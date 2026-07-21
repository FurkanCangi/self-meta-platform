#!/usr/bin/env node

import {
  compileDnaMethodAppraisalWorkerCandidate,
  createDnaMethodAppraisalWorkerContext,
  getDnaMethodAppraisalWorkerStatus,
  ingestDnaMethodAppraisalFidelity,
  ingestDnaMethodAppraisalPass,
  ingestDnaMethodAppraisalReconciliation,
  prepareDnaMethodAppraisalReviewPacket,
  type DnaMethodAppraisalWorkerPassRole,
} from "../src/lib/dna/chat/governance/methodAppraisalBatchWorker"

type Command =
  | "prepare"
  | "ingest-pass"
  | "ingest-reconciliation"
  | "ingest-fidelity"
  | "compile"
  | "status"

function option(name: string): string | undefined {
  const prefix = `--${name}=`
  return process.argv.find((argument) => argument.startsWith(prefix))?.slice(prefix.length)
}

function requiredOption(name: string): string {
  const value = option(name)
  if (!value) throw new Error(`worker_cli:missing_option:${name}`)
  return value
}

function requiredRole(): DnaMethodAppraisalWorkerPassRole {
  const role = requiredOption("role").toUpperCase()
  if (role !== "A" && role !== "B") throw new Error("worker_cli:invalid_role")
  return role
}

function command(): Command {
  const value = process.argv[2]
  if (![
    "prepare",
    "ingest-pass",
    "ingest-reconciliation",
    "ingest-fidelity",
    "compile",
    "status",
  ].includes(value)) throw new Error("worker_cli:invalid_or_missing_command")
  return value as Command
}

export function runDnaMethodAppraisalBatchWorkerCli(): void {
  const selectedCommand = command()
  const context = createDnaMethodAppraisalWorkerContext({
    researchRoot: process.env.RESEARCH_SSD_ROOT || "/Volumes/ResearchSSD",
    repoRoot: process.cwd(),
  })
  if (selectedCommand === "status") {
    const status = getDnaMethodAppraisalWorkerStatus(context)
    console.log(JSON.stringify(status, null, 2))
    if (process.argv.includes("--strict") && !status.ok) process.exitCode = 1
    return
  }
  const sourceId = requiredOption("source")
  const expectedIndexSha256 = requiredOption("expected-index-sha")
  if (selectedCommand === "prepare") {
    console.log(JSON.stringify(prepareDnaMethodAppraisalReviewPacket({
      context,
      sourceId,
      role: requiredRole(),
      expectedIndexSha256,
    }), null, 2))
    return
  }
  if (selectedCommand === "ingest-pass") {
    console.log(JSON.stringify(ingestDnaMethodAppraisalPass({
      context,
      sourceId,
      role: requiredRole(),
      inputPath: requiredOption("input"),
      packetPath: requiredOption("packet"),
      expectedIndexSha256,
    }), null, 2))
    return
  }
  if (selectedCommand === "ingest-reconciliation") {
    console.log(JSON.stringify(ingestDnaMethodAppraisalReconciliation({
      context,
      sourceId,
      inputPath: requiredOption("input"),
      expectedIndexSha256,
    }), null, 2))
    return
  }
  if (selectedCommand === "ingest-fidelity") {
    console.log(JSON.stringify(ingestDnaMethodAppraisalFidelity({
      context,
      sourceId,
      inputPath: requiredOption("input"),
      expectedIndexSha256,
    }), null, 2))
    return
  }
  console.log(JSON.stringify(compileDnaMethodAppraisalWorkerCandidate({
    context,
    sourceId,
    expectedIndexSha256,
  }), null, 2))
}

if (require.main === module) {
  try {
    runDnaMethodAppraisalBatchWorkerCli()
  } catch (error) {
    console.error(error instanceof Error ? error.message : "worker_cli:unknown_error")
    process.exitCode = 1
  }
}
