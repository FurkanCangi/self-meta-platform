import type {
  StudentAnswerObligation,
  StudentAnswerObligationKind,
  StudentConversationAction,
  StudentObservationScope,
  StudentPresentationRequest,
  StudentSemanticTask,
  StudentSummaryScope,
} from "./contracts"

export const DNA_STUDENT_OBLIGATION_COMPILER_VERSION = "dna-student-obligation-compiler@17" as const

const OBLIGATION_DESCRIPTIONS: Readonly<Record<StudentAnswerObligationKind, string>> = Object.freeze({
  define_target: "Hedef kavramı doğrudan tanımla",
  explain_target: "Hedefin işleyişini doğrudan açıkla",
  explain_source_evidence: "Mevcut onaylı kaynağın hedef hakkında ne söylediğini içerikle açıkla; yalnız genel sınır uyarısı verme. Kavramsal açıklamayı deneysel çalışma sonucu gibi sunma, kaynakta bulunmayan çalışma veya bulgu ekleme",
  explain_significance: "Hedefin işlevini ve neden önemli olduğunu açıkla",
  deepen_with_new_information: "Önceki açıklamayı tekrarlamadan yeni mekanizma veya ayrıntı ekle",
  state_evidence_limit: "Kanıtın ve yorumun sınırını açıkça belirt",
  avoid_causal_overclaim: "Birliktelikten kesin neden, tanı veya kapasite sonucu çıkarma",
  describe_measurement_scope: "Ölçüm yaklaşımını ve sonucun neyi gösterip göstermediğini açıkla",
  explain_mechanism: "Tanımı tekrarlamadan, kaynakta desteklenen süreç, değişim veya bağlantının nasıl işlediğini hedefe özgü açıkla; kaynak süreç sunmuyorsa mekanizma sınırını belirt",
  explain_daily_life_meaning: "Tanımı tekrarlamadan, hedefin günlük yaşam, karar veya katılım açısından ne değiştirdiğini kaynakla sınırlı açıkla; kaynak bu sonucu sunmuyorsa hedefe özgü günlük yaşam kanıt sınırını açıkça belirt ve genel tavsiyeyle doldurma",
  distinguish_targets: "Karşılaştırılan kavramları birbirinden ayır",
  contrast_target_states: "Aynı hedefin istenen düşük ve yüksek durumlarını karşılaştır",
  state_context_dependency: "Katılımın kişi, görev ve ortam bağlamına bağlı olduğunu belirt",
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
  historyAnchorRequired: boolean
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
  const presentationOnly = requestedTasks.size === 0 && input.presentation.preserveMeaning && input.conversationAction === "continue"
  requestedTasks.add(input.semanticTask)
  const treatmentBoundary = requestedTasks.has("treatment_boundary") || input.semanticTask === "treatment_boundary"
  const summary = requestedTasks.has("summarize") || input.semanticTask === "summarize"
  if (!treatmentBoundary && !summary) {
    if (!presentationOnly && requestedTasks.has("compare")) {
      if (input.observationScope.withinTargetStateContrast) {
        add("contrast_target_states", input.comparisonTargetIds)
        add("state_context_dependency", input.comparisonTargetIds)
      } else {
        add("distinguish_targets", input.comparisonTargetIds)
        // Distinguishing concepts does not request a scientific relationship.
        // A separate explicit `relate` task below retains that obligation;
        // missing relationship evidence must not manufacture a comparison FAIL.
      }
    }
    if (!presentationOnly && requestedTasks.has("example")) {
      add("give_concrete_example", input.targetIds)
      add("bind_example_to_target", input.targetIds)
      if (input.presentation.exampleScope === "shared") add("use_shared_scenario", input.targetIds)
    }
    if (!presentationOnly) {
      if (input.semanticTask === "define") add("define_target", input.targetIds)
      else if (["explain", "significance", "boundary", "measurement"].includes(input.semanticTask)) {
        add("explain_target", input.targetIds)
      }
      if (requestedTasks.has("significance")) add("explain_significance", input.targetIds)
      if (requestedTasks.has("relate")) add("explain_relation", input.targetIds)
      if (requestedTasks.has("deepen")) add("deepen_with_new_information", input.targetIds)
      if (requestedTasks.has("mechanism")) add("explain_mechanism", input.targetIds)
      if (requestedTasks.has("daily_life")) add("explain_daily_life_meaning", input.targetIds)
      if (requestedTasks.has("boundary")) {
        add("state_evidence_limit", input.targetIds)
        add("avoid_causal_overclaim", input.targetIds)
      }
      if (requestedTasks.has("measurement")) {
        add("describe_measurement_scope", input.targetIds)
        add("state_evidence_limit", input.targetIds)
      }
      if (requestedTasks.has("evidence")) {
        // A source-content request and its epistemic limit are separate duties.
        // Explicit boundary questions retain their existing explanation/limit
        // contract; the evidence keyword alone must not expand that scope.
        if (!requestedTasks.has("boundary")) add("explain_source_evidence", input.targetIds)
        add("state_evidence_limit", input.targetIds)
      }
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
    if (input.summaryScope.known && input.targetIds.length > 1) add("distinguish_targets", input.targetIds)
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
  if (input.conversationAction === "return" || input.historyAnchorRequired) {
    add("use_history_anchor", input.targetIds)
  }
  if (input.presentation.preserveMeaning) add("preserve_target_while_simplifying", input.targetIds)
  for (const targetId of input.componentTargetIds) add("cover_requested_component", [targetId])
  // A local case boundary changes the execution route, not the user's secondary
  // explanation request. Append so the existing observation duty IDs stay stable.
  // Explain the supported concept without turning it into an individual conclusion.
  if (!treatmentBoundary && input.semanticTask === "case_reasoning" && requestedTasks.has("explain")) {
    add("explain_target", input.targetIds)
    add("state_evidence_limit", input.targetIds)
  }
  if (!rows.length) add("define_target", input.targetIds)

  return Object.freeze(rows.map((row, index) => Object.freeze({
    id: `${turnId}:o${index + 1}`,
    kind: row.kind,
    targetIds: row.targetIds,
    description: OBLIGATION_DESCRIPTIONS[row.kind],
  })))
}
