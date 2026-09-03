import type {
  CaseScopedEvidenceFact,
  ClauseClaimType,
  ClauseEntailmentError,
  ClauseEntailmentLevel,
  JuryClauseProvenance,
  JuryReportSectionId,
  JuryStatementType,
  SourceEvidenceRelation,
} from "./contracts"
import {
  factEligibleForPreservedCapacity,
  factHasObservedContextComparison,
  factSupportsDifficultyDirection,
  relationIsConvergent,
  relationIsDiscrepant,
  relationsForFacts,
} from "./evidenceSemantics"

type SemanticCategory = "context" | "support" | "outcome" | "temporal" | "task" | "behavior"

export type SemanticRequirement = Readonly<{
  id: string
  category: SemanticCategory
  visible: RegExp
  evidence: RegExp
}>

// Concrete scenario details are deliberately closed-world. A lexical theme may
// choose a narrative family, but every detail below must also occur in a cited
// current-case fact before it can appear in visible text.
export const TEMPLATE_SEMANTIC_REQUIREMENTS: readonly SemanticRequirement[] = Object.freeze([
  { id: "game_ending", category: "context", visible: /oyun(?:un)?\s+bitiş|oyun\s+bit|oyuncak(?:ların)?\s+toplan/iu, evidence: /oyun(?:un)?\s+bitiş|oyun\s+bit|oyuncak(?:ların)?\s+toplan/iu },
  { id: "transition", category: "context", visible: /(?:^|[^\p{L}])geçiş(?:te|i|ler| sırasında)?(?=$|[^\p{L}])/iu, evidence: /(?:^|[^\p{L}])geçiş(?:te|i|ler| sırasında)?(?=$|[^\p{L}])/iu },
  { id: "home_context", category: "context", visible: /\bevde\b|\bev ortam/iu, evidence: /\bevde\b|\bev ortam/iu },
  { id: "school_context", category: "context", visible: /\bokulda\b|\bokul ortam/iu, evidence: /\bokulda\b|\bokul ortam/iu },
  { id: "clinic_context", category: "context", visible: /\bklinik(?:te| ortam)/iu, evidence: /\bklinik(?:te| ortam)/iu },
  { id: "structured_context", category: "context", visible: /\byapılandırılmış\s+(?:koşul|ortam|görev)/iu, evidence: /\byapılandırılmış\s+(?:koşul|ortam|görev)/iu },
  { id: "choice_offered", category: "support", visible: /seçenek\s+sun|iki\s+seçenek|seçim\s+hakkı/iu, evidence: /seçenek\s+sun|iki\s+seçenek|seçim\s+hakkı/iu },
  { id: "visual_support", category: "support", visible: /görsel(?:le| olarak)?\s+destek|görsel\s+program|sıra\s+kartı/iu, evidence: /görsel(?:le| olarak)?\s+destek|görsel\s+program|sıra\s+kartı/iu },
  { id: "written_steps", category: "support", visible: /yazılı\s+(?:üç|3)\s+basamak|yazılı\s+sıra/iu, evidence: /yazılı\s+(?:üç|3)\s+basamak|yazılı\s+sıra/iu },
  { id: "task_split", category: "support", visible: /tek\s+basamaklara?\s+ayr|görev(?:in)?\s+parçalan/iu, evidence: /tek\s+basamaklara?\s+ayr|görev(?:in)?\s+parçalan/iu },
  { id: "calm_environment", category: "support", visible: /sakin\s+(?:bir\s+)?(?:ortam|köşe|oda)/iu, evidence: /sakin\s+(?:bir\s+)?(?:ortam|köşe|oda)/iu },
  { id: "short_wait", category: "support", visible: /kısa\s+bekleme|bekleme\s+süresi/iu, evidence: /kısa\s+bekleme|bekleme\s+süresi/iu },
  { id: "body_card", category: "support", visible: /beden\s+kartı/iu, evidence: /beden\s+kartı/iu },
  { id: "break_water_walk", category: "support", visible: /mola,?\s*su\s+ve\s+kısa\s+yürüyüş|mola[^.]{0,40}su[^.]{0,40}yürüyüş/iu, evidence: /mola[^.]{0,40}su[^.]{0,40}yürüyüş/iu },
  { id: "reengagement", category: "outcome", visible: /etkinliğe\s+geri\s+dön|göreve\s+geri\s+dön|yeniden\s+(?:etkinliğe|göreve)\s+dön/iu, evidence: /etkinliğe\s+geri\s+dön|göreve\s+geri\s+dön|yeniden\s+(?:etkinliğe|göreve)\s+dön/iu },
  { id: "task_completed", category: "outcome", visible: /görevi[^.]{0,60}(?:tamamladı|tamamlayabildi|tamamlanabildi|tamamlandı)|alışveriş\s+görevini[^.]{0,50}(?:tamamladı|tamamlayabildi)/iu, evidence: /görevi[^.]{0,60}(?:tamamladı|tamamlayabildi|tamamlanabildi|tamamlandı)|alışveriş\s+görevini[^.]{0,50}(?:tamamladı|tamamlayabildi)/iu },
  { id: "support_removed_breakdown", category: "outcome", visible: /deste(?:k|ğin)\s+kaldırıl[^.]{0,80}(?:bozul|zorlan)/iu, evidence: /deste(?:k|ğin)\s+kaldırıl[^.]{0,80}(?:bozul|zorlan)/iu },
  { id: "need_named", category: "outcome", visible: /gereksinim(?:in)?\s+adlandırıl/iu, evidence: /gereksinim(?:in)?\s+adlandırıl/iu },
  { id: "distress_resolved", category: "outcome", visible: /itiraz(?:ın)?[^.]{0,100}(?:çözül|azal)|zorlanma[^.]{0,100}(?:çözül|azal)/iu, evidence: /itiraz(?:ın)?[^.]{0,100}(?:çözül|azal)|zorlanma[^.]{0,100}(?:çözül|azal)/iu },
  { id: "recovery_duration", category: "temporal", visible: /toparlanma\s+süresinin[^.]{0,100}(?:ayırt|uzun|kısa|değiş)|(?:dakika|saat)\s+sonra[^.]{0,60}toparlan/iu, evidence: /toparlanma\s+süresinin[^.]{0,100}(?:ayırt|uzun|kısa|değiş)|(?:dakika|saat)\s+sonra[^.]{0,60}toparlan/iu },
  { id: "morning", category: "temporal", visible: /\bsabah\b/iu, evidence: /\bsabah\b/iu },
  { id: "evening", category: "temporal", visible: /\bakşam\b/iu, evidence: /\bakşam\b/iu },
  { id: "rested_tired_comparison", category: "temporal", visible: /dinlenmiş\s+ve\s+yorgun\s+gün|yorgun\s+gün/iu, evidence: /dinlenmiş\s+ve\s+yorgun\s+gün|yorgun\s+gün/iu },
  { id: "cafeteria", category: "context", visible: /\bkantin(?:de| sırası)?\b/iu, evidence: /\bkantin(?:de| sırası)?\b/iu },
  { id: "classroom_noise", category: "context", visible: /sınıf\s+uğultu|sınıf(?:taki)?\s+gürültü/iu, evidence: /sınıf\s+uğultu|sınıf(?:taki)?\s+gürültü/iu },
  { id: "shopping_mall", category: "context", visible: /\bAVM\b/iu, evidence: /\bAVM\b/iu },
  { id: "long_journey", category: "context", visible: /uzun\s+yolculuk/iu, evidence: /uzun\s+yolculuk/iu },
  { id: "dressing", category: "task", visible: /giyinme|gömle(?:k|ği)|düğme/iu, evidence: /giyinme|gömle(?:k|ği)|düğme/iu },
  { id: "backpack", category: "task", visible: /çanta(?:sını|yı)?\s+hazırla/iu, evidence: /çanta(?:sını|yı)?\s+hazırla/iu },
  { id: "three_steps", category: "task", visible: /(?:üç|3)\s+basamak/iu, evidence: /(?:üç|3)\s+basamak/iu },
  { id: "money_transaction", category: "task", visible: /para\s+işlemi/iu, evidence: /para\s+işlemi/iu },
  { id: "tray_use", category: "task", visible: /tepsi\s+kullan/iu, evidence: /tepsi\s+kullan/iu },
  { id: "queue_tracking", category: "task", visible: /sıra\s+takib/iu, evidence: /sıra\s+takib/iu },
  { id: "hunger", category: "context", visible: /\baçlık\b/iu, evidence: /\baçlık\b/iu },
  { id: "thirst", category: "context", visible: /\bsusuzluk\b|\bsusuz\b/iu, evidence: /\bsusuzluk\b|\bsusuz\b/iu },
  { id: "toilet", category: "context", visible: /\btuvalet\b/iu, evidence: /\btuvalet\b/iu },
  { id: "heat", category: "context", visible: /\bsıcaklık\b/iu, evidence: /\bsıcaklık\b/iu },
  { id: "blender_sound", category: "context", visible: /blender\s+sesi/iu, evidence: /blender\s+sesi/iu },
  { id: "chair_sound", category: "context", visible: /sandalye\s+sesi/iu, evidence: /sandalye\s+sesi/iu },
  { id: "speaker_sound", category: "context", visible: /hoparlör\s+sesi/iu, evidence: /hoparlör\s+sesi/iu },
  { id: "haircut", category: "context", visible: /saç\s+kesim/iu, evidence: /saç\s+kesim/iu },
  { id: "anger", category: "behavior", visible: /\böfke|\bbağır|\bkızgın/iu, evidence: /\böfke|\bbağır|\bkızgın/iu },
  { id: "hiding", category: "behavior", visible: /masa\s+altı|saklan/iu, evidence: /masa\s+altı|saklan/iu },
  { id: "leaving_environment", category: "behavior", visible: /ortamdan\s+uzaklaş|ortamı\s+terk/iu, evidence: /ortamdan\s+uzaklaş|ortamı\s+terk/iu },
])

