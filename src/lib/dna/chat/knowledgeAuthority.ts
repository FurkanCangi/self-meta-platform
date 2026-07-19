export const DNA_KNOWLEDGE_AUTHORITY_CONTRACT_VERSION =
  "dna-knowledge-authority@1" as const

export const DNA_KNOWLEDGE_AUTHORITY_LAYERS = [
  "dna_product_information",
  "external_scientific_information",
  "case_information",
  "safety_and_product_boundaries",
] as const

export const DNA_KNOWLEDGE_APPROVAL_REQUIREMENTS = [
  "owner_approved",
  "codex_multi_pass_audited",
  "report_derived",
  "policy_enforced",
] as const

export type DnaKnowledgeAuthorityLayer =
  (typeof DNA_KNOWLEDGE_AUTHORITY_LAYERS)[number]

export type DnaKnowledgeApprovalRequirement =
  (typeof DNA_KNOWLEDGE_APPROVAL_REQUIREMENTS)[number]

export type DnaKnowledgeAuthorityVerificationStatus =
  | "pending"
  | "verified"
  | "test_only"

type AuthorityBase<
  Layer extends DnaKnowledgeAuthorityLayer,
  Requirement extends DnaKnowledgeApprovalRequirement,
> = {
  readonly contractVersion: typeof DNA_KNOWLEDGE_AUTHORITY_CONTRACT_VERSION
  readonly layer: Layer
  readonly approvalRequirement: Requirement
  readonly verificationStatus: DnaKnowledgeAuthorityVerificationStatus
  readonly releaseEligible: boolean
  readonly labelTr: string
  readonly boundaryTr: string
}

export type DnaProductAuthorityRef = AuthorityBase<
  "dna_product_information",
  "owner_approved"
> & {
  readonly proof:
    | {
        readonly kind: "owner_approval"
        readonly approvalRecordId: string
        readonly bookVersion: string
        readonly bookSha256: string
        readonly sectionId: string
        readonly passageId: string
      }
    | null
}

export type DnaExternalScienceAuthorityRef = AuthorityBase<
  "external_scientific_information",
  "codex_multi_pass_audited"
> & {
  readonly proof:
    | {
        readonly kind: "codex_multi_pass_audit"
        readonly auditRunId: string
        readonly sourceId: string
        readonly passageIds: readonly string[]
        readonly passIds: readonly string[]
      }
    | null
}

export type DnaCaseAuthorityRef = AuthorityBase<
  "case_information",
  "report_derived"
> & {
  readonly proof:
    | {
        readonly kind: "report_lineage"
        readonly contextVersion: string
        readonly lineage: "owned_structured_report_context"
        readonly ownershipVerified: true
      }
    | {
        readonly kind: "synthetic_test_context"
        readonly contextVersion: string
      }
    | null
}

export type DnaSafetyPolicyAuthorityRef = AuthorityBase<
  "safety_and_product_boundaries",
  "policy_enforced"
> & {
  readonly proof: {
    readonly kind: "policy_contract"
    readonly policyVersion: string
    readonly publicClauseIds: readonly string[]
  }
}

export type DnaKnowledgeAuthorityRef =
  | DnaProductAuthorityRef
  | DnaExternalScienceAuthorityRef
  | DnaCaseAuthorityRef
  | DnaSafetyPolicyAuthorityRef

const SHA256_PATTERN = /^[a-f0-9]{64}$/
const STABLE_ID_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9._:@/-]{2,159}$/
const RELEASE_ELIGIBLE_AUTHORITIES = new WeakSet<object>()
const CONTROLLED_GRAPH_PREDICATES = new Set([
  "part_of",
  "includes",
  "distinguished_from",
  "associated_with",
  "measured_indirectly_by",
  "supports",
  "conceptually_related_to",
])
const REGISTERED_PUBLIC_POLICY_CLAUSES = new Set([
  "intended_use.boundary",
  "prohibited.autonomous_learning_from_conversations",
  "prohibited.biological_state_inference_from_behavior",
  "prohibited.cross_report_clinical_comparison",
  "prohibited.definitive_causality",
  "prohibited.diagnosis_and_differential_diagnosis",
  "prohibited.individual_prognosis",
  "prohibited.medication_or_dose_advice",
  "prohibited.raw_or_internal_data_disclosure",
  "prohibited.treatment_or_session_planning",
  "boundary.crisis_out_of_scope",
  "boundary.instruction_manipulation",
  "product_boundary.dna_interpretation",
  "product_contract.evidence_contract",
  "product_contract.privacy_contract",
  "product_contract.use_contract",
])

