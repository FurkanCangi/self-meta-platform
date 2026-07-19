import type {
  DnaChatCatalogClaim,
  DnaChatCatalogRelation,
  DnaChatCatalogSafetyRule,
  DnaChatCatalogTopic,
} from "./catalog/types"
import { DNA_INTELLIGENCE_INTENDED_USE_VERSION } from "./intendedUse"
import {
  DNA_PRODUCT_AUTHORITY_PENDING,
  EXTERNAL_SCIENCE_AUTHORITY_PENDING,
  createPolicyAuthority,
  type DnaKnowledgeAuthorityRef,
  type DnaSafetyPolicyAuthorityRef,
} from "./knowledgeAuthority"
import type { DnaChatSafetyCategory } from "./types"

export const DNA_CHAT_LEGACY_PRODUCT_SOURCE_DISPOSITION = Object.freeze({
  assessment_overview: "pending_owner_approval",
  domain_contract: "pending_owner_approval",
  question_contract: "pending_owner_approval",
  scoring_contract: "pending_owner_approval",
  report_contract: "pending_owner_approval",
  evidence_contract: "policy_enforced",
  privacy_contract: "policy_enforced",
  age_contract: "split_required_in_phase_3",
  use_contract: "policy_enforced",
} as const)

const SAFETY_CATEGORY_TO_PUBLIC_CLAUSE: Record<DnaChatSafetyCategory, string> = {
  none: "intended_use.boundary",
  privacy: "prohibited.raw_or_internal_data_disclosure",
  diagnosis: "prohibited.diagnosis_and_differential_diagnosis",
  treatment: "prohibited.treatment_or_session_planning",
  medication: "prohibited.medication_or_dose_advice",
  prognosis: "prohibited.individual_prognosis",
  causality: "prohibited.definitive_causality",
  internal_data: "prohibited.raw_or_internal_data_disclosure",
  cross_case: "prohibited.cross_report_clinical_comparison",
  crisis: "boundary.crisis_out_of_scope",
  manipulation: "boundary.instruction_manipulation",
  unsafe_case_context: "prohibited.raw_or_internal_data_disclosure",
  biological_inference: "prohibited.biological_state_inference_from_behavior",
  measurement_overreach: "prohibited.biological_state_inference_from_behavior",
  internal_reasoning: "prohibited.raw_or_internal_data_disclosure",
  self_learning: "prohibited.autonomous_learning_from_conversations",
}

export function policyAuthorityForSafetyCategory(
  category: DnaChatSafetyCategory,
): DnaSafetyPolicyAuthorityRef {
  return createPolicyAuthority({
    policyVersion: DNA_INTELLIGENCE_INTENDED_USE_VERSION,
    publicClauseIds: [SAFETY_CATEGORY_TO_PUBLIC_CLAUSE[category]],
  })
}

export function policyAuthorityForCatalogRule(
  rule: Pick<DnaChatCatalogSafetyRule, "category">,
): DnaSafetyPolicyAuthorityRef {
  const category: DnaChatSafetyCategory =
    rule.category === "biological_inference" ||
    rule.category === "measurement_overreach" ||
    rule.category === "causality" ||
    rule.category === "diagnosis" ||
    rule.category === "treatment" ||
    rule.category === "internal_reasoning"
      ? rule.category
      : "manipulation"
  return policyAuthorityForSafetyCategory(category)
}

export function authorityForDnaContractSource(sourceName: string): DnaKnowledgeAuthorityRef {
  const disposition = DNA_CHAT_LEGACY_PRODUCT_SOURCE_DISPOSITION[
    sourceName as keyof typeof DNA_CHAT_LEGACY_PRODUCT_SOURCE_DISPOSITION
  ]
  if (disposition === "policy_enforced") {
    return createPolicyAuthority({
      policyVersion: DNA_INTELLIGENCE_INTENDED_USE_VERSION,
      publicClauseIds: [`product_contract.${sourceName}`],
    })
  }
  return DNA_PRODUCT_AUTHORITY_PENDING
}

export function authorityForCatalogTopic(
  topic: Pick<DnaChatCatalogTopic, "id">,
): DnaKnowledgeAuthorityRef {
  return topic.id.startsWith("dna.")
    ? DNA_PRODUCT_AUTHORITY_PENDING
    : EXTERNAL_SCIENCE_AUTHORITY_PENDING
}

export function authorityForCatalogTopicDetail(
  topic: Pick<DnaChatCatalogTopic, "id">,
  detail: string,
): DnaKnowledgeAuthorityRef {
  if (!topic.id.startsWith("dna.")) return EXTERNAL_SCIENCE_AUTHORITY_PENDING
  const normalized = detail.toLocaleLowerCase("tr-TR")
  if (/\b(?:değildir|degildir|ölçmez|olcmez|kanıtlamaz|kanitlamaz|doğrulanmamıştır|dogrulanmamistir|gösterilmemiştir|gosterilmemistir)\b/.test(normalized)) {
    return createPolicyAuthority({
      policyVersion: DNA_INTELLIGENCE_INTENDED_USE_VERSION,
      publicClauseIds: ["product_boundary.dna_interpretation"],
    })
  }
  return DNA_PRODUCT_AUTHORITY_PENDING
}

export function authorityForCatalogClaim(
  claim: Pick<DnaChatCatalogClaim, "id" | "topicId" | "claimType">,
): DnaKnowledgeAuthorityRef {
  if (!claim.topicId.startsWith("dna.")) return EXTERNAL_SCIENCE_AUTHORITY_PENDING
  if (
    claim.claimType === "product_boundary" ||
    claim.claimType === "measurement_boundary" ||
    claim.id.endsWith(".not_single_cause")
  ) {
    return createPolicyAuthority({
      policyVersion: DNA_INTELLIGENCE_INTENDED_USE_VERSION,
      publicClauseIds: ["product_boundary.dna_interpretation"],
    })
  }
  return DNA_PRODUCT_AUTHORITY_PENDING
}

export function authorityForCatalogRelation(
  relation: Pick<DnaChatCatalogRelation, "fromTopicId" | "toTopicId" | "predicate">,
): DnaKnowledgeAuthorityRef {
  const fromDna = relation.fromTopicId.startsWith("dna.")
  const toDna = relation.toTopicId.startsWith("dna.")
  if (fromDna && toDna && relation.predicate === "includes") {
    return DNA_PRODUCT_AUTHORITY_PENDING
  }
  return EXTERNAL_SCIENCE_AUTHORITY_PENDING
}

export function authorityForCatalogSource(): DnaKnowledgeAuthorityRef {
  return EXTERNAL_SCIENCE_AUTHORITY_PENDING
}

export function authorityForKnowledgeSourceType(
  type: "clinical_kb" | "literature" | "knowledge_entry",
): DnaKnowledgeAuthorityRef {
  void type
  return EXTERNAL_SCIENCE_AUTHORITY_PENDING
}
