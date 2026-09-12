const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
let passed = 0;
function load(file, mocks = {}) {
  const module = { exports: {} };
  const js = ts.transpileModule(fs.readFileSync(path.join(process.cwd(), file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 }
  }).outputText;
  vm.runInNewContext(js, { module, exports: module.exports,
    require: name => Object.hasOwn(mocks, name) ? mocks[name] : require(name),
    process: { env: { NODE_ENV: 'test', APP_SESSION_SECRET: 'local-fixture-not-a-real-secret-123456789' } },
    Buffer, Date, console: { warn() {}, error() {} } }, { filename: file });
  return module.exports;
}
const policy = load('src/lib/security/sessionReadFailure.ts');
async function check(label, fn) { await fn(); passed++; console.log('PASS ' + label); }
function guard(sequence, options = {}) {
  let calls = 0;
  const user = { id: 'synthetic-user', email_confirmed_at: '2026-01-01' };
  const api = load('src/lib/security/apiGuards.ts', {
    'server-only': {}, 'next/headers': {},
    'next/server': { NextResponse: { json: (body, init) => ({ body, status: init.status, headers: init.headers }) } },
    '@/lib/security/appSession': { verifyCurrentAppSession: async () => sequence[Math.min(calls++, sequence.length - 1)] },
    '@/lib/supabase/server': { createSupabaseServerClient: async () => ({ auth: { getUser: async () => ({data: {user: options.user === undefined ? user : options.user}, error: null}) } }) }
  });
  return { run: value => api.requireConfirmedUser(value), calls: () => calls };
}
const transient = { ok: false, reason: 'error', stage: 'session_record', code: 'PGRST003', transient: true };
(async () => {
  for (const error of [{code:'PGRST003'}, {code:'ETIMEDOUT'}, {status:503}, {code:'',message:'TypeError: fetch failed'}])
    await check('transient transport classification', () => assert.equal(policy.sessionReadFailure(error).transient, true));
  for (const error of [{code:'42501'}, {status:401,message:'fetch failed'}, {status:403}, {code:'PGRST116'}, {message:'invalid JWT'}, {code:'untrusted value / token'}])
    await check('no retry for denial or unknown error', () => assert.equal(policy.sessionReadFailure(error).transient, false));
  await check('legacy consumers unchanged, no retry', async () => {
    const g=guard([transient]); assert.equal((await g.run()).response.status,401); assert.equal(g.calls(),1);
  });
  await check('Chat recovers once only after full successful validation', async () => {
    const g=guard([transient,{ok:true}]); assert.equal((await g.run({recoverSessionRead:true})).ok,true); assert.equal(g.calls(),2);
  });
  await check('exhausted transient read stays denied as unavailable', async () => {
    const g=guard([transient]); const r=await g.run({recoverSessionRead:true}); assert.equal(r.response.status,503);
    assert.equal(r.response.body.error,'auth_service_unavailable'); assert.equal(g.calls(),2);
  });
  await check('non-transient DB failure denied without retry', async () => {
    const g=guard([{...transient,transient:false,code:'42501'}]); assert.equal((await g.run({recoverSessionRead:true})).response.status,503); assert.equal(g.calls(),1);
  });
  for (const reason of ['missing','invalid','expired','locked','suspended']) await check('never retry '+reason, async () => {
    const g=guard([{ok:false,reason}]); assert.equal((await g.run({recoverSessionRead:true})).response.status,401); assert.equal(g.calls(),1);
  });
  await check('revocation between attempts never admitted', async () => {
    const g=guard([transient,{ok:false,reason:'invalid'}]); assert.equal((await g.run({recoverSessionRead:true})).response.status,401); assert.equal(g.calls(),2);
  });
  await check('no user never reaches session lookup', async () => {
    const g=guard([{ok:true}],{user:null}); assert.equal((await g.run({recoverSessionRead:true})).response.status,401); assert.equal(g.calls(),0);
  });
  // Exercise real session validation with synthetic DB clients; no live data or network.
  const sid='11111111-1111-4111-8111-111111111111';
  for (const stage of ['account_sessions','account_devices','account_security_state']) await check('real session stage attribution '+stage, async () => {
    let session;
    const rows={account_sessions:{id:sid,device_id:'device',auth_session_id:'auth',status:'active',expires_at:'2099-01-01',last_seen_at:new Date().toISOString()},account_devices:{id:'device',verification_required:false,verified_at:'2026-01-01',revoked_at:null},account_security_state:{}};
    const admin={from: table => { const q={select:()=>q,eq:()=>q,maybeSingle:async()=> table===stage ? {data:null,error:{code:'PGRST003'}} : {data:rows[table],error:null}}; return q; }};
    session=load('src/lib/security/appSession.ts', {
      'server-only': {}, 'next/server': {},
      'next/headers': {cookies:async()=>({get:()=>({value:session.createAppSessionCookieValue(sid)})}),headers:async()=>new Map()},
      '@/lib/security/sessionReadFailure':policy,
      '@/lib/security/authSessionBinding':{extractSupabaseAuthSessionId:()=> 'auth'},
      '@/lib/security/anomalyDetection':{isSecurityLockExemptUser:async()=>false},
      '@/lib/supabase/admin':{createSupabaseAdminClient:()=>admin},
      '@/lib/supabase/server':{createSupabaseServerClient:async()=>({auth:{getSession:async()=>({data:{session:{access_token:'synthetic'}},error:null})}})}
    });
    const r=await session.verifyCurrentAppSession('synthetic-user'); assert.equal(r.reason,'error'); assert.equal(r.transient,true);
    assert.equal(r.stage,{account_sessions:'session_record',account_devices:'device_record',account_security_state:'security_state'}[stage]);
  });
  const route=fs.readFileSync('src/app/api/app/dna-chat/route.ts','utf8');
  await check('Chat preserves availability status instead of manufacturing expired session',()=> {
    assert.match(route,/response.status === 503 && rawError === "auth_service_unavailable"/);
    assert.match(route,/requireConfirmedUser\(\{ recoverSessionRead: true \}\)/);
  });
  await check('manual retry handler accepts availability error without automatic submission',()=> {
    const ui=fs.readFileSync('src/app/dna-asistani/DnaAssistantClient.tsx','utf8');
    const handler=ui.slice(ui.indexOf('function retryLastQuestion()'),ui.indexOf('const hasConversation'));
    assert.match(handler,/auth_service_unavailable/); assert.match(handler,/appendUser: false/);
    assert.match(ui,/Oturum şu anda doğrulanamıyor/);
  });
  console.log(JSON.stringify({passed,failed:0,networkCalls:0}));
})().catch(error=>{console.error(error);process.exitCode=1;});