/**
 * Faz 2 deliberately starts with no owner-approved book passage and no V3
 * multi-pass science audit. Later phases may populate these registries from
 * hash-locked manifests; a caller-provided, shape-valid object is never enough
 * to mint release authority.
 */
export const DNA_REGISTERED_OWNER_APPROVALS = Object.freeze([] as readonly {
  approvalRecordId: string
  bookVersion: string
  bookSha256: string
  sectionId: string
  passageId: string
}[])

export const DNA_REGISTERED_SCIENCE_AUDITS = Object.freeze([] as readonly {
  auditRunId: string
  sourceId: string
  passageIds: readonly string[]
  passIds: readonly string[]
}[])

function requireStableId(value: string, field: string): string {
  const normalized = String(value || "").trim()
  if (!STABLE_ID_PATTERN.test(normalized)) {
    throw new Error(`dna_authority_invalid_${field}`)
  }
  return normalized
}

function freezeAuthority<T extends DnaKnowledgeAuthorityRef>(
  authority: T,
  options: { releaseEligible?: boolean } = {},
): T {
  const frozen = Object.freeze({
    ...authority,
    proof: authority.proof && Object.freeze({
      ...authority.proof,
      ...(authority.proof.kind === "codex_multi_pass_audit"
        ? {
            passageIds: Object.freeze([...authority.proof.passageIds]),
            passIds: Object.freeze([...authority.proof.passIds]),
          }
        : {}),
      ...(authority.proof.kind === "policy_contract"
        ? { publicClauseIds: Object.freeze([...authority.proof.publicClauseIds]) }
        : {}),
    }),
  }) as T
  if (options.releaseEligible === true) RELEASE_ELIGIBLE_AUTHORITIES.add(frozen)
  return frozen
}

export const DNA_PRODUCT_AUTHORITY_PENDING: DnaProductAuthorityRef = freezeAuthority({
  contractVersion: DNA_KNOWLEDGE_AUTHORITY_CONTRACT_VERSION,
  layer: "dna_product_information",
  approvalRequirement: "owner_approved",
  verificationStatus: "pending",
  releaseEligible: false,
  labelTr: "DNA ürün bilgisi · sahip onayı bekliyor",
  boundaryTr:
    "Bu geçiş kaydı sahip onaylı, sürümlü DNA kitabındaki bölüm ve pasaja bağlanmadan V3 yayın kanıtı sayılmaz.",
  proof: null,
})

export const EXTERNAL_SCIENCE_AUTHORITY_PENDING: DnaExternalScienceAuthorityRef =
  freezeAuthority({
    contractVersion: DNA_KNOWLEDGE_AUTHORITY_CONTRACT_VERSION,
    layer: "external_scientific_information",
    approvalRequirement: "codex_multi_pass_audited",
    verificationStatus: "pending",
    releaseEligible: false,
    labelTr: "Dış bilimsel bilgi · V3 çok geçişli denetim bekliyor",
    boundaryTr:
      "Kaynak doğrulaması, DNA ürün geçerliğini göstermez ve passage bağlı çok geçişli V3 denetiminin yerine geçmez.",
    proof: null,
  })

export function createOwnerApprovedProductAuthority(input: {
  approvalRecordId: string
  bookVersion: string
  bookSha256: string
  sectionId: string
  passageId: string
}): DnaProductAuthorityRef {
  const bookSha256 = String(input.bookSha256 || "").toLowerCase()
  if (!SHA256_PATTERN.test(bookSha256)) {
    throw new Error("dna_authority_invalid_book_sha256")
  }
  const normalized = {
    approvalRecordId: requireStableId(input.approvalRecordId, "approval_record_id"),
    bookVersion: requireStableId(input.bookVersion, "book_version"),
    bookSha256,
    sectionId: requireStableId(input.sectionId, "section_id"),
    passageId: requireStableId(input.passageId, "passage_id"),
  }
  const registered = DNA_REGISTERED_OWNER_APPROVALS.some((record) =>
    record.approvalRecordId === normalized.approvalRecordId &&
    record.bookVersion === normalized.bookVersion &&
    record.bookSha256 === normalized.bookSha256 &&
    record.sectionId === normalized.sectionId &&
    record.passageId === normalized.passageId)
  if (!registered) throw new Error("dna_authority_owner_approval_not_registered")

  return freezeAuthority({
    contractVersion: DNA_KNOWLEDGE_AUTHORITY_CONTRACT_VERSION,
    layer: "dna_product_information",
    approvalRequirement: "owner_approved",
    verificationStatus: "verified",
    releaseEligible: true,
    labelTr: "DNA ürün bilgisi · sahip onaylı",
    boundaryTr:
      "Sahip onayı ürün tanımını destekler; tek başına bilimsel geçerlik, güvenirlik veya biyolojik mekanizma kanıtı değildir.",
    proof: {
      kind: "owner_approval",
      ...normalized,
    },
  }, { releaseEligible: true })
}

