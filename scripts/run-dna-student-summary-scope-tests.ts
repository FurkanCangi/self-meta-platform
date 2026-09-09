import assert from "node:assert/strict"
import { createEmptyStudentConversationState } from "../src/lib/dna/chat/studentFirst/conversationState"
import { resolveStudentEvidenceFirstRequest } from "../src/lib/dna/chat/studentFirst/evidenceFirstRequest"
import { buildStudentAnswerExecutionPlan } from "../src/lib/dna/chat/studentFirst/answerExecution"

// New development contrasts, never replacements for frozen Student40/holdouts.
// Check both intent and plan handoff; this is not a semantic quality judge.
const positive = [
  "interosepsiyon için bildiklerimizi, kesin olmayanları ve gözlem odağını özetle",
  "interosepsiyonda neyi bildiğimizi neyi kesin söyleyemediğimizi ve gözlemde neye bakacağımı toparla",
  "interosepsiyon için bildiklerimizi ve bilmediklerimizi özetle",
  "interosepsiyon için bilmediğimiz konuları özetle",
  "interosepsiyonda emin olmadığımız noktaları da özetle",
  "interosepsiyonda belirsiz kalan noktaları da toparla",
  "interosepsiyonda kesinleşmemiş bilgileri de özetle",
  "interosepsiyon için bilinmeyenleri özetle",
  "interosepsiyon için net olmayanları özetle",
  "interosepsiyon için henüz kanıtlanmamış bilgileri özetle",
  "interosepsiyon için yorum sınırlarını da özetle",
  "interosepsiyon için kanıtın sınırını da özetle",
  "interosepsiyonu özetle, neyi bilmiyoruz onu da söyle",
  "interosepsiyonu özetle, bilmediklerimizi de ekle",
  "interosepsiyonu özetle, ekle bilmediklerimizi de",
  "interosepsiyonu özetle, bilmediklerimizi ekler misin",
  "interosepsiyonu özetle, bilmediklerimizi ekleyebilir misin",
  "interosepsiyonu özetle, bilmediklerimizi ekleyebilirsin",
  "interosepsiyonu özetle, bilmediklerimizi ekle ama örnek ekleme",
  "interosepsiyonu özetle, bildiklerimizi değil bilmediklerimizi de belirt",
  "interosepsiyonu özetle, bilmediklerimizi ekleme; hayır bilmediklerimizi de ekle",
  "interosepsiyonda neyi biliyoruz neyi kesin söyleyemiyoruz diye iki cümlelik öğrenci özeti yap",
  "interosepsiyonu özetle, hangi konularda kesin konuşmadık onları da ayrıca söyle",
  "interosepsiyonu özetle, hangi konularda kesin konuşmadın onları da ayrıca söyle",
  "interosepsiyonu özetle, hangi konularda kesin konuşmadınız onları da ayrıca söyle",
  "interosepsiyonu özetle, neyi kesin söyleyemedin onu da belirt",
  "çalışma belleğinde emin olmadığımız noktaları da özetle",
]
const negative = [
  "interosepsiyon tanımını özetle",
  "interosepsiyonda emin olduğumuz noktaları özetle",
  "interosepsiyonda kesin olan bilgileri özetle",
  "interosepsiyon için sadece bildiklerimizi özetle, bilmediklerimizi ekleme",
  "interosepsiyon için sadece bildiklerimizi özetle, bilmediğimiz konuları ekleme",
  "interosepsiyonu özetle, kesin olmayanları yazma",
  "interosepsiyonu özetle, bilinmeyenlerden bahsetme",
  "interosepsiyonu özetle, belirsiz kalan noktaları eklemeyin",
  "interosepsiyonu özetle, bilmediklerimizi değil bildiklerimizi anlat",
  "interosepsiyonu özetle, bilmediklerimizi istemiyorum",
  "interosepsiyonu özetle, bilmediklerimizi atla",
  "interosepsiyonu özetle, bilmediklerimizi özetten çıkar",
  "interosepsiyonu özetle, bilmediklerimizi ekle demiyorum",
  "interosepsiyonu özetle, bilmediklerimizi ekle demedim",
  "interosepsiyonu özetle, bilmediklerimizi eklediğini söyledim",
  "interosepsiyonu özetle, bilmediklerimizi ekle; sonra bilmediklerimizi çıkar",
  "interosepsiyon tanımını özetle, \"bilmediklerimizi ekle\" ifadesini kullanma",
  "interosepsiyon tanımını özetle, ben interosepsiyonu bilmiyorum",
  "interosepsiyonu özetle, kesin konuşmadın diye bilmediğimiz konuları ekleme",
]
const failures: Array<{ question: string; expectedUnknown: boolean; actual: unknown }> = []
let plansChecked = 0
for (const [expectedUnknown, questions] of [[true, positive], [false, negative]] as const) {
  for (const question of questions) {
    const resolved = resolveStudentEvidenceFirstRequest({ turnId: `scope-${plansChecked + 1}`,
      message: question, state: createEmptyStudentConversationState() })
    if (!resolved.ok) { failures.push({ question, expectedUnknown, actual: resolved.reason }); continue }
    assert.equal(resolved.contract.semanticTask, "summarize", question)
    const plan = buildStudentAnswerExecutionPlan({ question, contract: resolved.contract })
    const hasObligation = resolved.contract.obligations.some((obligation) => obligation.kind === "summarize_unknown")
    const unknown = resolved.contract.summaryScope.unknown
    assert.equal(hasObligation, unknown, "resolved scope must reach the obligation compiler")
    assert.equal(Boolean(plan.summaryEpistemicScope), unknown, "resolved scope must reach the plan")
    assert.equal(JSON.stringify(resolved.facts).includes(question), false, "raw request must not be persisted")
    if (unknown !== expectedUnknown) failures.push({ question, expectedUnknown, actual: unknown })
    plansChecked++
  }
}
console.log(JSON.stringify({ ok: failures.length === 0, gate: "STUDENT_SUMMARY_EPISTEMIC_SCOPE",
  positiveControls: positive.length, negativeControls: negative.length, plansChecked, failures,
  externalProviderCalls: 0, semanticQualityCertified: false }, null, 2))
if (failures.length) process.exitCode = 1
