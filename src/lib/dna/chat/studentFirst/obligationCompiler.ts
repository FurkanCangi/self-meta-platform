import type {
  StudentAnswerObligation,
  StudentAnswerObligationKind,
  StudentConversationAction,
  StudentObservationScope,
  StudentPresentationRequest,
  StudentSemanticTask,
  StudentSummaryScope,
} from "./contracts"

export const DNA_STUDENT_OBLIGATION_COMPILER_VERSION = "dna-student-obligation-compiler@6" as const

const OBLIGATION_DESCRIPTIONS: Readonly<Record<StudentAnswerObligationKind, string>> = Object.freeze({
  define_target: "Hedef kavramı doğrudan tanımla",
  distinguish_targets: "Karşılaştırılan kavramları birbirinden ayır",
  contrast_target_states: "Aynı hedefin istenen düşük ve yüksek durumlarını karşılaştır",
  explain_relation: "Kavramların ilişkisini açıkla",
  give_concrete_example: "İstenen bağlamda somut örnek ver",
  bind_example_to_target: "Örneğin hedef kavramla bağını açıkla",
  use_shared_scenario: "Bütün hedefleri tek ortak senaryoda ayrı ayrı göster",
  honor_rejected_target: "Kullanıcının reddettiği hedefe geri dönme",
  use_history_anchor: "Doğru geçmiş konuşma hedefini kullan",
  preserve_target_while_simplifying: "Aynı hedefi daha sade dille anlat",
  cover_requested_component: "İstenen bileşeni ayrı karşıla",
  state_single_observation_limit: "Tek gözlemden kesin sonuç çıkarma",
  name_additional_context: "Gerekli ek bağlam veya gözlemi belirt",
  name_multiple_plausible_explanations: "Vaka davranışı için birden fazla makul açıklama sun",
  avoid_context_free_judgment: "Davranışı bağlamdan kopuk biçimde iyi veya kötü diye sınıflandırma",
  summarize_known: "Konuşmada desteklenen bilgileri özetle",
  summarize_unknown: "Bilinmeyen veya kesinleştirilemeyen noktaları özetle",
  summarize_observation_focus: "Gözlemde izlenecek noktaları özetle",
  refuse_treatment_selection: "Tedavi veya terapi seçimi yapma",
  offer_safe_assessment_frame: "Güvenli genel değerlendirme çerçevesi sun",
})

export type StudentObligationCompilationInput = Readonly<{
  semanticTask: StudentSemanticTask
  requestedSemanticTasks: readonly StudentSemanticTask[]
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

  const requestedTasks = new Set(input.requestedSemanticTasks)
  const treatmentBoundary = requestedTasks.has("treatment_boundary") || input.semanticTask === "treatment_boundary"
  const summary = requestedTasks.has("summarize") || input.semanticTask === "summarize"
  const presentationOnly = requestedTasks.size === 0 && input.presentation.preserveMeaning && input.conversationAction === "continue"
  if (!treatmentBoundary && !summary) {
    if (!presentationOnly && input.semanticTask === "compare") {
      if (input.observationScope.withinTargetStateContrast) {
        add("contrast_target_states", input.comparisonTargetIds)
      } else {
        add("distinguish_targets", input.comparisonTargetIds)
        add("explain_relation", input.comparisonTargetIds)
      }
    }
    if (!presentationOnly && (input.semanticTask === "example" || requestedTasks.has("example"))) {
      add("give_concrete_example", input.targetIds)
      add("bind_example_to_target", input.targetIds)
      if (input.presentation.exampleScope === "shared") add("use_shared_scenario", input.targetIds)
    }
    if (!presentationOnly && (input.semanticTask === "define" || input.semanticTask === "explain")) {
      add("define_target", input.targetIds)
    }
  }
  if (input.observationScope.singleObservationLimit) add("state_single_observation_limit", input.targetIds)
  if (input.observationScope.additionalContext) add("name_additional_context", input.targetIds)
  if (input.observationScope.multiplePlausibleExplanations) {
    add("name_multiple_plausible_explanations", input.targetIds)
  }
  if (input.observationScope.contextualJudgment) {
    add("avoid_context_free_judgment", input.targetIds)
  }
  if (summary) {
    if (input.summaryScope.known) add("summarize_known", input.targetIds)
    if (input.summaryScope.unknown) add("summarize_unknown", input.targetIds)
    if (input.summaryScope.observationFocus) add("summarize_observation_focus", input.targetIds)
  }
  if (treatmentBoundary) {
    add("refuse_treatment_selection", input.targetIds)
    add("offer_safe_assessment_frame", input.targetIds)
  }
  if (input.conversationAction === "repair" && input.rejectedTargetIds.length) {
    add("honor_rejected_target", input.rejectedTargetIds)
  }
  if (input.conversationAction === "return") add("use_history_anchor", input.targetIds)
  if (input.presentation.preserveMeaning) add("preserve_target_while_simplifying", input.targetIds)
  for (const targetId of input.componentTargetIds) add("cover_requested_component", [targetId])
  if (!rows.length) add("define_target", input.targetIds)

  return Object.freeze(rows.map((row, index) => Object.freeze({
    id: `${turnId}:o${index + 1}`,
    kind: row.kind,
    targetIds: row.targetIds,
    description: OBLIGATION_DESCRIPTIONS[row.kind],
  })))
}