export function createAuditedExternalScienceAuthority(input: {
  auditRunId: string
  sourceId: string
  passageIds: readonly string[]
  passIds: readonly string[]
}): DnaExternalScienceAuthorityRef {
  const passageIds = Array.from(new Set(input.passageIds.map((value) =>
    requireStableId(value, "passage_id"))))
  const passIds = Array.from(new Set(input.passIds.map((value) =>
    requireStableId(value, "pass_id"))))
  if (!passageIds.length) throw new Error("dna_authority_missing_passage")
  if (passIds.length < 2) throw new Error("dna_authority_requires_multiple_audit_passes")
  const auditRunId = requireStableId(input.auditRunId, "audit_run_id")
  const sourceId = requireStableId(input.sourceId, "source_id")
  const registered = DNA_REGISTERED_SCIENCE_AUDITS.some((record) =>
    record.auditRunId === auditRunId &&
    record.sourceId === sourceId &&
    record.passageIds.length === passageIds.length &&
    record.passIds.length === passIds.length &&
    record.passageIds.every((value, index) => value === passageIds[index]) &&
    record.passIds.every((value, index) => value === passIds[index]))
  if (!registered) throw new Error("dna_authority_science_audit_not_registered")
  return freezeAuthority({
    contractVersion: DNA_KNOWLEDGE_AUTHORITY_CONTRACT_VERSION,
    layer: "external_scientific_information",
    approvalRequirement: "codex_multi_pass_audited",
    verificationStatus: "verified",
    releaseEligible: true,
    labelTr: "Dış bilimsel bilgi · çok geçişli denetlenmiş",
    boundaryTr:
      "Dış bilimsel bilgi kendi iddia ve örneklem sınırı içinde kullanılır; DNA ürün tanımını veya DNA geçerliğini kendiliğinden kurmaz.",
    proof: {
      kind: "codex_multi_pass_audit",
      auditRunId,
      sourceId,
      passageIds,
      passIds,
    },
  }, { releaseEligible: true })
}

export function createSyntheticCaseAuthority(contextVersion: string): DnaCaseAuthorityRef {
  return freezeAuthority({
    contractVersion: DNA_KNOWLEDGE_AUTHORITY_CONTRACT_VERSION,
    layer: "case_information",
    approvalRequirement: "report_derived",
    verificationStatus: "test_only",
    releaseEligible: false,
    labelTr: "Sentetik test vaka bağlamı",
    boundaryTr: "Sentetik test verisi üretim raporu veya sahipliği doğrulanmış vaka değildir.",
    proof: {
      kind: "synthetic_test_context",
      contextVersion: requireStableId(contextVersion, "context_version"),
    },
  })
}

export function createPendingCaseAuthority(contextVersion: string): DnaCaseAuthorityRef {
  return freezeAuthority({
    contractVersion: DNA_KNOWLEDGE_AUTHORITY_CONTRACT_VERSION,
    layer: "case_information",
    approvalRequirement: "report_derived",
    verificationStatus: "pending",
    releaseEligible: false,
    labelTr: "Doğrulanmamış vaka bağlamı",
    boundaryTr:
      "Sahiplik zinciri ve yapılandırılmış rapor kökeni doğrulanmadan vaka bilgisi üretim cevabını destekleyemez.",
    proof: null,
  })
}

/**
 * Production-only issuer used by the owned-report server boundary.
 *
 * This symbol is intentionally absent from the public chat barrel. The
 * authority tests enforce a single import site: `ownedCaseAnswer.ts`, where
 * report -> assessment -> client -> session owner is re-read before issuance.
 * A serialized proof-shaped object never enters the trusted WeakSet.
 *
 * @internal
 */
