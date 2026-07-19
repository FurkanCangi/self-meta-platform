import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"

import {
  DNA_CURRENT_OWNER_BOOK_LOCK,
  DNA_OWNER_BOOK_LOCK_CONTRACT,
  buildDnaOwnerBookManifest,
  canOwnerBookApprovalSupportRole,
  compileDnaOwnerBookLock,
  verifyDnaOwnerBookArtifact,
  type DnaOwnerBookApprovalRecord,
} from "../src/lib/dna/chat/governance/bookLock"
import {
  DNA_CONTENT_LIFECYCLE_CONTRACT,
  DNA_REQUIRED_RELEASE_PATH,
  DNA_V3_RELEASE_BLOCKED_STATUSES,
  appendDnaLifecycleTransition,
  createDnaContentLifecycleRecord,
  createV2LegacyLifecycleRecord,
  isDnaLifecycleTransitionAllowed,
  isV3ContentReleaseEligible,
  verifyDnaLifecycleEventChain,
  type DnaContentLifecycleRecord,
  type DnaContentLifecycleStatus,
} from "../src/lib/dna/chat/governance/lifecycle"

function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex")
}

function readJson(path: string): unknown {
  return JSON.parse(readFileSync(resolve(process.cwd(), path), "utf8"))
}

function eventInput(sequence: number, toStatus: DnaContentLifecycleStatus) {
  return {
    toStatus,
    eventId: `event.lifecycle.${String(sequence).padStart(2, "0")}`,
    occurredAt: new Date(Date.UTC(2026, 6, 19, 0, sequence)).toISOString(),
    actorId: "codex.audit.pipeline",
    reasonCode: `gate.${toStatus}`,
    evidenceSha256: sha256(`evidence:${toStatus}:${sequence}`),
  } as const
}

function advanceReleasePath(): DnaContentLifecycleRecord {
  let record = createDnaContentLifecycleRecord({
    contentId: "claim.neurophysiology.example",
    contentKind: "claim",
    contentSha256: sha256("canonical claim bytes"),
    eventId: "event.lifecycle.00",
    occurredAt: new Date(Date.UTC(2026, 6, 19, 0, 0)).toISOString(),
    actorId: "codex.audit.pipeline",
    evidenceSha256: sha256("evidence:discovered:0"),
  })
  for (let index = 1; index < DNA_REQUIRED_RELEASE_PATH.length; index += 1) {
    record = appendDnaLifecycleTransition(
      record,
      eventInput(index, DNA_REQUIRED_RELEASE_PATH[index]),
    )
  }
  return record
}

