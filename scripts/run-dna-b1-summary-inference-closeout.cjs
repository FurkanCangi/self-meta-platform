// Offline bounded regression against immutable raw outputs, never a new judge.
require('./dna-student-offline-network-guard.cjs');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),Module=require('node:module');
const {createHash}=require('node:crypto'),{spawnSync,execFileSync}=require('node:child_process');
const hash=x=>createHash('sha256').update(x).digest('hex'),fh=p=>hash(fs.readFileSync(p)),j=p=>JSON.parse(fs.readFileSync(p));
const root='/Volumes/ResearchSSD/Outputs/SelfMetaAI/DNA_B1_BOUNDED_CLOSEOUT_20260908',compiled=`${root}/summary-inference-build-v1`;
const product='src/lib/dna/chat/studentFirst/answerExecutor.server.ts';
const parent=j(`${root}/refusal-prerequisite-freeze.json`),offline=j(`${root}/refusal-prerequisite-after-final.json`);
assert.equal(fh(`${root}/refusal-prerequisite-freeze.json`),'9670fd3723f107f5853c1a0b318fc8a585fbf968989b2798c8393e7675bdb4d6');
assert.equal(fh(`${root}/refusal-prerequisite-after-final.json`),'f285f33d5b4ea7d70546becaf7c2c8f8392d7bffb492f24787f0f170073925ca');
for(const[p,h]of Object.entries(parent.pins))if(p!==product)assert.equal(fh(p),h,p);
const identity=require(`${compiled}/scripts/dna-student-candidate-identity.js`),candidate=identity.studentCandidateSha256();
const changed=identity.studentCandidateSourceFiles().filter(p=>fh(p)!==parent.pins[p]);assert.deepEqual(changed,[product]);
const b=require('./dna-b1-prompt-scope-budget.cjs'),proof=j(b.auditFile),budgetFile=proof.budgetFile,budgetHash=fh(budgetFile);
const budget=b.inspectLedger(fs.readFileSync(budgetFile,'utf8'),proof,j(b.approvalFile),j('/Volumes/ResearchSSD/Outputs/SelfMetaAI/dna-student-stabilization-20260908/interruption-audit.json'));
assert.equal(budget.calls,656);assert.equal(budget.spent,2412193);
const save=(name,v)=>fs.writeFileSync(`${root}/${name}`,JSON.stringify(v,null,2)+'\n',{flag:'wx',mode:0o600});
const compiledFile=`${compiled}/${product.replace(/\.ts$/,'.js')}`;
function parserAt(file){const m=new Module(file,module);m.filename=file;m.paths=Module._nodeModulePaths(path.dirname(file));
 m._compile(fs.readFileSync(file,'utf8')+'\nmodule.exports.testParse=parseCandidate;'+(file===compiledFile?'\nmodule.exports.testLimit=preserveSummaryInferenceLimit;':''),file);return m.exports;}
const current=parserAt(compiledFile),old=parserAt(path.resolve('.tmp/dna-student-full602-visible',product.replace(/\.ts$/,'.js')));
assert.equal(old.DNA_STUDENT_ANSWER_EXECUTOR_VERSION,'dna-student-answer-executor@96');assert.equal(current.DNA_STUDENT_ANSWER_EXECUTOR_VERSION,'dna-student-answer-executor@97');
const row=offline.rows.find(r=>r.turnId==='NMINI-C01-T12'),receipt=offline.receipts.find(r=>r.receiptSha256===row.receiptSha256),plan=receipt.student.result.plan;
const journals=require(`${compiled}/scripts/dna-student-replay-journal.js`),cache=new Map(),pins={};
for(const use of offline.uses){const raw=fs.readFileSync(use.file,'utf8');journals.createStudentReplayJournal({read:()=>raw,append:()=>{throw Error('readonly');}});
 const e=raw.split('\n').filter(Boolean).map(JSON.parse).find(e=>e.valueSha256===use.eventSha256);assert.ok(e);pins[use.file]=fh(use.file);
 cache.set(use.key,{...e.value,file:use.file,eventSha256:e.valueSha256});}
