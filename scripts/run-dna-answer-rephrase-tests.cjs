const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),Module=require('node:module'),ts=require('typescript');
const resolve=Module._resolveFilename,load=Module._load;
Module._resolveFilename=function(n,...a){return resolve.call(this,n.startsWith('@/')?path.resolve('src',n.slice(2)):n,...a)};
Module._load=function(n,...a){return n==='server-only'?{}:load.call(this,n,...a)};
require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,f);
global.fetch=()=>{throw Error('NETWORK_FORBIDDEN')};
const {resolveStudentEvidenceFirstRequest:resolveRequest}=require('../src/lib/dna/chat/studentFirst/evidenceFirstRequest.ts');
const {createEmptyStudentConversationState:empty,applyStudentRequestContract:apply}=require('../src/lib/dna/chat/studentFirst/conversationState.ts');
const {createStudentApplicationReplaySession:session}=require('./dna-student-application-replay.ts');
const {buildStudentAnswerExecutionPlan:planFor}=require('../src/lib/dna/chat/studentFirst/answerExecution.ts');
const {executeStudentAnswer:execute}=require('../src/lib/dna/chat/studentFirst/answerExecutor.server.ts');
const {studentCandidateSha256}=require('./dna-student-candidate-identity.ts');
let count=0,mockCalls=0;
function request(message,state=empty()){const r=resolveRequest({message,state,turnId:'local-'+ ++count});assert.ok(r.ok);return r;}
async function composer(input){const plan=planFor(input);return execute({...input,apiKey:'synthetic-not-a-secret',fetchImpl:async(_u,init)=>{
  mockCalls++;const body=JSON.parse(JSON.parse(String(init.body)).input);
  return Response.json({output_text:JSON.stringify({blocks:Object.fromEntries(body.answerSlots.map(slot=>[slot.slotId,slot.relationComposition?{requestFocus:'definition_difference',scopeOrder:'not_ordered'}:plan.targetEvidence.map(t=>t.claims[0].text).join(' ')])),illustrationKind:'none'}),usage:{input_tokens:1,output_tokens:1}});
}})}
async function main(){
  const state=apply(apply(empty(),request('Çalışma belleği nedir?').contract),request('Çalışma belleği ile kısa süreli belleği karşılaştır.').contract);
  for(const message of ['Son cevabı daha sade anlatır mısın?','Önceki yanıtı daha basit açıklar mısın?','Az önceki açıklamayı kısaltır mısın?','Bunu daha sade anlat','Son yanıtı yeniden söyle']){
    const r=request(message,state);
    assert.equal(r.contract.referent.kind,'active',JSON.stringify({message,contract:r.contract}));
    assert.equal(r.contract.presentation.preserveMeaning,true,message);
    assert.equal(r.contract.semanticTask,'compare',message);
    assert.deepEqual([...r.contract.targetIds].sort(),['short_term_memory','working_memory']);
    assert.ok(r.contract.obligations.some(o=>o.kind==='distinguish_targets'));
  }
  const changed=request('Son cevabı bırak, inhibisyon nedir?',state);assert.deepEqual(changed.contract.targetIds,['inhibition']);
  assert.equal(request('Son cevabı daha sade anlat',empty()).contract.referent.kind,'none');
  assert.equal(request('Teşekkürler',state).facts.presentation.preserveMeaning,false);
  assert.equal(request('Çalışma belleğini ilk kez sade anlat',empty()).facts.presentation.preserveMeaning,false);
  const s=session({candidateSha256:studentCandidateSha256(),replaySha256:'1'.repeat(64),sessionId:'local-rephrase',secret:'synthetic-secret-long-enough-for-local-only',execute:composer,interpretScope:async()=>{throw Error('UNEXPECTED_SCOPE_PROVIDER')}});
  for(const question of ['Çalışma belleği nedir? Kısa ve sade anlatır mısın?','Peki kısa süreli bellekten farkı ne?','Son cevabı daha sade anlatır mısın?']){
    const r=await s.turn({question});assert.equal(r.status,200,JSON.stringify(r));assert.equal(r.body.runtimeGeneration,'student_first_candidate');assert.ok(r.visibleAnswer);assert.ok(!r.visibleAnswer.includes('yeterli içerik'));
    if(question.startsWith('Son'))assert.equal(r.student.contract.semanticTask,'compare');
  }
  console.log(JSON.stringify({pass:true,requestChecks:count,applicationTurns:3,mockedComposerCalls:mockCalls,externalCalls:0}));
}
Object.assign(process.env,{NODE_ENV:'test',DNA_CHAT_STUDENT_LOCAL_CANDIDATE:'1',DNA_CHAT_RUNTIME_RELEASE:'v2',DNA_CHAT_V3_KILL_SWITCH:'0',DNA_CHAT_V3_ROLLOUT_PERCENT:'0'});delete process.env.VERCEL_ENV;
main().catch(e=>{console.error(e);process.exitCode=1});
