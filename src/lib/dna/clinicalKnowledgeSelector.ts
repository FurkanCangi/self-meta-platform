import type { ClinicalEvidenceMap, ClinicalMechanismType } from "./clinicalAnalysis";
import type { AnamnezThemeSignals } from "./anamnezUtils";
import {
  CLINICAL_KNOWLEDGE_CHUNKS,
  type ClinicalKnowledgeChunk,
  type ClinicalKnowledgeLevel,
  type ClinicalKnowledgeUse,
} from "./clinicalKnowledgeBase";
import type { ExternalTestCategory } from "./externalTestRegistry";
import type { DomainKey, DomainLevel, DomainResult } from "./reportEngine";

type KnowledgeSelectionParams = {
  domainResults: DomainResult[];
  evidenceMap?: ClinicalEvidenceMap;
  anamnezFlags?: string[];
  anamnezSignals?: AnamnezThemeSignals;
  therapistInsights?: string[];
  externalTestCategories?: ExternalTestCategory[];
  primaryExternalTestCategory?: ExternalTestCategory | null;
  profileType?: string;
};

function mapLevelToKnowledgeLevel(level: DomainLevel): ClinicalKnowledgeLevel {
  if (level === "Atipik") return "relative_weakness";
  if (level === "Riskli") return "watch_range";
  return "relative_strength";
}