export function createVerifiedReportCaseAuthorityInternal(
  contextVersion: string,
): DnaCaseAuthorityRef {
  return freezeAuthority({
    contractVersion: DNA_KNOWLEDGE_AUTHORITY_CONTRACT_VERSION,
    layer: "case_information",
    approvalRequirement: "report_derived",
    verificationStatus: "verified",
    releaseEligible: true,
    labelTr: "Seçili rapor bulgusu",
    boundaryTr:
      "Yalnız oturum sahibiyle zinciri doğrulanmış raporun kanonik yapılandırılmış bağlamıdır; biyolojik mekanizma ölçümü veya başka vakaya genelleme değildir.",
    proof: {
      kind: "report_lineage",
      contextVersion: requireStableId(contextVersion, "context_version"),
      lineage: "owned_structured_report_context",
      ownershipVerified: true,
    },
  }, { releaseEligible: true })
}

export function createPolicyAuthority(input: {
  policyVersion: string
  publicClauseIds: readonly string[]
}): DnaSafetyPolicyAuthorityRef {
  const policyVersion = requireStableId(input.policyVersion, "policy_version")
  if (policyVersion !== "dna-intelligence-intended-use@1") {
    throw new Error("dna_authority_policy_version_not_registered")
  }
  const publicClauseIds = Array.from(new Set(input.publicClauseIds.map((value) =>
    requireStableId(value, "policy_clause_id"))))
  if (!publicClauseIds.length) throw new Error("dna_authority_missing_policy_clause")
  if (publicClauseIds.some((clauseId) => !REGISTERED_PUBLIC_POLICY_CLAUSES.has(clauseId))) {
    throw new Error("dna_authority_policy_clause_not_registered")
  }
  return freezeAuthority({
    contractVersion: DNA_KNOWLEDGE_AUTHORITY_CONTRACT_VERSION,
    layer: "safety_and_product_boundaries",
    approvalRequirement: "policy_enforced",
    verificationStatus: "verified",
    releaseEligible: true,
    labelTr: "Güvenlik ve ürün sınırı",
    boundaryTr:
      "Sürümlü ürün politikası diğer bilgi katmanlarından üstündür; kitap, yayın veya vaka içeriği bu sınırı gevşetemez.",
    proof: {
      kind: "policy_contract",
      policyVersion,
      publicClauseIds,
    },
  }, { releaseEligible: true })
}

export function isReleaseEligibleAuthority(
  authority: DnaKnowledgeAuthorityRef | null | undefined,
): authority is DnaKnowledgeAuthorityRef {
  if (!authority || authority.contractVersion !== DNA_KNOWLEDGE_AUTHORITY_CONTRACT_VERSION) {
    return false
  }
  if (!RELEASE_ELIGIBLE_AUTHORITIES.has(authority as object)) return false
  if (!authority.releaseEligible || authority.verificationStatus !== "verified") return false
  if (authority.layer === "dna_product_information") {
    return authority.approvalRequirement === "owner_approved" &&
      authority.proof?.kind === "owner_approval" &&
      SHA256_PATTERN.test(authority.proof.bookSha256) &&
      DNA_REGISTERED_OWNER_APPROVALS.some((record) =>
        record.approvalRecordId === authority.proof?.approvalRecordId &&
        record.bookVersion === authority.proof?.bookVersion &&
        record.bookSha256 === authority.proof?.bookSha256 &&
        record.sectionId === authority.proof?.sectionId &&
        record.passageId === authority.proof?.passageId)
  }
  if (authority.layer === "external_scientific_information") {
    return authority.approvalRequirement === "codex_multi_pass_audited" &&
      authority.proof?.kind === "codex_multi_pass_audit" &&
      authority.proof.passIds.length >= 2 && authority.proof.passageIds.length > 0 &&
      DNA_REGISTERED_SCIENCE_AUDITS.some((record) =>
        record.auditRunId === authority.proof?.auditRunId &&
        record.sourceId === authority.proof?.sourceId &&
        record.passageIds.length === authority.proof?.passageIds.length &&
        record.passIds.length === authority.proof?.passIds.length &&
        record.passageIds.every((value, index) => value === authority.proof?.passageIds[index]) &&
        record.passIds.every((value, index) => value === authority.proof?.passIds[index]))
  }
  if (authority.layer === "case_information") {
    return authority.approvalRequirement === "report_derived" &&
      authority.proof?.kind === "report_lineage" &&
      authority.proof.lineage === "owned_structured_report_context" &&
      authority.proof.ownershipVerified === true
  }
  return authority.approvalRequirement === "policy_enforced" &&
    authority.proof.kind === "policy_contract" && authority.proof.publicClauseIds.length > 0
}

