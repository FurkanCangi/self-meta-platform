// Prospective V1 subset only; unchanged product and existing judges. No old answer cache.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),Module=require('node:module');
const {createHash}=require('node:crypto'),{execFileSync}=require('node:child_process');
const root='/Volumes/ResearchSSD/Outputs/SelfMetaAI/DNA_CHAT_V1_RELEASE_20260910',compiled=root+'/compiled',doc='docs/dna-intelligence/completion-program';
const json=p=>JSON.parse(fs.readFileSync(p)),h=x=>createHash('sha256').update(x).digest('hex'),fh=p=>h(fs.readFileSync(p));
const manifestFile=doc+'/DNA_CHAT_V1_ACCEPTANCE_MANIFEST_20260910.json',manifest=json(manifestFile),policy=doc+'/DNA_CHAT_V1_RELEASE_POLICY_20260910.md';
const identity=require(compiled+'/scripts/dna-student-candidate-identity.js'),candidate=identity.studentCandidateSha256();
assert.equal(candidate,manifest.candidateSource);
const head=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
assert.equal(execFileSync('git',['status','--porcelain'],{encoding:'utf8'}).trim(),'','release_checkout_must_be_clean');
const replayId=h(JSON.stringify({head,candidate,manifest:fh(manifestFile),policy:fh(policy),runner:fh(__filename)}));
const replay=require(compiled+'/scripts/dna-student-application-replay.js'),evalInput=require(compiled+'/scripts/dna-student-visible-evaluation-input.js');
const sourceJudge=require(compiled+'/scripts/dna-student-visible-judge.js');
// Load existing Mini24 judge without executing its old stop-on-MINOR driver.
const miniFile=compiled+'/scripts/run-dna-student-mini24-visible.js',m=new Module(miniFile,module);m.filename=miniFile;m.paths=Module._nodeModulePaths(path.dirname(miniFile));
const miniSource=fs.readFileSync(miniFile,'utf8');assert.equal(miniSource.split('void main().catch').length,2);
m._compile(miniSource.slice(0,miniSource.indexOf('void main().catch'))+'\nmodule.exports.v1ExistingJudge=judge;',miniFile);
const oldBudget='/Volumes/ResearchSSD/Outputs/SelfMetaAI/dna-student-application-replay/f4ae56e52770ad71802d5862f06780a12ade0b1d20c1689c5b93d2b5e245f4ff/f4ae56e52770ad71802d5862f06780a12ade0b1d20c1689c5b93d2b5e245f4ff/budget.jsonl';
assert.equal(fh(oldBudget),'ac00c10700860ae852321dd3b053d679f39d86f511ec8a9976a2cb8abcf02f9b','baseline_ledger_changed');
const baseline={calls:718,conservativeMicrousd:2537784,sha256:fh(oldBudget)};
const reserve=require(compiled+'/scripts/dna-stabilization-budget.js').reserveStabilizationRequest;
const usageCost=require(compiled+'/src/lib/dna/chat/lunaUsage.js').calculateDnaChatLunaUsage;
const roles={dna_student_answer_executor:900,dna_student_context_scope:120,dna_student_long_visible_answer_judge:1000,dna_student_frozen_natural_mini24_gold_judge:1200};
const pins=Object.fromEntries([...identity.studentCandidateSourceFiles(),manifestFile,policy,__filename].map(p=>[p,fh(p)]));
const verify=()=>{assert.equal(identity.studentCandidateSha256(),candidate);assert.equal(execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),head);for(const[p,v]of Object.entries(pins))assert.equal(fh(p),v,p);assert.equal(fh(oldBudget),baseline.sha256);};
async function main(){
 verify();if(!process.argv.includes('--run')){console.log(JSON.stringify({candidate,head,turns:70,boundaries:manifest.boundaries.length,baseline,maximumNewRequests:400,releaseApproved:false}));return;}
 assert.ok(process.env.OPENAI_API_KEY?.trim());assert.ok(!process.env.VERCEL_ENV);
 // Exclusive immutable attempt: never automatically resume/reroll an existing attempt.
 const run=root+'/acceptance-attempt-1';fs.mkdirSync(run,{recursive:false});
 const write=(name,value)=>fs.writeFileSync(run+'/'+name,JSON.stringify(value,null,2)+'\n',{flag:'wx',mode:0o600});
 write('freeze.json',{candidate,head,replayId,pins,baseline,policyVersion:'DNA_CHAT_V1@1',noOldOutputReuse:true});
 Object.assign(process.env,{NODE_ENV:'test',DNA_CHAT_STUDENT_LOCAL_CANDIDATE:'1'});
 const originalFetch=globalThis.fetch,rows=[];let active=null,calls=0,spent=baseline.conservativeMicrousd,unknown=false,stop=null;
 globalThis.fetch=async(url,init)=>{
  assert.ok(active&&!unknown,'no_active_turn_or_unknown_usage');assert.equal(String(url),'https://api.openai.com/v1/responses');assert.equal(init.method,'POST');
  const request=JSON.parse(init.body),role=request.text?.format?.name;assert.ok(Object.hasOwn(roles,role),'unapproved_role');
  assert.equal(request.max_output_tokens,roles[role]);assert.equal(request.model,'gpt-5.6-luna');assert.equal(request.store,false);assert.deepEqual(request.reasoning,{effort:'none'});assert.equal(request.text.verbosity,'low');
  if(active.phase==='runtime'){assert.ok(['dna_student_answer_executor','dna_student_context_scope'].includes(role));assert.equal(JSON.parse(request.input).currentUserMessage,active.question);}
  else assert.ok(role.includes('judge'));
  verify();assert.ok(calls<400&&baseline.calls+calls<2884,'call_cap');const reserved=reserve(request,spent),ordinal=baseline.calls+(++calls);
  write(`call-${ordinal}-started.json`,{ordinal,active,role,request,reservedMicrousd:reserved,secretsRecorded:false});
  let response,body,errorName=null;try{response=await originalFetch(url,init);body=await response.clone().json();}catch(e){errorName=e.name;}
  const u=body?.usage,cached=u?.input_tokens_details?.cached_tokens??0;
  const exact=!!response?.ok&&Number.isSafeInteger(u?.input_tokens)&&Number.isSafeInteger(u?.output_tokens)&&u.input_tokens>=0&&u.output_tokens>=0&&Number.isSafeInteger(cached)&&cached>=0&&cached<=u.input_tokens;
  const charge=exact?usageCost({inputTokens:u.input_tokens,outputTokens:u.output_tokens,cachedInputTokens:cached}).costMicrousd:reserved;
  spent+=charge;unknown=!exact||charge>reserved||spent>20000000;
  write(`call-${ordinal}-completed.json`,{ordinal,active,role,status:response?.status??null,body:body??null,errorName,chargedMicrousd:charge,exactUsage:exact,reservationExceeded:charge>reserved});
  console.log(JSON.stringify({event:'provider',turn:active.id,role,ordinal,status:response?.status??null,usageKnown:exact}));
  if(unknown||!response)throw Error('provider_usage_uncertain_stop');return response;
 };
 try{
  outer:for(const conversation of manifest.sessions){
   const session=replay.createStudentApplicationReplaySession({candidateSha256:candidate,replaySha256:replayId,sessionId:conversation.id,secret:'dna-v1-synthetic-session-secret-at-least32'}),history=[];
   for(const turn of conversation.turns){
    const before=session.state(),startCalls=calls;active={phase:'runtime',id:turn.id,question:turn.question};
    const receipt=await session.turn({question:turn.question});write(turn.id+'-runtime.json',receipt);
    const record={id:turn.id,question:turn.question,critical:!!conversation.critical,boundary:manifest.boundaries.includes(turn.id),status:receipt.status,visibleAnswer:receipt.visibleAnswer,
     runtimeNewRequests:calls-startCalls,realComposerCalls:receipt.student?.result.provider.calls??0,fixture:turn,receiptFile:turn.id+'-runtime.json',hardViolations:[],verdict:null};
    rows.push(record);
    if(receipt.status!==200||!receipt.visibleAnswer?.trim()){record.verdict='FAIL';record.hardViolations.push('RUNTIME_OR_EMPTY');stop={id:turn.id,reason:'HARD_RUNTIME_GATE',status:receipt.status,error:receipt.body.error??null};write(turn.id+'-result.json',record);break outer;}
    const evaluation=evalInput.prepareStudentVisibleEvaluation({request:{question:turn.question},replay:receipt,stateBefore:before});
    if(!evaluation.ok){stop={id:turn.id,reason:'EVALUATION_UNRESOLVED',detail:evaluation.reason};write(turn.id+'-result.json',record);break outer;}
    active={phase:'judge',id:turn.id,question:turn.question};
    const judged=await sourceJudge.judgeStudentVisibleAnswer({question:turn.question,answer:receipt.visibleAnswer,contract:evaluation.contract,plan:evaluation.plan,visibleHistory:history});
    record.sourceJudgment=judged;record.evaluationAuthority=evaluation.authority;
    record.contract=evaluation.contract;record.plan=evaluation.plan;
    if(!judged.ok){stop={id:turn.id,reason:'JUDGE_UNRESOLVED',detail:judged.reason};write(turn.id+'-result.json',record);break outer;}
    const j=judged.judgment;
    for(const[flag,failed]of Object.entries({WRONG_TARGET:!j.correctTarget,WRONG_REFERENT:!j.correctReferent,WRONG_CONTEXT:!j.correctContext,UNSUPPORTED_SCIENCE:j.unsupportedScience,UNSAFE_CLINICAL:j.unsafeClinical}))if(failed)record.hardViolations.push(flag);
    record.verdict=j.verdict;
    if(turn.gold&&!record.hardViolations.length){
     const mini=await m.exports.v1ExistingJudge({gold:turn.gold,answer:receipt.visibleAnswer,contract:evaluation.contract,plan:evaluation.plan,visibleHistory:history.map(h=>({...h,turnId:h.fixtureTurnId}))});record.miniGoldJudgment=mini;
     if(!mini.ok){stop={id:turn.id,reason:'MINI_GOLD_JUDGE_UNRESOLVED',detail:mini.reason};write(turn.id+'-result.json',record);break outer;}
     const g=mini.judgment;if(!g.targetCorrect)record.hardViolations.push('WRONG_TARGET');if(!g.referentCorrect)record.hardViolations.push('WRONG_REFERENT');if(g.unsafeClinical)record.hardViolations.push('UNSAFE_CLINICAL');
     if(g.verdict==='FAIL'||record.verdict==='FAIL')record.verdict='FAIL';else if(g.verdict==='MINOR'||record.verdict==='MINOR')record.verdict='MINOR';
    }
    if(record.critical&&record.realComposerCalls<1)record.hardViolations.push('CRITICAL_REAL_PROVIDER_PROOF_MISSING');
    const missing=j.obligationAssessments.filter(o=>!['SATISFIED','SUPPORTED_LIMITATION'].includes(o.status));
    if(record.boundary&&missing.length)record.hardViolations.push('BOUNDARY_DUTY_MISSING');
    write(turn.id+'-result.json',record);console.log(JSON.stringify({event:'turn',id:turn.id,verdict:record.verdict,hard:record.hardViolations,newRequests:calls-startCalls}));
    history.push({turnId:evaluation.contract.turnId,fixtureTurnId:turn.id,user:turn.question,assistant:receipt.visibleAnswer});
    if(record.hardViolations.length){stop={id:turn.id,reason:'HARD_SEMANTIC_GATE',violations:record.hardViolations};break outer;}
   }
  }
 }catch(e){stop={id:active?.id??null,reason:'EXECUTION_STOP',errorName:e.name,message:e.message};}
 finally{
  globalThis.fetch=originalFetch;let integrity=true;try{verify();}catch{integrity=false;}
  const counts={PASS:rows.filter(r=>r.verdict==='PASS').length,MINOR:rows.filter(r=>r.verdict==='MINOR').length,FAIL:rows.filter(r=>r.verdict==='FAIL').length,UNRESOLVED:rows.filter(r=>!r.verdict).length,UNEXECUTED:70-rows.length};
  const result={version:'dna-chat-v1-real-provider-attempt@1',candidate,head,replayId,counts,stop,integrity,rows,
   completedRuntimeTurns:rows.length,newProviderRequests:calls,newCostMicrousd:spent-baseline.conservativeMicrousd,cumulativeCalls:baseline.calls+calls,cumulativeConservativeMicrousd:spent,usageUncertain:unknown,
   status:stop?'STOPPED_NOT_ACCEPTED':'AWAITING_FULL_SOURCE_AND_FROZEN_OBLIGATION_REVIEW',officialMini24:'BLOCKED_UNCHANGED',oldScientific250:'DIAGNOSTIC_ONLY_UNCHANGED',
   applicationSmokeCompleted:false,releaseApproved:false,deploy:false};
  write('result.json',result);console.log(JSON.stringify({output:run+'/result.json',counts,stop,candidate,head,calls,newCostUsd:result.newCostMicrousd/1e6,deploy:false}));if(stop)process.exitCode=1;
 }
}
main().catch(e=>{console.error(JSON.stringify({error:e.message}));process.exitCode=1;});
