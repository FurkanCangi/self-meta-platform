import { createHash } from "node:crypto"

import {
  DNA_SOURCE_AGE_SCOPES,
  type DnaEvidencePopulation,
  type DnaSourceAgeScope,
} from "./sourceGovernance"

export const DNA_EVIDENCE_EXTRACTION_VERSION = "dna-evidence-extraction@1" as const
export const DNA_SOURCE_PASSAGE_VERSION = "dna-source-passage@1" as const
export const DNA_ATOMIC_CLAIM_VERSION = "dna-atomic-claim@1" as const
export const DNA_BLIND_EXTRACTION_VERSION = "dna-blind-extraction@1" as const
export const DNA_CLAIM_RECONCILIATION_VERSION = "dna-claim-reconciliation@1" as const

export const DNA_PARSER_PREFERENCE = Object.freeze([
  "jats_xml",
  "epub_xml",
  "structural_html",
  "approved_pdf_range",
  "ocr",
] as const)

export type DnaEvidenceArtifactFormat = (typeof DNA_PARSER_PREFERENCE)[number]

export const DNA_PARSE_EXCLUSION_REASONS = Object.freeze([
  "references",
  "table",
  "figure",
  "caption",
  "supplement",
  "scale_or_questionnaire",
  "test_items",
  "third_party_component",
  "structural_noncontent",
  "empty_or_fragment",
  "invalid_ocr",
  "column_order_invalid",
] as const)

export type DnaParseExclusionReason = (typeof DNA_PARSE_EXCLUSION_REASONS)[number]

type DnaManualParagraph = Readonly<{
  paragraphNumber: number
  pageStart: number
  pageEnd: number
  sectionPath: readonly string[]
  text: string
}>

export type DnaApprovedPageRange = Readonly<{
  rangeId: string
  pageStart: number
  pageEnd: number
  paragraphs: readonly DnaManualParagraph[]
}>

export type DnaManualArtifactApproval = Readonly<{
  approvalId: string
  approvedAt: string
  evidenceSha256: string
  artifactSha256: string
  approved: true
  columnOrderVerified: true
  restrictedComponentsExcluded: true
}>

export type DnaOcrQualityApproval = Readonly<{
  engineId: string
  meanCharacterConfidence: number
  replacementCharacterRate: number
  humanRangeApproved: true
  columnOrderVerified: true
}>

export type DnaEvidenceArtifactInput = Readonly<{
  sourceId: string
  artifactId: string
  format: DnaEvidenceArtifactFormat
  originalLanguage: string
  bytes: string | Uint8Array
  declaredSha256?: string
  approvedRanges?: readonly DnaApprovedPageRange[]
  manualApproval?: DnaManualArtifactApproval
  ocrQuality?: DnaOcrQualityApproval
  trustRegistry?: DnaEvidenceTrustRegistry
}>

export type DnaParsedParagraph = Readonly<{
  paragraphId: string
  sourceId: string
  artifactId: string
  artifactSha256: string
  format: DnaEvidenceArtifactFormat
  originalLanguage: string
  sectionPath: readonly string[]
  sectionIdentityPath: readonly string[]
  xmlId: string | null
  paragraphIndex: number
  sectionParagraphIndex: number
  pageStart: number | null
  pageEnd: number | null
  text: string
  contentSha256: string
}>

export type DnaParsedArtifact = Readonly<{
  schemaVersion: typeof DNA_EVIDENCE_EXTRACTION_VERSION
  status: "candidate_only"
  runtimeEligible: false
  sourceId: string
  artifactId: string
  artifactSha256: string
  format: DnaEvidenceArtifactFormat
  parserRank: number
  originalLanguage: string
  paragraphs: readonly DnaParsedParagraph[]
  exclusions: readonly Readonly<{
    reason: DnaParseExclusionReason
    count: number
  }>[]
  parsedContentSha256: string
  artifactBindingSha256: string
}>

const SHA256_PATTERN = /^[a-f0-9]{64}$/
const STABLE_ID_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9._:@/-]{2,159}$/
const ISO_LANGUAGE_PATTERN = /^[a-z]{2,3}(?:-[A-Z]{2})?$/
const WHITESPACE_PATTERN = /\s+/g

export const DNA_EVIDENCE_TRUST_REGISTRY_VERSION = "dna-evidence-trust-registry@1" as const

export const DNA_EVIDENCE_TRUST_KINDS = Object.freeze([
  "manual_artifact_approval",
  "passage_license_approval",
  "passage_metadata_approval",
  "passage",
  "method_appraisal",
] as const)

export type DnaEvidenceTrustKind = (typeof DNA_EVIDENCE_TRUST_KINDS)[number]

export type DnaEvidenceTrustRecord = Readonly<{
  kind: DnaEvidenceTrustKind
  recordId: string
  sourceId: string
  artifactSha256: string
  subjectSha256: string
}>

export type DnaEvidenceTrustRegistry = Readonly<{
  schemaVersion: typeof DNA_EVIDENCE_TRUST_REGISTRY_VERSION
  registryId: string
  authority: "governance_audit" | "test_fixture"
  records: readonly DnaEvidenceTrustRecord[]
  registrySha256: string
}>

function stableJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`
  const object = value as Record<string, unknown>
  return `{${Object.keys(object).sort().map((key) =>
    `${JSON.stringify(key)}:${stableJson(object[key])}`).join(",")}}`
}

function sha256Bytes(value: string | Uint8Array): string {
  return createHash("sha256").update(
    typeof value === "string" ? Buffer.from(value, "utf8") : value,
  ).digest("hex")
}

function sha256Object(value: unknown): string {
  return sha256Bytes(stableJson(value))
}

/**
 * Creates the content commitment stored by the separate governance audit.
 * A commitment alone is not approval; consumers must also receive an intact,
 * explicitly trusted registry containing the matching record.
 */
export function commitDnaEvidenceSubject(value: unknown): string {
  return sha256Object(value)
}

function requireStableId(value: string, field: string): string {
  const normalized = String(value || "").trim()
  if (!STABLE_ID_PATTERN.test(normalized)) throw new Error(`dna_evidence_invalid_${field}`)
  return normalized
}

function requireSha256(value: string, field: string): string {
  const normalized = String(value || "").trim().toLowerCase()
  if (!SHA256_PATTERN.test(normalized)) throw new Error(`dna_evidence_invalid_${field}`)
  return normalized
}

function requireIsoTimestamp(value: string, field: string): string {
  const normalized = String(value || "").trim()
  const timestamp = Date.parse(normalized)
  if (!Number.isFinite(timestamp) || new Date(timestamp).toISOString() !== normalized) {
    throw new Error(`dna_evidence_invalid_${field}`)
  }
  return normalized
}

function normalizeText(value: string): string {
  return value.normalize("NFKC").replace(WHITESPACE_PATTERN, " ").trim()
}

function canonicalText(value: string): string {
  return normalizeText(value).toLocaleLowerCase("en-US")
}

function decodeEntities(value: string): string {
  return value
    .replace(/&#x([0-9a-f]+);/gi, (_, code: string) =>
      String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&#([0-9]+);/g, (_, code: string) =>
      String.fromCodePoint(Number.parseInt(code, 10)))
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, "\"")
    .replace(/&apos;/gi, "'")
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value)
    for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child)
  }
  return value
}

function requireExactKeys(
  value: object,
  allowedKeys: readonly string[],
  code: string,
): void {
  const actual = Object.keys(value).sort()
  const expected = [...allowedKeys].sort()
  if (actual.length !== expected.length
    || actual.some((key, index) => key !== expected[index])) {
    throw new Error(code)
  }
}

function trustRegistryCore(registry: DnaEvidenceTrustRegistry) {
  const { registrySha256: _registrySha256, ...core } = registry
  return core
}

export function createDnaEvidenceTrustRegistry(input: Readonly<{
  registryId: string
  authority: "governance_audit" | "test_fixture"
  records: readonly DnaEvidenceTrustRecord[]
}>): DnaEvidenceTrustRegistry {
  const registryId = requireStableId(input.registryId, "trust_registry_id")
  if (input.authority !== "governance_audit" && input.authority !== "test_fixture") {
    throw new Error("dna_evidence_invalid_trust_registry_authority")
  }
  const keys = new Set<string>()
  const records = input.records.map((record) => {
    requireExactKeys(record, [
      "kind",
      "recordId",
      "sourceId",
      "artifactSha256",
      "subjectSha256",
    ], "dna_evidence_invalid_trust_record_shape")
    if (!DNA_EVIDENCE_TRUST_KINDS.includes(record.kind)) {
      throw new Error("dna_evidence_invalid_trust_record_kind")
    }
    const normalized = {
      kind: record.kind,
      recordId: requireStableId(record.recordId, "trust_record_id"),
      sourceId: requireStableId(record.sourceId, "trust_source_id"),
      artifactSha256: requireSha256(record.artifactSha256, "trust_artifact_sha256"),
      subjectSha256: requireSha256(record.subjectSha256, "trust_subject_sha256"),
    }
    const key = `${normalized.kind}\u0000${normalized.recordId}\u0000${normalized.sourceId}\u0000${normalized.artifactSha256}`
    if (keys.has(key)) throw new Error("dna_evidence_duplicate_trust_record")
    keys.add(key)
    return Object.freeze(normalized)
  }).sort((left, right) => stableJson(left).localeCompare(stableJson(right)))
  const core = {
    schemaVersion: DNA_EVIDENCE_TRUST_REGISTRY_VERSION,
    registryId,
    authority: input.authority,
    records,
  }
  return deepFreeze({ ...core, registrySha256: sha256Object(core) })
}

export const DNA_EMPTY_EVIDENCE_TRUST_REGISTRY = createDnaEvidenceTrustRegistry({
  registryId: "dna.evidence.trust.empty",
  authority: "governance_audit",
  records: [],
})

/**
 * Production trust is code-reviewed and digest-pinned. It is deliberately
 * empty until a governance release registers an audited registry snapshot.
 * A caller-created `governance_audit` object is therefore not authoritative.
 */
export const DNA_REGISTERED_EVIDENCE_TRUST_REGISTRY_SHA256 = Object.freeze([] as string[])

export function isDnaEvidenceTrustRegistryValid(
  registry: DnaEvidenceTrustRegistry,
): boolean {
  try {
    return registry.schemaVersion === DNA_EVIDENCE_TRUST_REGISTRY_VERSION
      && (registry.authority === "governance_audit" || registry.authority === "test_fixture")
      && registry.registrySha256 === sha256Object(trustRegistryCore(registry))
      && createDnaEvidenceTrustRegistry({
        registryId: registry.registryId,
        authority: registry.authority,
        records: registry.records,
      }).registrySha256 === registry.registrySha256
  } catch {
    return false
  }
}

export function isDnaEvidenceTrustRegistryAuthorized(
  registry: DnaEvidenceTrustRegistry,
): boolean {
  if (!isDnaEvidenceTrustRegistryValid(registry)) return false
  if (registry.authority === "governance_audit") {
    return DNA_REGISTERED_EVIDENCE_TRUST_REGISTRY_SHA256.includes(registry.registrySha256)
  }
  return process.env.NODE_ENV !== "production"
    && process.env.DNA_EVIDENCE_TEST_FIXTURE_MODE === "1"
}

function requireTrustedSubject(input: Readonly<{
  registry: DnaEvidenceTrustRegistry | undefined
  kind: DnaEvidenceTrustKind
  recordId: string
  sourceId: string
  artifactSha256: string
  subjectSha256: string
}>): void {
  if (!input.registry || !isDnaEvidenceTrustRegistryValid(input.registry)) {
    throw new Error("dna_evidence_trust_registry_required")
  }
  if (!isDnaEvidenceTrustRegistryAuthorized(input.registry)) {
    throw new Error("dna_evidence_trust_registry_not_authorized")
  }
  const match = input.registry.records.find((record) =>
    record.kind === input.kind
    && record.recordId === input.recordId
    && record.sourceId === input.sourceId
    && record.artifactSha256 === input.artifactSha256
    && record.subjectSha256 === input.subjectSha256)
  if (!match) throw new Error(`dna_evidence_untrusted_${input.kind}`)
}

function bytesToUtf8(value: string | Uint8Array): string {
  if (typeof value === "string") return value
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(value)
  } catch {
    throw new Error("dna_evidence_invalid_utf8")
  }
}

function tagName(rawTag: string): string | null {
  const match = rawTag.match(/^<\s*\/?\s*([a-zA-Z0-9_.:-]+)/)
  if (!match) return null
  return (match[1]?.split(":").pop() || "").toLowerCase()
}

function attribute(rawTag: string, name: string): string | null {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  const match = rawTag.match(new RegExp(`\\s${escaped}\\s*=\\s*(["'])(.*?)\\1`, "i"))
  return match ? decodeEntities(match[2] || "") : null
}

function thirdPartyReason(rawTag: string): DnaParseExclusionReason | null {
  const markers = ["specific-use", "content-type", "class", "data-license", "data-origin"]
    .map((name) => attribute(rawTag, name))
    .filter((value): value is string => Boolean(value))
    .join(" ")
  return /\bthird[-_ ]party\b/i.test(markers) ? "third_party_component" : null
}

function structuralTagReason(name: string, rawTag: string): DnaParseExclusionReason | null {
  const thirdParty = thirdPartyReason(rawTag)
  if (thirdParty) return thirdParty
  if (["ref-list", "references", "bibliography"].includes(name)) return "references"
  if (["table", "table-wrap", "thead", "tbody", "tfoot"].includes(name)) return "table"
  if (["fig", "figure", "fig-group"].includes(name)) return "figure"
  if (["caption", "figcaption"].includes(name)) return "caption"
  if (["supplementary-material", "supplement", "app", "app-group", "fn-group"].includes(name)) {
    return "supplement"
  }
  if (["questionnaire", "scale-items", "survey-instrument"].includes(name)) {
    return "scale_or_questionnaire"
  }
  if (["test-items", "item-bank"].includes(name)) return "test_items"
  if (["script", "style", "nav", "aside", "footer", "noscript"].includes(name)) {
    return "structural_noncontent"
  }
  return null
}

function semanticSectionReason(title: string): DnaParseExclusionReason | null {
  const normalized = canonicalText(title).replace(/[:.]$/, "")
  if (/^(references|reference list|bibliography|kaynakça|kaynaklar)$/.test(normalized)) {
    return "references"
  }
  if (/^(?:(?:electronic|online)\s+)?(?:supplement(?:ary)?(?:\s+(?:information|material|materials|data|appendix|appendices))?|supporting information|appendix(?:es)?|ek(?:ler)?)\b/.test(normalized)) {
    return "supplement"
  }
  if (/^(questionnaire|questionnaire items|survey instrument|scale items|ölçek maddeleri|anket)\b/.test(normalized)) {
    return "scale_or_questionnaire"
  }
  if (/^(test items|item bank|test maddeleri)\b/.test(normalized)) return "test_items"
  return null
}

type MutableParagraph = {
  xmlId: string | null
  sectionPath: string[]
  sectionIdentityPath: string[]
  paragraphIndex: number
  sectionParagraphIndex: number
  pageStart: number | null
  pageEnd: number | null
  text: string
}

type MarkupParseResult = {
  paragraphs: MutableParagraph[]
  exclusions: Map<DnaParseExclusionReason, number>
}

type TagFrame = {
  name: string
  exclusion: DnaParseExclusionReason | null
}

type SectionFrame = {
  tagDepth: number
  title: string
  xmlId: string | null
  identity: string
  exclusion: DnaParseExclusionReason | null
}

function nearestExclusion(stack: readonly TagFrame[]): DnaParseExclusionReason | null {
  for (let index = stack.length - 1; index >= 0; index -= 1) {
    if (stack[index]?.exclusion) return stack[index]!.exclusion
  }
  return null
}

function incrementExclusion(
  exclusions: Map<DnaParseExclusionReason, number>,
  reason: DnaParseExclusionReason,
): void {
  exclusions.set(reason, (exclusions.get(reason) ?? 0) + 1)
}

function headingExclusionReason(
  value: { readonly reason: DnaParseExclusionReason } | null,
): DnaParseExclusionReason | null {
  return value ? value.reason : null
}

function parseJatsMarkup(content: string): MarkupParseResult {
  const sanitized = content
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<\?[^>]*\?>/g, "")
    .replace(/<!DOCTYPE[\s\S]*?>/gi, "")
  const regions: string[] = []
  for (const match of sanitized.matchAll(/<abstract\b[\s\S]*?<\/abstract\s*>/gi)) {
    regions.push(match[0])
  }
  const body = sanitized.match(/<body\b[\s\S]*?<\/body\s*>/i)
  if (body?.[0]) regions.push(body[0])
  if (regions.length === 0) throw new Error("dna_evidence_jats_regions_missing")

  const paragraphs: MutableParagraph[] = []
  const exclusions = new Map<DnaParseExclusionReason, number>()
  let globalParagraphIndex = 0

  for (const [regionIndex, region] of regions.entries()) {
    const stack: TagFrame[] = []
    const initialTitle = region.toLowerCase().startsWith("<abstract") ? "Abstract" : "Body"
    const sections: SectionFrame[] = [{
      tagDepth: 0,
      title: initialTitle,
      xmlId: null,
      identity: `${initialTitle.toLowerCase()}:${regionIndex + 1}`,
      exclusion: null,
    }]
    let sectionOrdinal = 0
    const sectionIdentities = new Set([sections[0]!.identity])
    const sectionParagraphCounts = new Map<string, number>()
    let titleCapture: { text: string[]; sectionDepth: number } | null = null
    let paragraphCapture: {
      text: string[]
      xmlId: string | null
      sectionPath: string[]
      sectionIdentityPath: string[]
      sectionKey: string
      exclusion: DnaParseExclusionReason | null
    } | null = null

    const tokens = region.match(/<[^>]+>|[^<]+/g) ?? []
    for (const token of tokens) {
      if (!token.startsWith("<")) {
        const text = decodeEntities(token)
        if (titleCapture && !nearestExclusion(stack)) titleCapture.text.push(text)
        if (paragraphCapture && !paragraphCapture.exclusion && !nearestExclusion(stack)) {
          paragraphCapture.text.push(text)
        }
        continue
      }
      if (/^<\s*[!?]/.test(token)) continue
      const name = tagName(token)
      if (!name) continue
      const closing = /^<\s*\//.test(token)
      const selfClosing = /\/\s*>$/.test(token)

      if (!closing) {
        const inherited = nearestExclusion(stack)
        const ownExclusion = inherited ?? structuralTagReason(name, token)
        stack.push({ name, exclusion: ownExclusion })

        if (name === "sec") {
          sectionOrdinal += 1
          const sectionXmlId = attribute(token, "id") || attribute(token, "xml:id")
          const sectionIdentity = sectionXmlId
            ? `xml:${sectionXmlId}`
            : `ordinal:${regionIndex + 1}.${sectionOrdinal}`
          if (sectionIdentities.has(sectionIdentity)) {
            throw new Error("dna_evidence_duplicate_section_identity")
          }
          sectionIdentities.add(sectionIdentity)
          sections.push({
            tagDepth: stack.length,
            title: sectionXmlId || `Section ${regionIndex + 1}.${sections.length}`,
            xmlId: sectionXmlId,
            identity: sectionIdentity,
            exclusion: ownExclusion,
          })
        }
        if (name === "title" && !ownExclusion) {
          titleCapture = { text: [], sectionDepth: sections.length - 1 }
        }
        if (name === "p") {
          const sectionPath = sections.map((section) => section.title).filter(Boolean)
          const sectionIdentityPath = sections.map((section) => section.identity)
          const sectionKey = sectionIdentityPath.join(" > ")
          const sectionExclusion = [...sections].reverse().find((section) => section.exclusion)?.exclusion ?? null
          paragraphCapture = {
            text: [],
            xmlId: attribute(token, "id") || attribute(token, "xml:id"),
            sectionPath,
            sectionIdentityPath,
            sectionKey,
            exclusion: ownExclusion ?? sectionExclusion,
          }
        }
        if (selfClosing) stack.pop()
        continue
      }

      const top = stack[stack.length - 1]
      if (!top || top.name !== name) throw new Error("dna_evidence_markup_not_well_formed")

      if (name === "title" && titleCapture) {
        const title = normalizeText(titleCapture.text.join(" "))
        const section = sections[titleCapture.sectionDepth]
        if (section && title) {
          section.title = title
          section.exclusion = section.exclusion ?? semanticSectionReason(title)
        }
        titleCapture = null
      }

      if (name === "p" && paragraphCapture) {
        const section = sections[sections.length - 1]
        const currentPath = sections.map((entry) => entry.title).filter(Boolean)
        const currentIdentityPath = sections.map((entry) => entry.identity)
        const sectionKey = currentIdentityPath.join(" > ") || paragraphCapture.sectionKey
        const sectionParagraphIndex = (sectionParagraphCounts.get(sectionKey) ?? 0) + 1
        sectionParagraphCounts.set(sectionKey, sectionParagraphIndex)
        const reason = paragraphCapture.exclusion ?? section?.exclusion ?? null
        const text = normalizeText(paragraphCapture.text.join(" "))
        if (reason) {
          incrementExclusion(exclusions, reason)
        } else if (text.length < 20) {
          incrementExclusion(exclusions, "empty_or_fragment")
        } else {
          globalParagraphIndex += 1
          paragraphs.push({
            xmlId: paragraphCapture.xmlId,
            sectionPath: currentPath.length > 0 ? currentPath : [initialTitle],
            sectionIdentityPath: currentIdentityPath,
            paragraphIndex: globalParagraphIndex,
            sectionParagraphIndex,
            pageStart: null,
            pageEnd: null,
            text,
          })
        }
        paragraphCapture = null
      }

      stack.pop()
      if (name === "sec") sections.pop()
    }
    if (stack.length > 0 || paragraphCapture || titleCapture) {
      throw new Error("dna_evidence_markup_not_well_formed")
    }
  }

  if (paragraphs.length === 0) throw new Error("dna_evidence_no_eligible_paragraphs")
  return { paragraphs, exclusions }
}

