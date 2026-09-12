// Real proxy implementation, synthetic identity/DB only. No network or provider.
const fs = require('node:fs');
const vm = require('node:vm');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const ts = require('typescript');
const {NextResponse} = require('next/server');
const sid='11111111-1111-4111-8111-111111111111';
const aid='22222222-2222-4222-8222-222222222222';
const secret='synthetic-test-not-a-real-credential';
const signed='v1.'+sid+'.'+crypto.createHmac('sha256',secret).update('v1:'+sid).digest('base64url');
const token='x.'+Buffer.from(JSON.stringify({session_id:aid})).toString('base64url')+'.x';
function load(file,mocks,logs){
  const mod={exports:{}};
  const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
  vm.runInNewContext(code,{module:mod,exports:mod.exports,require:n=>{if(!(n in mocks))throw Error('Unexpected import '+n);return mocks[n];},process:{env:{NODE_ENV:'production',APP_SESSION_SECRET:secret}},crypto:crypto.webcrypto,TextEncoder,Headers,URL,Date,atob,btoa,console:{warn:(...v)=>logs.push(v)},fetch:()=>{throw Error('NETWORK_FORBIDDEN');}});
  return mod.exports;
}
async function run(o={}){
  const logs=[];
  const rows={account_sessions:{id:sid,device_id:'synthetic',auth_session_id:aid,status:'active',expires_at:'2099-01-01',...o.session},account_devices:{verified_at:'2026-01-01',verification_required:false,revoked_at:null,...o.device},account_security_state:{...o.security}};
  if(o.missingTable)rows[o.missingTable]=null;
  const admin={from:table=>{const q={select:()=>q,eq:()=>q,update:()=>q,is:()=>q,maybeSingle:async()=>{if(o.throwTable===table)throw new TypeError('fetch failed');return table===o.errorTable?{data:null,error:o.error||{code:'PGRST003'}}:{data:rows[table],error:null};}};return q;}};
  const auth={getUser:async()=>({data:{user:o.noUser?null:{id:'synthetic-user',email_confirmed_at:o.unconfirmed?null:'2026-01-01'}},error:o.userError||null}),getSession:async()=>({data:{session:{access_token:o.badAuthToken?'invalid':token}},error:o.sessionError||null})};
  const policy=load('src/lib/security/sessionReadFailure.ts',{},logs);
  const proxy=load('src/proxy.ts',{'@supabase/ssr':{createServerClient:()=>({auth})},'@supabase/supabase-js':{createClient:()=>admin},'next/server':{NextResponse},'./lib/security/sessionReadFailure':policy},logs).proxy;
  const url=new URL('https://synthetic.invalid'+(o.path||'/dna-asistani'));
  const cookie=o.cookie===undefined?signed:o.cookie;
  const response=await proxy({url:String(url),nextUrl:url,headers:new Headers(o.prefetch?{'next-router-prefetch':'1'}:{}),cookies:{get:n=>n==='sm_active_session'&&cookie?{value:cookie}:undefined,getAll:()=>[]}});
  assert.ok(!JSON.stringify(logs).includes(signed));assert.ok(!JSON.stringify(logs).includes(token));
  return {response,logs};
}
let passed=0;
async function check(name,options,status,deleted,stage){
  const {response,logs}=await run(options);
  assert.equal(response.status,status,name);
  assert.equal(response.cookies.get('sm_active_session')?.value==='',deleted,name);
  if(status===503){assert.equal(response.headers.get('location'),null);assert.match(response.headers.get('cache-control'),/no-store/);assert.match(await response.text(),/Oturum şu anda doğrulanamıyor/);}
  if(stage)assert.ok(logs.some(l=>l[1]?.stage===stage),name);
  console.log('PASS '+name);passed++;
}
(async()=>{
  await check('valid session admitted',{},200,false);
  for(const path of ['/dna-asistani','/reports','/starter']){
    for(const table of ['account_sessions','account_devices','account_security_state']){
      const stage={account_sessions:'session_record',account_devices:'device_record',account_security_state:'security_state'}[table];
      await check('prefetch read failure preserves cookie '+path+' '+table,{path,prefetch:true,errorTable:table},503,false,stage);
    }
  }
  for(const table of ['account_sessions','account_devices','account_security_state'])
    await check('thrown dependency failure fails closed '+table,{throwTable:table},503,false,'unexpected_dependency');
  await check('unknown DB error never admits or erases session',{errorTable:'account_sessions',error:{code:'42501',message:'secret details'}},503,false,'session_record');
  await check('auth service failure preserves session',{userError:{status:503}},503,false,'auth_user');
  await check('auth session read failure preserves session',{sessionError:{code:'ETIMEDOUT'}},503,false,'auth_session');
  for(const [name,options] of [
    ['missing cookie',{cookie:''}],['invalid signature',{cookie:signed+'x'}],
    ['revoked session',{session:{status:'revoked'}}],['expired session',{session:{expires_at:'2000-01-01'}}],
    ['missing session',{missingTable:'account_sessions'}],['different auth session',{session:{auth_session_id:sid}}],
    ['missing auth binding',{badAuthToken:true}],['revoked device',{device:{revoked_at:'2026-01-01'}}],
    ['unverified device',{device:{verification_required:true}}],['missing device',{missingTable:'account_devices'}],
    ['locked account',{security:{temporary_locked_until:'2099-01-01'}}],['suspended account',{security:{suspended_at:'2026-01-01'}}],
    ['legacy unsigned cookie',{cookie:sid}]
  ])await check(name+' still denied',options,307,true);
  await check('unauthenticated still denied',{noUser:true},307,false);
  await check('unconfirmed still denied',{unconfirmed:true},307,false);
  await check('next independent valid request revalidates successfully',{},200,false);
  console.log(JSON.stringify({passed,failed:0,networkCalls:0,providerCalls:0,scope:'proxy availability and security regression'}));
})().catch(e=>{console.error(e);process.exitCode=1;});
