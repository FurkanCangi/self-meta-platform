import assert from "node:assert/strict"
import { mkdtempSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"

import {
  createCanonicalDnaDevelopmentHistoryLedger,
  materializeDnaDevelopmentHistoryLedger,
} from "../src/lib/dna/chat/evaluation/developmentHistoryStore"

const root = mkdtempSync(join(tmpdir(), "dna-development-history-"))

try {
  assert.throws(() => materializeDnaDevelopmentHistoryLedger({
    researchRoot: root,
    write: false,
    allowNonSsdForTests: true,
  }), /ledger_missing/)

  const created = materializeDnaDevelopmentHistoryLedger({
    researchRoot: root,
    write: true,
    allowNonSsdForTests: true,
  })
  assert.equal(created.mode, "created_and_verified")
  assert.equal(created.entryCount, 1_856)
  assert.equal(created.batchCount, 1)

  const verified = materializeDnaDevelopmentHistoryLedger({
    researchRoot: root,
    write: false,
    allowNonSsdForTests: true,
  })
  assert.equal(verified.mode, "verified_existing")
  assert.equal(verified.rawFileSha256, created.rawFileSha256)
  assert.equal(verified.ledgerSha256, createCanonicalDnaDevelopmentHistoryLedger().ledgerSha256)

  writeFileSync(created.ledgerPath, Buffer.concat([
    readFileSync(created.ledgerPath),
    Buffer.from("\n", "utf8"),
  ]))
  assert.throws(() => materializeDnaDevelopmentHistoryLedger({
    researchRoot: root,
    write: true,
    allowNonSsdForTests: true,
  }), /ledger_bytes_mismatch/)

  const symlinkRoot = mkdtempSync(join(tmpdir(), "dna-development-history-symlink-"))
  const external = mkdtempSync(join(tmpdir(), "dna-development-history-external-"))
  const evaluationDirectory = join(
    symlinkRoot,
    "Datasets/DNA-Intelligence/evaluation/v3",
  )
  mkdirSync(evaluationDirectory, { recursive: true })
  symlinkSync(external, join(evaluationDirectory, "development-history"))
  assert.throws(() => materializeDnaDevelopmentHistoryLedger({
    researchRoot: symlinkRoot,
    write: true,
    allowNonSsdForTests: true,
  }), /symlink_component/)
  rmSync(symlinkRoot, { recursive: true, force: true })
  rmSync(external, { recursive: true, force: true })

  assert.throws(() => materializeDnaDevelopmentHistoryLedger({
    researchRoot: dirname(root),
    write: false,
  }), /requires_research_ssd/)

  console.log(JSON.stringify({
    ok: true,
    entryCount: created.entryCount,
    negativeCases: 4,
    rawFileSha256: created.rawFileSha256,
    ledgerSha256: created.ledgerSha256,
  }, null, 2))
} finally {
  rmSync(root, { recursive: true, force: true })
}