const hit=[...cache.values()].find(v=>v.request?.text?.format?.name==='dna_student_answer_executor'&&v.request.input.includes(row.question));assert.ok(hit);
const rawValue=JSON.parse(hit.body.output.flatMap(x=>x.content??[]).filter(x=>x.type==='output_text').map(x=>x.text).join(''));
const before=old.testParse(rawValue,plan,row.question),after=current.testParse(rawValue,plan,row.question);assert.ok(before&&after);
assert.equal(before.answer,row.answer);assert.deepEqual(current.validateStudentAnswerCandidate({candidate:after,plan,question:row.question}),[]);
assert.deepEqual(after.blocks.filter(b=>b.blockId!=='b2'),before.blocks.filter(b=>b.blockId!=='b2'));
const policy=plan.policyUnits.find(p=>p.id==='policy.evidence-limit'),slot=after.blocks.find(b=>b.blockId==='b2');
assert.ok(slot.text.includes(policy.text.split(';')[0]));assert.ok(!slot.text.includes('gösterip göstermediğini bilmiyoruz'));
const tests=[];function check(name,fn){fn();tests.push(name);}
const normalize=t=>current.testLimit(t,plan,slot),canonical=policy.text.split(';')[0];
check('immutable_raw_failure_reproduced',()=>assert.ok(before.answer.includes('gösterip göstermediğini bilmiyoruz')));
check('only_unknown_block_changed',()=>assert.equal(after.blocks.filter((b,i)=>b.text!==before.blocks[i].text).length,1));
for(const [i,t]of ['Bunların tek başına belirli bir neden, tanı veya kişiye özgü sonuç gösterip göstermediğini bilmiyoruz',
 'Bu bilgi tek başına kesin bir tanı kanıtlayıp kanıtlamadığını bilmiyoruz',
 'Bu gözlemler tek başına kişiye özgü sonuç gösterip göstermediğini bilinmiyor'].entries())
 check(`bounded_inference_form_${i}`,()=>assert.equal(normalize(t),canonical));
for(const [i,t]of ['Bu mekanizmanın hangi koşullarda değiştiği bilinmiyor.',
 'Kaynak, bu ölçümün uzun dönemde nasıl değiştiğinin bilinmediğini belirtiyor.',
 'Bu bilginin neden bazı durumlarda değiştiğini bilmiyoruz.',
 'Öğretmenin neden böyle davrandığını bilmiyoruz.',policy.text].entries())
 check(`other_unknown_or_correct_boundary_untouched_${i}`,()=>assert.equal(normalize(t),t));
check('independent_source_unknown_preserved',()=>{
 const extra='Kaynak, bu ölçümün uzun dönemde nasıl değiştiğinin bilinmediğini belirtiyor.';
 const value=`${rawValue.blocks.b2} ${extra}`;assert.equal(normalize(value),`${canonical}; değerlendirmede kanıtın sınırı ve bağlam birlikte ele alınmalı. ${extra}`);});
check('not_summary_untouched',()=>assert.equal(current.testLimit(rawValue.blocks.b2,{...plan,operation:'compare'},slot),rawValue.blocks.b2));
check('other_slot_untouched',()=>assert.equal(current.testLimit(rawValue.blocks.b2,plan,after.blocks[0]),rawValue.blocks.b2));
check('absent_policy_untouched',()=>assert.equal(current.testLimit(rawValue.blocks.b2,{...plan,policyUnits:[]},slot),rawValue.blocks.b2));
check('unbound_policy_untouched',()=>assert.equal(current.testLimit(rawValue.blocks.b2,plan,{...slot,usedPolicyUnitIds:[]}),rawValue.blocks.b2));
check('absent_scope_untouched',()=>assert.equal(current.testLimit(rawValue.blocks.b2,{...plan,summaryEpistemicScope:null},slot),rawValue.blocks.b2));
check('idempotent',()=>assert.equal(normalize(normalize(rawValue.blocks.b2)),normalize(rawValue.blocks.b2)));
check('metadata_unchanged',()=>assert.deepEqual({...after.blocks[1],text:''},{...before.blocks[1],text:''}));
const baseline={version:'summary-inference-bounded-controls@1',candidate,candidateIsCommit:false,parentCandidate:parent.candidate,
 product,productSha256:fh(product),scriptSha256:fh(__filename),tests,controls:tests.length,
 before:before.answer,after:after.answer,formalSemanticAcceptance:false,externalCalls:0,budget};