function main(): void {
  assert.deepEqual(
    readJson("docs/dna-intelligence/governance/v3/dna-book-lock-contract.json"),
    JSON.parse(JSON.stringify(DNA_OWNER_BOOK_LOCK_CONTRACT)),
  )
  assert.deepEqual(
    readJson("docs/dna-intelligence/governance/v3/content-lifecycle-contract.json"),
    JSON.parse(JSON.stringify(DNA_CONTENT_LIFECYCLE_CONTRACT)),
  )

  // Phase 3 is honestly deferred, not passed with an empty approval set.
  assert.equal(DNA_CURRENT_OWNER_BOOK_LOCK.status, "deferred_owner_book")
  assert.equal(DNA_CURRENT_OWNER_BOOK_LOCK.ownerApprovalCount, 0)
  assert.equal(DNA_CURRENT_OWNER_BOOK_LOCK.releaseEligible, false)
  assert.equal(DNA_CURRENT_OWNER_BOOK_LOCK.approvedBook, null)
  assert.equal(DNA_CURRENT_OWNER_BOOK_LOCK.productClaimBindings.length, 0)

  const bytes = new TextEncoder().encode(
    "Bölüm bir: öz düzenleme tanımı.\nBölüm iki: yorum sınırları.",
  )
  const chapterBoundary = new TextEncoder().encode(
    "Bölüm bir: öz düzenleme tanımı.\n",
  ).byteLength
  const manifest = buildDnaOwnerBookManifest({
    bookId: "dna.owner.book",
    bookVersion: "dna-owner-book@1",
    artifactBytes: bytes,
    chapters: [
      {
        chapterId: "dna.chapter.self-regulation",
        range: { startByte: 0, endByteExclusive: chapterBoundary },
        passages: [{
          passageId: "dna.passage.self-regulation.definition",
          range: { startByte: 0, endByteExclusive: chapterBoundary - 1 },
        }],
      },
      {
        chapterId: "dna.chapter.boundaries",
        range: { startByte: chapterBoundary, endByteExclusive: bytes.byteLength },
        passages: [{
          passageId: "dna.passage.boundaries.case",
          range: { startByte: chapterBoundary, endByteExclusive: bytes.byteLength },
        }],
      },
    ],
  })
  assert.equal(verifyDnaOwnerBookArtifact(manifest, bytes), true)
  assert.throws(() => buildDnaOwnerBookManifest({
    bookId: "dna.owner.book",
    bookVersion: "dna-owner-book@duplicate-chapter",
    artifactBytes: bytes,
    chapters: [
      {
        chapterId: "dna.chapter.duplicate",
        range: { startByte: 0, endByteExclusive: chapterBoundary },
        passages: [{
          passageId: "dna.passage.duplicate.one",
          range: { startByte: 0, endByteExclusive: chapterBoundary - 1 },
        }],
      },
      {
        chapterId: "dna.chapter.duplicate",
        range: { startByte: chapterBoundary, endByteExclusive: bytes.byteLength },
        passages: [{
          passageId: "dna.passage.duplicate.two",
          range: { startByte: chapterBoundary, endByteExclusive: bytes.byteLength },
        }],
      },
    ],
  }), /duplicate_chapter_id/)

  const approvedChapter = manifest.chapters[0]
  const approvedPassage = approvedChapter.passages[0]
  const approval: DnaOwnerBookApprovalRecord = {
    approvalRecordId: "owner.approval.example",
    approvalStatus: "owner_approved",
    declarationVersion: "owner-declaration@1",
    bookId: manifest.bookId,
    bookVersion: manifest.bookVersion,
    artifactSha256: manifest.artifactSha256,
    byteLength: manifest.byteLength,
    approvedChapterRanges: [{
      chapterId: approvedChapter.chapterId,
      range: approvedChapter.range,
      chapterSha256: approvedChapter.chapterSha256,
    }],
    approvedPassageRanges: [{
      chapterId: approvedChapter.chapterId,
      passageId: approvedPassage.passageId,
      range: approvedPassage.range,
      passageSha256: approvedPassage.passageSha256,
    }],
  }
  const locked = compileDnaOwnerBookLock({
    manifest,
    artifactBytes: bytes,
    approval,
    liveProductClaimIds: ["dna.claim.self-regulation.definition"],
    claimBindings: [{
      claimId: "dna.claim.self-regulation.definition",
      chapterId: approvedChapter.chapterId,
      passageId: approvedPassage.passageId,
      passageSha256: approvedPassage.passageSha256,
    }],
  })
  assert.equal(locked.status, "locked")
  assert.equal(canOwnerBookApprovalSupportRole(locked, "product_definition"), true)
  for (const role of DNA_OWNER_BOOK_LOCK_CONTRACT.ownerApprovalDoesNotEstablish) {
    assert.equal(canOwnerBookApprovalSupportRole(locked, role), false, role)
  }

  // One-byte mutation invalidates the artifact and therefore the approval.
  const mutated = new Uint8Array(bytes)
  mutated[5] ^= 1
  assert.equal(verifyDnaOwnerBookArtifact(manifest, mutated), false)
  assert.throws(() => compileDnaOwnerBookLock({
    manifest,
    artifactBytes: mutated,
    approval,
    liveProductClaimIds: ["dna.claim.self-regulation.definition"],
    claimBindings: locked.productClaimBindings,
  }), /artifact_hash_mismatch/)
  assert.throws(() => compileDnaOwnerBookLock({
    manifest,
    artifactBytes: bytes,
    approval: { ...approval, bookVersion: "dna-owner-book@2" },
    liveProductClaimIds: ["dna.claim.self-regulation.definition"],
    claimBindings: locked.productClaimBindings,
  }), /approval_artifact_mismatch/)
  assert.throws(() => compileDnaOwnerBookLock({
    manifest,
    artifactBytes: bytes,
    approval,
    liveProductClaimIds: [],
    claimBindings: [],
  }), /vacuous_claim_set/)
  assert.throws(() => compileDnaOwnerBookLock({
    manifest,
    artifactBytes: bytes,
    approval,
    liveProductClaimIds: ["dna.claim.one", "dna.claim.two"],
    claimBindings: [{
      claimId: "dna.claim.one",
      chapterId: approvedChapter.chapterId,
      passageId: approvedPassage.passageId,
      passageSha256: approvedPassage.passageSha256,
    }],
  }), /incomplete_live_claim_binding/)
  const unapprovedPassage = manifest.chapters[1].passages[0]
  assert.throws(() => compileDnaOwnerBookLock({
    manifest,
    artifactBytes: bytes,
    approval,
    liveProductClaimIds: ["dna.claim.unapproved.chapter"],
    claimBindings: [{
      claimId: "dna.claim.unapproved.chapter",
      chapterId: manifest.chapters[1].chapterId,
      passageId: unapprovedPassage.passageId,
      passageSha256: unapprovedPassage.passageSha256,
    }],
  }), /claim_passage_not_approved/)

  // Phase 4 uses a verified append-only chain and exact released-only gate.
  const released = advanceReleasePath()
  assert.equal(released.status, "released")
  assert.equal(verifyDnaLifecycleEventChain(released), true)
  assert.equal(isV3ContentReleaseEligible(released), true)
  assert.equal(Object.isFrozen(released.events), true)
  assert.equal(Object.isFrozen(released.events[0]), true)

  const tampered = JSON.parse(JSON.stringify(released)) as DnaContentLifecycleRecord
  ;(tampered.events as unknown as Array<{ reasonCode: string }>)[2].reasonCode = "gate.tampered"
  assert.equal(verifyDnaLifecycleEventChain(tampered), false)
  assert.equal(isV3ContentReleaseEligible(tampered), false)

  const legacy = createV2LegacyLifecycleRecord({
    contentId: "claim.legacy.approved",
    legacyStatus: "approvedEntry_sourceVerified_live",
  })
  assert.equal(isV3ContentReleaseEligible(legacy), false)

  const preReleaseStatuses = DNA_REQUIRED_RELEASE_PATH.slice(0, -1)
  let preRelease = createDnaContentLifecycleRecord({
    contentId: "claim.pre-release",
    contentKind: "claim",
    contentSha256: sha256("pre-release"),
    eventId: "event.pre-release.00",
    occurredAt: new Date(Date.UTC(2026, 6, 19, 1, 0)).toISOString(),
    actorId: "codex.audit.pipeline",
    evidenceSha256: sha256("pre-release-discovered"),
  })
  for (let index = 1; index < preReleaseStatuses.length; index += 1) {
    preRelease = appendDnaLifecycleTransition(preRelease, {
      ...eventInput(index, preReleaseStatuses[index]),
      eventId: `event.pre-release.${String(index).padStart(2, "0")}`,
      occurredAt: new Date(Date.UTC(2026, 6, 19, 1, index)).toISOString(),
    })
  }
  assert.equal(preRelease.status, "compiled")
  assert.equal(isV3ContentReleaseEligible(preRelease), false)

  const monitored = appendDnaLifecycleTransition(
    released,
    eventInput(DNA_REQUIRED_RELEASE_PATH.length, "monitored"),
  )
  assert.equal(isV3ContentReleaseEligible(monitored), false)
  const deprecated = appendDnaLifecycleTransition(
    released,
    eventInput(DNA_REQUIRED_RELEASE_PATH.length, "deprecated"),
  )
  assert.equal(isV3ContentReleaseEligible(deprecated), false)

  for (const blocked of DNA_V3_RELEASE_BLOCKED_STATUSES) {
    assert.notEqual(blocked, "released")
    assert.equal(isV3ContentReleaseEligible({
      ...released,
      status: blocked,
    }), false, `blocked lifecycle status escaped: ${blocked}`)
  }
  assert.equal(isDnaLifecycleTransitionAllowed("accepted", "released"), false)
  assert.equal(isDnaLifecycleTransitionAllowed("accepted", "compiled"), true)
  assert.throws(() => appendDnaLifecycleTransition(preRelease, {
    ...eventInput(99, "accepted"),
    eventId: "event.illegal.backwards",
  }), /transition_not_allowed/)

  console.log("DNA Faz 3–4 book/lifecycle tests: PASS")
  console.log(JSON.stringify({
    ownerBookStatus: DNA_CURRENT_OWNER_BOOK_LOCK.status,
    ownerApprovals: DNA_CURRENT_OWNER_BOOK_LOCK.ownerApprovalCount,
    bookMutationInvalidatesApproval: true,
    ownerBookScientificValidation: false,
    lifecycleStates: DNA_CONTENT_LIFECYCLE_CONTRACT.states.length,
    requiredReleaseMilestones: DNA_REQUIRED_RELEASE_PATH.length,
    blockedStatuses: DNA_V3_RELEASE_BLOCKED_STATUSES.length,
    releasedOnly: true,
    hashChainVerified: true,
    v2ReleaseEligibleInV3: false,
  }, null, 2))
}

main()
