import type {
  StudentAnswerObligation,
  StudentAnswerObligationKind,
  StudentConversationAction,
  StudentObservationScope,
  StudentPresentationRequest,
  StudentSemanticTask,
  StudentSummaryScope,
} from "./contracts"

export const DNA_STUDENT_OBLIGATION_COMPILER_VERSION = "dna-student-obligation-compiler@1" as const

const OBLIGATION_DESCRIPTIONS: Readonly<Record<StudentAnswerObligationKind, string>> = Object.freeze({
  define_target: "Hedef kavramı doğrudan tanımla",
  distinguish_targets: "Karşılaştırılan kavramları birbirinden ayır",
  explain_relation: "Kavramların ilişkisini açıkla",
  give_concrete_example: "İstenen bağlamda somut örnek ver",
  bind_example_to_target: "Örneğin hedef kavramla bağını açıkla",
  honor_rejected_target: "Kullanıcının reddettiği hedefe geri dönme",
  use_history_anchor: "Doğru geçmiş konuşma hedefini kullan",
  preserve_target_while_simplifying: "Aynı hedefi daha sade dille anlat",
  cover_requested_component: "İstenen bileşeni ayrı karşıla",
  state_single_observation_limit: "Tek gözlemden kesin sonuç çıkarma",
  name_additional_context: "Gerekli ek bağlam veya gözlemi belirt",
  summarize_known: "Konuşmada desteklenen bilgileri özetle",
  summarize_unknown: "Bilinmeyen veya kesinleştirilemeyen noktaları özetle",
  summarize_observation_focus: "Gözlemde izlenecek noktaları özetle",
  refuse_treatment_selection: "Tedavi veya terapi seçimi yapma",
  offer_safe_assessment_frame: "Güvenli genel değerlendirme çerçevesi sun",
})

export type StudentObligationCompilationInput = Readonly<{
  semanticTask: StudentSemanticTask
  conversationAction: StudentConversationAction
  targetIds: readonly string[]
  rejectedTargetIds: readonly string[]
  comparisonTargetIds: readonly string[]
  componentTargetIds: readonly string[]
  presentation: StudentPresentationRequest
  summaryScope: StudentSummaryScope
  observationScope: StudentObservationScope
}>

export function compileStudentAnswerObligations(
  turnId: string,
  input: StudentObligationCompilationInput,
): readonly StudentAnswerObligation[] {
  const rows: Array<Readonly<{ kind: StudentAnswerObligationKind; targetIds: readonly string[] }>> = []
  const seen = new Set<string>()
  const add = (kind: StudentAnswerObligationKind, targetIds: readonly string[]) => {
    const normalizedTargets = [...new Set(targetIds)]
    const key = `${kind}:${normalizedTargets.join(",")}`
    if (seen.has(key)) return
    seen.add(key)
    rows.push(Object.freeze({ kind, targetIds: Object.freeze(normalizedTargets) }))
  }

  if (input.semanticTask === "define" || input.semanticTask === "explain") add("define_target", input.targetIds)
  if (input.semanticTask === "compare") {
    add("distinguish_targets", input.comparisonTargetIds)
    add("explain_relation", input.comparisonTargetIds)
  }
  if (input.semanticTask === "example") {
    add("give_concrete_example", input.targetIds)
    add("bind_example_to_target", input.targetIds)
  }
  if (input.observationScope.singleObservationLimit) add("state_single_observation_limit", input.targetIds)
  if (input.observationScope.additionalContext) add("name_additional_context", input.targetIds)
  if (input.semanticTask === "summarize") {
    if (input.summaryScope.known) add("summarize_known", input.targetIds)
    if (input.summaryScope.unknown) add("summarize_unknown", input.targetIds)
    if (input.summaryScope.observationFocus) add("summarize_observation_focus", input.targetIds)
  }
  if (input.semanticTask === "treatment_boundary") {
    add("refuse_treatment_selection", input.targetIds)
    add("offer_safe_assessment_frame", input.targetIds)
  }
  if (input.conversationAction === "repair" && input.rejectedTargetIds.length) {
    add("honor_rejected_target", input.rejectedTargetIds)
  }
  if (input.conversationAction === "return") add("use_history_anchor", input.targetIds)
  if (input.presentation.preserveMeaning) add("preserve_target_while_simplifying", input.targetIds)
  for (const targetId of input.componentTargetIds) add("cover_requested_component", [targetId])
  if (input.presentation.example !== "none" && input.semanticTask !== "example") {
    add("give_concrete_example", input.targetIds)
  }
  if (!rows.length) add("define_target", input.targetIds)

  return Object.freeze(rows.map((row, index) => Object.freeze({
    id: `${turnId}:o${index + 1}`,
    kind: row.kind,
    targetIds: row.targetIds,
    description: OBLIGATION_DESCRIPTIONS[row.kind],
  })))
}