function unique<T>(items: readonly T[]): T[] {
  return Array.from(new Set(items))
}

function normalize(value: string): string {
  return value.toLocaleLowerCase("tr-TR").replace(/[^a-z0-9çğıöşü]+/gu, " ").trim()
}

export function decomposeVisibleSentence(sentence: string): readonly string[] {
  const coarse = sentence
    .split(/(?<=[;:])\s+|,\s+(?=(?:ancak|fakat|buna karşın|duygusal|seçenek|görev|bakım veren|terapist|bu |diğer |aynı |farklı ))|\s+(?:ancak|fakat|buna karşın)\s+/iu)
    .map((item) => item.trim())
    .filter(Boolean)
  return Object.freeze(coarse.length ? coarse : [sentence.trim()])
}

function claimType(statementType: JuryStatementType, text: string): ClauseClaimType {
  if (statementType === "boundary") return "BOUNDARY"
  if (statementType === "literature_link") return "LITERATURE"
  if (statementType === "case_fact") return "CASE_DETAIL"
  if (/(?:puan|beklenen aralık|profil|birincil öncelik|ölçek toplam)/iu.test(text)) return "PROFILE_INTERPRETATION"
  return "SYNTHESIS"
}

function errorForCategory(category: SemanticCategory): ClauseEntailmentError {
  if (category === "context" || category === "task" || category === "behavior") return "UNSUPPORTED_CONTEXT_DETAIL"
  if (category === "support") return "UNSUPPORTED_SUPPORT_DETAIL"
  if (category === "outcome") return "UNSUPPORTED_OUTCOME_DETAIL"
  return "UNSUPPORTED_TEMPORAL_DETAIL"
}

