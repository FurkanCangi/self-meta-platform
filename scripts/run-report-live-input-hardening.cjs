// Synthetic structural reproductions only. No patient text, account IDs, DB or
// provider access. Compare with the separately compiled immutable release.
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { buildJuryReadyReport, VisibleReportPropositionValidator, DeterministicClinicalCritic } = require('../compiled-eleven/src/lib/dna/reportJury')
const { extractCanonicalAnamnesisEvidence, factSupportsPreservedCapacity } = require('../compiled-eleven/src/lib/dna/reportJury/canonicalAnamnesisEvidence')
const { extractCanonicalTherapistObservation: observation } = require('../compiled-eleven/src/lib/dna/reportV2/canonicalCaseEvidence')
const { reportLiteratureSourceEligible: eligible } = require('../compiled-eleven/src/lib/dna/reportJury/literatureEligibility')
const literature = require('../compiled-eleven/src/lib/dna/literatureNote')
const baseRoot = process.env.REPORT_LIVE_INPUT_BASE_COMPILED
assert.ok(baseRoot, 'Independent compiled baseline is mandatory')
const before = require(path.join(baseRoot, 'src/lib/dna/reportJury'))
const legacyLiterature = require(path.join(baseRoot, 'src/lib/dna/literatureNote'))
const output = path.resolve(process.env.REPORT_LIVE_INPUT_OUTPUT || 'output-live-input')
const checks = [], rows = []
let networkAttempts = 0
globalThis.fetch = async () => { networkAttempts++; throw Error('NETWORK_FORBIDDEN') }
function check(name, action) { try { action(); checks.push({name, pass:true}) } catch(error) { checks.push({name, pass:false, error:String(error)}) } }
const phrases = text => ({
  noise: (text.match(/(?:nnj|asdf|qwerty|zzzz)/giu) || []).length,
  clinicalCertainty: (text.match(/puanı bu alandaki klinik güçlüğü göstermektedir/gu) || []).length,
  unboundedAbsence: (text.match(/Ayrı bir korunmuş alan bulunmamaktadır/gu) || []).length,
  inventedDuration: (text.match(/Gözlemin kısa süresi/gu) || []).length,
  duplicatedObservationScope: Math.max(0, (text.match(/Doğrudan gözlem(?:, yalnız kayıt altındaki görev ve koşullarda görülen performansı göstermektedir| yalnız gözlenen görev ve koşullar hakkında bilgi vermektedir)/gu) || []).length - 1),
})
async function main() {
  for (const noise of ['nnj', 'brrr', 'zzzz', 'asdfghjkl', 'qwerty', '12345', '???', 'deneme test', 'aaa bbbb']) {
    check(`Unusable observation: ${noise}`, () => assert.equal(observation(`Terapist yorumları: ${noise}`).present, false))
  }
  for (const note of ['Ağladı.', 'Ağrı yok.', 'El yıkamayı tamamladı.', 'Masada 5 dk kaldı.', 'Yüksek ses koşulu denenmedi. El yıkamayı tamamladı.']) {
    check(`Short valid observation survives: ${note}`, () => { assert.equal(observation(`Terapist yorumları: ${note}`).present, true); assert.equal(observation(`Terapist yorumları: ${note}`).normalizedText, note) })
  }
  check('Mixed noisy/clinical note retains the actual observation', () => assert.equal(observation('Terapist yorumları: nnj. El yıkamayı tamamladı. zzzz.').normalizedText, 'El yıkamayı tamamladı.'))
  check('Catalog is byte-equivalent as exported data', () => assert.deepEqual(literature.VERIFIED_LITERATURE_SOURCES, legacyLiterature.VERIFIED_LITERATURE_SOURCES))
  for (const verb of ['bitirir','tamamlar','yerleştirir']) check(`Reported aorist ability: ${verb}`,()=>assert.ok(extractCanonicalAnamnesisEvidence({clientCode:'SYNTH-AORIST',anamnez:`Çocuğun güçlü yanları: Sevdiği yapbozu ${verb}.`}).some(factSupportsPreservedCapacity)))
  for (const verb of ['bitiremez','tamamlamaz','yerleştiremez']) check(`Negative aorist is not capacity: ${verb}`,()=>assert.equal(extractCanonicalAnamnesisEvidence({clientCode:'SYNTH-AORIST',anamnez:`Çocuğun güçlü yanları: Sevdiği yapbozu ${verb}.`}).some(factSupportsPreservedCapacity),false))
  const capacityResult=await buildJuryReadyReport({clientCode:'SYNTH-CAPACITY',ageMonths:60,answers:Array(60).fill(3),anamnez:'Başvuru sebebi: Oyun bitince ağlıyor. Çocuğun güçlü yanları: Sevdiği yapbozu bitirir.'})
  check('Concrete preserved capacity is in the final report',()=>{assert.equal(capacityResult.validation.pass,true);assert.match(capacityResult.finalReport,/Sevdiği yapbozu bitirir/u)})
  const removed=capacityResult.lockedLanguagePlan.sections.flatMap(s=>s.paragraphs).filter(p=>['evidence.preserved','formulation.bold-synthesis'].includes(p.id)).reduce((text,p)=>text.replace(p.text,''),capacityResult.finalReport)+'\nKorunmuş kapasite.'
  const removedAudit=await new DeterministicClinicalCritic().review({lockedPlan:capacityResult.lockedLanguagePlan,decisionExplanation:capacityResult.decision_explanation,externalEvidence:capacityResult.externalEvidence,dataQuality:capacityResult.dataQuality,finalReport:removed})
  check('A bare keyword cannot hide a preserved-capacity omission',()=>assert.ok(removedAudit.findings.some(f=>f.type==='PRESERVED_CAPACITY_OMISSION')))
  for (const age of [24, 35, 36, 42, 47, 48, 59, 60, 66, 71]) {
    check(`Middle-childhood source excluded at ${age} months`, () => assert.equal(eligible(literature.VERIFIED_LITERATURE_SOURCES.DE_RAEYMAECKER_DHAR_2022, 'context-frame', age), false))
    for (const note of ['', 'nnj', 'El yıkamayı tamamladı.']) {
      const id = `SYNTH-LIVE-INPUT-${age}-${note ? note === 'nnj' ? 'noise' : 'brief' : 'empty'}`
      const input = { clientCode:id, ageMonths:age, answers:Array(60).fill(3), anamnez:`Terapist yorumları: ${note}` }
      const old = await before.buildJuryReadyReport(input)
      const result = await buildJuryReadyReport(input)
      const repeated = await buildJuryReadyReport(input)
      check(`${id}: unchanged scoring and full priority profile`, () => { assert.equal(result.base.v1.totalScore, old.base.v1.totalScore); assert.equal(result.overallClassification, old.overallClassification); assert.deepEqual(result.priorityProfile, old.priorityProfile) })
      check(`${id}: acceptance, determinism, headings and no provider`, () => { assert.equal(result.validation.pass,true,result.validation.failureCodes.join(',')); assert.equal(result.templateSemanticLeakage.pass,true); assert.equal(result.reportStatus,'ready_for_therapist_review'); assert.equal(result.finalReport,repeated.finalReport); assert.equal(result.languageFallbackUsed,false); assert.equal(result.base.providerCalls,0); assert.equal((result.finalReport.match(/^\d\. /gmu)||[]).length,5) })
      check(`${id}: no overclaim, noise or repetition`, () => assert.deepEqual(phrases(result.finalReport),{noise:0,clinicalCertainty:0,unboundedAbsence:0,inventedDuration:0,duplicatedObservationScope:0}))
      check(`${id}: protected case details`, () => { if (note && note !== 'nnj') assert.match(result.finalReport,/el yıkamayı tamamladı/iu); else { assert.equal(result.therapistObservation.present,false); assert.equal(result.caseScopedEvidenceEnvelope.therapist_observations.length,0) } })
      check(`${id}: literature citations remain real, limited and linked`, () => {
        assert.ok(result.literature.referenceCount >= 5 && result.literature.referenceCount <= 10)
        assert.ok(!result.literature.sourceIds.includes('DE_RAEYMAECKER_DHAR_2022'))
        assert.ok(!result.literature.sourceIds.includes('CASE_SMITH_ET_AL_2015'))
        for (const id of result.literature.sourceIds) assert.ok(eligible(literature.VERIFIED_LITERATURE_SOURCES[id],'age-only',age))
        for (const paragraph of result.lockedLanguagePlan.sections.find(s=>s.id==='limits_science').paragraphs.filter(p=>p.id.startsWith('science.')&&!p.id.startsWith('science.reference.'))) {
          const expected=result.literature.sourceIds.filter(id=>paragraph.text.includes(literature.VERIFIED_LITERATURE_SOURCES[id].inlineCitation.replace(/^\(|\)$/gu,'')))
          const actual=[...new Set(paragraph.sentenceProvenance.flatMap(p=>p.supporting_literature_ids))]
          assert.deepEqual(actual.sort(),expected.sort())
        }
      })
      check(`${id}: legacy literature default is unchanged`, () => {
        const analysis={globalLevel:old.overallClassification,profileType:old.profilePattern,weakDomains:['Duyusal Regülasyon'],strongDomains:[]}
        const context={ageMonths:age,stableSeed:id}
        assert.deepEqual(literature.buildLiteratureAlignedSection(analysis,context),legacyLiterature.buildLiteratureAlignedSection(analysis,context))
      })
      if (note === 'nnj') check(`${id}: safety rejects reintroduced fake observation`, () => {
        const altered=result.finalReport.replace('Bu değerlendirmede doğrudan terapist gözlemi bulunmamaktadır.','Doğrudan klinik gözlemde nnj.')
        const audit=new VisibleReportPropositionValidator().validate(result.lockedLanguagePlan,altered,result.dataQuality,result.therapistObservation,result.externalEvidence)
        assert.ok(audit.absent_observation_promoted_count > 0 || audit.provenance_failures.length > 0)
      })
      rows.push({id, accepted:result.validation.pass&&result.templateSemanticLeakage.pass, before:phrases(old.finalReport),after:phrases(result.finalReport),confidenceBefore:old.confidence.category,confidenceAfter:result.confidence.category,sources:result.literature.sourceIds,reportBefore:old.finalReport,reportAfter:result.finalReport})
    }
  }
  check('Network calls = 0',()=>assert.equal(networkAttempts,0))
  const totals=key=>rows.reduce((out,row)=>{for(const [name,count] of Object.entries(row[key]))out[name]=(out[name]||0)+count;return out},{})
  const summary={pass:checks.every(c=>c.pass),checks:checks.length,failed:checks.filter(c=>!c.pass),cases:rows.length,accepted:rows.filter(r=>r.accepted).length,before:totals('before'),after:totals('after'),confidenceChanges:rows.filter(r=>r.confidenceBefore!==r.confidenceAfter).map(r=>({id:r.id,before:r.confidenceBefore,after:r.confidenceAfter})),networkAttempts,providerCostUsd:0}
  fs.mkdirSync(output,{recursive:true})
  fs.writeFileSync(path.join(output,'summary.json'),JSON.stringify(summary,null,2))
  fs.writeFileSync(path.join(output,'checks.json'),JSON.stringify(checks,null,2))
  fs.writeFileSync(path.join(output,'synthetic-before-after.json'),JSON.stringify(rows,null,2))
  console.log(JSON.stringify(summary,null,2));assert.equal(summary.pass,true)
}
main().catch(error=>{console.error(error);process.exitCode=1})