function parseHtmlMarkup(content: string): MarkupParseResult {
  const sanitized = content
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<\?[^>]*\?>/g, "")
  const body = sanitized.match(/<body\b[^>]*>([\s\S]*?)<\/body\s*>/i)?.[1] ?? sanitized
  const tokens = body.match(/<[^>]+>|[^<]+/g) ?? []
  const voidTags = new Set(["area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "source", "track", "wbr"])
  const stack: TagFrame[] = []
  const headingPath: string[] = []
  const headingIdentityPath: string[] = []
  const sectionParagraphCounts = new Map<string, number>()
  const exclusions = new Map<DnaParseExclusionReason, number>()
  const paragraphs: MutableParagraph[] = []
  let globalParagraphIndex = 0
  let headingOrdinal = 0
  let headingCapture: {
    level: number
    ordinal: number
    text: string[]
    exclusion: DnaParseExclusionReason | null
  } | null = null
  let excludedHeading: { level: number; reason: DnaParseExclusionReason } | null = null
  let paragraphCapture: {
    text: string[]
    xmlId: string | null
    sectionPath: string[]
    sectionIdentityPath: string[]
    exclusion: DnaParseExclusionReason | null
  } | null = null

  for (const token of tokens) {
    if (!token.startsWith("<")) {
      const text = decodeEntities(token)
      if (headingCapture && !nearestExclusion(stack)) headingCapture.text.push(text)
      if (paragraphCapture && !paragraphCapture.exclusion && !nearestExclusion(stack)) {
        paragraphCapture.text.push(text)
      }
      continue
    }
    if (/^<\s*[!?]/.test(token)) continue
    const name = tagName(token)
    if (!name) continue
    const closing = /^<\s*\//.test(token)
    const selfClosing = /\/\s*>$/.test(token) || voidTags.has(name)

    if (!closing) {
      const inherited = nearestExclusion(stack)
      const ownExclusion = inherited ?? structuralTagReason(name, token)
      stack.push({ name, exclusion: ownExclusion })
      const heading = name.match(/^h([1-6])$/)
      if (heading) {
        const level = Number(heading[1])
        headingOrdinal += 1
        if (excludedHeading && level <= excludedHeading.level) excludedHeading = null
        headingCapture = { level, text: [], exclusion: ownExclusion, ordinal: headingOrdinal }
      }
      if (name === "p") {
        paragraphCapture = {
          text: [],
          xmlId: attribute(token, "id") || attribute(token, "xml:id"),
          sectionPath: headingPath.length > 0 ? [...headingPath] : ["Document body"],
          sectionIdentityPath: headingIdentityPath.length > 0
            ? [...headingIdentityPath]
            : ["html:document-body"],
          exclusion: ownExclusion ?? headingExclusionReason(excludedHeading),
        }
      }
      if (selfClosing) stack.pop()
      continue
    }

    const top = stack[stack.length - 1]
    if (!top || top.name !== name) throw new Error("dna_evidence_markup_not_well_formed")
    const heading = name.match(/^h([1-6])$/)
    if (heading && headingCapture) {
      const title = normalizeText(headingCapture.text.join(" "))
      if (title) {
        headingPath.length = headingCapture.level - 1
        headingPath[headingCapture.level - 1] = title
        headingIdentityPath.length = headingCapture.level - 1
        headingIdentityPath[headingCapture.level - 1] = `heading:${headingCapture.ordinal}`
        const reason = headingCapture.exclusion ?? semanticSectionReason(title)
        excludedHeading = reason ? { level: headingCapture.level, reason } : excludedHeading
      }
      headingCapture = null
    }
    if (name === "p" && paragraphCapture) {
      const sectionKey = paragraphCapture.sectionIdentityPath.join(" > ")
      const sectionParagraphIndex = (sectionParagraphCounts.get(sectionKey) ?? 0) + 1
      sectionParagraphCounts.set(sectionKey, sectionParagraphIndex)
      const reason = paragraphCapture.exclusion
      const text = normalizeText(paragraphCapture.text.join(" "))
      if (reason) {
        incrementExclusion(exclusions, reason)
      } else if (text.length < 20) {
        incrementExclusion(exclusions, "empty_or_fragment")
      } else {
        globalParagraphIndex += 1
        paragraphs.push({
          xmlId: paragraphCapture.xmlId,
          sectionPath: paragraphCapture.sectionPath,
          sectionIdentityPath: paragraphCapture.sectionIdentityPath,
          paragraphIndex: globalParagraphIndex,
          sectionParagraphIndex,
          pageStart: null,
          pageEnd: null,
          text,
        })
      }
      paragraphCapture = null
    }
    stack.pop()
  }
  if (stack.length > 0 || paragraphCapture || headingCapture) {
    throw new Error("dna_evidence_markup_not_well_formed")
  }
  if (paragraphs.length === 0) throw new Error("dna_evidence_no_eligible_paragraphs")
  return { paragraphs, exclusions }
}

function parseManualRanges(
  input: DnaEvidenceArtifactInput,
  artifactSha256: string,
): MarkupParseResult {
  const approval = input.manualApproval
  if (!approval?.approved
    || !approval.columnOrderVerified
    || !approval.restrictedComponentsExcluded) {
    throw new Error("dna_evidence_manual_range_not_approved")
  }
  requireStableId(approval.approvalId, "manual_approval_id")
  requireIsoTimestamp(approval.approvedAt, "manual_approved_at")
  requireSha256(approval.evidenceSha256, "manual_approval_evidence_sha256")
  if (requireSha256(approval.artifactSha256, "manual_approval_artifact_sha256") !== artifactSha256) {
    throw new Error("dna_evidence_manual_approval_artifact_mismatch")
  }
  const ranges = input.approvedRanges ?? []
  if (ranges.length === 0) throw new Error("dna_evidence_approved_range_missing")

  if (input.format === "ocr") {
    const quality = input.ocrQuality
    if (!quality?.humanRangeApproved
      || !quality.columnOrderVerified
      || quality.meanCharacterConfidence < 0.98
      || quality.meanCharacterConfidence > 1
      || quality.replacementCharacterRate < 0
      || quality.replacementCharacterRate > 0.005) {
      throw new Error("dna_evidence_invalid_ocr")
    }
    requireStableId(quality.engineId, "ocr_engine_id")
  }
  requireTrustedSubject({
    registry: input.trustRegistry,
    kind: "manual_artifact_approval",
    recordId: approval.approvalId,
    sourceId: input.sourceId,
    artifactSha256,
    subjectSha256: sha256Object({
      format: input.format,
      approval,
      approvedRanges: ranges,
      ocrQuality: input.format === "ocr" ? input.ocrQuality : null,
    }),
  })

  const paragraphs: MutableParagraph[] = []
  const exclusions = new Map<DnaParseExclusionReason, number>()
  const occupiedPages: Array<[number, number]> = []
  let globalParagraphIndex = 0
  for (const range of ranges) {
    requireStableId(range.rangeId, "range_id")
    if (!Number.isSafeInteger(range.pageStart)
      || !Number.isSafeInteger(range.pageEnd)
      || range.pageStart < 1
      || range.pageEnd < range.pageStart) {
      throw new Error("dna_evidence_invalid_page_range")
    }
    if (occupiedPages.some(([start, end]) => range.pageStart <= end && range.pageEnd >= start)) {
      throw new Error("dna_evidence_overlapping_page_ranges")
    }
    occupiedPages.push([range.pageStart, range.pageEnd])
    if (range.paragraphs.length === 0) throw new Error("dna_evidence_range_paragraphs_missing")
    const ordered = [...range.paragraphs].sort((left, right) => left.paragraphNumber - right.paragraphNumber)
    for (const [index, paragraph] of ordered.entries()) {
      if (!Number.isSafeInteger(paragraph.paragraphNumber)
        || paragraph.paragraphNumber !== index + 1
        || paragraph.pageStart < range.pageStart
        || paragraph.pageEnd > range.pageEnd
        || paragraph.pageEnd < paragraph.pageStart
        || paragraph.sectionPath.length === 0) {
        throw new Error("dna_evidence_invalid_manual_paragraph_location")
      }
      const text = normalizeText(paragraph.text)
      if (text.length < 20) {
        incrementExclusion(exclusions, "empty_or_fragment")
        continue
      }
      if (input.format === "ocr" && /�/.test(text)) throw new Error("dna_evidence_invalid_ocr")
      globalParagraphIndex += 1
      paragraphs.push({
        xmlId: null,
        sectionPath: paragraph.sectionPath.map(normalizeText),
        sectionIdentityPath: [
          `manual-range:${range.rangeId}`,
          ...paragraph.sectionPath.map((entry) => `title:${canonicalText(entry)}`),
        ],
        paragraphIndex: globalParagraphIndex,
        sectionParagraphIndex: paragraph.paragraphNumber,
        pageStart: paragraph.pageStart,
        pageEnd: paragraph.pageEnd,
        text,
      })
    }
  }
  if (paragraphs.length === 0) throw new Error("dna_evidence_no_eligible_paragraphs")
  return { paragraphs, exclusions }
}

export function selectDnaPreferredArtifact(
  artifacts: readonly DnaEvidenceArtifactInput[],
): DnaEvidenceArtifactInput {
  if (artifacts.length === 0) throw new Error("dna_evidence_artifact_missing")
  const sourceIds = new Set(artifacts.map((artifact) => artifact.sourceId))
  if (sourceIds.size !== 1) throw new Error("dna_evidence_mixed_source_artifacts")
  const artifactIds = new Set<string>()
  for (const artifact of artifacts) {
    requireStableId(artifact.sourceId, "source_id")
    const artifactId = requireStableId(artifact.artifactId, "artifact_id")
    if (!DNA_PARSER_PREFERENCE.includes(artifact.format)) {
      throw new Error("dna_evidence_invalid_artifact_format")
    }
    if (artifactIds.has(artifactId)) throw new Error("dna_evidence_duplicate_artifact_id")
    artifactIds.add(artifactId)
  }
  return [...artifacts].sort((left, right) => {
    const rank = DNA_PARSER_PREFERENCE.indexOf(left.format) - DNA_PARSER_PREFERENCE.indexOf(right.format)
    return rank || left.artifactId.localeCompare(right.artifactId)
  })[0]!
}

export function parseDnaEvidenceArtifact(input: DnaEvidenceArtifactInput): DnaParsedArtifact {
  const sourceId = requireStableId(input.sourceId, "source_id")
  const artifactId = requireStableId(input.artifactId, "artifact_id")
  if (!ISO_LANGUAGE_PATTERN.test(input.originalLanguage)) {
    throw new Error("dna_evidence_invalid_original_language")
  }
  if (!DNA_PARSER_PREFERENCE.includes(input.format)) {
    throw new Error("dna_evidence_invalid_artifact_format")
  }
  const artifactSha256 = sha256Bytes(input.bytes)
  if (input.declaredSha256 && requireSha256(input.declaredSha256, "declared_sha256") !== artifactSha256) {
    throw new Error("dna_evidence_artifact_hash_mismatch")
  }

  const parsed = input.format === "jats_xml"
    ? parseJatsMarkup(bytesToUtf8(input.bytes))
    : input.format === "epub_xml" || input.format === "structural_html"
      ? parseHtmlMarkup(bytesToUtf8(input.bytes))
      : parseManualRanges(input, artifactSha256)

  const paragraphs = parsed.paragraphs.map((paragraph) => {
    const paragraphId = `${artifactId}:p${String(paragraph.paragraphIndex).padStart(6, "0")}`
    return deepFreeze({
      paragraphId,
      sourceId,
      artifactId,
      artifactSha256,
      format: input.format,
      originalLanguage: input.originalLanguage,
      sectionPath: paragraph.sectionPath.map((entry) => normalizeText(entry)),
      sectionIdentityPath: [...paragraph.sectionIdentityPath],
      xmlId: paragraph.xmlId,
      paragraphIndex: paragraph.paragraphIndex,
      sectionParagraphIndex: paragraph.sectionParagraphIndex,
      pageStart: paragraph.pageStart,
      pageEnd: paragraph.pageEnd,
      text: paragraph.text,
      contentSha256: sha256Bytes(paragraph.text),
    } satisfies DnaParsedParagraph)
  })
  const exclusions = [...parsed.exclusions.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([reason, count]) => Object.freeze({ reason, count }))
  const parsedContentSha256 = parsedParagraphManifestSha256(paragraphs)
  const artifactBindingSha256 = sha256Object({
    schemaVersion: DNA_EVIDENCE_EXTRACTION_VERSION,
    sourceId,
    artifactId,
    artifactSha256,
    format: input.format,
    parsedContentSha256,
  })
  return deepFreeze({
    schemaVersion: DNA_EVIDENCE_EXTRACTION_VERSION,
    status: "candidate_only",
    runtimeEligible: false,
    sourceId,
    artifactId,
    artifactSha256,
    format: input.format,
    parserRank: DNA_PARSER_PREFERENCE.indexOf(input.format) + 1,
    originalLanguage: input.originalLanguage,
    paragraphs,
    exclusions,
    parsedContentSha256,
    artifactBindingSha256,
  })
}

function parsedParagraphManifestSha256(
  paragraphs: readonly DnaParsedParagraph[],
): string {
  return sha256Object(paragraphs.map((paragraph) => ({
    paragraphId: paragraph.paragraphId,
    sectionPath: paragraph.sectionPath,
    sectionIdentityPath: paragraph.sectionIdentityPath,
    xmlId: paragraph.xmlId,
    paragraphIndex: paragraph.paragraphIndex,
    sectionParagraphIndex: paragraph.sectionParagraphIndex,
    pageStart: paragraph.pageStart,
    pageEnd: paragraph.pageEnd,
    contentSha256: paragraph.contentSha256,
  })))
}

export function isDnaParsedArtifactIntegrityValid(parsed: DnaParsedArtifact): boolean {
  return parsed.schemaVersion === DNA_EVIDENCE_EXTRACTION_VERSION
    && parsed.status === "candidate_only"
    && parsed.runtimeEligible === false
    && parsed.paragraphs.every((paragraph) =>
      paragraph.sourceId === parsed.sourceId
      && paragraph.artifactId === parsed.artifactId
      && paragraph.artifactSha256 === parsed.artifactSha256
      && paragraph.format === parsed.format
      && paragraph.contentSha256 === sha256Bytes(paragraph.text))
    && parsed.parsedContentSha256 === parsedParagraphManifestSha256(parsed.paragraphs)
    && parsed.artifactBindingSha256 === sha256Object({
      schemaVersion: parsed.schemaVersion,
      sourceId: parsed.sourceId,
      artifactId: parsed.artifactId,
      artifactSha256: parsed.artifactSha256,
      format: parsed.format,
      parsedContentSha256: parsed.parsedContentSha256,
    })
}

export function isDnaParsedArtifactCurrent(
  parsed: DnaParsedArtifact,
  currentArtifactBytes: string | Uint8Array,
): boolean {
  return isDnaParsedArtifactIntegrityValid(parsed)
    && parsed.artifactSha256 === sha256Bytes(currentArtifactBytes)
}

export const DNA_PASSAGE_EVIDENCE_TYPES = Object.freeze([
  "systematic_review",
  "meta_analysis",
  "guideline",
  "consensus",
  "randomized_trial",
  "controlled_experiment",
  "observational",
  "psychometric",
  "narrative_review",
  "theory",
  "textbook",
  "not_reported",
] as const)

export type DnaPassageEvidenceType = (typeof DNA_PASSAGE_EVIDENCE_TYPES)[number]

export type DnaPassageLicenseApproval = Readonly<{
  status: "approved"
  sourceId: string
  artifactSha256: string
  component: "passage"
  licenseRecordId: string
  evidenceSha256: string
  extractionAllowed: true
  thirdPartyMaterialExcluded: true
}>

export type DnaPassageMetadataApproval = Readonly<{
  reviewId: string
  reviewedAt: string
  evidenceSha256: string
  ageScopeApproved: true
  evidenceTypeApproved: true
  claimBoundaryApproved: true
}>

export type DnaSourcePassage = Readonly<{
  schemaVersion: typeof DNA_SOURCE_PASSAGE_VERSION
  id: string
  status: "candidate_only"
  runtimeEligible: false
  sourceId: string
  artifactId: string
  originalText: string
  originalLanguage: string
  sectionPath: readonly string[]
  xmlIds: readonly string[]
  paragraphStart: number
  paragraphEnd: number
  pageStart: number | null
  pageEnd: number | null
  paragraphIds: readonly string[]
  artifactSha256: string
  artifactBindingSha256: string
  contentSha256: string
  ageScope: DnaSourceAgeScope
  evidenceType: DnaPassageEvidenceType
  claimBoundary: string
  licenseStatus: "approved"
  licenseRecordId: string
  licenseEvidenceSha256: string
  metadataReviewId: string
  metadataEvidenceSha256: string
  provenanceSha256: string
}>

function passageCore(passage: Omit<DnaSourcePassage, "provenanceSha256">) {
  return passage
}

function sameSection(
  left: readonly string[],
  right: readonly string[],
): boolean {
  return stableJson(left) === stableJson(right)
}

export function createDnaSourcePassage(input: Readonly<{
  id: string
  parsedArtifact: DnaParsedArtifact
  paragraphIds: readonly string[]
  ageScope: DnaSourceAgeScope
  evidenceType: DnaPassageEvidenceType
  claimBoundary: string
  licenseApproval: DnaPassageLicenseApproval
  metadataApproval: DnaPassageMetadataApproval
  trustRegistry: DnaEvidenceTrustRegistry
}>): DnaSourcePassage {
  const id = requireStableId(input.id, "passage_id")
  if (!isDnaParsedArtifactIntegrityValid(input.parsedArtifact)) {
    throw new Error("dna_evidence_parsed_artifact_status_invalid")
  }
  if (input.paragraphIds.length < 1 || input.paragraphIds.length > 3) {
    throw new Error("dna_evidence_passage_paragraph_count")
  }
  if (new Set(input.paragraphIds).size !== input.paragraphIds.length) {
    throw new Error("dna_evidence_duplicate_passage_paragraph")
  }
  const paragraphById = new Map(input.parsedArtifact.paragraphs.map((paragraph) => [
    paragraph.paragraphId,
    paragraph,
  ]))
  const paragraphs = input.paragraphIds.map((paragraphId) => {
    const paragraph = paragraphById.get(paragraphId)
    if (!paragraph) throw new Error("dna_evidence_passage_paragraph_missing")
    return paragraph
  })
  if (!paragraphs.every((paragraph) =>
    sameSection(paragraph.sectionIdentityPath, paragraphs[0]!.sectionIdentityPath))) {
    throw new Error("dna_evidence_passage_crosses_section")
  }
  for (let index = 1; index < paragraphs.length; index += 1) {
    if (paragraphs[index]!.sectionParagraphIndex !== paragraphs[index - 1]!.sectionParagraphIndex + 1) {
      throw new Error("dna_evidence_passage_not_adjacent")
    }
  }
  if (!DNA_SOURCE_AGE_SCOPES.includes(input.ageScope)) {
    throw new Error("dna_evidence_invalid_passage_age_scope")
  }
  if (!DNA_PASSAGE_EVIDENCE_TYPES.includes(input.evidenceType)) {
    throw new Error("dna_evidence_invalid_passage_evidence_type")
  }
  const claimBoundary = normalizeText(input.claimBoundary)
  if (claimBoundary.length < 12 || claimBoundary.length > 800) {
    throw new Error("dna_evidence_invalid_passage_claim_boundary")
  }

  const license = input.licenseApproval
  requireExactKeys(license, [
    "status",
    "sourceId",
    "artifactSha256",
    "component",
    "licenseRecordId",
    "evidenceSha256",
    "extractionAllowed",
    "thirdPartyMaterialExcluded",
  ], "dna_evidence_invalid_passage_license_shape")
  if (license.status !== "approved"
    || license.component !== "passage"
    || !license.extractionAllowed
    || !license.thirdPartyMaterialExcluded
    || license.sourceId !== input.parsedArtifact.sourceId
    || requireSha256(license.artifactSha256, "license_artifact_sha256") !== input.parsedArtifact.artifactSha256) {
    throw new Error("dna_evidence_passage_license_not_approved")
  }
  const licenseRecordId = requireStableId(license.licenseRecordId, "license_record_id")
  const licenseEvidenceSha256 = requireSha256(license.evidenceSha256, "license_evidence_sha256")
  requireTrustedSubject({
    registry: input.trustRegistry,
    kind: "passage_license_approval",
    recordId: licenseRecordId,
    sourceId: input.parsedArtifact.sourceId,
    artifactSha256: input.parsedArtifact.artifactSha256,
    subjectSha256: sha256Object(license),
  })

  const review = input.metadataApproval
  requireExactKeys(review, [
    "reviewId",
    "reviewedAt",
    "evidenceSha256",
    "ageScopeApproved",
    "evidenceTypeApproved",
    "claimBoundaryApproved",
  ], "dna_evidence_invalid_passage_review_shape")
  if (!review.ageScopeApproved || !review.evidenceTypeApproved || !review.claimBoundaryApproved) {
    throw new Error("dna_evidence_passage_metadata_not_approved")
  }
  const metadataReviewId = requireStableId(review.reviewId, "metadata_review_id")
  requireIsoTimestamp(review.reviewedAt, "metadata_reviewed_at")
  const metadataEvidenceSha256 = requireSha256(review.evidenceSha256, "metadata_evidence_sha256")
  requireTrustedSubject({
    registry: input.trustRegistry,
    kind: "passage_metadata_approval",
    recordId: metadataReviewId,
    sourceId: input.parsedArtifact.sourceId,
    artifactSha256: input.parsedArtifact.artifactSha256,
    subjectSha256: sha256Object(review),
  })

  const originalText = paragraphs.map((paragraph) => paragraph.text).join("\n\n")
  const pageStarts = paragraphs.map((paragraph) => paragraph.pageStart).filter((value): value is number => value !== null)
  const pageEnds = paragraphs.map((paragraph) => paragraph.pageEnd).filter((value): value is number => value !== null)
  if (["approved_pdf_range", "ocr"].includes(input.parsedArtifact.format)
    && (pageStarts.length !== paragraphs.length || pageEnds.length !== paragraphs.length)) {
    throw new Error("dna_evidence_passage_page_location_missing")
  }
  const core = passageCore({
    schemaVersion: DNA_SOURCE_PASSAGE_VERSION,
    id,
    status: "candidate_only",
    runtimeEligible: false,
    sourceId: input.parsedArtifact.sourceId,
    artifactId: input.parsedArtifact.artifactId,
    originalText,
    originalLanguage: input.parsedArtifact.originalLanguage,
    sectionPath: [...paragraphs[0]!.sectionPath],
    xmlIds: paragraphs.map((paragraph) => paragraph.xmlId).filter((value): value is string => Boolean(value)),
    paragraphStart: paragraphs[0]!.sectionParagraphIndex,
    paragraphEnd: paragraphs[paragraphs.length - 1]!.sectionParagraphIndex,
    pageStart: pageStarts.length > 0 ? Math.min(...pageStarts) : null,
    pageEnd: pageEnds.length > 0 ? Math.max(...pageEnds) : null,
    paragraphIds: paragraphs.map((paragraph) => paragraph.paragraphId),
    artifactSha256: input.parsedArtifact.artifactSha256,
    artifactBindingSha256: input.parsedArtifact.artifactBindingSha256,
    contentSha256: sha256Bytes(originalText),
    ageScope: input.ageScope,
    evidenceType: input.evidenceType,
    claimBoundary,
    licenseStatus: "approved",
    licenseRecordId,
    licenseEvidenceSha256,
    metadataReviewId,
    metadataEvidenceSha256,
  })
  return deepFreeze({ ...core, provenanceSha256: sha256Object(core) })
}

export function isDnaSourcePassageCurrent(
  passage: DnaSourcePassage,
  parsedArtifact: DnaParsedArtifact,
): boolean {
  if (!isDnaParsedArtifactIntegrityValid(parsedArtifact)
    || passage.sourceId !== parsedArtifact.sourceId
    || passage.artifactId !== parsedArtifact.artifactId
    || passage.artifactSha256 !== parsedArtifact.artifactSha256
    || passage.artifactBindingSha256 !== parsedArtifact.artifactBindingSha256) return false
  const paragraphs = passage.paragraphIds.map((paragraphId) =>
    parsedArtifact.paragraphs.find((paragraph) => paragraph.paragraphId === paragraphId))
  if (paragraphs.some((paragraph) => !paragraph)) return false
  const text = paragraphs.map((paragraph) => paragraph!.text).join("\n\n")
  const { provenanceSha256, ...core } = passage
  return sha256Bytes(text) === passage.contentSha256
    && sha256Object(core) === provenanceSha256
}

export function validateDnaPassageSet(passages: readonly DnaSourcePassage[]): Readonly<{
  ok: boolean
  overlappingPassageIds: readonly string[]
}> {
  const owners = new Map<string, string>()
  const overlapping = new Set<string>()
  for (const passage of passages) {
    for (const paragraphId of passage.paragraphIds) {
      const key = `${passage.sourceId}\u0000${passage.artifactSha256}\u0000${paragraphId}`
      const owner = owners.get(key)
      if (owner && owner !== passage.id) {
        overlapping.add(owner)
        overlapping.add(passage.id)
      } else {
        owners.set(key, passage.id)
      }
    }
  }
  return deepFreeze({
    ok: overlapping.size === 0,
    overlappingPassageIds: [...overlapping].sort(),
  })
}

export const DNA_ATOMIC_CLAIM_TYPES = Object.freeze([
  "definition",
  "association",
  "group_difference",
  "measurement_property",
  "intervention_effect",
  "mechanism_description",
  "developmental_pattern",
  "interpretation_boundary",
] as const)
export type DnaAtomicClaimType = (typeof DNA_ATOMIC_CLAIM_TYPES)[number]

export const DNA_CLAIM_SETTINGS = Object.freeze([
  "laboratory",
  "clinical",
  "community",
  "school",
  "home",
  "mixed",
  "not_reported",
] as const)
export type DnaClaimSetting = (typeof DNA_CLAIM_SETTINGS)[number]

export const DNA_CLAIM_DIRECTIONS = Object.freeze([
  "positive",
  "negative",
  "higher",
  "lower",
  "mixed",
  "no_difference",
  "not_applicable",
  "not_reported",
] as const)
export type DnaClaimDirection = (typeof DNA_CLAIM_DIRECTIONS)[number]

export const DNA_CLAIM_STUDY_DESIGNS = Object.freeze([
  "systematic_review",
  "meta_analysis",
  "randomized_controlled_trial",
  "controlled_experiment",
  "cross_sectional_observational",
  "longitudinal_observational",
  "case_control",
  "psychometric_validation",
  "guideline_or_consensus",
  "narrative_review",
  "theory_paper",
  "textbook",
  "not_reported",
] as const)
export type DnaClaimStudyDesign = (typeof DNA_CLAIM_STUDY_DESIGNS)[number]

export const DNA_EVIDENCE_LEVELS = Object.freeze([
  "high",
  "moderate",
  "low",
  "very_low",
  "not_assessed",
] as const)
export type DnaClaimEvidenceLevel = (typeof DNA_EVIDENCE_LEVELS)[number]

export const DNA_CLAIM_CAUSAL_STATUSES = Object.freeze([
  "not_causal",
  "associational",
  "descriptive",
  "source_causal_claim_unverified",
] as const)
export type DnaClaimCausalStatus = (typeof DNA_CLAIM_CAUSAL_STATUSES)[number]

export type DnaEffectMagnitude = Readonly<{
  kind: "not_reported" | "standardized" | "raw" | "qualitative"
  metric: string | null
  value: number | null
  qualifier: "negligible" | "small" | "moderate" | "large" | "mixed" | "not_reported"
}>

export type DnaClaimUncertainty = Readonly<{
  level: "low" | "moderate" | "high" | "not_reported"
  text: string
}>

export type DnaClaimPassageLocatorEvidence = Readonly<{
  kind: "passage_locator"
  passageId: string
  locatorText: string
  locatorSha256: string
}>

export type DnaClaimMethodAppraisalEvidence = Readonly<{
  kind: "method_appraisal"
  appraisalId: string
  appraisalSha256: string
  assessedLevel: Exclude<DnaClaimEvidenceLevel, "not_assessed">
}>

export type DnaAtomicClaimDraft = Readonly<{
  claimId: string
  claimType: DnaAtomicClaimType
  proposition: string
  population: DnaEvidencePopulation
  ageScope: DnaSourceAgeScope
  setting: DnaClaimSetting
  measure: string | null
  comparator: string | null
  outcome: string
  direction: DnaClaimDirection
  effectMagnitude: DnaEffectMagnitude
  effectEvidence: DnaClaimPassageLocatorEvidence | null
  uncertainty: DnaClaimUncertainty
  studyDesign: DnaClaimStudyDesign
  evidenceLevel: DnaClaimEvidenceLevel
  evidenceLevelEvidence: DnaClaimMethodAppraisalEvidence | null
  passageIds: readonly string[]
  causalStatus: DnaClaimCausalStatus
  claimBoundary: string
  dnaRelationship: "none"
  conflictSetId: string | null
}>

export type DnaAtomicClaim = Readonly<{
  schemaVersion: typeof DNA_ATOMIC_CLAIM_VERSION
  status: "candidate_only" | "quarantined"
  runtimeEligible: false
  extractionLane: "A" | "B"
  extractionProtocolId: string
  extractionRunId: string
  sourceId: string
  artifactSha256: string
  claimId: string
  claimType: DnaAtomicClaimType
  proposition: string
  population: DnaEvidencePopulation
  ageScope: DnaSourceAgeScope
  setting: DnaClaimSetting
  measure: string | null
  comparator: string | null
  outcome: string
  direction: DnaClaimDirection
  effectMagnitude: DnaEffectMagnitude
  effectEvidence: DnaClaimPassageLocatorEvidence | null
  uncertainty: DnaClaimUncertainty
  studyDesign: DnaClaimStudyDesign
  evidenceLevel: DnaClaimEvidenceLevel
  evidenceLevelEvidence: DnaClaimMethodAppraisalEvidence | null
  passageIds: readonly string[]
  causalStatus: DnaClaimCausalStatus
  claimBoundary: string
  dnaRelationship: "none"
  conflictSetId: string | null
  quarantineReason: "source_causal_claim_requires_method_review" | null
  claimSha256: string
}>

const CLAIM_DRAFT_KEYS = Object.freeze([
  "claimId",
  "claimType",
  "proposition",
  "population",
  "ageScope",
  "setting",
  "measure",
  "comparator",
  "outcome",
  "direction",
  "effectMagnitude",
  "effectEvidence",
  "uncertainty",
  "studyDesign",
  "evidenceLevel",
  "evidenceLevelEvidence",
  "passageIds",
  "causalStatus",
  "claimBoundary",
  "dnaRelationship",
  "conflictSetId",
] as const)

const DNA_EVIDENCE_POPULATIONS = Object.freeze([
  "human",
  "animal",
  "in_vitro",
  "mixed_human_animal",
  "not_applicable",
  "not_reported",
] as const satisfies readonly DnaEvidencePopulation[])
const CAUSAL_LANGUAGE_PATTERN = /\b(?:causes?|caused|causing|leads? to|results? in|determines?|produces?|produced|drives?|driven|induces?|induced|improves?|improved|reduces?|reduced|enhances?|enhanced|impairs?|impaired|prevents?|prevented|is responsible for|due to|nedeni(?:dir)?|neden olur|yol açar|belirler|iyileştirir|azaltır|artırır|tetikler|bozar|önler)\b/i
const SECOND_PREDICATE_AFTER_JOINER_PATTERN = /(?:\b(?:is|are|was|were|has|have|participates?|predicts?|determines?|contributes?|increases?|decreases?|improves?|reduces?|mediates?|correlates?|shows?|affects?|drives?|induces?|enhances?|impairs?|prevents?)\b[^.;]{0,180}\b(?:and|but|while|whereas)\b\s+(?:[^\s,.;:]+\s+){0,6}(?:is|are|was|were|has|have|participates?|predicts?|determines?|contributes?|increases?|decreases?|improves?|reduces?|mediates?|correlates?|shows?|affects?|drives?|induces?|enhances?|impairs?|prevents?)\b|\b(?:rol alır|ilişkilidir|belirler|katkıda bulunur|artırır|azaltır|iyileştirir|tetikler|bozar|önler|gösterir|olabilir|sağlar|etkiler|açıklar)\b[^.;]{0,180}\b(?:ve|ancak|fakat|ama)\b\s+(?:[^\s,.;:]+\s+){0,6}(?:rol alır|ilişkilidir|belirler|katkıda bulunur|artırır|azaltır|iyileştirir|tetikler|bozar|önler|gösterir|olabilir|sağlar|etkiler|açıklar)\b)/i

function requireBoundedText(
  value: string,
  field: string,
  minimum: number,
  maximum: number,
): string {
  const normalized = normalizeText(value)
  if (normalized.length < minimum || normalized.length > maximum) {
    throw new Error(`dna_evidence_invalid_${field}`)
  }
  return normalized
}

function propositionIsVerbatimInPassages(
  proposition: string,
  passages: readonly DnaSourcePassage[],
): boolean {
  const propositionCanonical = canonicalText(proposition)
  return passages.some((passage) => canonicalText(passage.originalText).includes(propositionCanonical))
}

function createAtomicClaim(input: Readonly<{
  lane: "A" | "B"
  protocolId: string
  runId: string
  sourceId: string
  artifactSha256: string
  passageById: ReadonlyMap<string, DnaSourcePassage>
  trustRegistry: DnaEvidenceTrustRegistry
  draft: DnaAtomicClaimDraft
}>): DnaAtomicClaim {
  requireExactKeys(input.draft, CLAIM_DRAFT_KEYS, "dna_evidence_atomic_claim_shape_invalid")
  const claimId = requireStableId(input.draft.claimId, "claim_id")
  if (!DNA_ATOMIC_CLAIM_TYPES.includes(input.draft.claimType)) {
    throw new Error("dna_evidence_invalid_claim_type")
  }
  if (!DNA_EVIDENCE_POPULATIONS.includes(input.draft.population)) {
    throw new Error("dna_evidence_invalid_claim_population")
  }
  if (!DNA_SOURCE_AGE_SCOPES.includes(input.draft.ageScope)) {
    throw new Error("dna_evidence_invalid_claim_age_scope")
  }
  if (!DNA_CLAIM_SETTINGS.includes(input.draft.setting)) {
    throw new Error("dna_evidence_invalid_claim_setting")
  }
  if (!DNA_CLAIM_DIRECTIONS.includes(input.draft.direction)) {
    throw new Error("dna_evidence_invalid_claim_direction")
  }
  if (!DNA_CLAIM_STUDY_DESIGNS.includes(input.draft.studyDesign)) {
    throw new Error("dna_evidence_invalid_study_design")
  }
  if (!DNA_EVIDENCE_LEVELS.includes(input.draft.evidenceLevel)) {
    throw new Error("dna_evidence_invalid_evidence_level")
  }
  if (!DNA_CLAIM_CAUSAL_STATUSES.includes(input.draft.causalStatus)) {
    throw new Error("dna_evidence_invalid_causal_status")
  }
  if (input.draft.dnaRelationship !== "none") {
    throw new Error("dna_evidence_blind_extraction_cannot_create_dna_relationship")
  }
  if (input.draft.passageIds.length < 1 || input.draft.passageIds.length > 3
    || new Set(input.draft.passageIds).size !== input.draft.passageIds.length) {
    throw new Error("dna_evidence_invalid_claim_passage_ids")
  }
  const passages = input.draft.passageIds.map((passageId) => {
    const passage = input.passageById.get(passageId)
    if (!passage) throw new Error("dna_evidence_claim_passage_missing")
    return passage
  })
  if (!passages.every((passage) =>
    passage.sourceId === input.sourceId
    && passage.artifactSha256 === input.artifactSha256
    && passage.licenseStatus === "approved")) {
    throw new Error("dna_evidence_claim_passage_binding_invalid")
  }
  if (!passages.every((passage) => passage.ageScope === input.draft.ageScope)) {
    throw new Error("dna_evidence_claim_age_scope_not_passage_bound")
  }
  const proposition = requireBoundedText(input.draft.proposition, "claim_proposition", 12, 600)
  if (/[;\n\r]/.test(input.draft.proposition)
    || (proposition.match(/[.!?](?:\s|$)/g)?.length ?? 0) > 1
    || SECOND_PREDICATE_AFTER_JOINER_PATTERN.test(proposition)) {
    throw new Error("dna_evidence_claim_not_atomic")
  }
  if (!propositionIsVerbatimInPassages(proposition, passages)) {
    throw new Error("dna_evidence_claim_not_verbatim_in_passage")
  }
  const hasCausalLanguage = CAUSAL_LANGUAGE_PATTERN.test(proposition)
  if (hasCausalLanguage && input.draft.causalStatus !== "source_causal_claim_unverified") {
    throw new Error("dna_evidence_unsupported_causal_language")
  }
  if (!hasCausalLanguage && input.draft.causalStatus === "source_causal_claim_unverified") {
    throw new Error("dna_evidence_causal_status_not_text_bound")
  }

  const claimBoundary = requireBoundedText(input.draft.claimBoundary, "claim_boundary", 12, 800)
  if (!passages.every((passage) => passage.claimBoundary === claimBoundary)) {
    throw new Error("dna_evidence_claim_boundary_not_passage_bound")
  }
  const outcome = requireBoundedText(input.draft.outcome, "claim_outcome", 2, 240)
  const measure = input.draft.measure === null
    ? null
    : requireBoundedText(input.draft.measure, "claim_measure", 2, 240)
  const comparator = input.draft.comparator === null
    ? null
    : requireBoundedText(input.draft.comparator, "claim_comparator", 2, 240)
  requireExactKeys(input.draft.effectMagnitude, ["kind", "metric", "value", "qualifier"], "dna_evidence_effect_magnitude_shape_invalid")
  if (![
    "not_reported",
    "standardized",
    "raw",
    "qualitative",
  ].includes(input.draft.effectMagnitude.kind)
    || !["negligible", "small", "moderate", "large", "mixed", "not_reported"]
      .includes(input.draft.effectMagnitude.qualifier)
    || (input.draft.effectMagnitude.value !== null
      && !Number.isFinite(input.draft.effectMagnitude.value))) {
    throw new Error("dna_evidence_invalid_effect_magnitude")
  }
  const effectMetric = input.draft.effectMagnitude.metric === null
    ? null
    : requireBoundedText(input.draft.effectMagnitude.metric, "effect_metric", 1, 80)
  if (input.draft.effectMagnitude.kind === "not_reported"
    && (input.draft.effectMagnitude.metric !== null
      || input.draft.effectMagnitude.value !== null
      || input.draft.effectMagnitude.qualifier !== "not_reported")) {
    throw new Error("dna_evidence_effect_magnitude_inconsistent")
  }
  if (["standardized", "raw"].includes(input.draft.effectMagnitude.kind)
    && (effectMetric === null || input.draft.effectMagnitude.value === null)) {
    throw new Error("dna_evidence_effect_magnitude_inconsistent")
  }
  if (input.draft.effectMagnitude.kind === "qualitative"
    && (effectMetric !== null || input.draft.effectMagnitude.value !== null)) {
    throw new Error("dna_evidence_effect_magnitude_inconsistent")
  }
  let effectEvidence: DnaClaimPassageLocatorEvidence | null = null
  if (input.draft.effectMagnitude.kind === "not_reported") {
    if (input.draft.effectEvidence !== null) {
      throw new Error("dna_evidence_unexpected_effect_evidence")
    }
  } else {
    const evidence = input.draft.effectEvidence
    if (!evidence) throw new Error("dna_evidence_effect_requires_passage_locator")
    requireExactKeys(evidence, [
      "kind",
      "passageId",
      "locatorText",
      "locatorSha256",
    ], "dna_evidence_effect_locator_shape_invalid")
    const passage = input.passageById.get(evidence.passageId)
    const locatorText = requireBoundedText(evidence.locatorText, "effect_locator_text", 2, 500)
    if (evidence.kind !== "passage_locator"
      || !passage
      || !canonicalText(passage.originalText).includes(canonicalText(locatorText))
      || requireSha256(evidence.locatorSha256, "effect_locator_sha256") !== sha256Bytes(locatorText)
      || (effectMetric !== null && !canonicalText(locatorText).includes(canonicalText(effectMetric)))
      || (input.draft.effectMagnitude.value !== null
        && !canonicalText(locatorText).includes(String(input.draft.effectMagnitude.value)))
      || (input.draft.effectMagnitude.qualifier !== "not_reported"
        && !canonicalText(locatorText).includes(input.draft.effectMagnitude.qualifier))) {
      throw new Error("dna_evidence_effect_not_passage_bound")
    }
    effectEvidence = {
      kind: "passage_locator",
      passageId: passage.id,
      locatorText,
      locatorSha256: sha256Bytes(locatorText),
    }
  }
  requireExactKeys(input.draft.uncertainty, ["level", "text"], "dna_evidence_uncertainty_shape_invalid")
  if (!["low", "moderate", "high", "not_reported"].includes(input.draft.uncertainty.level)) {
    throw new Error("dna_evidence_invalid_uncertainty_level")
  }
  const uncertainty = {
    level: input.draft.uncertainty.level,
    text: requireBoundedText(input.draft.uncertainty.text, "uncertainty_text", 8, 500),
  }
  let evidenceLevelEvidence: DnaClaimMethodAppraisalEvidence | null = null
  if (input.draft.evidenceLevel === "not_assessed") {
    if (input.draft.evidenceLevelEvidence !== null) {
      throw new Error("dna_evidence_unexpected_level_evidence")
    }
  } else {
    const evidence = input.draft.evidenceLevelEvidence
    if (!evidence) throw new Error("dna_evidence_level_requires_method_appraisal")
    requireExactKeys(evidence, [
      "kind",
      "appraisalId",
      "appraisalSha256",
      "assessedLevel",
    ], "dna_evidence_level_appraisal_shape_invalid")
    if (evidence.kind !== "method_appraisal"
      || evidence.assessedLevel !== input.draft.evidenceLevel) {
      throw new Error("dna_evidence_level_requires_method_appraisal")
    }
    const appraisalId = requireStableId(evidence.appraisalId, "method_appraisal_id")
    const appraisalSha256 = requireSha256(evidence.appraisalSha256, "method_appraisal_sha256")
    requireTrustedSubject({
      registry: input.trustRegistry,
      kind: "method_appraisal",
      recordId: appraisalId,
      sourceId: input.sourceId,
      artifactSha256: input.artifactSha256,
      subjectSha256: sha256Object({
        kind: "method_appraisal",
        appraisalId,
        appraisalSha256,
        assessedLevel: evidence.assessedLevel,
      }),
    })
    evidenceLevelEvidence = {
      kind: "method_appraisal",
      appraisalId,
      appraisalSha256,
      assessedLevel: evidence.assessedLevel,
    }
  }
  const conflictSetId = input.draft.conflictSetId === null
    ? null
    : requireStableId(input.draft.conflictSetId, "conflict_set_id")
  const status = hasCausalLanguage ? "quarantined" as const : "candidate_only" as const
  const core = {
    schemaVersion: DNA_ATOMIC_CLAIM_VERSION,
    status,
    runtimeEligible: false as const,
    extractionLane: input.lane,
    extractionProtocolId: input.protocolId,
    extractionRunId: input.runId,
    sourceId: input.sourceId,
    artifactSha256: input.artifactSha256,
    claimId,
    claimType: input.draft.claimType,
    proposition,
    population: input.draft.population,
    ageScope: input.draft.ageScope,
    setting: input.draft.setting,
    measure,
    comparator,
    outcome,
    direction: input.draft.direction,
    effectMagnitude: { ...input.draft.effectMagnitude, metric: effectMetric },
    effectEvidence,
    uncertainty,
    studyDesign: input.draft.studyDesign,
    evidenceLevel: input.draft.evidenceLevel,
    evidenceLevelEvidence,
    passageIds: [...input.draft.passageIds],
    causalStatus: input.draft.causalStatus,
    claimBoundary,
    dnaRelationship: "none" as const,
    conflictSetId,
    quarantineReason: hasCausalLanguage
      ? "source_causal_claim_requires_method_review" as const
      : null,
  }
  return deepFreeze({ ...core, claimSha256: sha256Object(core) })
}

export const DNA_BLIND_EXTRACTION_PROTOCOLS = deepFreeze({
  A: {
    protocolId: "dna-blind-extraction-a@1",
    lane: "A",
    blindTo: "B",
    mayCreateDnaRelationship: false,
    visibleInputs: ["source_artifact", "eligible_passages", "source_governance_metadata"],
    forbiddenInputs: ["blind_run_b", "dna_product_book", "dna_claim_links", "reconciliation_output"],
  },
  B: {
    protocolId: "dna-blind-extraction-b@1",
    lane: "B",
    blindTo: "A",
    mayCreateDnaRelationship: false,
    visibleInputs: ["source_artifact", "eligible_passages", "source_governance_metadata"],
    forbiddenInputs: ["blind_run_a", "dna_product_book", "dna_claim_links", "reconciliation_output"],
  },
} as const)

export type DnaBlindExtractionLane = keyof typeof DNA_BLIND_EXTRACTION_PROTOCOLS

export type DnaBlindContextCommitment = Readonly<{
  contextId: string
  instructionSha256: string
  governanceMetadataSha256: string
  sourceArtifactSha256: string
  passageManifestSha256: string
  peerOutputExcluded: true
}>

export type DnaBlindClaimRationale = Readonly<{
  claimId: string
  passageIds: readonly string[]
  rationale: string
  uncertaintyEvidence: string
  rationaleSha256: string
}>

export type DnaBlindExtractionRun = Readonly<{
  schemaVersion: typeof DNA_BLIND_EXTRACTION_VERSION
  status: "candidate_only"
  runtimeEligible: false
  lane: DnaBlindExtractionLane
  protocolId: string
  runId: string
  createdAt: string
  sourceId: string
  artifactSha256: string
  passageIds: readonly string[]
  claims: readonly DnaAtomicClaim[]
  rationales: readonly DnaBlindClaimRationale[]
  blindTo: "A" | "B"
  dnaLinkingAllowed: false
  instructionSha256: string
  governanceMetadataSha256: string
  contextCommitmentSha256: string
  blindContextSha256: string
  runSha256: string
}>

const BLIND_RUN_INPUT_KEYS = Object.freeze([
  "lane",
  "protocolId",
  "runId",
  "createdAt",
  "sourceId",
  "artifactSha256",
  "parsedArtifact",
  "passages",
  "trustRegistry",
  "contextCommitment",
  "claimDrafts",
  "rationales",
] as const)

export function createDnaBlindExtractionRun(input: Readonly<{
  lane: DnaBlindExtractionLane
  protocolId: string
  runId: string
  createdAt: string
  sourceId: string
  artifactSha256: string
  parsedArtifact: DnaParsedArtifact
  passages: readonly DnaSourcePassage[]
  trustRegistry: DnaEvidenceTrustRegistry
  contextCommitment: DnaBlindContextCommitment
  claimDrafts: readonly DnaAtomicClaimDraft[]
  rationales: readonly DnaBlindClaimRationale[]
}>): DnaBlindExtractionRun {
  requireExactKeys(input, BLIND_RUN_INPUT_KEYS, "dna_evidence_blind_input_leak_or_shape_invalid")
  const protocol = DNA_BLIND_EXTRACTION_PROTOCOLS[input.lane]
  if (!protocol || input.protocolId !== protocol.protocolId) {
    throw new Error("dna_evidence_blind_protocol_mismatch")
  }
  const runId = requireStableId(input.runId, "blind_run_id")
  if (runId === protocol.protocolId) throw new Error("dna_evidence_blind_run_id_not_distinct")
  const createdAt = requireIsoTimestamp(input.createdAt, "blind_run_created_at")
  const sourceId = requireStableId(input.sourceId, "blind_source_id")
  const artifactSha256 = requireSha256(input.artifactSha256, "blind_artifact_sha256")
  if (input.passages.length === 0 || input.claimDrafts.length === 0) {
    throw new Error("dna_evidence_blind_run_empty")
  }
  if (!isDnaParsedArtifactIntegrityValid(input.parsedArtifact)
    || input.parsedArtifact.sourceId !== sourceId
    || input.parsedArtifact.artifactSha256 !== artifactSha256) {
    throw new Error("dna_evidence_blind_parsed_artifact_invalid")
  }
  for (const passage of input.passages) {
    if (passage.sourceId !== sourceId
      || passage.artifactSha256 !== artifactSha256
      || passage.status !== "candidate_only"
      || passage.runtimeEligible !== false
      || passage.licenseStatus !== "approved"
      || !isDnaSourcePassageCurrent(passage, input.parsedArtifact)) {
      throw new Error("dna_evidence_blind_passage_binding_invalid")
    }
    requireTrustedSubject({
      registry: input.trustRegistry,
      kind: "passage",
      recordId: passage.id,
      sourceId,
      artifactSha256,
      subjectSha256: passage.provenanceSha256,
    })
  }
  if (!validateDnaPassageSet(input.passages).ok) {
    throw new Error("dna_evidence_blind_passage_overlap")
  }
  const passageById = new Map(input.passages.map((passage) => [passage.id, passage]))
  if (passageById.size !== input.passages.length) throw new Error("dna_evidence_duplicate_passage_id")
  const claims = input.claimDrafts.map((draft) => createAtomicClaim({
    lane: input.lane,
    protocolId: protocol.protocolId,
    runId,
    sourceId,
    artifactSha256,
    passageById,
    trustRegistry: input.trustRegistry,
    draft,
  }))
  if (new Set(claims.map((claim) => claim.claimId)).size !== claims.length) {
    throw new Error("dna_evidence_duplicate_claim_id")
  }
  const passageIds = [...passageById.keys()].sort()
  const passageManifestSha256 = sha256Object(input.passages
    .map((passage) => ({ id: passage.id, provenanceSha256: passage.provenanceSha256 }))
    .sort((left, right) => left.id.localeCompare(right.id)))
  const context = input.contextCommitment
  requireExactKeys(context, [
    "contextId",
    "instructionSha256",
    "governanceMetadataSha256",
    "sourceArtifactSha256",
    "passageManifestSha256",
    "peerOutputExcluded",
  ], "dna_evidence_blind_context_shape_invalid")
  const contextId = requireStableId(context.contextId, "blind_context_id")
  const instructionSha256 = requireSha256(context.instructionSha256, "blind_instruction_sha256")
  const governanceMetadataSha256 = requireSha256(
    context.governanceMetadataSha256,
    "blind_governance_metadata_sha256",
  )
  if (context.sourceArtifactSha256 !== artifactSha256
    || context.passageManifestSha256 !== passageManifestSha256
    || !context.peerOutputExcluded) {
    throw new Error("dna_evidence_blind_context_commitment_invalid")
  }
  const contextCommitmentCore = {
    contextId,
    instructionSha256,
    governanceMetadataSha256,
    sourceArtifactSha256: artifactSha256,
    passageManifestSha256,
    peerOutputExcluded: true as const,
  }
  const contextCommitmentSha256 = sha256Object(contextCommitmentCore)
  const rationaleByClaimId = new Map(input.rationales.map((rationale) => [rationale.claimId, rationale]))
  if (rationaleByClaimId.size !== input.rationales.length
    || rationaleByClaimId.size !== claims.length) {
    throw new Error("dna_evidence_blind_rationale_count_invalid")
  }
  const rationales = claims.map((claim) => {
    const rationale = rationaleByClaimId.get(claim.claimId)
    if (!rationale) throw new Error("dna_evidence_blind_rationale_missing")
    requireExactKeys(rationale, [
      "claimId",
      "passageIds",
      "rationale",
      "uncertaintyEvidence",
      "rationaleSha256",
    ], "dna_evidence_blind_rationale_shape_invalid")
    const rationaleText = requireBoundedText(rationale.rationale, "blind_rationale", 12, 1200)
    const uncertaintyEvidence = requireBoundedText(
      rationale.uncertaintyEvidence,
      "blind_uncertainty_evidence",
      8,
      800,
    )
    if (stableJson([...rationale.passageIds].sort()) !== stableJson([...claim.passageIds].sort())) {
      throw new Error("dna_evidence_blind_rationale_passage_mismatch")
    }
    const core = {
      claimId: claim.claimId,
      passageIds: [...claim.passageIds].sort(),
      rationale: rationaleText,
      uncertaintyEvidence,
    }
    if (requireSha256(rationale.rationaleSha256, "blind_rationale_sha256") !== sha256Object(core)) {
      throw new Error("dna_evidence_blind_rationale_commitment_invalid")
    }
    return deepFreeze({ ...core, rationaleSha256: sha256Object(core) })
  })
  const blindContextSha256 = sha256Object({
    protocolId: protocol.protocolId,
    sourceId,
    artifactSha256,
    passageIds,
    contextCommitmentSha256,
  })
  const core = {
    schemaVersion: DNA_BLIND_EXTRACTION_VERSION,
    status: "candidate_only" as const,
    runtimeEligible: false as const,
    lane: input.lane,
    protocolId: protocol.protocolId,
    runId,
    createdAt,
    sourceId,
    artifactSha256,
    passageIds,
    claims,
    rationales,
    blindTo: protocol.blindTo,
    dnaLinkingAllowed: false as const,
    instructionSha256,
    governanceMetadataSha256,
    contextCommitmentSha256,
    blindContextSha256,
  }
  return deepFreeze({ ...core, runSha256: sha256Object(core) })
}

export const DNA_RECONCILIATION_COMPARISON_FIELDS = Object.freeze([
  "passage",
  "proposition",
  "age_scope",
  "causality",
  "evidence_level",
  "claim_boundary",
] as const)
export type DnaReconciliationComparisonField =
  (typeof DNA_RECONCILIATION_COMPARISON_FIELDS)[number]

export type DnaClaimReconciliation = Readonly<{
  schemaVersion: typeof DNA_CLAIM_RECONCILIATION_VERSION
  reconciliationId: string
  protocolId: "dna-claim-reconciliation@1"
  status: "exact_consensus_candidate" | "contested" | "quarantined"
  consensusEligible: boolean
  runtimeEligible: false
  registryStatus: "not_registered"
  sourceId: string
  artifactSha256: string
  runAId: string
  runBId: string
  runASha256: string
  runBSha256: string
  claimAId: string
  claimBId: string
  claimASha256: string
  claimBSha256: string
  comparisons: Readonly<Record<DnaReconciliationComparisonField, boolean>>
  disagreements: readonly DnaReconciliationComparisonField[]
  majorityVoteUsed: false
  rereviewRequired: boolean
  reconciliationSha256: string
}>

function blindRunCore(run: DnaBlindExtractionRun) {
  const { runSha256: _runSha256, ...core } = run
  return core
}

function blindRunIntegrityValid(run: DnaBlindExtractionRun): boolean {
  return run.schemaVersion === DNA_BLIND_EXTRACTION_VERSION
    && run.status === "candidate_only"
    && run.runtimeEligible === false
    && run.dnaLinkingAllowed === false
    && run.runSha256 === sha256Object(blindRunCore(run))
    && run.claims.every((claim) => {
      const { claimSha256, ...core } = claim
      return claimSha256 === sha256Object(core)
        && claim.extractionLane === run.lane
        && claim.extractionProtocolId === run.protocolId
        && claim.extractionRunId === run.runId
        && claim.sourceId === run.sourceId
        && claim.artifactSha256 === run.artifactSha256
        && claim.runtimeEligible === false
        && claim.dnaRelationship === "none"
    })
    && run.rationales.length === run.claims.length
    && run.rationales.every((rationale) => {
      const { rationaleSha256, ...core } = rationale
      return rationaleSha256 === sha256Object(core)
        && run.claims.some((claim) => claim.claimId === rationale.claimId)
    })
}

export function reconcileDnaBlindClaims(input: Readonly<{
  reconciliationId: string
  runA: DnaBlindExtractionRun
  claimAId: string
  runB: DnaBlindExtractionRun
  claimBId: string
}>): DnaClaimReconciliation {
  requireExactKeys(input, [
    "reconciliationId",
    "runA",
    "claimAId",
    "runB",
    "claimBId",
  ], "dna_evidence_reconciliation_shape_invalid")
  const reconciliationId = requireStableId(input.reconciliationId, "reconciliation_id")
  if (input.runA.lane !== "A"
    || input.runB.lane !== "B"
    || input.runA.protocolId !== DNA_BLIND_EXTRACTION_PROTOCOLS.A.protocolId
    || input.runB.protocolId !== DNA_BLIND_EXTRACTION_PROTOCOLS.B.protocolId
    || input.runA.runId === input.runB.runId
    || input.runA.contextCommitmentSha256 === input.runB.contextCommitmentSha256
    || input.runA.instructionSha256 === input.runB.instructionSha256
    || !blindRunIntegrityValid(input.runA)
    || !blindRunIntegrityValid(input.runB)) {
    throw new Error("dna_evidence_blind_independence_or_integrity_invalid")
  }
  const claimA = input.runA.claims.find((claim) => claim.claimId === input.claimAId)
  const claimB = input.runB.claims.find((claim) => claim.claimId === input.claimBId)
  if (!claimA || !claimB) throw new Error("dna_evidence_reconciliation_claim_missing")

  const sourceBindingValid = input.runA.sourceId === input.runB.sourceId
    && input.runA.artifactSha256 === input.runB.artifactSha256
    && claimA.sourceId === claimB.sourceId
    && claimA.artifactSha256 === claimB.artifactSha256
    && claimA.dnaRelationship === "none"
    && claimB.dnaRelationship === "none"
  const atomicStructureConsistent = stableJson({
    claimType: claimA.claimType,
    population: claimA.population,
    setting: claimA.setting,
    measure: claimA.measure,
    comparator: claimA.comparator,
    outcome: claimA.outcome,
    direction: claimA.direction,
    effectMagnitude: claimA.effectMagnitude,
    effectEvidence: claimA.effectEvidence,
    uncertainty: claimA.uncertainty,
    studyDesign: claimA.studyDesign,
    conflictSetId: claimA.conflictSetId,
  }) === stableJson({
    claimType: claimB.claimType,
    population: claimB.population,
    setting: claimB.setting,
    measure: claimB.measure,
    comparator: claimB.comparator,
    outcome: claimB.outcome,
    direction: claimB.direction,
    effectMagnitude: claimB.effectMagnitude,
    effectEvidence: claimB.effectEvidence,
    uncertainty: claimB.uncertainty,
    studyDesign: claimB.studyDesign,
    conflictSetId: claimB.conflictSetId,
  })
  const comparisons: Record<DnaReconciliationComparisonField, boolean> = {
    passage: stableJson([...claimA.passageIds].sort()) === stableJson([...claimB.passageIds].sort()),
    proposition: canonicalText(claimA.proposition) === canonicalText(claimB.proposition),
    age_scope: claimA.ageScope === claimB.ageScope,
    causality: claimA.causalStatus === claimB.causalStatus,
    evidence_level: claimA.evidenceLevel === claimB.evidenceLevel,
    claim_boundary: canonicalText(claimA.claimBoundary) === canonicalText(claimB.claimBoundary),
  }
  const disagreements = DNA_RECONCILIATION_COMPARISON_FIELDS.filter((field) => !comparisons[field])
  const quarantined = !sourceBindingValid
    || !atomicStructureConsistent
    || claimA.status === "quarantined"
    || claimB.status === "quarantined"
  const exactConsensus = !quarantined && disagreements.length === 0
  const status = quarantined
    ? "quarantined" as const
    : exactConsensus
      ? "exact_consensus_candidate" as const
      : "contested" as const
  const core = {
    schemaVersion: DNA_CLAIM_RECONCILIATION_VERSION,
    reconciliationId,
    protocolId: "dna-claim-reconciliation@1" as const,
    status,
    consensusEligible: exactConsensus,
    runtimeEligible: false as const,
    registryStatus: "not_registered" as const,
    sourceId: input.runA.sourceId,
    artifactSha256: input.runA.artifactSha256,
    runAId: input.runA.runId,
    runBId: input.runB.runId,
    runASha256: input.runA.runSha256,
    runBSha256: input.runB.runSha256,
    claimAId: claimA.claimId,
    claimBId: claimB.claimId,
    claimASha256: claimA.claimSha256,
    claimBSha256: claimB.claimSha256,
    comparisons: { ...comparisons },
    disagreements,
    majorityVoteUsed: false as const,
    rereviewRequired: !exactConsensus,
  }
  return deepFreeze({ ...core, reconciliationSha256: sha256Object(core) })
}

export type DnaClaimRereviewResolution = Readonly<{
  protocolId: "dna-claim-rereview@1"
  reviewId: string
  reviewedAt: string
  sourceId: string
  artifactSha256: string
  reconciliationSha256: string
  decision: "consensus" | "contested" | "quarantined"
  rereadPassageIds: readonly string[]
  resolved: Readonly<{
    passageIds: readonly string[]
    proposition: string
    ageScope: DnaSourceAgeScope
    causalStatus: DnaClaimCausalStatus
    evidenceLevel: DnaClaimEvidenceLevel
    evidenceLevelEvidence: DnaClaimMethodAppraisalEvidence | null
    claimBoundary: string
  }> | null
  evidenceSha256: string
  rationaleCode: "source_reread_exact" | "boundary_unresolved" | "support_not_found"
}>

export type DnaRereviewedClaimReconciliation = Readonly<{
  schemaVersion: typeof DNA_CLAIM_RECONCILIATION_VERSION
  rereviewProtocolId: "dna-claim-rereview@1"
  reviewId: string
  previousReconciliationSha256: string
  status: "rereview_consensus_candidate" | "contested" | "quarantined"
  consensusEligible: boolean
  runtimeEligible: false
  registryStatus: "not_registered"
  majorityVoteUsed: false
  sourceId: string
  artifactSha256: string
  resolved: DnaClaimRereviewResolution["resolved"]
  evidenceSha256: string
  rationaleCode: DnaClaimRereviewResolution["rationaleCode"]
  rereviewSha256: string
}>

export function applyDnaClaimRereview(input: Readonly<{
  reconciliation: DnaClaimReconciliation
  resolution: DnaClaimRereviewResolution
  passages: readonly DnaSourcePassage[]
  parsedArtifact: DnaParsedArtifact
  trustRegistry: DnaEvidenceTrustRegistry
}>): DnaRereviewedClaimReconciliation {
  requireExactKeys(input, [
    "reconciliation",
    "resolution",
    "passages",
    "parsedArtifact",
    "trustRegistry",
  ], "dna_evidence_rereview_shape_invalid")
  if (input.reconciliation.status !== "contested"
    || input.reconciliation.reconciliationSha256 !== sha256Object((({
      reconciliationSha256: _hash,
      ...core
    }) => core)(input.reconciliation))) {
    throw new Error("dna_evidence_rereview_requires_valid_contested_record")
  }
  const resolution = input.resolution
  requireExactKeys(resolution, [
    "protocolId",
    "reviewId",
    "reviewedAt",
    "sourceId",
    "artifactSha256",
    "reconciliationSha256",
    "decision",
    "rereadPassageIds",
    "resolved",
    "evidenceSha256",
    "rationaleCode",
  ], "dna_evidence_rereview_resolution_shape_invalid")
  if (resolution.protocolId !== "dna-claim-rereview@1"
    || resolution.sourceId !== input.reconciliation.sourceId
    || resolution.artifactSha256 !== input.reconciliation.artifactSha256
    || resolution.reconciliationSha256 !== input.reconciliation.reconciliationSha256) {
    throw new Error("dna_evidence_rereview_provenance_invalid")
  }
  const reviewId = requireStableId(resolution.reviewId, "rereview_id")
  requireIsoTimestamp(resolution.reviewedAt, "rereviewed_at")
  const evidenceSha256 = requireSha256(resolution.evidenceSha256, "rereview_evidence_sha256")
  if (resolution.rereadPassageIds.length === 0
    || new Set(resolution.rereadPassageIds).size !== resolution.rereadPassageIds.length) {
    throw new Error("dna_evidence_rereview_passages_missing")
  }
  const passageById = new Map(input.passages.map((passage) => [passage.id, passage]))
  if (!isDnaParsedArtifactIntegrityValid(input.parsedArtifact)
    || input.parsedArtifact.sourceId !== resolution.sourceId
    || input.parsedArtifact.artifactSha256 !== resolution.artifactSha256) {
    throw new Error("dna_evidence_rereview_parsed_artifact_invalid")
  }
  const rereadPassages = resolution.rereadPassageIds.map((passageId) => {
    const passage = passageById.get(passageId)
    if (!passage
      || passage.sourceId !== resolution.sourceId
      || passage.artifactSha256 !== resolution.artifactSha256
      || !isDnaSourcePassageCurrent(passage, input.parsedArtifact)) {
      throw new Error("dna_evidence_rereview_passage_binding_invalid")
    }
    requireTrustedSubject({
      registry: input.trustRegistry,
      kind: "passage",
      recordId: passage.id,
      sourceId: resolution.sourceId,
      artifactSha256: resolution.artifactSha256,
      subjectSha256: passage.provenanceSha256,
    })
    return passage
  })

  const resolutionEvidenceCore = {
    protocolId: resolution.protocolId,
    reviewId: resolution.reviewId,
    reviewedAt: resolution.reviewedAt,
    sourceId: resolution.sourceId,
    artifactSha256: resolution.artifactSha256,
    reconciliationSha256: resolution.reconciliationSha256,
    decision: resolution.decision,
    rereadPassageIds: [...resolution.rereadPassageIds],
    resolved: resolution.resolved,
    rationaleCode: resolution.rationaleCode,
  }
  if (evidenceSha256 !== sha256Object(resolutionEvidenceCore)) {
    throw new Error("dna_evidence_rereview_evidence_commitment_invalid")
  }

  if (resolution.decision === "consensus") {
    if (!resolution.resolved || resolution.rationaleCode !== "source_reread_exact") {
      throw new Error("dna_evidence_rereview_consensus_resolution_missing")
    }
    requireExactKeys(resolution.resolved, [
      "passageIds",
      "proposition",
      "ageScope",
      "causalStatus",
      "evidenceLevel",
      "evidenceLevelEvidence",
      "claimBoundary",
    ], "dna_evidence_rereview_resolved_shape_invalid")
    const resolvedProposition = normalizeText(resolution.resolved.proposition)
    if (stableJson([...resolution.resolved.passageIds].sort())
      !== stableJson([...resolution.rereadPassageIds].sort())
      || !propositionIsVerbatimInPassages(resolvedProposition, rereadPassages)
      || /[;\n\r]/.test(resolvedProposition)
      || (resolvedProposition.match(/[.!?](?:\s|$)/g)?.length ?? 0) > 1
      || SECOND_PREDICATE_AFTER_JOINER_PATTERN.test(resolvedProposition)
      || CAUSAL_LANGUAGE_PATTERN.test(resolvedProposition)
      || !rereadPassages.every((passage) =>
        passage.ageScope === resolution.resolved!.ageScope
        && passage.claimBoundary === normalizeText(resolution.resolved!.claimBoundary))
      || !DNA_SOURCE_AGE_SCOPES.includes(resolution.resolved.ageScope)
      || !DNA_CLAIM_CAUSAL_STATUSES.includes(resolution.resolved.causalStatus)
      || resolution.resolved.causalStatus === "source_causal_claim_unverified"
      || !DNA_EVIDENCE_LEVELS.includes(resolution.resolved.evidenceLevel)) {
      throw new Error("dna_evidence_rereview_consensus_not_source_bound")
    }
    if (resolution.resolved.evidenceLevel === "not_assessed") {
      if (resolution.resolved.evidenceLevelEvidence !== null) {
        throw new Error("dna_evidence_rereview_unexpected_level_evidence")
      }
    } else {
      const levelEvidence = resolution.resolved.evidenceLevelEvidence
      if (!levelEvidence || levelEvidence.kind !== "method_appraisal") {
        throw new Error("dna_evidence_rereview_level_requires_method_appraisal")
      }
      requireExactKeys(levelEvidence, [
        "kind",
        "appraisalId",
        "appraisalSha256",
        "assessedLevel",
      ], "dna_evidence_rereview_level_appraisal_shape_invalid")
      requireTrustedSubject({
        registry: input.trustRegistry,
        kind: "method_appraisal",
        recordId: requireStableId(levelEvidence.appraisalId, "rereview_method_appraisal_id"),
        sourceId: resolution.sourceId,
        artifactSha256: resolution.artifactSha256,
        subjectSha256: sha256Object({
          kind: "method_appraisal",
          appraisalId: levelEvidence.appraisalId,
          appraisalSha256: requireSha256(
            levelEvidence.appraisalSha256,
            "rereview_method_appraisal_sha256",
          ),
          assessedLevel: levelEvidence.assessedLevel,
        }),
      })
      if (levelEvidence.assessedLevel !== resolution.resolved.evidenceLevel) {
        throw new Error("dna_evidence_rereview_level_appraisal_mismatch")
      }
    }
  } else if (resolution.resolved !== null) {
    throw new Error("dna_evidence_rereview_nonconsensus_has_resolution")
  }
  if ((resolution.decision === "contested" && resolution.rationaleCode !== "boundary_unresolved")
    || (resolution.decision === "quarantined" && resolution.rationaleCode !== "support_not_found")) {
    throw new Error("dna_evidence_rereview_rationale_inconsistent")
  }

  const status = resolution.decision === "consensus"
    ? "rereview_consensus_candidate" as const
    : resolution.decision === "contested"
      ? "contested" as const
      : "quarantined" as const
  const core = {
    schemaVersion: DNA_CLAIM_RECONCILIATION_VERSION,
    rereviewProtocolId: resolution.protocolId,
    reviewId,
    previousReconciliationSha256: input.reconciliation.reconciliationSha256,
    status,
    consensusEligible: status === "rereview_consensus_candidate",
    runtimeEligible: false as const,
    registryStatus: "not_registered" as const,
    majorityVoteUsed: false as const,
    sourceId: resolution.sourceId,
    artifactSha256: resolution.artifactSha256,
    resolved: resolution.resolved,
    evidenceSha256,
    rationaleCode: resolution.rationaleCode,
  }
  return deepFreeze({ ...core, rereviewSha256: sha256Object(core) })
}

/**
 * Intentionally empty until later appraisal, acceptance, lifecycle and release
 * phases register real audited records. Candidate consensus is not acceptance.
 */
export const DNA_CURRENT_ACCEPTED_ATOMIC_CLAIM_REGISTRY = Object.freeze([] as const)

export const DNA_EVIDENCE_EXTRACTION_CONTRACT = deepFreeze({
  schemaVersion: DNA_EVIDENCE_EXTRACTION_VERSION,
  phases: [14, 15, 16, 17, 18, 19],
  parserPreference: DNA_PARSER_PREFERENCE,
  excludedComponents: DNA_PARSE_EXCLUSION_REASONS,
  passageParagraphRange: { minimum: 1, maximum: 3, adjacent: true, sameSection: true },
  blindProtocols: DNA_BLIND_EXTRACTION_PROTOCOLS,
  reconciliationFields: DNA_RECONCILIATION_COMPARISON_FIELDS,
  majorityVotingAllowed: false,
  runtimeNetworkAllowed: false,
  runtimeLlmAllowed: false,
  autonomousExtractionImplemented: false,
  registeredEvidenceTrustRegistryCount:
    DNA_REGISTERED_EVIDENCE_TRUST_REGISTRY_SHA256.length,
  callerAssertedGovernanceTrustAllowed: false,
  testFixtureTrustAllowedInProduction: false,
  acceptedRegistryCount: DNA_CURRENT_ACCEPTED_ATOMIC_CLAIM_REGISTRY.length,
  outputDisposition: "candidate_only_until_later_release_gates",
})
