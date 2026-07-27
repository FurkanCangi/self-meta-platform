import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { createHash } from "node:crypto"
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import {
  DNA_REGISTERED_OWNER_APPROVALS,
} from "../src/lib/dna/chat/knowledgeAuthority"
import {
  buildDnaOwnerBookManifest,
  compileDnaOwnerBookLock,
  verifyDnaOwnerBookArtifact,
  type DnaOwnerBookApprovalRecord,
  type DnaOwnerBookManifest,
} from "../src/lib/dna/chat/governance/bookLock"
import {
  DRAFT_OUTPUT_SUBPATH,
  FINALIZATION_OUTPUT_SUBPATH,
  OwnerBookFinalizationError,
  buildFinalizationBundle,
  buildFinalizationPackage,
  loadVerifiedDraftPackage,
  prepareFinalizationWorkbench,
  resolveSsdRoot,
  stableJson,
  verifyFinalizationWorkbench,
} from "./dna-owner-book-finalization-workbench"


const REPO_ROOT = process.cwd()
const PYTHON = process.env.DNA_DOCUMENT_PYTHON || "python3"

type Fixture = Readonly<{
  root: string
  sourceRoot: string
  ssdRoot: string
  draftRepoManifest: string
  finalizationRepoManifest: string
}>

function sha256(value: Uint8Array): string {
  return createHash("sha256").update(value).digest("hex")
}

function buildFixture(): Fixture {
  const root = mkdtempSync(join(tmpdir(), "dna-owner-book-finalization-test-"))
  const sourceRoot = join(root, "source")
  const ssdRoot = join(root, "ssd")
  const draftRepoManifest = join(root, "repo", "draft.json")
  const finalizationRepoManifest = join(root, "repo", "finalization.json")
  mkdirSync(ssdRoot)
  const script = String.raw`
import sys
from pathlib import Path
sys.path.insert(0, sys.argv[1])
import dna_owner_book_draft as draft
from run_dna_owner_book_draft_tests import write_docx
source_root = Path(sys.argv[2])
ssd_root = Path(sys.argv[3])
repo_manifest = Path(sys.argv[4])
for number in range(1, 10):
    write_docx(source_root / f"{number}. Bölüm.docx", number)
draft.build(
    source_root=source_root,
    ssd_root=ssd_root,
    repo_manifest_path=repo_manifest,
    allow_test_root=True,
)
`
  execFileSync(PYTHON, [
    "-c",
    script,
    join(REPO_ROOT, "scripts"),
    sourceRoot,
    ssdRoot,
    draftRepoManifest,
  ], { cwd: REPO_ROOT, stdio: "pipe" })
  return {
    root,
    sourceRoot,
    ssdRoot,
    draftRepoManifest,
    finalizationRepoManifest,
  }
}

function withFixture(run: (fixture: Fixture) => void): void {
  const fixture = buildFixture()
  try {
    run(fixture)
  } finally {
    rmSync(fixture.root, { recursive: true, force: true })
  }
}

function fileTreeHashes(root: string): Record<string, string> {
  const result: Record<string, string> = {}
  function visit(directory: string, prefix: string): void {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name)
      const relativePath = prefix ? `${prefix}/${entry.name}` : entry.name
      if (entry.isDirectory()) visit(path, relativePath)
      else if (entry.isFile()) result[relativePath] = sha256(readFileSync(path))
    }
  }
  visit(root, "")
  return result
}

function currentFinalizationDirectory(ssdRoot: string): string {
  const outputRoot = join(ssdRoot, FINALIZATION_OUTPUT_SUBPATH)
  const current = JSON.parse(readFileSync(join(outputRoot, "current.json"), "utf8")) as {
    packageDirectoryName: string
  }
  return join(outputRoot, current.packageDirectoryName)
}

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8")) as T
}

