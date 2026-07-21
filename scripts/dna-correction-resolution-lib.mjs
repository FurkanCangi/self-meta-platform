import { createHash } from "node:crypto"

export const DNA_CORRECTION_RESOLUTION_VERSION = "dna-correction-resolution-attestation@1"

export const REQUIRED_CORRECTION_CHECKS = Object.freeze([
  "notice_identity",
  "notice_target_relation",
  "notice_scope",
  "notice_update_statement",
  "source_manifest_binding",
  "current_jats_binding",
  "current_pdf_binding",
  "post_notice_timing",
])

export function stableJson(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`
  return `{${Object.keys(value).sort().map((key) =>
    `${JSON.stringify(key)}:${stableJson(value[key])}`).join(",")}}`
}

export function sha256(value) {
  return createHash("sha256").update(
    Buffer.isBuffer(value) || typeof value === "string" ? value : stableJson(value),
  ).digest("hex")
}

export function canonicalDoi(value) {
  return String(value || "").trim().replace(/^doi\s*:\s*/i, "")
    .replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, "").replace(/[.,;:]+$/, "").toLowerCase()
}

export function canonicalPmcid(value) {
  const digits = String(value || "").toUpperCase().replace(/^PMC/, "").replace(/\D/g, "")
  return digits ? `PMC${digits}` : ""
}

function isSha256(value) {
  return /^[a-f0-9]{64}$/.test(String(value || ""))
}

function validDate(value) {
  return typeof value === "string" && Number.isFinite(Date.parse(value))
}

function check(id, passed, evidenceRefs, failureReason) {
  return Object.freeze({
    id,
    status: passed ? "passed" : "failed",
    evidenceRefs: Object.freeze([...evidenceRefs].sort()),
    failureReason: passed ? null : failureReason,
  })
}

/**
 * Produces a correction decision only from explicit, hash-bound evidence.
 * A caller cannot obtain `verified_applied` by supplying a bare boolean: every
 * required check is recomputed here from notice, manifest and artifact facts.
 */
export function buildDnaCorrectionResolutionAttestation(input) {
  const sourceDoi = canonicalDoi(input.source.doi)
  const sourcePmcid = canonicalPmcid(input.source.pmcid)
  const noticeDoi = canonicalDoi(input.correctionNotice.doi)
  const noticePmcid = canonicalPmcid(input.correctionNotice.pmcid)
  const targetDoi = canonicalDoi(input.correctionNotice.targetDoi)
  const targetPmcid = canonicalPmcid(input.correctionNotice.targetPmcid)
  const correctionDate = Date.parse(input.correctionNotice.publicationDate)
  const sourceDownloadedAt = Date.parse(input.source.downloadedAt)
  const pdfModifiedAt = Date.parse(input.artifacts.pdf.documentModifiedAt)

  const checks = [
    check(
      "notice_identity",
      input.correctionNotice.articleType === "correction"
        && Boolean(noticeDoi) && Boolean(noticePmcid)
        && isSha256(input.correctionNotice.sha256)
        && input.correctionNotice.bytes > 0,
      ["correction_notice_jats"],
      "correction_notice_identity_or_archive_invalid",
    ),
    check(
      "notice_target_relation",
      input.correctionNotice.relationType === "corrected-article"
        && targetDoi === sourceDoi && targetPmcid === sourcePmcid,
      ["correction_notice_jats", "source_manifest"],
      "correction_notice_target_does_not_match_source",
    ),
    check(
      "notice_scope",
      input.correctionNotice.scope === "author_affiliations_only"
        && input.correctionNotice.minorChanges === true
        && input.correctionNotice.otherAffectedFieldsIndicated === false,
      ["correction_notice_jats"],
      "correction_scope_is_not_explicitly_limited_to_author_affiliations",
    ),
    check(
      "notice_update_statement",
      input.correctionNotice.articleUpdated === true && input.correctionNotice.pdfUpdated === true,
      ["correction_notice_jats"],
      "official_notice_does_not_confirm_both_article_and_pdf_updated",
    ),
    check(
      "source_manifest_binding",
      input.source.manifestArtifactHashesMatch === true
        && isSha256(input.source.manifestSha256)
        && sourceDoi === canonicalDoi(input.artifacts.jats.doi)
        && sourcePmcid === canonicalPmcid(input.artifacts.jats.pmcid),
      ["source_manifest", "local_current_jats", "local_current_pdf"],
      "source_manifest_or_declared_artifact_hash_binding_invalid",
    ),
    check(
      "current_jats_binding",
      isSha256(input.artifacts.jats.localSha256)
        && input.artifacts.jats.localSha256 === input.artifacts.jats.remoteSha256
        && input.artifacts.jats.localSha256 === input.artifacts.jats.manifestSha256
        && input.artifacts.jats.localBytes === input.artifacts.jats.remoteBytes,
      ["local_current_jats", "remote_current_jats", "source_manifest"],
      "local_jats_is_not_the_hash_identical_current_authority_snapshot",
    ),
    check(
      "current_pdf_binding",
      isSha256(input.artifacts.pdf.localSha256)
        && input.artifacts.pdf.localSha256 === input.artifacts.pdf.remoteSha256
        && input.artifacts.pdf.localSha256 === input.artifacts.pdf.manifestSha256
        && input.artifacts.pdf.localBytes === input.artifacts.pdf.remoteBytes,
      ["local_current_pdf", "remote_repository_pdf", "source_manifest"],
      "local_pdf_is_not_hash_identical_to_the_bound_repository_snapshot",
    ),
    check(
      "post_notice_timing",
      Number.isFinite(correctionDate) && Number.isFinite(sourceDownloadedAt)
        && Number.isFinite(pdfModifiedAt)
        && sourceDownloadedAt >= correctionDate && pdfModifiedAt >= correctionDate,
      ["correction_notice_jats", "source_manifest", "local_current_pdf"],
      "source_acquisition_or_pdf_modification_does_not_postdate_the_notice",
    ),
  ]
  const failedChecks = checks.filter((item) => item.status === "failed")
  const status = failedChecks.length === 0 ? "verified_applied" : "pending"
  const reasonCodes = failedChecks.map((item) => item.failureReason).filter(Boolean).sort()
  const body = {
    schemaVersion: DNA_CORRECTION_RESOLUTION_VERSION,
    attestationId: input.attestationId,
    checkedAt: input.checkedAt,
    decision: {
      status,
      sourceIntegrityResolution: status === "verified_applied" ? "applied" : "pending",
      affectedScope: status === "verified_applied" ? "author_affiliations_only" : "unresolved",
      scientificClaimImpact: status === "verified_applied"
        ? "not_indicated_by_official_notice"
        : "unknown_until_resolution",
    },
    source: {
      sourceId: input.source.sourceId,
      doi: sourceDoi,
      pmcid: sourcePmcid,
      sourceRecordPath: input.source.sourceRecordPath,
      downloadedAt: input.source.downloadedAt,
      manifestSha256: input.source.manifestSha256,
    },
    correctionNotice: {
      doi: noticeDoi,
      pmcid: noticePmcid,
      publicationDate: input.correctionNotice.publicationDate,
      articleType: input.correctionNotice.articleType,
      relationType: input.correctionNotice.relationType,
      targetDoi,
      targetPmcid,
      scope: input.correctionNotice.scope,
      minorChanges: input.correctionNotice.minorChanges,
      otherAffectedFieldsIndicated: input.correctionNotice.otherAffectedFieldsIndicated,
      articleUpdated: input.correctionNotice.articleUpdated,
      pdfUpdated: input.correctionNotice.pdfUpdated,
      sourceUrl: input.correctionNotice.sourceUrl,
      archivedRelativePath: input.correctionNotice.archivedRelativePath,
      bytes: input.correctionNotice.bytes,
      sha256: input.correctionNotice.sha256,
      normalizedStatementSha256: input.correctionNotice.normalizedStatementSha256,
    },
    artifacts: input.artifacts,
    checks,
    reasonCodes,
    limitations: [
      "The decision verifies the correction notice, its stated scope, and the current artifact bindings; it is not a scientific-validity appraisal.",
      "No pre-correction binary was available, so the attestation does not independently diff every pre/post field.",
      "The scientific-claim-impact statement is limited to what the official correction notice indicates; it does not prove that no undisclosed change exists.",
      "The PDF byte match uses the publisher-version copy held by the official institutional repository because the BMJ PDF endpoint denied automated retrieval during this audit.",
    ],
  }
  return Object.freeze({ ...body, attestationSha256: sha256(body) })
}

export function validateDnaCorrectionResolutionAttestation(attestation) {
  const errors = []
  if (!attestation || typeof attestation !== "object") return { ok: false, errors: ["attestation_required"] }
  if (attestation.schemaVersion !== DNA_CORRECTION_RESOLUTION_VERSION) errors.push("invalid_schema_version")
  if (!String(attestation.attestationId || "").trim()) errors.push("attestation_id_required")
  if (!validDate(attestation.checkedAt)) errors.push("checked_at_invalid")
  const { attestationSha256, ...body } = attestation
  if (!isSha256(attestationSha256) || sha256(body) !== attestationSha256) {
    errors.push("attestation_hash_mismatch")
  }
  const checks = Array.isArray(attestation.checks) ? attestation.checks : []
  const ids = new Set(checks.map((item) => item?.id))
  for (const id of REQUIRED_CORRECTION_CHECKS) {
    if (!ids.has(id)) errors.push(`required_check_missing:${id}`)
  }
  if (ids.size !== checks.length) errors.push("duplicate_check_id")
  for (const item of checks) {
    if (!item || !["passed", "failed"].includes(item.status)) errors.push(`invalid_check_status:${item?.id || "unknown"}`)
    if (!Array.isArray(item?.evidenceRefs) || item.evidenceRefs.length === 0) {
      errors.push(`check_evidence_missing:${item?.id || "unknown"}`)
    }
    if (item?.status === "failed" && !String(item.failureReason || "").trim()) {
      errors.push(`failed_check_reason_missing:${item?.id || "unknown"}`)
    }
    if (item?.status === "passed" && item.failureReason !== null) {
      errors.push(`passed_check_has_failure_reason:${item?.id || "unknown"}`)
    }
  }
  const failedChecks = checks.filter((item) => item?.status === "failed")
  const status = attestation.decision?.status
  if (!["verified_applied", "pending"].includes(status)) errors.push("invalid_decision_status")
  if (status === "verified_applied") {
    if (failedChecks.length > 0) errors.push("applied_with_failed_check")
    if (attestation.decision?.sourceIntegrityResolution !== "applied") {
      errors.push("verified_attestation_not_mapped_to_applied")
    }
    if ((attestation.reasonCodes || []).length > 0) errors.push("applied_with_reason_codes")
  } else if (attestation.decision?.sourceIntegrityResolution !== "pending") {
    errors.push("pending_attestation_not_mapped_to_pending")
  }
  if (!Array.isArray(attestation.limitations) || attestation.limitations.length < 3) {
    errors.push("limitations_incomplete")
  }
  for (const hash of [
    attestation.source?.manifestSha256,
    attestation.correctionNotice?.sha256,
    attestation.correctionNotice?.normalizedStatementSha256,
    attestation.artifacts?.jats?.localSha256,
    attestation.artifacts?.jats?.remoteSha256,
    attestation.artifacts?.pdf?.localSha256,
    attestation.artifacts?.pdf?.remoteSha256,
  ]) {
    if (!isSha256(hash)) errors.push("invalid_evidence_sha256")
  }
  return { ok: errors.length === 0, errors: Object.freeze([...new Set(errors)].sort()) }
}
