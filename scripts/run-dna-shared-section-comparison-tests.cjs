const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), Module = require('node:module');
const ts = require('typescript');
const resolve = Module._resolveFilename, load = Module._load;
Module._resolveFilename = function(name, ...args) { return resolve.call(this, name.startsWith('@/') ? path.resolve('src', name.slice(2)) : name, ...args); };
Module._load = function(name, ...args) { return name === 'server-only' ? {} : load.call(this, name, ...args); };
require.extensions['.ts'] = (m, f) => m._compile(ts.transpileModule(fs.readFileSync(f, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true }
}).outputText, f);
let externalCalls = 0, checks = 0;
global.fetch = async () => { externalCalls++; throw new Error('external_network_forbidden'); };
const { resolveStudentEvidenceFirstRequest: resolveRequest } = require('../src/lib/dna/chat/studentFirst/evidenceFirstRequest.ts');
const { createEmptyStudentConversationState: empty, applyStudentRequestContract: apply } = require('../src/lib/dna/chat/studentFirst/conversationState.ts');
const { buildStudentAnswerExecutionPlan: planFor, validateStudentAnswerExecutionPlan: valid } = require('../src/lib/dna/chat/studentFirst/answerExecution.ts');
const { buildStudentS13ResolvedRequestHandoff: handoff } = require('../src/lib/dna/chat/studentFirst/runtimeBridge.ts');
const { executeStudentAnswer } = require('../src/lib/dna/chat/studentFirst/answerExecutor.server.ts');
const { resolveStudentTargetDescriptor: descriptor, studentTargetIdForOwnerBookTopic: topicTarget } = require('../src/lib/dna/chat/studentFirst/targetCatalog.ts');
const { getDnaOwnerBookTopicClaims } = require('../src/lib/dna/chat/ownerBookRuntime.ts');
function request(message, state = empty()) {
  const r = resolveRequest({ turnId: `local-${checks++}`, message, state }); assert.ok(r.ok); return r.contract;
}
async function main() {
  const wm = descriptor('working_memory'), stm = descriptor('short_term_memory');
  assert.equal(wm.ownerBookTopicId, stm.ownerBookTopicId);
  assert.equal(topicTarget(wm.ownerBookTopicId), 'working_memory', 'legacy topic primary must remain unchanged');
  const source = getDnaOwnerBookTopicClaims(wm.ownerBookTopicId, true);
  assert.ok(source.some(c => c.text.startsWith('Kısa süreli bellek, bilginin kısa bir süre korunmasını')));
  for (const surface of ['kısa süreli bellek', 'kısa süreli belleği', 'kısa süreli bellekten', 'kısa süreli belleğin', 'short term memory']) {
    const c = request(`${surface} nedir?`);
    assert.ok(c.targetIds.includes('short_term_memory'), surface);
    assert.equal(planFor({question: `${surface} nedir?`, contract:c}).targetEvidence[0].claims[0].role, 'target');
  }
  for (const [first, follow, expected] of [
    ['Çalışma belleği nedir? Kısa ve sade anlatır mısın?', 'Peki kısa süreli bellekten farkı ne?', ['working_memory','short_term_memory']],
    ['Kısa süreli bellek nedir?', 'Çalışma belleğiyle farkı ne?', ['working_memory','short_term_memory']],
    ['İnhibisyon nedir?', 'Planlama ile farkı ne?', ['inhibition','planning']],
    ['Duygu düzenleme nedir?', 'Arousal ile farkı ne?', ['emotion_regulation','arousal']],
  ]) {
    const a = request(first), b = request(follow, apply(empty(), a));
    assert.equal(b.semanticTask, 'compare'); assert.equal(b.ambiguity, 'none');
    assert.deepEqual([...b.targetIds].sort(), expected.sort());
    assert.ok(b.obligations.some(o => o.kind === 'distinguish_targets'));
    assert.ok(!b.obligations.some(o => o.kind === 'explain_relation'));
    const h = handoff({question: follow, contract:b}), p = planFor({question:follow,contract:b});
    assert.equal(h.crosswalk.length, 2); assert.equal(p.targetEvidence.length,2); assert.ok(valid(p,b));
    for (const evidence of p.targetEvidence) assert.equal(evidence.claims[0].role, 'target');
    // Real composer/validator, synthetic provider response. No paid evaluation.
    let mockCalls = 0;
    const result = await executeStudentAnswer({question:follow,contract:b,apiKey:'synthetic-not-real',fetchImpl:async (_url,init) => {
      mockCalls++;
      const body=JSON.parse(String(init.body)), input=JSON.parse(body.input);
      assert.equal(input.currentUserMessage,follow);
      assert.ok(input.answerSlots.every(slot=>slot.activeTargets.length===2));
      return Response.json({id:'mock-shared-section',output_text:JSON.stringify({blocks:Object.fromEntries(input.answerSlots.map(slot=>[
        slot.slotId, slot.relationComposition ? {requestFocus:'definition_difference',scopeOrder:'not_ordered'} :
        p.targetEvidence.map(t=>t.claims[0].text).join(' ')
      ])),illustrationKind:'none'}),usage:{input_tokens:1,output_tokens:1}});
    }});
    assert.equal(mockCalls,1); assert.ok(result.ok,JSON.stringify(result));
    assert.ok(!result.answer.includes('sorulan sonuç'));
    if(expected.includes('short_term_memory')) {
      assert.match(result.answer,/Kısa süreli bellek/u);
      assert.match(result.answer,/işlenme|güncellenme/u);
    }
  }
  const unsafe=request('Çalışma belleği için hangi terapiyi seçeyim?');
  const repair=request('Çalışma belleği değil, kısa süreli bellek.',apply(empty(),request('Çalışma belleği nedir?')));
  assert.deepEqual(repair.targetIds,['short_term_memory']);
  assert.ok(valid(planFor({question:'Çalışma belleği değil, kısa süreli bellek.',contract:repair}),repair));
  const typedRepair={...repair,rejectedTargetIds:['working_memory']};
  const repairHandoff=handoff({question:'typed rejected concept control',contract:typedRepair});
  assert.ok(repairHandoff.crosswalk.some(row=>row.studentTargetId==='working_memory'&&row.polarity==='REJECTED_TARGET'));
  assert.ok(valid(planFor({question:'typed rejected concept control',contract:typedRepair}),typedRepair));
  assert.throws(()=>handoff({question:'invalid local contract',contract:{...repair,rejectedTargetIds:['short_term_memory']}}),/polarity_conflict/);
  assert.equal(planFor({question:'Çalışma belleği için hangi terapiyi seçeyim?',contract:unsafe}).executionRoute,'local_safety_boundary');
  assert.equal(externalCalls,0);
  console.log(JSON.stringify({status:'PASS',requestControls:checks,comparisonExecutions:4,externalCalls,kind:'LOCAL_REGRESSION_NOT_RELEASE_ACCEPTANCE'}));
}
main().catch(e=>{console.error(e);process.exitCode=1;});