async function main(){
 if(process.argv.includes('--controls')){console.log(JSON.stringify(baseline));return;}
 if(process.argv.includes('--local')){
  const previous=j(`${root}/refusal-prerequisite-local31-final.json`),results=[];
  for(const r of previous.results){const testFile=`scripts/${r.name}.ts`;assert.equal(fh(testFile),parent.pins[testFile]);
   const out=spawnSync(process.execPath,['--conditions=react-server','-r',path.resolve('scripts/dna-student-offline-network-guard.cjs'),`${compiled}/scripts/${r.name}.js`],
    {encoding:'utf8',timeout:60000,maxBuffer:8*1024*1024,env:{...process.env,NODE_ENV:'test',OPENAI_API_KEY:'offline-not-real'}});
   results.push({name:r.name,exitCode:out.status,output:out.stdout,stderr:out.stderr,error:out.error?.message??null});console.log(JSON.stringify({name:r.name,exitCode:out.status}));}
  // Rebind only the unchanged approved V2 evaluator's runtime import to this
  // build. Do not reuse an old candidate's contract-test outcome.
  const file=path.resolve('scripts/run-dna-student40-contract-v2.cjs'),m=new Module(file,module);m.filename=file;m.paths=module.paths;
  const source=fs.readFileSync(file,'utf8').replace("path.resolve('.tmp/dna-student-full602-visible')",JSON.stringify(compiled));m._compile(source,file);
  const ev=m.exports,overlay=j('docs/dna-intelligence/completion-program/STUDENT40_CONTRACT_EXPECTATION_V2.json');
  const contracts=ev.evaluate(ev.validateOverlay(overlay,fs.readFileSync(overlay.baseFixture.path)),overlay);
  const failed=results.filter(r=>r.exitCode!==0),expected=failed.length===1&&failed[0].name==='run-dna-student-evidence-first-contract-student40-tests'
   &&JSON.parse(failed[0].output).failures.map(r=>r.turnId).join('|')===overlay.corrections.map(r=>r.turnId).join('|');
  const result={...baseline,results,rawPassed:results.filter(r=>r.exitCode===0).length,total:31,approvedV2GatePassed:!!expected&&contracts.gatePass,contractV2:contracts};
  save('summary-inference-local31-v1.json',result);assert.equal(result.approvedV2GatePassed,true);return;
 }
 Object.assign(process.env,{NODE_ENV:'test',DNA_CHAT_STUDENT_LOCAL_CANDIDATE:'1',OPENAI_API_KEY:'offline-not-real'});delete process.env.VERCEL_ENV;
 let active='',miss=null;const uses=[],rows=[],receipts=[],stops=[];
 globalThis.fetch=async(url,init)=>{assert.equal(String(url),'https://api.openai.com/v1/responses');const request=JSON.parse(String(init.body)),key=b.requestKey(request),hit=cache.get(key);
  if(!hit){miss={turnId:active,key};return Response.json({error:{code:'exact_cache_miss'}},{status:400});}
  uses.push({turnId:active,key,file:hit.file,eventSha256:hit.eventSha256});return Response.json(hit.body,{status:hit.status});};
 const replay=hash(JSON.stringify({candidate,script:fh(__filename),pins,authority:'OFFLINE_CURRENT_CONTROLLER_EXACT_CACHE'}));
 const {createStudentApplicationReplaySession}=require(`${compiled}/scripts/dna-student-application-replay.js`);
 for(const conversationId of [...new Set(offline.rows.map(r=>r.conversationId))]){
  const session=createStudentApplicationReplaySession({candidateSha256:candidate,replaySha256:replay,sessionId:conversationId,secret:'summary-inference-offline-synthetic-context-32'});
  for(const old of offline.rows.filter(r=>r.conversationId===conversationId)){
   active=old.turnId;miss=null;const r=await session.turn({question:old.question});receipts.push(r);
   if(miss||r.status!==200||!r.visibleAnswer||!r.usageComplete){stops.push({turnId:active,miss,status:r.status});break;}
   const oldReceipt=offline.receipts.find(x=>x.receiptSha256===old.receiptSha256);
   assert.deepEqual(r.student?.contract,oldReceipt.student?.contract);assert.deepEqual(r.student?.result.plan,oldReceipt.student?.result.plan);
   if(active!=='NMINI-C01-T12')assert.equal(r.visibleAnswer,old.answer,'unrelated_answer_changed');else assert.equal(r.visibleAnswer,after.answer);
   rows.push({turnId:active,conversationId,question:old.question,before:old.answer,answer:r.visibleAnswer,changed:r.visibleAnswer!==old.answer,
    answerSha256:hash(r.visibleAnswer),receiptSha256:r.receiptSha256});}
 }
 assert.equal(fh(budgetFile),budgetHash);for(const[p,h]of Object.entries(pins))assert.equal(fh(p),h,p);
 for(const[p,h]of Object.entries(parent.pins))if(p!==product)assert.equal(fh(p),h,p);
 const result={...baseline,replay,pins,rows,receipts,uses,stops,changedTurns:rows.filter(r=>r.changed).map(r=>r.turnId),
  head:execFileSync('/Library/Developer/CommandLineTools/usr/bin/git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),
  officialMini24:'NOT_RUN_NEW_CANDIDATE; unchanged T10 MINOR not overridden',newCostMicrousd:0,
  limitation:'Bounded generic evidentiary-predicate normalization only. Other paraphrases are not certified. Source-specific unknowns are not replaced.',
  beforeSourceFile:`${root}/summary-inference-before-v1.json`,compiledSourceSha256:fh(compiledFile),budgetLedgerSha256:budgetHash};
 save('summary-inference-mini24-offline-v1.json',result);assert.equal(rows.length,24);assert.deepEqual(stops,[]);
 assert.deepEqual(result.changedTurns,['NMINI-C01-T12']);console.log(JSON.stringify({candidate,controls:tests.length,visible:rows.length,changed:result.changedTurns,externalCalls:0,budget}));
}
main().catch(e=>{console.error(e);process.exitCode=1});
