// Transport/provenance wrapper only. The frozen official runner owns scoring,
// normalization, history, stop order and its original USD 0.35 logical usage cap.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {createHash}=require('node:crypto'),{execFileSync}=require('node:child_process');
const hash=x=>createHash('sha256').update(x).digest('hex'),fileHash=p=>hash(fs.readFileSync(p));
const json=p=>JSON.parse(fs.readFileSync(p)),compiled=path.resolve('.tmp/dna-student-full602-visible');
const root='/Volumes/ResearchSSD/Outputs/SelfMetaAI/DNA_B1_BOUNDED_CLOSEOUT_20260908';
const replayRoot='/Volumes/ResearchSSD/Outputs/SelfMetaAI/dna-student-application-replay';
const approvalFile='docs/dna-intelligence/completion-program/B1_RELATION_MINI24_EGRESS_OWNER_APPROVAL_20260909.json';
const fixtureRoot='.tmp/dna-chat-natural-production-20260824/deliverables/DNA_CHAT_NATURAL_PRODUCTION_20260824/02_NATURAL_MINI24';
const runner='scripts/run-dna-student-mini24-visible.ts';
const b=require('./dna-b1-prompt-scope-budget.cjs');
const identity=require(`${compiled}/scripts/dna-student-candidate-identity.js`);
const replayApi=require(`${compiled}/scripts/dna-student-application-replay.js`);
const journals=require(`${compiled}/scripts/dna-student-replay-journal.js`);
const {reserveStabilizationRequest}=require(`${compiled}/scripts/dna-stabilization-budget.js`);
const {calculateDnaChatLunaUsage}=require(`${compiled}/src/lib/dna/chat/lunaUsage.js`);
const key=b.requestKey,write=(name,value)=>fs.writeFileSync(`${root}/${name}`,JSON.stringify(value,null,2)+'\n',{flag:'wx',mode:0o600});
function files(dir,depth=3){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>{
 const p=path.join(dir,e.name);return e.isDirectory()&&depth>0?files(p,depth-1):e.isFile()&&p.endsWith('.jsonl')?[p]:[];
});}
function records(file){const raw=fs.readFileSync(file,'utf8');
 journals.createStudentReplayJournal({read:()=>raw,append:()=>{throw Error('read_only');}});
 return raw.split('\n').filter(Boolean).map(JSON.parse);
}
function judgeContent(input){
 const g=input.gold,c=input.contract,p=input.plan,required=g.requiredReferent??g.requiredHistoryAnchor;
 return {recentVisibleConversation:input.visibleHistory.slice(-8),requiredOlderTurn:required?input.visibleHistory.find(r=>r.turnId===required)??null:null,
  currentStudentMessage:g.rawUserMessage,immutableGold:g,implementationContractForTraceOnly:c?{
   operation:c.semanticTask,activeTargetIds:c.targetIds,rejectedTargetIds:c.rejectedTargetIds,referent:c.referent}:null,
  lockedEvidence:p?.targetEvidence??null,policyUnits:p?.policyUnits??null,visibleAnswer:input.answer};
}
function expectedJudge(offline,gold,turnId){
 const row=offline.rows.find(r=>r.turnId===turnId);assert.ok(row,'out_of_scope_turn');
 const receipt=offline.receipts.find(r=>r.receiptSha256===row.receiptSha256);assert.ok(receipt);
 const g=gold.rows.find(r=>r.turnId===turnId);assert.ok(g);assert.equal(g.rawUserMessage,row.question);
 const history=offline.rows.filter(r=>r.conversationId===row.conversationId&&r.turnId<turnId)
  .map(r=>({turnId:r.turnId,user:r.question,assistant:r.answer}));
 const c=receipt.student?.contract??null,p=receipt.student?.result.plan??null,required=g.requiredReferent??g.requiredHistoryAnchor;
 return {recentVisibleConversation:history.slice(-8),requiredOlderTurn:required?history.find(r=>r.turnId===required)??null:null,
  currentStudentMessage:g.rawUserMessage,immutableGold:g,implementationContractForTraceOnly:c?{
   operation:c.semanticTask,activeTargetIds:c.targetIds,rejectedTargetIds:c.rejectedTargetIds,referent:c.referent}:null,
  lockedEvidence:p?.targetEvidence??null,policyUnits:p?.policyUnits??null,visibleAnswer:row.answer};
}
function prepare(){
 assert.equal(fs.realpathSync('/Volumes/ResearchSSD'),'/Volumes/ResearchSSD');
 const approval=json(approvalFile),freezeFile=`${root}/relation-request-closeout.json`,freeze=json(freezeFile);
 assert.equal(fileHash(freezeFile),approval.candidateFreezeSha256);assert.equal(identity.studentCandidateSha256(),approval.candidateSourceSha256);
 assert.equal(freeze.candidate,approval.candidateSourceSha256);assert.equal(approval.totalApiHardCapUsd,20);
 assert.equal(approval.maximumNewCalls,40);assert.equal(approval.maximumCumulativeLedgerCalls,659);
 assert.equal(approval.destination,'https://api.openai.com/v1/responses');assert.equal(approval.reuseExistingKey,true);
 assert.equal(approval.store,false);assert.equal(approval.model,'gpt-5.6-luna');assert.equal(approval.reasoning,'none');
 assert.equal(approval.newUnknownCallPolicy,'STOP');assert.equal(approval.deployApproved,false);
 const offlineFile=`${root}/relation-mini24-offline.json`,offline=json(offlineFile);
 assert.equal(fileHash(offlineFile),'2582c7f334ce60b49644b4b4d068c3a0d9260f8573f064ce5a2c0ced4beceb45');
 const goldFile=`${fixtureRoot}/NATURAL_MINI24_GOLD.json`,fixtureFile=`${fixtureRoot}/NATURAL_MINI24_FIXTURE.json`,gold=json(goldFile);
 assert.equal(fileHash(goldFile),'2a54904a77979b381948d7815f832013720b127a4199989087b9e3183723bc50');
 assert.equal(fileHash(fixtureFile),'9f146c18fe4cccf2a54aa4fa4aecd038dfecff3aee81e751f2308e6ea3845adc');
 assert.equal(fileHash(b.auditFile),b.auditPin);const proof=json(b.auditFile),recovery=json(b.approvalFile);
 const priorFile='/Volumes/ResearchSSD/Outputs/SelfMetaAI/dna-student-stabilization-20260908/interruption-audit.json';
 assert.equal(fileHash(priorFile),'5d66c80629a67c407d6c7e19c1388f00cc3ea8585712b574f63806187c9b197f');
 const prior=json(priorFile),initial=b.inspectLedger(fs.readFileSync(proof.budgetFile,'utf8'),proof,recovery,prior);
 assert.equal(fileHash(proof.budgetFile),approval.budgetBefore.ledgerSha256);assert.equal(initial.calls,619);assert.equal(initial.spent,2266411);
 const replay=replayApi.studentApplicationReplaySha256([runner,fixtureFile,goldFile]),candidate=freeze.candidate;
 const pins={...freeze.pins,[approvalFile]:fileHash(approvalFile),[freezeFile]:fileHash(freezeFile),[__filename]:fileHash(__filename),
  [offlineFile]:fileHash(offlineFile),[runner]:fileHash(runner),[b.auditFile]:fileHash(b.auditFile),[b.approvalFile]:fileHash(b.approvalFile),
  [priorFile]:fileHash(priorFile),['scripts/dna-b1-prompt-scope-budget.cjs']:fileHash('scripts/dna-b1-prompt-scope-budget.cjs')};
 for(const f of ['scripts/run-dna-student-mini24-visible.js','scripts/dna-student-application-replay.js','scripts/dna-student-replay-journal.js',
  'src/lib/dna/chat/s13/server.js','src/lib/dna/chat/studentFirst/answerExecutor.server.js'])pins[`${compiled}/${f}`]=fileHash(`${compiled}/${f}`);
 const rawCache=new Map(),rawEvents=new Map(),historicalJudges=new Map(),priorBudgetHashes=new Set();
 const allFiles=[...new Set([...files(replayRoot),...offline.uses.map(u=>u.file)])].sort();
 for(const file of allFiles){
  const events=records(file);pins[file]=fileHash(file);rawEvents.set(file,events);
  const priorHistory=[];let priorConversation=null;
  for(const e of events){
   const v=e.value;if(file===proof.budgetFile){if(v===undefined){/* input content is deliberately not stored in budget events */}continue;}
   if(file.endsWith(`/${replay}/mini24.jsonl`)&&e.stage==='completed'&&!e.key.endsWith(':judge')&&v?.visibleAnswer){
    const g=gold.rows.find(r=>r.turnId===e.key);assert.ok(g);
    if(priorConversation!==g.conversationId){priorHistory.length=0;priorConversation=g.conversationId;}
    priorHistory.push({turnId:e.key,user:g.rawUserMessage,assistant:v.visibleAnswer,receipt:v});
   }
   if(file.endsWith(`/${replay}/mini24.jsonl`)&&e.key.endsWith(':judge')){
    const last=priorHistory.at(-1);assert.equal(last?.turnId,e.key.slice(0,-6));
    const oldInput={gold:gold.rows.find(r=>r.turnId===last.turnId),answer:last.assistant,contract:last.receipt.student?.contract??null,
     plan:last.receipt.student?.result.plan??null,visibleHistory:priorHistory.slice(0,-1).map(({receipt,...r})=>r)};
    assert.equal(hash(JSON.stringify(oldInput)),e.inputSha256,'old_judge_input_reconstruction_mismatch');
    const k=`${e.key}:${hash(JSON.stringify(judgeContent(oldInput)))}`;
    const entries=historicalJudges.get(k)??[];entries.push({event:e,file});historicalJudges.set(k,entries);
   }
   if(e.stage!=='completed'||!v?.request||!v?.body)continue;
   const r={...v.request,model:v.body.model,store:v.body.store,reasoning:{effort:v.body.reasoning?.effort},max_output_tokens:v.body.max_output_tokens};
   if(r.model!=='gpt-5.6-luna'||r.store!==false||r.reasoning.effort!=='none')continue;
   const k=key(r);const old=rawCache.get(k);
   if(!old)rawCache.set(k,{value:v,file,eventSha256:e.valueSha256});
   else if(old.eventSha256!==e.valueSha256)old.conflicting=true;
  }
 }
 // Exact answer response selection is inherited from the frozen controller,
 // not from whichever historical draw looks best.
 for(const use of offline.uses){const e=rawEvents.get(use.file).find(e=>e.stage==='completed'&&e.valueSha256===use.eventSha256);assert.ok(e);
  const v=e.value;assert.equal(key({...v.request,model:v.body.model,store:v.body.store,reasoning:{effort:v.body.reasoning.effort},max_output_tokens:v.body.max_output_tokens}),use.key);
  rawCache.set(use.key,{value:v,file:use.file,eventSha256:use.eventSha256,boundAnswer:true});
 }
 // Started calls carry only an input hash; completion pairs do not recover their
 // payload. The two known unknown request identities are explicitly excluded.
 for(const p of [proof,prior])if(p.recoveredInput?.requestSha256)priorBudgetHashes.add(p.recoveredInput.requestSha256);
 const verify=()=>{assert.equal(identity.studentCandidateSha256(),candidate);for(const[p,h]of Object.entries(pins)){
  if(p!==proof.budgetFile)assert.equal(fileHash(p),h,p);
 }};verify();
 const head=execFileSync('/Library/Developer/CommandLineTools/usr/bin/git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();assert.equal(head,approval.gitHead);
 const expected=new Map(gold.rows.map(g=>[g.turnId,expectedJudge(offline,gold,g.turnId)]));
 const validateRequest=body=>{
  assert.equal(body.model,approval.model);assert.equal(body.store,false);assert.deepEqual(body.reasoning,{effort:'none'});
  assert.equal(body.text?.format?.name,'dna_student_frozen_natural_mini24_gold_judge','new_answer_generation_not_needed');
  assert.equal(body.max_output_tokens,1200);assert.equal(body.text.verbosity,'low');
  const input=JSON.parse(body.input),turnId=input.immutableGold?.turnId;assert.ok(expected.has(turnId));assert.deepEqual(input,expected.get(turnId),'egress_must_match_frozen_scope');
  assert.ok(!priorBudgetHashes.has(hash(JSON.stringify(body))));assert.notEqual(key(body),proof.recoveredProviderInput.requestSha256);
  return turnId;
 };
 const budgetStarts=rawEvents.get(proof.budgetFile).filter(e=>e.stage==='started');
 const forbidMissingOldRaw=body=>{const requestSha256=hash(JSON.stringify(body)),reservedMicrousd=reserveStabilizationRequest(body,0);
  for(const e of budgetStarts)assert.notEqual(hash(JSON.stringify({ordinal:Number(e.key.slice(5)),requestSha256,reservedMicrousd})),e.inputSha256,
   'identical_paid_request_exists_without_selected_raw_do_not_retry');
 };
 return {approval,freeze,offline,gold,proof,recovery,prior,initial,replay,candidate,pins,rawCache,historicalJudges,verify,head,expected,validateRequest,forbidMissingOldRaw};
}
async function main(){
 const p=prepare(),{candidate,replay,initial,verify}=p;
 const outputFile=`${root}/relation-mini24-gate-result.json`;
 assert.ok(!fs.existsSync(outputFile),'immutable_gate_result_already_exists');
 assert.ok(!fs.existsSync(`${replayRoot}/${candidate}/${replay}/mini24.jsonl`),'candidate_gate_already_started_no_reroll');
 const preflight={version:'dna-b1-relation-mini24-gate-transport@1',candidate,candidateIsCommit:false,head:p.head,replay,
  pins:p.pins,approvalFile,budgetBefore:initial,rawCacheEntries:p.rawCache.size,historicalJudgeInputs:p.historicalJudges.size,
  scoringRunnerUnchanged:true,gateScope:24,maximumNewCalls:40,cumulativeCapMicrousd:20000000,model:p.freeze.model,
  runtime:{node:process.version,typescript:require('typescript/package.json').version},
  worktreeAtStart:execFileSync('/Library/Developer/CommandLineTools/usr/bin/git',['status','--short'],{encoding:'utf8'})};
 if(process.argv.includes('--self-test')){
  let passed=0;const check=fn=>{fn();passed++;};
  for(const [id,input] of p.expected){
   const body={model:'gpt-5.6-luna',store:false,reasoning:{effort:'none'},input:JSON.stringify(input),max_output_tokens:1200,
    text:{verbosity:'low',format:{name:'dna_student_frozen_natural_mini24_gold_judge'}}};
   check(()=>assert.equal(p.validateRequest(body),id));
   for(const altered of [{...body,store:true},{...body,model:'unapproved'},{...body,max_output_tokens:6000},
    {...body,input:JSON.stringify({...input,visibleAnswer:input.visibleAnswer+' changed'})},
    {...body,input:JSON.stringify({...input,extraProductionRecord:'forbidden'})}])check(()=>assert.throws(()=>p.validateRequest(altered)));
  }
  for(const use of p.offline.uses)check(()=>assert.equal(p.rawCache.get(use.key)?.eventSha256,use.eventSha256));
  console.log(JSON.stringify({wrapperControls:passed,externalCalls:0,candidate,scope:'transport_scope_and_exact_cache_only_not_product_or_semantic_tests'}));return;
 }
 if(!process.argv.includes('--run')){console.log(JSON.stringify({...preflight,pins:undefined,worktreeAtStart:undefined,pinsCount:Object.keys(p.pins).length}));return;}
 require('dotenv').config({path:'.env.local',quiet:true,override:false});assert.ok(process.env.OPENAI_API_KEY?.trim());
 assert.ok(!process.env.VERCEL_ENV&&process.env.NODE_ENV!=='production'&&!process.env.DNA_MINI24_ONLY_TURN);
 Object.assign(process.env,{NODE_ENV:'test',DNA_CHAT_STUDENT_LOCAL_CANDIDATE:'1',
  DNA_S13_LIMITED_ROLLOUT_CONTEXT_SECRET:'relation-mini24-gate-synthetic-context-32'});
 write('relation-mini24-gate-preflight.json',{...preflight,startedAtUtc:new Date().toISOString()});
 const id=hash('dna-b1-stabilization-user-approved-20usd-20260907'),budget=journals.openStudentReplayJournal('budget',id,id);
 assert.equal(fileHash(budget.file),p.approval.budgetBefore.ledgerSha256);
 const raw=journals.openStudentReplayJournal('mini24-provider-raw',candidate,replay),uses=[],judgeUses=[],scopeStops=[];
 const originalFetch=globalThis.fetch,originalOpen=journals.openStudentReplayJournal,originalLog=console.log,originalError=console.error;
 let spent=initial.spent,calls=initial.calls,stopped=false,runnerResult=null,runnerError=null;
 // Reuse a prior official judgment only with identical judgeInput AND the
 // identical original replay/harness identity. Ambiguity is a stop, never a vote.
 journals.openStudentReplayJournal=(suite,c,r)=>{
  const opened=originalOpen(suite,c,r);if(suite!=='mini24')return opened;
  const once=opened.journal.once.bind(opened.journal);
  opened.journal.once=(k,input,run)=>once(k,input,async()=>{
   if(!k.endsWith(':judge'))return run();
   const prior=p.historicalJudges.get(`${k}:${hash(JSON.stringify(judgeContent(input)))}`);
   if(prior){const completed=prior.filter(x=>x.event.stage==='completed');
    assert.ok(completed.length&&completed.length*2===prior.length,'old_indeterminate_judge_do_not_retry');
    assert.equal(new Set(completed.map(x=>x.event.valueSha256)).size,1,'conflicting_old_judgments_no_favorable_selection');
    judgeUses.push({key:k,kind:'EXACT_OLD_OFFICIAL_JUDGE_INPUT_AND_RUNNER',source:completed[0].file,eventSha256:completed[0].event.valueSha256});
    return completed[0].event.value;
   }return run();
  });return opened;
 };
 globalThis.fetch=async(url,init)=>{
  assert.ok(!stopped,'new_usage_uncertainty_stop');assert.equal(String(url),p.approval.destination);
  const request=JSON.parse(String(init.body)),k=key(request),cached=p.rawCache.get(k);
  if(cached){assert.ok(!cached.conflicting,'conflicting_cached_provider_draws');uses.push({kind:'EXACT_RAW_CACHE',key:k,file:cached.file,eventSha256:cached.eventSha256});
   return Response.json(cached.value.body,{status:cached.value.status});}
  let turnId;try{turnId=p.validateRequest(request);p.forbidMissingOldRaw(request);verify();}catch(e){scopeStops.push({reason:e.message,key:k});throw e;}
  assert.ok(calls<659&&calls-initial.calls<40);const reserve=reserveStabilizationRequest(request,spent),ordinal=++calls;
  const budgetInput={ordinal,requestSha256:hash(String(init.body)),reservedMicrousd:reserve};let response,transportError;
  const charge=await budget.journal.once(`call-${ordinal}`,budgetInput,async()=>{
   const v=await raw.journal.once(k,{turnId,request},async()=>{
    try{response=await originalFetch(url,init);return {turnId,request,status:response.status,body:await response.clone().json(),secretsRecorded:false};}
    catch(e){transportError=e;return {turnId,request,status:null,body:null,transportErrorName:e.name,secretsRecorded:false};}
   });
   const u=v.body?.usage,cachedTokens=u?.input_tokens_details?.cached_tokens??0;
   const exact=response?.ok&&Number.isSafeInteger(u?.input_tokens)&&Number.isSafeInteger(u?.output_tokens)&&Number.isSafeInteger(cachedTokens)
    &&u.input_tokens>=0&&u.output_tokens>=0&&cachedTokens>=0&&cachedTokens<=u.input_tokens;
   const actual=exact?calculateDnaChatLunaUsage({inputTokens:u.input_tokens,cachedInputTokens:cachedTokens,outputTokens:u.output_tokens}).costMicrousd:reserve;
   uses.push({kind:'NEW_JUDGE',turnId,key:k,ordinal,file:raw.file,eventSha256:hash(JSON.stringify(v))});
   return {chargedMicrousd:actual,exactUsage:!!exact,httpStatus:v.status,reservationExceeded:actual>reserve};
  });
  spent+=charge.chargedMicrousd;stopped=!charge.exactUsage||charge.reservationExceeded||spent>20000000;
  originalLog(JSON.stringify({stage:'Mini24_judge',turnId,newCalls:calls-initial.calls,usageKnown:charge.exactUsage}));
  if(transportError)throw transportError;assert.ok(response,'prior_attempt_never_resent');return response;
 };
 console.log=message=>{try{runnerResult=JSON.parse(message);}catch{runnerError={failure:'unstructured_runner_output'};}};
 console.error=message=>{try{runnerError=JSON.parse(message);}catch{runnerError={failure:'unstructured_runner_error'};}};
 process.once('beforeExit',()=>{
  console.log=originalLog;console.error=originalError;globalThis.fetch=originalFetch;journals.openStudentReplayJournal=originalOpen;
  let integrity='PASS';try{verify();}catch(e){integrity=e.message;process.exitCode=1;}
  const result={...preflight,completedAtUtc:new Date().toISOString(),runnerResult,runnerError,integrity,uses,judgeUses,scopeStops,
   rawJournal:raw.file,rawJournalSha256:fs.existsSync(raw.file)?fileHash(raw.file):null,
   currentGateJournal:runnerResult?.journalPath??null,currentGateJournalSha256:runnerResult?.journalPath?fileHash(runnerResult.journalPath):null,
   budgetAfter:{conservativeMicrousd:spent,knownMicrousd:spent-initial.heldUnknownMicrousd,heldUnknownMicrousd:initial.heldUnknownMicrousd,
    calls,newCalls:calls-initial.calls,newChargedMicrousd:spent-initial.spent,usageUncertainStop:stopped,ledgerSha256:fileHash(budget.file)},
   cachedUsageInOriginalGateIsNotNewBill:true,productCodeChanged:false,criteriaChanged:false,productionChanged:false,
   releaseDecision:runnerResult?.ok&&integrity==='PASS'?'MINI24_ONLY_PASS_LATER_GATES_REQUIRED':'BLOCKED_AT_MINI24'};
  write('relation-mini24-gate-result.json',result);
  originalLog(JSON.stringify({output:outputFile,candidate,ok:runnerResult?.ok??false,passTurns:runnerResult?.passTurns,
   firstFailure:runnerResult?.firstFailure?.turnId??runnerError?.failure,budget:result.budgetAfter,integrity}));
 });
 require(`${compiled}/scripts/run-dna-student-mini24-visible.js`);
}
main().catch(e=>{console.error(String(e));process.exitCode=1;});