export type EvaluateSentenceInput = Readonly<{
  sentenceId: string
  caseId: string
  sectionId: JuryReportSectionId
  paragraphId: string
  sentence: string
  statementType: JuryStatementType
  facts: readonly CaseScopedEvidenceFact[]
  relations?: readonly SourceEvidenceRelation[]
  decisionIds?: readonly string[]
  literatureIds?: readonly string[]
}>

export function evaluateSentenceEntailment(input: EvaluateSentenceInput): readonly JuryClauseProvenance[] {
  const factText = input.facts.map((fact) => `${fact.statement} ${fact.source_excerpt}`).join("\n")
  const onlyProfileFacts = input.facts.length > 0 && input.facts.every((fact) => fact.source_type === "DNA_SCORE")
  const clauses = decomposeVisibleSentence(input.sentence)
  const results = clauses.map((clause, index) => {
    const genericProfileImplication = (input.decisionIds?.length ?? 0) > 0
      && /(?:zorlaşabilir|gerekebilir|değişebilir|beklenen aralık|ölçüm koşullarında)/iu.test(clause)
    const semanticTemplateExempt = input.statementType === "boundary" || input.statementType === "literature_link"
    const required = genericProfileImplication || semanticTemplateExempt ? [] : TEMPLATE_SEMANTIC_REQUIREMENTS.filter((requirement) => requirement.visible.test(clause))
    const supported = required.filter((requirement) => requirement.evidence.test(factText))
    const missing = required.filter((requirement) => !supported.includes(requirement))
    const directFact = input.facts.find((fact) => normalize(fact.statement) === normalize(clause) || normalize(fact.source_excerpt) === normalize(clause))
    let level: ClauseEntailmentLevel
    if (missing.length) level = "UNSUPPORTED"
    else if (directFact) level = "DIRECT"
    else if (required.length && input.facts.length) level = "COMPOSITIONAL"
    else if (genericProfileImplication) level = "PROFILE_DERIVED"
    else if (input.statementType === "boundary" || input.statementType === "literature_link") level = "COMPOSITIONAL"
    else if ((input.decisionIds?.length ?? 0) > 0 && !input.facts.length) level = "PROFILE_DERIVED"
    else if (input.facts.length) level = onlyProfileFacts ? "PROFILE_DERIVED" : "COMPOSITIONAL"
    else level = (input.decisionIds?.length ?? 0) > 0 ? "PROFILE_DERIVED" : "UNSUPPORTED"

    const errors: ClauseEntailmentError[] = []
    if (level === "UNSUPPORTED") {
      errors.push("UNSUPPORTED_VISIBLE_CLAUSE")
      if (input.facts.length) errors.push("FACT_ID_PRESENT_BUT_NOT_ENTAILING")
      if (missing.length) errors.push("TEMPLATE_DETAIL_WITHOUT_EVIDENCE")
      if (onlyProfileFacts && missing.length) errors.push("PROFILE_TO_FUNCTION_OVERREACH")
      for (const requirement of missing) errors.push(errorForCategory(requirement.category))
    }
    const contentEntailment: JuryClauseProvenance["content_entailment"] = level === "UNSUPPORTED" ? "FAIL" : "PASS"
    const preservedClaim = /(?:korunmuş(?:\s+kapasite|\s+işlev|\s+beceri|\s+yön)|beceri\w*\s+korundu|kapasite(?:nin)?\s+korundu|beklenen\s+aralık(?:ta|tadır)|güçlük\s+(?:bildirilmedi|görülmedi|yok))/iu.test(clause)
      && !/(?:korunmuş\s+kapasite|beklenen\s+yöndeki\s+sonuç)[^.]{0,100}(?:kanıtı\s+olarak\s+)?kullanılmam/iu.test(clause)
    const negatedDifficultyClaim = /(?:güçlük\s+(?:görmedi|bildirilmedi|bildirmedi|yok|olmad)|belirgin\s+güçlük[^.]{0,60}(?:görmedi|bildirilmedi|bildirmedi|yok|olmad)|zorlanma[^.]{0,60}(?:görülmedi|bildirilmedi|yok|olmad))/iu.test(clause)
    const difficultyClaim = !negatedDifficultyClaim
      && /(?:güçlük\s+yön|belirgin\s+güçlük|güçlüğü\s+(?:destek|göster)|zorlanma|beklenen\s+aralığın\s+dışında)/iu.test(clause)
    const convergenceClaim = !/(?:aynı\s+yönde\s+değil|aynı\s+yönde\s+sonuç\s+vermem|tam\s+olarak\s+örtüşmem)/iu.test(clause) && (
      /(?:bilgi\s+kaynak|bakım\s+veren|terapist|doğrudan\s+gözlem|dış\s+test)[^.]{0,180}(?:aynı\s+yön|aynı\s+sonuç|örtüş|birleş)/iu.test(clause)
      || /(?:aynı\s+yön|aynı\s+sonuç|örtüş|birleş)[^.]{0,180}(?:bilgi\s+kaynak|bakım\s+veren|terapist|doğrudan\s+gözlem|dış\s+test)/iu.test(clause)
    )
    const discrepancyClaim = /(?:aynı\s+yönde\s+değil|aynı\s+yönde\s+sonuç\s+vermem|farklı\s+yöndeki\s+bilgi|tam\s+olarak\s+örtüşmem|(?:bilgi\s+kaynak|bakım\s+veren|terapist|doğrudan\s+gözlem|dış\s+test)[^.]{0,160}ayrış)/iu.test(clause)
    const observedContextVariabilityClaim = /(?:terapist\s+gözlem[^.]{0,100}performans(?:ın)?[^.]{0,80}koşullara?\s+göre\s+değiş|doğrudan\s+gözlem[^.]{0,100}görev\s+koşulları\s+değiştiğinde[^.]{0,80}performans|koşul\s+karşılaştırması)/iu.test(clause)
    const applicableRelations = relationsForFacts(input.relations ?? [], input.facts.map((fact) => fact.id))
    const eligiblePreserved = input.facts.filter(factEligibleForPreservedCapacity)
    const difficultyFacts = input.facts.filter(factSupportsDifficultyDirection)
    const forbiddenEpistemicFacts = input.facts.filter((fact) => fact.epistemic_status !== "OBSERVED_OR_REPORTED")
    let directionMatch: JuryClauseProvenance["direction_match"] = "NOT_APPLICABLE"
    let epistemicStatusMatch: JuryClauseProvenance["epistemic_status_match"] = "NOT_APPLICABLE"
    let sourceRelationMatch: JuryClauseProvenance["source_relation_match"] = "NOT_APPLICABLE"
    if (preservedClaim && input.facts.length) {
      directionMatch = eligiblePreserved.length ? "PASS" : "FAIL"
      epistemicStatusMatch = eligiblePreserved.length || forbiddenEpistemicFacts.length === 0 ? "PASS" : "FAIL"
      if (!eligiblePreserved.length) {
        errors.push("EVIDENCE_DIRECTION_MISMATCH")
        if (input.facts.some((fact) => fact.semantic_direction === "DIFFICULTY" || fact.semantic_direction === "MIXED")) errors.push("DIFFICULTY_AS_PRESERVED_CAPACITY")
        if (forbiddenEpistemicFacts.some((fact) => fact.epistemic_status === "ABSENT_INFORMATION")) errors.push("ABSENCE_AS_PRESERVED_CAPACITY")
      }
      if (epistemicStatusMatch === "FAIL") errors.push("EPISTEMIC_STATUS_MISMATCH")
    }
    if (difficultyClaim && input.facts.length) {
      const match = difficultyFacts.length > 0
      directionMatch = match ? "PASS" : "FAIL"
      if (!match) errors.push("EVIDENCE_DIRECTION_MISMATCH")
    }
    if (convergenceClaim && input.facts.length >= 2) {
      const hasDiscrepancy = applicableRelations.some(relationIsDiscrepant)
      const hasConvergence = applicableRelations.some(relationIsConvergent)
      sourceRelationMatch = !hasDiscrepancy && hasConvergence ? "PASS" : "FAIL"
      if (sourceRelationMatch === "FAIL") {
        errors.push("SOURCE_RELATION_MISMATCH")
        if (hasDiscrepancy) errors.push("FALSE_SOURCE_CONVERGENCE")
      }
    }
    if (discrepancyClaim && input.facts.length >= 2) {
      sourceRelationMatch = applicableRelations.some(relationIsDiscrepant) ? "PASS" : "FAIL"
      if (sourceRelationMatch === "FAIL") errors.push("SOURCE_RELATION_MISMATCH")
    }
    if (observedContextVariabilityClaim && input.facts.length) {
      const contextFacts = input.facts.filter((fact) => fact.source_type === "THERAPIST_OBSERVATION" || fact.source_type === "CAREGIVER_ANAMNESIS")
      const hasObservedComparison = contextFacts.some(factHasObservedContextComparison)
      epistemicStatusMatch = hasObservedComparison ? "PASS" : "FAIL"
      if (!hasObservedComparison) {
        errors.push("UNASSESSED_CONTEXT_AS_OBSERVED")
        errors.push("EPISTEMIC_STATUS_MISMATCH")
      }
    }
    const externalFacts = input.facts.filter((fact) => fact.source_type === "EXTERNAL_TEST")
    const namedExternalFacts = externalFacts.filter((fact) => clause.toLocaleLowerCase("tr-TR").includes(fact.statement.split(":")[0].toLocaleLowerCase("tr-TR")))
    if (namedExternalFacts.length && ((preservedClaim && !namedExternalFacts.some(factEligibleForPreservedCapacity)) || (difficultyClaim && !namedExternalFacts.some(factSupportsDifficultyDirection)))) {
      errors.push("EXTERNAL_TEST_DIRECTION_MISMATCH")
    }
    if (errors.some((error) => ["DIFFICULTY_AS_PRESERVED_CAPACITY", "ABSENCE_AS_PRESERVED_CAPACITY", "FALSE_SOURCE_CONVERGENCE", "EVIDENCE_DIRECTION_MISMATCH", "EPISTEMIC_STATUS_MISMATCH", "SOURCE_RELATION_MISMATCH", "EXTERNAL_TEST_DIRECTION_MISMATCH", "UNASSESSED_CONTEXT_AS_OBSERVED"].includes(error))) level = "UNSUPPORTED"
    if (level === "UNSUPPORTED" && !errors.includes("UNSUPPORTED_VISIBLE_CLAUSE")) errors.unshift("UNSUPPORTED_VISIBLE_CLAUSE")
    const claimDirection = discrepancyClaim
      ? "MIXED" as const
      : preservedClaim
      ? "PRESERVED" as const
      : difficultyClaim
      ? "DIFFICULTY" as const
      : "NEUTRAL" as const
    const specificityLevel = onlyProfileFacts || level === "PROFILE_DERIVED"
      ? "PROFILE_ONLY" as const
      : required.length
      ? "HIGH" as const
      : "BOUNDED" as const
    return Object.freeze({
      clause_id: `${input.sentenceId}.clause-${index + 1}`,
      case_id: input.caseId,
      section_id: input.sectionId,
      paragraph_id: input.paragraphId,
      sentence_id: input.sentenceId,
      clause,
      claim_type: claimType(input.statementType, clause),
      entailment_level: level,
      required_semantics: Object.freeze(required.map((item) => item.id)),
      supported_semantics: Object.freeze(supported.map((item) => item.id)),
      missing_semantics: Object.freeze(missing.map((item) => item.id)),
      supporting_case_fact_ids: Object.freeze(input.facts.map((fact) => fact.id)),
      supporting_decision_ids: Object.freeze(unique(input.decisionIds ?? [])),
      supporting_literature_ids: Object.freeze(unique(input.literatureIds ?? [])),
      claim_direction: claimDirection,
      supporting_sources: Object.freeze(unique(input.facts.map((fact) => fact.source_type))),
      supporting_directions: Object.freeze(unique(input.facts.map((fact) => fact.semantic_direction))),
      relation_state: Object.freeze(unique(applicableRelations.map((relation) => relation.relation))),
      specificity_level: specificityLevel,
      render_eligible: level !== "UNSUPPORTED",
      backoff_reason: level === "UNSUPPORTED"
        ? missing.length
          ? `Unsupported semantic atoms: ${missing.map((item) => item.id).join(", ")}`
          : unique(errors).join(", ") || "Claim support contract failed"
        : null,
      content_entailment: contentEntailment,
      direction_match: directionMatch,
      epistemic_status_match: epistemicStatusMatch,
      source_relation_match: sourceRelationMatch,
      final_support: level === "UNSUPPORTED" ? "FAIL" : "PASS",
      error_types: Object.freeze(unique(errors)),
    }) satisfies JuryClauseProvenance
  })
  const partiallySupported = results.some((item) => item.entailment_level === "UNSUPPORTED") && results.some((item) => item.entailment_level !== "UNSUPPORTED")
  if (!partiallySupported) return Object.freeze(results)
  return Object.freeze(results.map((item) => item.entailment_level === "UNSUPPORTED"
    ? Object.freeze({ ...item, error_types: Object.freeze(unique([...item.error_types, "PARTIALLY_SUPPORTED_SENTENCE" as const])) })
    : item))
}

