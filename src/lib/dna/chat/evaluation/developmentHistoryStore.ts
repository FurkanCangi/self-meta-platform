import { createHash } from "node:crypto"
import {
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  writeFileSync,
} from "node:fs"
import { dirname, join, relative, resolve } from "node:path"

import { DNA_CHAT_CATALOG_BENCHMARK_QUESTIONS } from "../catalog"
import committedAuthorityJson from "./generated/currentDevelopmentHistoryAuthority.json"
import {
  appendDnaDevelopmentHistoryLedger,
  assertDnaDevelopmentHistoryMatchesAuthority,
  type DnaDevelopmentHistoryAuthorityManifest,
  type DnaDevelopmentHistoryLedger,
} from "./evaluationDatasetIntegrity"

export const DNA_DEVELOPMENT_HISTORY_GENESIS_BATCH_ID =
  "development-history.v2-baseline.2026-07-19" as const
export const DNA_DEVELOPMENT_HISTORY_GENESIS_APPENDED_AT =
  "2026-07-19T00:00:00.000Z" as const

const LEDGER_RELATIVE_PATH =
  "Datasets/DNA-Intelligence/evaluation/v3/development-history/ledger.json"

const committedAuthority = committedAuthorityJson as DnaDevelopmentHistoryAuthorityManifest

function sha256(bytes: Buffer): string {
  return createHash("sha256").update(bytes).digest("hex")
}

function canonicalBytes(value: unknown): Buffer {
  return Buffer.from(`${JSON.stringify(value, null, 2)}\n`, "utf8")
}

function assertContained(root: string, candidate: string, code: string): void {
  const pathFromRoot = relative(root, candidate)
  if (pathFromRoot === ".." || pathFromRoot.startsWith(`..${process.platform === "win32" ? "\\" : "/"}`)
    || resolve(candidate) === resolve(root) && candidate !== root) {
    throw new Error(code)
  }
}

function assertSafeResearchRoot(root: string, allowNonSsdForTests: boolean): string {
  const resolved = resolve(root)
  if (!allowNonSsdForTests && !resolved.startsWith("/Volumes/ResearchSSD")) {
    throw new Error("dna_development_history_requires_research_ssd")
  }
  if (!existsSync(resolved) || lstatSync(resolved).isSymbolicLink()) {
    throw new Error("dna_development_history_invalid_research_root")
  }
  return resolved
}

function assertExistingPathChainIsSafe(root: string, targetDirectory: string): void {
  assertContained(root, targetDirectory, "dna_development_history_path_escape")
  const segments = relative(root, targetDirectory).split(/[\\/]/).filter(Boolean)
  let cursor = root
  for (const segment of segments) {
    cursor = join(cursor, segment)
    if (!existsSync(cursor)) continue
    if (lstatSync(cursor).isSymbolicLink()) {
      throw new Error("dna_development_history_symlink_component")
    }
    if (!realpathSync(cursor).startsWith(realpathSync(root))) {
      throw new Error("dna_development_history_realpath_escape")
    }
  }
}

export function createCanonicalDnaDevelopmentHistoryLedger(): DnaDevelopmentHistoryLedger {
  const ledger = appendDnaDevelopmentHistoryLedger({
    previous: null,
    questions: DNA_CHAT_CATALOG_BENCHMARK_QUESTIONS,
    batchId: DNA_DEVELOPMENT_HISTORY_GENESIS_BATCH_ID,
    appendedAt: DNA_DEVELOPMENT_HISTORY_GENESIS_APPENDED_AT,
  })
  assertDnaDevelopmentHistoryMatchesAuthority({ ledger, authority: committedAuthority })
  return ledger
}

export type DnaDevelopmentHistoryMaterializationResult = Readonly<{
  mode: "verified_existing" | "created_and_verified"
  ledgerPath: string
  rawFileSha256: string
  ledgerSha256: string
  batchCount: number
  entryCount: number
  authoritySha256: string
}>

export function materializeDnaDevelopmentHistoryLedger(input: Readonly<{
  researchRoot: string
  write: boolean
  allowNonSsdForTests?: boolean
}>): DnaDevelopmentHistoryMaterializationResult {
  const root = assertSafeResearchRoot(input.researchRoot, input.allowNonSsdForTests === true)
  const ledgerPath = join(root, LEDGER_RELATIVE_PATH)
  const ledgerDirectory = dirname(ledgerPath)
  assertExistingPathChainIsSafe(root, ledgerDirectory)
  const expectedLedger = createCanonicalDnaDevelopmentHistoryLedger()
  const expectedBytes = canonicalBytes(expectedLedger)
  let mode: DnaDevelopmentHistoryMaterializationResult["mode"] = "verified_existing"

  if (!existsSync(ledgerPath)) {
    if (!input.write) throw new Error("dna_development_history_ledger_missing")
    mkdirSync(ledgerDirectory, { recursive: true, mode: 0o700 })
    assertExistingPathChainIsSafe(root, ledgerDirectory)
    writeFileSync(ledgerPath, expectedBytes, { flag: "wx", mode: 0o600 })
    mode = "created_and_verified"
  }

  if (lstatSync(ledgerPath).isSymbolicLink()
    || !realpathSync(ledgerPath).startsWith(realpathSync(root))) {
    throw new Error("dna_development_history_ledger_path_untrusted")
  }
  const actualBytes = readFileSync(ledgerPath)
  if (!actualBytes.equals(expectedBytes)) {
    throw new Error("dna_development_history_ledger_bytes_mismatch")
  }
  const actualLedger = JSON.parse(actualBytes.toString("utf8")) as DnaDevelopmentHistoryLedger
  assertDnaDevelopmentHistoryMatchesAuthority({
    ledger: actualLedger,
    authority: committedAuthority,
  })

  return Object.freeze({
    mode,
    ledgerPath,
    rawFileSha256: sha256(actualBytes),
    ledgerSha256: actualLedger.ledgerSha256,
    batchCount: actualLedger.batches.length,
    entryCount: actualLedger.batches.reduce((sum, batch) => sum + batch.entries.length, 0),
    authoritySha256: committedAuthority.authoritySha256,
  })
}
