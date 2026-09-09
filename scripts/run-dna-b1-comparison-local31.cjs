// Original test sources and approved seven-row contract overlay remain frozen.
// Persist raw original runner failures separately from the approved V2 gate.
require('./dna-student-offline-network-guard.cjs');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {spawnSync}=require('node:child_process'),{createHash}=require('node:crypto');
const root='/Volumes/ResearchSSD/Outputs/SelfMetaAI/DNA_B1_BOUNDED_CLOSEOUT_20260908';
const hash=x=>createHash('sha256').update(x).digest('hex'),fh=p=>hash(fs.readFileSync(p)),j=p=>JSON.parse(fs.readFileSync(p));
const identity=require('../.tmp/dna-student-full602-visible/scripts/dna-student-candidate-identity.js');
const previous=j(`${root}/local31-relation-request-final.json`),candidate=identity.studentCandidateSha256(),results=[];
const parent=j(`${root}/relation-request-closeout.json`);
const final=process.argv.includes('--final'),migrated='scripts/run-dna-student-relation-authority-tests.ts';
for(const r of previous.results)if(!final||`scripts/${r.name}.ts`!==migrated)assert.equal(fh(`scripts/${r.name}.ts`),parent.pins[`scripts/${r.name}.ts`]);
if(final)assert.equal(j(`${root}/comparison-presentation-test-before.json`).sha256,parent.pins[migrated]);
const started=Date.now();
for(const r of previous.results){
 const output=spawnSync(process.execPath,['--conditions=react-server','-r','./scripts/dna-student-offline-network-guard.cjs',
  path.resolve(`.tmp/dna-student-full602-visible/scripts/${r.name}.js`)],
 {encoding:'utf8',maxBuffer:8*1024*1024,timeout:60000,env:{...process.env,NODE_PATH:path.resolve('node_modules/next/dist/compiled'),
  OPENAI_API_KEY:'offline-not-real',NODE_ENV:'test'}});
 results.push({name:r.name,exitCode:output.status,output:output.stdout,stderr:output.stderr,error:output.error?.message??null});
 console.log(JSON.stringify({test:r.name,exitCode:output.status}));
}
const ev=require('./run-dna-student40-contract-v2.cjs'),overlay=j('docs/dna-intelligence/completion-program/STUDENT40_CONTRACT_EXPECTATION_V2.json');
const contracts=ev.evaluate(ev.validateOverlay(overlay,fs.readFileSync(overlay.baseFixture.path)),overlay);
const failed=results.filter(r=>r.exitCode!==0),contractFailure=failed.find(r=>r.name==='run-dna-student-evidence-first-contract-student40-tests');
const expectedOnly=contractFailure&&JSON.parse(contractFailure.output).failures.map(r=>r.turnId).join('|')===overlay.corrections.map(r=>r.turnId).join('|');
const gatePassed=failed.length===1&&expectedOnly&&contracts.gatePass;
const result={version:final?'dna-b1-comparison-local31@2':'dna-b1-comparison-local31@1',candidate,elapsedSeconds:(Date.now()-started)/1000,
 rawPassed:results.filter(r=>r.exitCode===0).length,total:31,approvedV2GatePassed:!!gatePassed,contractV2:contracts,
 originalExpectationFailurePreserved:true,results,externalCalls:0,realSocketGuard:true,sourceSha256:fh(__filename),
 presentationTestMigration:final?{path:migrated,before:parent.pins[migrated],after:fh(migrated),
  change:'Shorter renderer heading plus stronger visible-source-clause assertion; no scientific duty removed.'}:null};
if(process.argv.includes('--record'))fs.writeFileSync(`${root}/comparison-presentation-local31${final?'-final':''}.json`,JSON.stringify(result,null,2)+'\n',{flag:'wx',mode:0o600});
console.log(JSON.stringify({...result,results:undefined,contractV2:contracts.versionedScore}));
if(!gatePassed)process.exitCode=1;