export function candidateIsSemanticallyEntailed(candidate: string, facts: readonly CaseScopedEvidenceFact[]): boolean {
  const clauses = evaluateSentenceEntailment({
    sentenceId: "candidate",
    caseId: facts[0]?.case_id ?? "candidate",
    sectionId: "decision_support",
    paragraphId: "candidate",
    sentence: candidate,
    statementType: "synthesis",
    facts,
  })
  return clauses.every((clause) => clause.entailment_level !== "UNSUPPORTED")
}

export function evidenceGroundedSpecificityBackoff(primary: CaseScopedEvidenceFact, observation?: CaseScopedEvidenceFact): string {
  const primarySentence = primary.statement.replace(/\s+/gu, " ").trim()
  if (observation) {
    const observationSentence = observation.statement.replace(/\s+/gu, " ").trim()
    return `${primarySentence} Terapist gözlemi de ayrı bir görev örneği sağlamaktadır: ${observationSentence}`
  }
  return `${primarySentence} Bu bilgi yalnız kaynakta belirtilen görev ve bağlamla sınırlı olarak yorumlanmaktadır.`
}

export type ClauseEntailmentAudit = Readonly<{
  pass: boolean
  visible_clause_count: number
  supported_visible_clause_count: number
  unsupported_visible_clause_count: number
  partially_supported_sentence_count: number
  fact_id_present_but_not_entailing_count: number
  profile_to_function_overreach_count: number
  direction_mismatch_count: number
  epistemic_status_mismatch_count: number
  source_relation_mismatch_count: number
  difficulty_as_preserved_count: number
  absence_as_preserved_count: number
  false_source_convergence_count: number
  external_test_direction_error_count: number
  unassessed_context_as_observed_count: number
  precision: number
  recall: number
  failures: readonly JuryClauseProvenance[]
}>