export function authoritySet(
  authorities: readonly DnaKnowledgeAuthorityRef[],
): DnaKnowledgeAuthorityLayer[] {
  return Array.from(new Set(authorities.map((authority) => authority.layer))).sort()
}

export const DNA_KNOWLEDGE_ANSWER_ROLES = [
  "product_definition",
  "scientific_evidence",
  "dna_specific_validation",
  "case_finding",
  "safety_boundary",
] as const

export type DnaKnowledgeAnswerRole =
  (typeof DNA_KNOWLEDGE_ANSWER_ROLES)[number]

export function canAuthoritySupportAnswerRole(
  authority: DnaKnowledgeAuthorityRef,
  role: DnaKnowledgeAnswerRole,
  options: { requireReleaseEligible?: boolean; dnaSpecificEvidence?: boolean } = {},
): boolean {
  if (authority.contractVersion !== DNA_KNOWLEDGE_AUTHORITY_CONTRACT_VERSION) return false
  if (authority.releaseEligible && !isReleaseEligibleAuthority(authority)) return false
  if (options.requireReleaseEligible && !isReleaseEligibleAuthority(authority)) return false
  if (role === "product_definition") return authority.layer === "dna_product_information"
  if (role === "scientific_evidence") {
    return authority.layer === "external_scientific_information"
  }
  if (role === "dna_specific_validation") {
    return authority.layer === "external_scientific_information" &&
      options.dnaSpecificEvidence === true
  }
  if (role === "case_finding") return authority.layer === "case_information"
  return authority.layer === "safety_and_product_boundaries"
}

export function isAuthorityGraphEdgeAllowed(input: {
  from: DnaKnowledgeAuthorityLayer
  to: DnaKnowledgeAuthorityLayer
  predicate: string
}): boolean {
  const predicate = String(input.predicate || "").toLowerCase()
  // A graph edge is executable only when its predicate belongs to the
  // versioned one-hop catalog vocabulary. Unknown verbs fail closed.
  if (!CONTROLLED_GRAPH_PREDICATES.has(predicate)) return false
  if (
    input.from === "external_scientific_information" &&
    input.to === "dna_product_information" &&
    !/^(?:distinguished_from|associated_with|supports|conceptually_related_to)$/.test(predicate)
  ) {
    return false
  }
  if (
    input.from === "case_information" &&
    input.to !== "case_information"
  ) {
    return false
  }
  if (
    input.to === "safety_and_product_boundaries" &&
    input.from !== "safety_and_product_boundaries"
  ) {
    return false
  }
  return true
}

export const DNA_KNOWLEDGE_AUTHORITY_CONTRACT = Object.freeze({
  schemaVersion: DNA_KNOWLEDGE_AUTHORITY_CONTRACT_VERSION,
  authorities: Object.freeze([
    {
      layer: "dna_product_information",
      labelTr: "DNA Ürün Bilgisi",
      authorityTr: "Sahibin onayladığı DNA kitabı",
      approvalRequirement: "owner_approved",
    },
    {
      layer: "external_scientific_information",
      labelTr: "Dış Bilimsel Bilgi",
      authorityTr: "Hakemli yayınlar, kılavuzlar ve kitaplar",
      approvalRequirement: "codex_multi_pass_audited",
    },
    {
      layer: "case_information",
      labelTr: "Vaka Bilgisi",
      authorityTr: "Sahipliği doğrulanmış yapılandırılmış güvenli rapor bağlamı",
      approvalRequirement: "report_derived",
    },
    {
      layer: "safety_and_product_boundaries",
      labelTr: "Güvenlik ve Ürün Sınırları",
      authorityTr: "Sürümlü güvenlik sözleşmesi",
      approvalRequirement: "policy_enforced",
    },
  ]),
  nonSubstitutionRules: Object.freeze([
    "dna_product_information_cannot_replace_external_science",
    "external_science_cannot_validate_dna_product_automatically",
    "case_information_cannot_claim_biological_measurement",
    "policy_cannot_be_overridden_by_other_authorities",
    "external_science_cannot_redefine_dna_product",
  ]),
  terminology: Object.freeze({
    approvalRequirement: "codex_multi_pass_audited",
    futureLifecycleStatus: "codex_audited_multi_pass",
    distinctionTr:
      "İlki bilgi otoritesinin onay gereksinimi, ikincisi Faz 28'de kullanılacak kayıt yaşam-döngüsü statüsüdür.",
  }),
})