function normalizeText(value: string): string {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function dedupeChunks(chunks: ClinicalKnowledgeChunk[]): ClinicalKnowledgeChunk[] {
  const seen = new Set<string>();
  return chunks.filter((chunk) => {
    if (seen.has(chunk.id)) return false;
    seen.add(chunk.id);
    return true;
  });
}

function supportsMechanism(chunk: ClinicalKnowledgeChunk, mechanism: ClinicalMechanismType | undefined): boolean {
  if (!chunk.mechanism || chunk.mechanism.length === 0) return true;
  if (mechanism === "evidence_limited_mixed" && chunk.mechanism.includes("default")) return true;
  return Boolean(mechanism && chunk.mechanism.includes(mechanism));
}

function getDomainLevelChunks(domainResults: DomainResult[], useIn: ClinicalKnowledgeUse): ClinicalKnowledgeChunk[] {
  return domainResults.flatMap((domain) => {
    const construct = CLINICAL_KNOWLEDGE_CHUNKS.find(
      (chunk) => chunk.domain === domain.key && chunk.purpose === "construct" && chunk.useIn.includes(useIn)
    );
    const levelComment = CLINICAL_KNOWLEDGE_CHUNKS.find(
      (chunk) =>
        chunk.domain === domain.key &&
        chunk.purpose === "level_comment" &&
        chunk.level === mapLevelToKnowledgeLevel(domain.level as DomainLevel) &&
        chunk.useIn.includes(useIn)
    );
    return [construct, levelComment].filter(Boolean) as ClinicalKnowledgeChunk[];
  });
}

function getCrossScaleChunk(params: KnowledgeSelectionParams, useIn: ClinicalKnowledgeUse): ClinicalKnowledgeChunk[] {
  const nonTypicalKeys = new Set(
    params.domainResults.filter((domain) => domain.level !== "Tipik").map((domain) => domain.key as DomainKey)
  );
  const chunks: ClinicalKnowledgeChunk[] = [];

  const has = (key: DomainKey) => nonTypicalKeys.has(key);

  if (
    params.evidenceMap?.clinicalMechanism === "motor_praxis" ||
    params.evidenceMap?.clinicalMechanism === "adaptive_daily_living" ||
    params.evidenceMap?.clinicalMechanism === "language_communication" ||
    params.evidenceMap?.clinicalMechanism === "language_social_pragmatic"
  ) {
    const cognitiveExecutive = CLINICAL_KNOWLEDGE_CHUNKS.find(
      (chunk) => chunk.id === "CROSS_SCALE_COGNITIVE_EXECUTIVE" && chunk.useIn.includes(useIn)
    );
    if (cognitiveExecutive) chunks.push(cognitiveExecutive);
  }

  const pairIds: string[] = [];
  if (has("sensory") && has("emotional")) pairIds.push("CROSS_SCALE_SENSORY_EMOTIONAL");
  if (has("physiological") && has("emotional")) pairIds.push("CROSS_SCALE_PHYSIOLOGICAL_EMOTIONAL");
  if (has("interoception") && has("physiological")) pairIds.push("CROSS_SCALE_INTEROCEPTION_PHYSIOLOGICAL");
  if (has("interoception") && has("emotional")) pairIds.push("CROSS_SCALE_INTEROCEPTION_EMOTIONAL");
  if (has("cognitive") && has("executive")) pairIds.push("CROSS_SCALE_COGNITIVE_EXECUTIVE");
  if (has("emotional") && has("executive")) pairIds.push("CROSS_SCALE_EMOTIONAL_EXECUTIVE");
  if (nonTypicalKeys.size >= 3) pairIds.push("CROSS_SCALE_WIDESPREAD_PATTERN");
  if (nonTypicalKeys.size >= 1 && params.domainResults.some((domain) => domain.level === "Tipik")) {
    pairIds.push("CROSS_SCALE_ASYMMETRICAL_PROFILE");
  }

  for (const id of pairIds) {
    const chunk = CLINICAL_KNOWLEDGE_CHUNKS.find((item) => item.id === id && item.useIn.includes(useIn));
    if (chunk) chunks.push(chunk);
  }

  return chunks;
}

function getMechanismSpecificChunks(
  params: KnowledgeSelectionParams,
  useIn: ClinicalKnowledgeUse
): ClinicalKnowledgeChunk[] {
  const mechanism = params.evidenceMap?.clinicalMechanism;
  if (!mechanism || mechanism === "default") return [];

  const ids: string[] = [];
  if (mechanism === "adaptive_daily_living") {
    ids.push(
      "EXECUTIVE_FUNCTION_REPORT_LANGUAGE",
      "INTEROCEPTION_REPORT_LANGUAGE",
      "PHYSIOLOGICAL_REGULATION_REPORT_LANGUAGE",
      "EXECUTIVE_FUNCTION_ANAMNESIS_INTEGRATION",
      "INTEROCEPTION_ANAMNESIS_INTEGRATION",
      "RISK_PROFILE_GENERAL_RULE",
      "RISK_PROFILE_SUMMARY_RULE"
    );
  }
  if (mechanism === "social_pragmatic") {
    ids.push(
      "COGNITIVE_REGULATION_REPORT_LANGUAGE",
      "EMOTIONAL_REGULATION_REPORT_LANGUAGE",
      "EXECUTIVE_FUNCTION_REPORT_LANGUAGE",
      "COGNITIVE_REGULATION_ANAMNESIS_INTEGRATION",
      "EMOTIONAL_REGULATION_ANAMNESIS_INTEGRATION",
      "RISK_PROFILE_GENERAL_RULE",
      "RISK_PROFILE_SUMMARY_RULE"
    );
  }
  if (mechanism === "language_communication") {
    ids.push(
      "COGNITIVE_REGULATION_REPORT_LANGUAGE",
      "EXECUTIVE_FUNCTION_REPORT_LANGUAGE",
      "COGNITIVE_REGULATION_ANAMNESIS_INTEGRATION",
      "EXECUTIVE_FUNCTION_ANAMNESIS_INTEGRATION",
      "RISK_PROFILE_GENERAL_RULE",
      "RISK_PROFILE_SUMMARY_RULE"
    );
  }
  if (mechanism === "language_social_pragmatic") {
    ids.push(
      "COGNITIVE_REGULATION_REPORT_LANGUAGE",
      "EXECUTIVE_FUNCTION_REPORT_LANGUAGE",
      "EMOTIONAL_REGULATION_REPORT_LANGUAGE",
      "COGNITIVE_REGULATION_ANAMNESIS_INTEGRATION",
      "EMOTIONAL_REGULATION_ANAMNESIS_INTEGRATION",
      "RISK_PROFILE_GENERAL_RULE",
      "RISK_PROFILE_SUMMARY_RULE"
    );
  }
  if (mechanism === "physiological_interoceptive") {
    ids.push(
      "PHYSIOLOGICAL_REGULATION_REPORT_LANGUAGE",
      "INTEROCEPTION_REPORT_LANGUAGE",
      "PHYSIOLOGICAL_REGULATION_ANAMNESIS_INTEGRATION",
      "INTEROCEPTION_ANAMNESIS_INTEGRATION",
      "RISK_PROFILE_GENERAL_RULE",
      "RISK_PROFILE_SUMMARY_RULE"
    );
  }
  if (mechanism === "motor_praxis") {
    ids.push(
      "EXECUTIVE_FUNCTION_REPORT_LANGUAGE",
      "COGNITIVE_REGULATION_REPORT_LANGUAGE",
      "EMOTIONAL_REGULATION_REPORT_LANGUAGE",
      "EXECUTIVE_FUNCTION_ANAMNESIS_INTEGRATION"
    );
  }
  if (mechanism === "evidence_limited_mixed") {
    ids.push(
      "EXECUTIVE_FUNCTION_REPORT_LANGUAGE",
      "COGNITIVE_REGULATION_REPORT_LANGUAGE",
      "EMOTIONAL_REGULATION_REPORT_LANGUAGE",
      "EXECUTIVE_FUNCTION_ANAMNESIS_INTEGRATION",
      "COGNITIVE_REGULATION_ANAMNESIS_INTEGRATION",
      "RISK_PROFILE_CONTEXT_MODIFIERS",
      "RISK_PROFILE_PROTECTIVE_FACTORS",
      "REPORT_SAFETY_RULE"
    );
  }

  return ids
    .map((id) =>
      CLINICAL_KNOWLEDGE_CHUNKS.find(
        (chunk) => chunk.id === id && chunk.useIn.includes(useIn) && supportsMechanism(chunk, mechanism)
      )
    )
    .filter(Boolean) as ClinicalKnowledgeChunk[];
}

function getRiskProfileChunks(params: KnowledgeSelectionParams, useIn: ClinicalKnowledgeUse): ClinicalKnowledgeChunk[] {
  const nonTypicalCount = params.domainResults.filter((domain) => domain.level !== "Tipik").length;
  const ids: string[] = [];

  if (nonTypicalCount === 1) ids.push("RISK_PROFILE_SINGLE_DOMAIN");
  if (nonTypicalCount === 2) ids.push("RISK_PROFILE_DUAL_DOMAIN");
  if (nonTypicalCount >= 3) ids.push("RISK_PROFILE_MULTI_DOMAIN");
  if (params.domainResults.some((domain) => domain.level === "Tipik")) ids.push("RISK_PROFILE_PROTECTIVE_FACTORS");
  ids.push("RISK_PROFILE_CONTEXT_MODIFIERS");

  return ids
    .map((id) => CLINICAL_KNOWLEDGE_CHUNKS.find((chunk) => chunk.id === id && chunk.useIn.includes(useIn)))
    .filter(Boolean) as ClinicalKnowledgeChunk[];
}

function getAnamnesisChunks(params: KnowledgeSelectionParams, useIn: ClinicalKnowledgeUse): ClinicalKnowledgeChunk[] {
  const text = normalizeText(
    [
      ...(params.anamnezFlags || []),
      ...(params.therapistInsights || []),
      params.profileType || "",
      ...(params.externalTestCategories || []),
    ].join(" ")
  ).toLocaleLowerCase("tr-TR");
  const ids = ["ANAMNESIS_INTEGRATION_GENERAL_RULE"];

  if (/uyku|rutin|geçiş|gecis|yeme|tuvalet/.test(text)) ids.push("ANAMNESIS_SLEEP_AND_ROUTINE");
  if (/duyusal|ses|gürültü|gurultu|dokun|oral|kalabalık|kalabalik|giyim|banyo/.test(text)) {
    ids.push("ANAMNESIS_SENSORY_CONTEXT");
  }
  if (/öfke|ofke|ağla|agla|sakinleş|sakinles|frustrasyon|ayrılma|ayrilma|duygusal/.test(text)) {
    ids.push("ANAMNESIS_EMOTIONAL_CONTEXT");
  }
  if (/dikkat|görev|gorev|yönerge|yonerge|oyunda kal|dürtü|durtu|başlat|baslat|sürdür|surdur/.test(text)) {
    ids.push("ANAMNESIS_ATTENTION_AND_TASK_BEHAVIOR");
  }
  if (/tuvalet|açlık|aclik|susuz|ağrı|agri|yorgun/.test(text)) {
    ids.push("ANAMNESIS_INTEROCEPTIVE_CONTEXT");
  }
  if (/anne|baba|bakımveren|bakimveren|eş-reg|es-reg|co-reg|ko-reg/.test(text)) {
    ids.push("ANAMNESIS_PARENTING_AND_CO_REGULATION");
  }
  if (/gebelik|doğum|dogum|premat|nöro|norolojik|epilepsi|alerji|kolik/.test(text)) {
    ids.push("ANAMNESIS_MEDICAL_AND_DEVELOPMENTAL_HISTORY");
  }
  if (/iyi uyum|korunmuş|korunmus|destekle|rutinle daha iyi|bire bir|tekli ortam/.test(text)) {
    ids.push("ANAMNESIS_PROTECTIVE_CONTEXT");
  }

  if ((params.anamnezFlags || []).length === 0) {
    ids.push("ANAMNESIS_CONTRADICTION_RULE");
  }
  if (params.evidenceMap?.clinicalMechanism === "adaptive_daily_living") {
    ids.push("ANAMNESIS_SLEEP_AND_ROUTINE", "INTEROCEPTION_ANAMNESIS_INTEGRATION", "EXECUTIVE_FUNCTION_ANAMNESIS_INTEGRATION");
  }
  if (params.evidenceMap?.clinicalMechanism === "physiological_interoceptive") {
    ids.push("PHYSIOLOGICAL_REGULATION_ANAMNESIS_INTEGRATION", "INTEROCEPTION_ANAMNESIS_INTEGRATION");
  }
  if (params.evidenceMap?.clinicalMechanism === "language_communication") {
    ids.push("COGNITIVE_REGULATION_ANAMNESIS_INTEGRATION", "EXECUTIVE_FUNCTION_ANAMNESIS_INTEGRATION");
  }
  if (params.evidenceMap?.clinicalMechanism === "social_pragmatic") {
    ids.push("COGNITIVE_REGULATION_ANAMNESIS_INTEGRATION", "EMOTIONAL_REGULATION_ANAMNESIS_INTEGRATION");
  }
  if (params.evidenceMap?.clinicalMechanism === "language_social_pragmatic") {
    ids.push(
      "COGNITIVE_REGULATION_ANAMNESIS_INTEGRATION",
      "EMOTIONAL_REGULATION_ANAMNESIS_INTEGRATION",
      "EXECUTIVE_FUNCTION_ANAMNESIS_INTEGRATION"
    );
  }
  if (params.evidenceMap?.clinicalMechanism === "evidence_limited_mixed") {
    ids.push(
      "ANAMNESIS_CONTRADICTION_RULE",
      "ANAMNESIS_PROTECTIVE_CONTEXT",
      "COGNITIVE_REGULATION_ANAMNESIS_INTEGRATION",
      "EXECUTIVE_FUNCTION_ANAMNESIS_INTEGRATION"
    );
  }

  return ids
    .map((id) => CLINICAL_KNOWLEDGE_CHUNKS.find((chunk) => chunk.id === id && chunk.useIn.includes(useIn)))
    .filter(Boolean) as ClinicalKnowledgeChunk[];
}

function getLanguageSafetyChunks(useIn: ClinicalKnowledgeUse): ClinicalKnowledgeChunk[] {
  return ["REGULATION_REPORT_STYLE", "REPORT_OUTPUT_STRUCTURE", "REPORT_TONE_RULE", "REPORT_LANGUAGE_RULE", "REPORT_PRIORITY_RULE"]
    .map((id) => CLINICAL_KNOWLEDGE_CHUNKS.find((chunk) => chunk.id === id && chunk.useIn.includes(useIn)))
    .filter(Boolean) as ClinicalKnowledgeChunk[];
}

export function selectClinicalKnowledge(params: KnowledgeSelectionParams, useIn: ClinicalKnowledgeUse): ClinicalKnowledgeChunk[] {
  const commonIds =
    useIn === "decision"
      ? ["REGULATION_OVERVIEW", "REGULATION_EARLY_CHILDHOOD_FRAME", "REGULATION_INTERPRETATION_BOUNDARY"]
      : useIn === "conclusion"
      ? [
          "REGULATION_OVERVIEW",
          "REGULATION_EARLY_CHILDHOOD_FRAME",
          "REGULATION_INTERPRETATION_BOUNDARY",
          "REPORT_FINAL_SUMMARY_TEMPLATE",
          "REPORT_SAFETY_RULE",
        ]
      : useIn === "prioritization"
      ? ["REGULATION_INTERPRETATION_BOUNDARY", "REPORT_SAFETY_RULE"]
      : [];

  const common = commonIds
    .map((id) => CLINICAL_KNOWLEDGE_CHUNKS.find((chunk) => chunk.id === id && chunk.useIn.includes(useIn)))
    .filter(Boolean) as ClinicalKnowledgeChunk[];

  return dedupeChunks([
    ...common,
    ...getMechanismSpecificChunks(params, useIn),
    ...getCrossScaleChunk(params, useIn),
    ...getRiskProfileChunks(params, useIn),
    ...getAnamnesisChunks(params, useIn),
    ...getLanguageSafetyChunks(useIn),
  ]);
}

export function selectDomainKnowledge(domain: DomainResult, params: KnowledgeSelectionParams): ClinicalKnowledgeChunk[] {
  const useIn: ClinicalKnowledgeUse = "domain_comment";
  const construct = CLINICAL_KNOWLEDGE_CHUNKS.find(
    (chunk) => chunk.domain === domain.key && chunk.purpose === "construct" && chunk.useIn.includes(useIn)
  );
  const levelComment = CLINICAL_KNOWLEDGE_CHUNKS.find(
    (chunk) =>
      chunk.domain === domain.key &&
      chunk.purpose === "level_comment" &&
      chunk.level === mapLevelToKnowledgeLevel(domain.level as DomainLevel) &&
      chunk.useIn.includes(useIn)
  );

  const anamnesis = getAnamnesisChunks(
    {
      ...params,
      domainResults: [domain],
    },
    useIn
  ).filter((chunk) => {
    if (domain.key === "sensory") return chunk.id === "ANAMNESIS_SENSORY_CONTEXT";
    if (domain.key === "emotional") return chunk.id === "ANAMNESIS_EMOTIONAL_CONTEXT";
    if (domain.key === "cognitive" || domain.key === "executive") {
      return chunk.id === "ANAMNESIS_ATTENTION_AND_TASK_BEHAVIOR" || chunk.id.endsWith("_ANAMNESIS_INTEGRATION");
    }
    if (domain.key === "interoception") {
      return chunk.id === "ANAMNESIS_INTEROCEPTIVE_CONTEXT" || chunk.id === "INTEROCEPTION_ANAMNESIS_INTEGRATION";
    }
    if (domain.key === "physiological") {
      return chunk.id === "ANAMNESIS_SLEEP_AND_ROUTINE" || chunk.id === "PHYSIOLOGICAL_REGULATION_ANAMNESIS_INTEGRATION";
    }
    return false;
  });

  const reportLanguage = CLINICAL_KNOWLEDGE_CHUNKS.filter(
    (chunk) =>
      chunk.domain === domain.key &&
      chunk.purpose === "report_language" &&
      chunk.useIn.includes(useIn) &&
      supportsMechanism(chunk, params.evidenceMap?.clinicalMechanism)
  );

  return dedupeChunks([construct, levelComment, ...anamnesis, ...reportLanguage].filter(Boolean) as ClinicalKnowledgeChunk[]);
}

export function buildKnowledgeText(chunks: ClinicalKnowledgeChunk[], limit = 2): string {
  return dedupeChunks(chunks)
    .slice(0, limit)
    .map((chunk) => normalizeText(chunk.text))
    .filter(Boolean)
    .join(" ");
}

export function buildDomainKnowledgeText(domain: DomainResult, params: KnowledgeSelectionParams, limit = 2): string {
  return buildKnowledgeText(selectDomainKnowledge(domain, params), limit);
}

export function buildUseKnowledgeText(params: KnowledgeSelectionParams, useIn: ClinicalKnowledgeUse, limit = 2): string {
  return buildKnowledgeText(
    [...selectClinicalKnowledge(params, useIn), ...getDomainLevelChunks(params.domainResults, useIn)],
    limit
  );
}