function testPrepareVerifyAndNoAuthorityExpansion(): void {
  withFixture((fixture) => {
    const draftRoot = join(fixture.ssdRoot, DRAFT_OUTPUT_SUBPATH)
    const beforeDraft = fileTreeHashes(draftRoot)
    const prepared = prepareFinalizationWorkbench({
      ssdRoot: fixture.ssdRoot,
      repoManifestPath: fixture.finalizationRepoManifest,
      allowTestRoot: true,
    })
    const afterDraft = fileTreeHashes(draftRoot)
    assert.deepEqual(afterDraft, beforeDraft)
    assert.equal(prepared.status, "candidate_only_pending_owner_action")
    assert.equal(prepared.chapterCount, 9)
    assert.equal(prepared.claimReviewSlotCount, 9)
    assert.equal(prepared.pendingClaimReviewSlotCount, 9)
    assert.equal(prepared.ownerDeclarationStatus, "pending_owner_action")
    assert.equal(prepared.ownerApproval, false)
    assert.equal(prepared.runtimeEligible, false)
    assert.equal(prepared.releaseEligible, false)
    assert.equal(prepared.answerEligible, false)
    assert.equal(prepared.activationAllowed, false)

    const verified = verifyFinalizationWorkbench({
      ssdRoot: fixture.ssdRoot,
      repoManifestPath: fixture.finalizationRepoManifest,
      allowTestRoot: true,
    })
    assert.equal(verified.status, "verified_candidate_only")
    assert.equal(verified.workbenchSha256, prepared.workbenchSha256)

    const packageDirectory = currentFinalizationDirectory(fixture.ssdRoot)
    const queue = readFileSync(join(packageDirectory, "claim-review-queue.jsonl"), "utf8")
    const declaration = readFileSync(
      join(packageDirectory, "owner-declaration-template.json"),
      "utf8",
    )
    const compact = readFileSync(fixture.finalizationRepoManifest, "utf8")
    assert.doesNotMatch(queue, /"claimText":/)
    assert.match(queue, /"claimTextIncluded":false/)
    assert.doesNotMatch(declaration, /"approvalStatus":\s*"owner_approved"/)
    assert.match(declaration, /"approvalStatus":\s*"pending_owner_action"/)
    assert.doesNotMatch(compact, /DNA yaklaşımı|Regülasyon:|"text":|"claimText":/)
    assert.doesNotMatch(compact, /\/Users\/|\/Volumes\//)
  })
}

function testByteMutationAndOutputTamperFailClosed(): void {
  withFixture((fixture) => {
    prepareFinalizationWorkbench({
      ssdRoot: fixture.ssdRoot,
      repoManifestPath: fixture.finalizationRepoManifest,
      allowTestRoot: true,
    })
    const packageDirectory = currentFinalizationDirectory(fixture.ssdRoot)
    const wrapper = readJson<{ bookManifest: DnaOwnerBookManifest }>(
      join(packageDirectory, "final-book-manifest.json"),
    )
    const artifactPath = join(packageDirectory, "final-book-candidate.txt")
    const artifact = new Uint8Array(readFileSync(artifactPath))
    assert.equal(verifyDnaOwnerBookArtifact(wrapper.bookManifest, artifact), true)
    const mutated = new Uint8Array(artifact)
    mutated[7] ^= 1
    assert.equal(verifyDnaOwnerBookArtifact(wrapper.bookManifest, mutated), false)
    writeFileSync(artifactPath, mutated)
    assert.throws(() => verifyFinalizationWorkbench({
      ssdRoot: fixture.ssdRoot,
      repoManifestPath: fixture.finalizationRepoManifest,
      allowTestRoot: true,
    }), /owner_book_finalization_file_hash_mismatch/)
  })
}

function testMissingAndDuplicatePassagesFailClosed(): void {
  const bytes = new TextEncoder().encode("chapter-onechapter-two")
  assert.throws(() => buildDnaOwnerBookManifest({
    bookId: "dna.owner.test",
    bookVersion: "dna-owner-test@missing",
    artifactBytes: bytes,
    chapters: [{
      chapterId: "chapter.one",
      range: { startByte: 0, endByteExclusive: 11 },
      passages: [],
    }],
  }), /dna_book_lock_missing_passage/)
  assert.throws(() => buildDnaOwnerBookManifest({
    bookId: "dna.owner.test",
    bookVersion: "dna-owner-test@duplicate",
    artifactBytes: bytes,
    chapters: [
      {
        chapterId: "chapter.one",
        range: { startByte: 0, endByteExclusive: 11 },
        passages: [{
          passageId: "passage.duplicate",
          range: { startByte: 0, endByteExclusive: 11 },
          canonicalText: "chapter-one",
        }],
      },
      {
        chapterId: "chapter.two",
        range: { startByte: 11, endByteExclusive: bytes.byteLength },
        passages: [{
          passageId: "passage.duplicate",
          range: { startByte: 11, endByteExclusive: bytes.byteLength },
          canonicalText: "chapter-two",
        }],
      },
    ],
  }), /dna_book_lock_duplicate_passage_id/)
}

function testFakeApprovalAndEmptyRegistryCannotCompile(): void {
  withFixture((fixture) => {
    prepareFinalizationWorkbench({
      ssdRoot: fixture.ssdRoot,
      repoManifestPath: fixture.finalizationRepoManifest,
      allowTestRoot: true,
    })
    assert.equal(DNA_REGISTERED_OWNER_APPROVALS.length, 0)
    const packageDirectory = currentFinalizationDirectory(fixture.ssdRoot)
    const wrapper = readJson<{ bookManifest: DnaOwnerBookManifest }>(
      join(packageDirectory, "final-book-manifest.json"),
    )
    const artifact = new Uint8Array(
      readFileSync(join(packageDirectory, "final-book-candidate.txt")),
    )
    const passages = wrapper.bookManifest.chapters.flatMap((chapter) =>
      chapter.passages.map((passage) => ({ chapter, passage })))
    const approval: DnaOwnerBookApprovalRecord = {
      approvalRecordId: "owner.approval.fake",
      approvalStatus: "owner_approved",
      declarationVersion: "owner-declaration@1",
      bookId: wrapper.bookManifest.bookId,
      bookVersion: wrapper.bookManifest.bookVersion,
      artifactSha256: wrapper.bookManifest.artifactSha256,
      byteLength: wrapper.bookManifest.byteLength,
      approvedChapterRanges: wrapper.bookManifest.chapters.map((chapter) => ({
        chapterId: chapter.chapterId,
        range: chapter.range,
        chapterSha256: chapter.chapterSha256,
      })),
      approvedPassageRanges: passages.map(({ chapter, passage }) => ({
        chapterId: chapter.chapterId,
        passageId: passage.passageId,
        range: passage.range,
        artifactPassageSha256: passage.artifactPassageSha256,
        canonicalPassageSha256: passage.canonicalPassageSha256,
      })),
    }
    const canonicalPassageTexts = Object.fromEntries(passages.map(({ passage }) => [
      passage.passageId,
      new TextDecoder().decode(
        artifact.subarray(passage.range.startByte, passage.range.endByteExclusive),
      ).trim(),
    ]))
    const liveProductClaimIds = passages.map((_, index) => `dna.claim.test.${index + 1}`)
    const claimBindings = passages.map(({ chapter, passage }, index) => ({
      claimId: liveProductClaimIds[index],
      chapterId: chapter.chapterId,
      passageId: passage.passageId,
      artifactPassageSha256: passage.artifactPassageSha256,
      passageSha256: passage.canonicalPassageSha256,
    }))
    assert.throws(() => compileDnaOwnerBookLock({
      manifest: wrapper.bookManifest,
      artifactBytes: artifact,
      canonicalPassageTexts,
      approval: {
        ...approval,
        approvalStatus: "pending_owner_action",
      } as unknown as DnaOwnerBookApprovalRecord,
      liveProductClaimIds,
      claimBindings,
    }), /dna_book_lock_owner_approval_required/)
    assert.throws(() => compileDnaOwnerBookLock({
      manifest: wrapper.bookManifest,
      artifactBytes: artifact,
      canonicalPassageTexts,
      approval,
      liveProductClaimIds,
      claimBindings,
    }), /dna_book_lock_approval_not_registered/)
  })
}

function testPathSymlinkAndPointerTraversalFailClosed(): void {
  withFixture((fixture) => {
    assert.throws(() => resolveSsdRoot(fixture.ssdRoot), (
      error: unknown,
    ) => error instanceof OwnerBookFinalizationError
      && /ssd_must_be_mounted_volume/.test(error.message))

    const outputParent = join(
      fixture.ssdRoot,
      "Outputs/SelfMetaAI/dna-intelligence",
    )
    const outside = join(fixture.root, "outside")
    mkdirSync(outside)
    symlinkSync(outside, join(outputParent, "owner-book-finalization-workbench"))
    assert.throws(() => prepareFinalizationWorkbench({
      ssdRoot: fixture.ssdRoot,
      repoManifestPath: fixture.finalizationRepoManifest,
      allowTestRoot: true,
    }), /owner_book_finalization_output_symlink_rejected/)
  })

  withFixture((fixture) => {
    prepareFinalizationWorkbench({
      ssdRoot: fixture.ssdRoot,
      repoManifestPath: fixture.finalizationRepoManifest,
      allowTestRoot: true,
    })
    const currentPath = join(
      fixture.ssdRoot,
      FINALIZATION_OUTPUT_SUBPATH,
      "current.json",
    )
    const current = readJson<Record<string, unknown>>(currentPath)
    current.packageDirectoryName = "../../outside"
    writeFileSync(currentPath, stableJson(current, true), "utf8")
    assert.throws(() => verifyFinalizationWorkbench({
      ssdRoot: fixture.ssdRoot,
      repoManifestPath: fixture.finalizationRepoManifest,
      allowTestRoot: true,
    }), /owner_book_finalization_current_invalid/)
  })
}

function testTwentyRunsAreDeterministic(): void {
  withFixture((fixture) => {
    const draftPackage = loadVerifiedDraftPackage(fixture.ssdRoot, {
      allowTestRoot: true,
    })
    const identities = new Set<string>()
    const fileSets = new Set<string>()
    for (let iteration = 0; iteration < 20; iteration += 1) {
      const candidate = buildFinalizationPackage(
        buildFinalizationBundle(draftPackage),
      )
      identities.add(candidate.workbenchSha256)
      fileSets.add(stableJson(Object.fromEntries(
        Object.entries(candidate.files).sort(([left], [right]) =>
          left.localeCompare(right)).map(([name, bytes]) => [name, sha256(bytes)]),
      )))
    }
    assert.equal(identities.size, 1)
    assert.equal(fileSets.size, 1)
  })
}

function main(): void {
  const tests: readonly [string, () => void][] = [
    ["prepare_verify_no_authority_expansion", testPrepareVerifyAndNoAuthorityExpansion],
    ["byte_mutation_and_output_tamper", testByteMutationAndOutputTamperFailClosed],
    ["missing_and_duplicate_passages", testMissingAndDuplicatePassagesFailClosed],
    ["fake_approval_and_empty_registry", testFakeApprovalAndEmptyRegistryCannotCompile],
    ["path_symlink_pointer_traversal", testPathSymlinkAndPointerTraversalFailClosed],
    ["twenty_run_determinism", testTwentyRunsAreDeterministic],
  ]
  for (const [name, run] of tests) {
    run()
    console.log(`PASS ${name}`)
  }
  console.log(`DNA owner-book finalization workbench: PASS ${tests.length}/${tests.length}`)
}

main()
