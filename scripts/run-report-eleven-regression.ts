import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import crypto from "node:crypto"
import cases from "./fixtures/report-eleven-exact10.json"
import { buildJuryReadyReport, VisibleReportPropositionValidator, type JuryReportResult } from "../src/lib/dna/reportJury"
import { extractCanonicalTherapistObservation } from "../src/lib/dna/reportV2/canonicalCaseEvidence"
import { extractCanonicalAnamnesisEvidence, factSupportsDifficulty, factSupportsPreservedCapacity } from "../src/lib/dna/reportJury/canonicalAnamnesisEvidence"
import { inferEvidenceDirection, inferEvidenceEpistemicStatus } from "../src/lib/dna/reportJury/evidenceSemantics"
import { candidateIsSemanticallyEntailed } from "../src/lib/dna/reportJury/clauseEntailment"
import { calculateAssessment } from "../src/lib/assessment/assessmentEngine"
import { applyFullBoldClinicalReportParagraphs } from "../src/lib/dna/reportText"
import type { ReportInput } from "../src/lib/dna/reportEngine"

const output = process.env.REPORT_ELEVEN_OUTPUT || path.join(process.cwd(), "output-eleven")
const sha = (value: unknown) => crypto.createHash("sha256").update(typeof value === "string" ? value : JSON.stringify(value)).digest("hex")
const checks: { name: string; pass: boolean; error?: string }[] = []
function check(name: string, fn: () => void) { try { fn(); checks.push({ name, pass: true }) } catch (e) { checks.push({ name, pass: false, error: String(e) }) } }

