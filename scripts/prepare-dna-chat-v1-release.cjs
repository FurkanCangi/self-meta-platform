// Copy-only RC preparation; never changes the original worktree or historical evidence.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {createHash}=require('node:crypto'),{execFileSync}=require('node:child_process');
const root=process.cwd(),target='/Users/furkancangi/.codex/visualizations/2026/08/17/01a01022-17ba-7933-8eba-32085b80ce53/dna-chat-v1-rc';
const output='/Volumes/ResearchSSD/Outputs/SelfMetaAI/DNA_CHAT_V1_RELEASE_20260910';
const json=p=>JSON.parse(fs.readFileSync(p)),hash=p=>createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const freeze=json('/Volumes/ResearchSSD/Outputs/SelfMetaAI/DNA_B1_BOUNDED_CLOSEOUT_20260908/development-candidate-freeze-20260910-v1.json');
for(const[p,h]of Object.entries(freeze.sourcePins))assert.equal(hash(p),h);
const head=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();assert.equal(head,freeze.head);
assert.ok(fs.existsSync('/Volumes/ResearchSSD/Outputs'));assert.ok(!fs.existsSync(target));assert.ok(!fs.existsSync(output));
const miniRoot='.tmp/dna-chat-natural-production-20260824/deliverables/DNA_CHAT_NATURAL_PRODUCTION_20260824/02_NATURAL_MINI24';
const miniFixture=miniRoot+'/NATURAL_MINI24_FIXTURE.json',miniGold=miniRoot+'/NATURAL_MINI24_GOLD.json';
assert.equal(hash(miniFixture),'9f146c18fe4cccf2a54aa4fa4aecd038dfecff3aee81e751f2308e6ea3845adc');
assert.equal(hash(miniGold),'2a54904a77979b381948d7815f832013720b127a4199989087b9e3183723bc50');
const studentPath='scripts/dna-student-fixtures/STUDENT40_DEVELOPMENT.json',hourPath='scripts/dna-student-fixtures/SYNTHETIC_ONE_HOUR_24.json';
assert.equal(hash(studentPath),'e8bf1368ea3f3ea5c09ba710a90c6e4f16a64e1d4f0388339c43c42b734f0a65');assert.equal(hash(hourPath),'8c8916240a237c526757b19e0db9047f3a8394b4be389b40868174704a60deb1');
const sciPath='.tmp/measurement-cert-recovery/.tmp/replay-dependencies-recovery-v2/scientific250_source_trace.jsonl';
assert.equal(hash(sciPath),'c70f65083ed02260ff9474ea174f5313c9544e55284a1e5da56cdf069c6fdb1b');
const sci=fs.readFileSync(sciPath,'utf8').trim().split('\n').map(JSON.parse),g=json(miniGold),mini=json(miniFixture),st=json(studentPath),hour=json(hourPath);
const sessions=[];
for(const n of [5,7,13,19,28,33]){const r=sci[n-1];assert.ok(!r.setup);sessions.push({id:r.id,critical:true,origin:sciPath,turns:[{id:r.id,question:r.question,original:r}]});}
for(const c of mini.conversations)sessions.push({id:c.conversationId,origin:miniFixture,turns:c.turns.map(t=>({id:t.turnId,question:t.rawUserMessage,gold:g.rows.find(r=>r.turnId===t.turnId)}))});
sessions.push({id:'ONEHOUR24',origin:hourPath,turns:hour.turns.map(t=>({id:t.turnId,question:t.user,expected:t.expected}))});
for(const c of st.conversations.filter(c=>['STUDENT40-C01','STUDENT40-C03'].includes(c.conversationId)))sessions.push({id:c.conversationId,origin:studentPath,turns:c.turns.map(t=>({id:t.turnId,question:t.user,expected:t.expected}))});
assert.equal(sessions.flatMap(s=>s.turns).length,70);
const boundaries=['NMINI-C01-T04','NMINI-C01-T10','NMINI-C01-T11','NMINI-C02-T03','NMINI-C02-T10','ONEHOUR24-T07','ONEHOUR24-T14','ONEHOUR24-T15','ONEHOUR24-T18','ONEHOUR24-T20','ONEHOUR24-T21','STUDENT40-C01-T07','STUDENT40-C03-T03','STUDENT40-C03-T07'];
const manifest={version:'dna-chat-v1-acceptance-selection@1',candidateSource:freeze.candidate,synthetic:true,turns:70,boundaries,sessions,
 originalPins:Object.fromEntries([miniFixture,miniGold,studentPath,hourPath,sciPath,'docs/dna-intelligence/completion-program/STUDENT40_CONTRACT_EXPECTATION_V2.json'].map(p=>[p,hash(p)])),
 noNewGold:true,noOldOutputs:true,oldResultsUnchanged:true,releasePolicy:'DNA_CHAT_V1_RELEASE_POLICY_20260910.md'};
const parent=json('/Volumes/ResearchSSD/Outputs/SelfMetaAI/DNA_B1_BOUNDED_CLOSEOUT_20260908/single-deadline-closeout-v1.json');
const additions=['scripts/dna-student-visible-judge.ts','scripts/dna-student-visible-evaluation-input.ts','scripts/dna-student-stabilization-judge.ts','scripts/dna-student-secondary-judge-trace.ts',
 'scripts/prepare-dna-chat-v1-release.cjs','scripts/run-dna-chat-v1-acceptance.cjs','tsconfig.dna-chat-v1.json',
 'docs/dna-intelligence/completion-program/DNA_CHAT_V1_RELEASE_POLICY_20260910.md','docs/dna-intelligence/completion-program/STUDENT40_CONTRACT_EXPECTATION_V2.json'];
const files=[...new Set([...Object.keys(freeze.sourcePins),...Object.keys(parent.pins).filter(p=>p.startsWith('scripts/')), ...additions])];
for(const p of files)assert.ok(fs.existsSync(p),p);
fs.mkdirSync(output,{recursive:false});
fs.writeFileSync(output+'/original-worktree.json',JSON.stringify({head,sourceIdentity:freeze.candidate,worktree:execFileSync('git',['status','--short'],{encoding:'utf8'}),copyPins:Object.fromEntries(files.map(p=>[p,hash(p)]))},null,2)+'\n',{flag:'wx',mode:0o600});
execFileSync('git',['worktree','add','-b','codex/dna-chat-v1-rc-20260910',target,head],{stdio:'inherit'});
for(const p of files){const dst=path.join(target,p);fs.mkdirSync(path.dirname(dst),{recursive:true});fs.copyFileSync(p,dst);assert.equal(hash(dst),hash(p));}
const doc=target+'/docs/dna-intelligence/completion-program/';fs.writeFileSync(doc+'DNA_CHAT_V1_ACCEPTANCE_MANIFEST_20260910.json',JSON.stringify(manifest,null,2)+'\n',{flag:'wx'});
fs.copyFileSync(miniFixture,doc+'DNA_CHAT_V1_ORIGINAL_MINI24_FIXTURE.json');fs.copyFileSync(miniGold,doc+'DNA_CHAT_V1_ORIGINAL_MINI24_GOLD.json');
console.log(JSON.stringify({target,output,files:files.length,turns:70,boundaries:boundaries.length,head,source:freeze.candidate}));