export function auditClauseEntailment(clauses: readonly JuryClauseProvenance[]): ClauseEntailmentAudit {
  const visible = clauses.filter((clause) => clause.claim_type !== "BOUNDARY" && clause.claim_type !== "LITERATURE")
  const failures = visible.filter((clause) => clause.entailment_level === "UNSUPPORTED")
  const partialSentenceIds = unique(failures.filter((clause) => clause.error_types.includes("PARTIALLY_SUPPORTED_SENTENCE")).map((clause) => clause.sentence_id))
  const supported = visible.length - failures.length
  return Object.freeze({
    pass: failures.length === 0,
    visible_clause_count: visible.length,
    supported_visible_clause_count: supported,
    unsupported_visible_clause_count: failures.length,
    partially_supported_sentence_count: partialSentenceIds.length,
    fact_id_present_but_not_entailing_count: failures.filter((clause) => clause.error_types.includes("FACT_ID_PRESENT_BUT_NOT_ENTAILING")).length,
    profile_to_function_overreach_count: failures.filter((clause) => clause.error_types.includes("PROFILE_TO_FUNCTION_OVERREACH")).length,
    direction_mismatch_count: failures.filter((clause) => clause.error_types.includes("EVIDENCE_DIRECTION_MISMATCH")).length,
    epistemic_status_mismatch_count: failures.filter((clause) => clause.error_types.includes("EPISTEMIC_STATUS_MISMATCH")).length,
    source_relation_mismatch_count: failures.filter((clause) => clause.error_types.includes("SOURCE_RELATION_MISMATCH")).length,
    difficulty_as_preserved_count: failures.filter((clause) => clause.error_types.includes("DIFFICULTY_AS_PRESERVED_CAPACITY")).length,
    absence_as_preserved_count: failures.filter((clause) => clause.error_types.includes("ABSENCE_AS_PRESERVED_CAPACITY")).length,
    false_source_convergence_count: failures.filter((clause) => clause.error_types.includes("FALSE_SOURCE_CONVERGENCE")).length,
    external_test_direction_error_count: failures.filter((clause) => clause.error_types.includes("EXTERNAL_TEST_DIRECTION_MISMATCH")).length,
    unassessed_context_as_observed_count: failures.filter((clause) => clause.error_types.includes("UNASSESSED_CONTEXT_AS_OBSERVED")).length,
    precision: visible.length ? supported / visible.length : 1,
    recall: visible.length ? supported / visible.length : 1,
    failures: Object.freeze(failures),
  })
}