async function main() {
  let networkAttempts = 0
  globalThis.fetch = (async () => { networkAttempts++; throw Error("REPORT_ELEVEN_NETWORK_FORBIDDEN") }) as typeof fetch
  fs.mkdirSync(output, { recursive: true })
  const results: { id: string; input: ReportInput; text: string; result: JuryReportResult }[] = []
  for (const row of cases) {
    const input = row.input as ReportInput
    const result = await buildJuryReadyReport(input)
    const replay = await buildJuryReadyReport(input)
    const text = applyFullBoldClinicalReportParagraphs(result.finalReport, result.lockedLanguagePlan.sections.flatMap(s => s.paragraphs).filter(p => p.emphasis === "full_bold").map(p => p.text))
    check(`${row.id}: unchanged scores, classification and priority`, () => {
      const { siniflama, ...scores } = calculateAssessment(input.answers!)
      assert.deepEqual(scores, input.scores)
      assert.equal(result.overallClassification, row.baseline.overallClassification)
      assert.deepEqual(result.priorityProfile, row.baseline.priorityProfile)
    })
    check(`${row.id}: production acceptance and deterministic replay`, () => {
      assert.equal(result.validation.pass, true, result.validation.failureCodes.join(","))
      assert.equal(result.templateSemanticLeakage.pass, true)
      assert.equal(result.reportStatus, "ready_for_therapist_review")
      assert.equal(result.finalReport, replay.finalReport)
      assert.equal(result.base.providerCalls, 0)
    })
    check(`${row.id}: grammar, safety and headings`, () => {
      assert.doesNotMatch(text, /çocuk\s+(?:bakım veren|anne|ama|kart olmadan)|çocuğun durduğunu bildirilen|Gözlemin kısa süresi/iu)
      assert.doesNotMatch(text, /\b(?:kaliyo|basladi|bitmio|aksam|bagirma|gidiyo)\b/iu)
      assert.equal((text.match(/^\d\. /gmu) ?? []).length, 5)
      assert.equal(result.validation.unsupportedCausalityCount, 0)
      assert.equal(result.validation.unsupportedSourceCount, 0)
      assert.equal(result.validation.crossCaseContaminationCount, 0)
      assert.equal(result.validation.unsupportedVisibleCaseClaimCount, 0)
    })
    results.push({ id: row.id, input, text, result })
    fs.writeFileSync(path.join(output, `${row.id}.txt`), text)
  }
  const get = (number: number) => results[number - 1]
  check("1. Absent observations cannot count as sources", () => {
    for (const i of [2, 10]) {
      assert.equal(get(i).result.therapistObservation.present, false)
      assert.equal(get(i).result.caseScopedEvidenceEnvelope.therapist_observations.length, 0)
      assert.doesNotMatch(get(i).text, /Doğrudan klinik gözlemde/iu)
    }
  })
  check("2. Unknown topics cannot become functional difficulties", () => {
    assert.equal(get(2).result.caseScopedEvidenceEnvelope.anamnesis_evidence.some(factSupportsDifficulty), false)
    assert.doesNotMatch(get(2).text, /Tuvalet sırasında bildirilen güçlük/iu)
  })
  check("3. Negated distress retains its direction", () => {
    const fact = get(8).result.caseScopedEvidenceEnvelope.anamnesis_evidence.find(f => /ağlama.*bildirilmedi/iu.test(f.raw_span))!
    assert.ok(fact)
    assert.equal(factSupportsDifficulty(fact), false)
    assert.doesNotMatch(get(8).text, /bakım veren.*performans güçlüğü bildirmiştir|aynı düzeyde kullanılamadığını/iu)
    assert.match(get(8).text, /sırası değiştiğinde etkinlikte kaldı/iu)
  })
  check("4. Drawing is not visual scaffolding", () => {
    assert.match(get(5).text, /resim yaptı/iu)
    assert.doesNotMatch(get(5).text, /görev aynı zamanda yazılı veya görsel|görev yapılandırması aynı anda|performanstaki iyileşme/iu)
    assert.equal(get(5).result.therapistObservation.meaningfulContextComparison, false)
  })
  check("5. Source-level direction is not taken from a single preserved subtask", () => {
    for (const i of [1, 3, 7, 9]) assert.doesNotMatch(get(i).text, /alan puanı ile bakım veren anlatısı aynı yönde değildir|Bakım veren anlatısı korunmuş performans yönünde bilgi vermektedir; buna karşılık/iu)
    assert.match(get(9).text, /farklı işlevleri değerlendirdiği/iu)
  })
  check("6. Material sleep difficulty and accidents remain visible", () => {
    for (const pattern of [/geceleri iki kez uyandığını/iu, /kanepeye uzanıp ara verdiğini/iu, /son hafta iki kez tuvalete yetişemediği/iu, /Ağrı veya yanma yakınması bildirilmedi/iu]) assert.match(get(6).text, pattern)
    const fact = get(6).result.caseScopedEvidenceEnvelope.anamnesis_evidence.find(f => /çok sıkışınca/iu.test(f.raw_span))!
    assert.equal(factSupportsDifficulty(fact), true)
    assert.equal(factSupportsPreservedCapacity(fact), false)
  })
  check("7. Preserved self-care does not prove awareness or support dependence", () => {
    const fact = get(6).result.caseScopedEvidenceEnvelope.anamnesis_evidence.find(f => /giysilerini indirip/iu.test(f.raw_span))!
    assert.ok(fact)
    assert.equal(fact.domains.includes("interoception"), false)
    assert.doesNotMatch(get(7).text, /desteğin olmadığı ya da yetersiz kaldığı koşullarda arttığını/iu)
    assert.match(get(7).text, /yapbozu sessiz odada tek başına tamamladı/iu)
  })
  check("8. Incomplete movement note is acknowledged, not completed by invention", () => {
    assert.match(get(7).text, /notunda çocuğun yaptığı hareket açıklanmamıştır/iu)
    assert.doesNotMatch(get(7).text, /Ses olunca sandalye altına\./u)
    assert.match(get(7).text, /çorapla ilgili iş yarım kalıyor/iu)
    assert.match(get(7).text, /oyun bittiğinde bağırdığı bildiriliyor/iu)
    assert.doesNotMatch(get(3).text, /Bakım veren anlatısı ise aynı alanda güçlük bildirilmediğini göstermektedir/iu)
  })
  check("9. Short text does not establish observation duration", () => {
    assert.doesNotMatch(get(9).text, /Gözlemin kısa süresi/iu)
    assert.equal(get(9).result.therapistObservation.meaningfulContextComparison, false)
  })
  check("10. Exact caregiver-completed external result is accepted", () => {
    assert.match(get(4).text, /Bildirilen sonuç: Planlama\/Organizasyon T=72, bakım veren formu tamamlandı/iu)
    assert.equal(get(4).result.validation.wrongSourceAttributionCount, 0)
  })
  check("11. Specific decision emphasis and original sock event survive", () => {
    assert.match(get(1).text, /\*\*El yıkama sırasında bildirilen güçlük/iu)
    assert.doesNotMatch(get(1).text, /Tuvalet sırasında bildirilen güçlük/iu)
    assert.match(get(10).text, /Dün yeni çorabı çıkarıp eski yumuşak çorabı giydi/iu)
    assert.doesNotMatch(get(10).text, /kuralları yok say|kesin otizm yaz|yanlışlıkla yapıştırılmış/iu)
  })

  for (const absent of ["Henüz doğrudan gözlem yapılmadı.", "Gözlem yapılmadı. Tuvalet ve uyku konuşulmadı.", "Doğrudan gözlem yapılmadı; günlük görev örneği verilmedi.", "Bu alan sorulmadı."]) {
    check(`absence minimal pair: ${absent}`, () => assert.equal(extractCanonicalTherapistObservation(`Terapist yorumları: ${absent}`).present, false))
  }
  check("Mixed actual and unassessed observation stays available", () => assert.equal(extractCanonicalTherapistObservation("Terapist yorumları: El yıkamayı tamamladı. Yüksek ses koşulu denenmedi.").present, true))
  for (const unknown of ["Uyku konuşulmadı.", "Tuvalet sorulmadı.", "Açlık hakkında bilmiyoruz."]) check(`unknown: ${unknown}`, () => {
    assert.notEqual(inferEvidenceEpistemicStatus(unknown), "OBSERVED_OR_REPORTED")
    assert.equal(inferEvidenceDirection(unknown), "UNKNOWN")
  })
  for (const pair of [["Ağlama veya etkinliği terk etme bildirilmedi.", "Ağlama veya etkinliği terk etme bildirildi."], ["Ağlamıyor.", "Ağlamıyor değil."]]) check(`negation pair: ${pair[0]}`, () => {
    assert.notEqual(inferEvidenceDirection(pair[0]), "DIFFICULTY")
    assert.equal(inferEvidenceDirection(pair[1]), "DIFFICULTY")
  })
  check("Independent strength segment never inherits unrelated difficulty domain", () => {
    const facts = extractCanonicalAnamnesisEvidence({ ...get(1).input, anamnez: "Başvuru sebebi: Oyun bitince ağlıyor. Çocuğun güçlü yanları: Sessiz odada yapbozu tamamlıyor." })
    assert.equal(facts.find(f => /yapboz/iu.test(f.statement))?.domains.includes("emotional"), false)
  })
  check("Safety negative control: fabricated visual support is rejected", () => assert.equal(candidateIsSemanticallyEntailed("Doğrudan gözlemde görsel destek kullanıldı.", get(5).result.caseScopedEvidenceEnvelope.therapist_observations), false))
  check("Safety negative control: drawing cannot entail scaffolding", () => assert.equal(candidateIsSemanticallyEntailed("Doğrudan gözlemde görev aynı zamanda yazılı veya görsel adımlarla yapılandırılmıştır.", get(5).result.caseScopedEvidenceEnvelope.therapist_observations), false))
  check("Safety negative control: maintained performance cannot entail a decline", () => assert.equal(candidateIsSemanticallyEntailed("Doğrudan gözlemde görev koşulları değiştiğinde performansın da değişmesi, kapasitenin yapılandırılmış ve daha yoğun koşullarda aynı düzeyde kullanılamadığını göstermektedir.", get(8).result.caseScopedEvidenceEnvelope.therapist_observations), false))
  check("Safety negative control: solitary puzzle success cannot entail support dependence", () => {
    const fact = get(7).result.caseScopedEvidenceEnvelope.anamnesis_evidence.find(f => /yapbozu/iu.test(f.statement))!
    assert.equal(candidateIsSemanticallyEntailed("Bu bilgi, güçlüğün desteğin olmadığı ya da yetersiz kaldığı koşullarda arttığını göstermektedir.", [fact]), false)
  })
  check("Safety negative control: absent source cannot support difficulty", () => {
    const fact = extractCanonicalAnamnesisEvidence({ ...get(1).input, anamnez: "Uyku hakkında bilgi bulunmuyor." })[0]
    if (fact) assert.equal(candidateIsSemanticallyEntailed("Fizyolojik regülasyonda belirgin güçlük vardır.", [fact]), false)
    else assert.equal(inferEvidenceDirection("Uyku hakkında bilgi bulunmuyor."), "UNKNOWN")
  })
  check("Safety negative control: altered external result remains rejected", () => {
    const r = get(4).result
    const altered = r.finalReport.replace("T=72, bakım veren formu tamamlandı", "T=22, bakım veren formu tamamlandı")
    const audit = new VisibleReportPropositionValidator().validate(r.lockedLanguagePlan, altered, r.dataQuality, r.therapistObservation, r.externalEvidence)
    assert.ok(audit.provenance_failures.length > 0)
  })
  check("A difficulty entered in the strength field is not a preserved skill", () => {
    const facts = extractCanonicalAnamnesisEvidence({ ...get(1).input, anamnez: "Çocuğun güçlü yanları: Tuvalet ihtiyacını son anda söylüyor ve oyunu aniden bırakıyor." })
    assert.ok(facts.some(factSupportsDifficulty))
    assert.equal(facts.some(factSupportsPreservedCapacity), false)
  })
  check("No provider/network calls", () => assert.equal(networkAttempts, 0))
  const summary = { checks: checks.length, pass: checks.every(c => c.pass), failures: checks.filter(c => !c.pass), accepted: results.filter(r => r.result.validation.pass && r.result.templateSemanticLeakage.pass && r.result.reportStatus === "ready_for_therapist_review").length, networkAttempts, providerCalls: 0, providerCostUsd: 0,
    cases: results.map((r, i) => ({ id: r.id, inputSha256: sha(r.input), reportSha256: sha(r.text), confidenceBefore: cases[i].baseline.confidence.category, confidenceAfter: r.result.confidence.category, validation: r.result.validation, beforeAccepted: cases[i].baseline.accepted })) }
  fs.writeFileSync(path.join(output, "regression-summary.json"), JSON.stringify(summary, null, 2))
  fs.writeFileSync(path.join(output, "checks.json"), JSON.stringify(checks, null, 2))
  fs.writeFileSync(path.join(output, "SAME_10_AFTER.md"), results.map((r, i) => `# ${r.id} — ${cases[i].title}\n\n${r.text}`).join("\n\n---\n\n"))
  fs.writeFileSync(path.join(output, "sealed-evidence.jsonl"), results.map(r => JSON.stringify({ id: r.id, input: r.input, quality: r.result.dataQuality, confidence: r.result.confidence, envelope: r.result.caseScopedEvidenceEnvelope, decision: r.result.decision_explanation, plan: r.result.lockedLanguagePlan, validation: r.result.validation })).join("\n"))
  console.log(JSON.stringify({ checks: summary.checks, accepted: summary.accepted, pass: summary.pass, failures: summary.failures, output }, null, 2))
  assert.equal(summary.pass, true)
}
main().catch(error => { console.error(error); process.exitCode = 1 })
