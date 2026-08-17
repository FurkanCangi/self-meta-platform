import "server-only"

import { appendFile, chmod, mkdir, readFile, writeFile } from "node:fs/promises"
import path from "node:path"
import type {
  DnaS13CanaryFeedbackRecord,
  DnaS13CanaryMessageRecord,
  DnaS13CanaryTrainingAnnotation,
} from "./contracts"
import type { DnaS13RealizationProvenance } from "../strictProvenance"

const SAFE_DEFAULT_PREFIX = "/Volumes/ResearchSSD/Outputs/SelfMetaAI/"
const SAFE_TEST_PREFIXES = ["/private/tmp/", "/tmp/"] as const

function safeIdentifier(value: string, name: string) {
  if (!/^[a-zA-Z0-9_-]{8,80}$/u.test(value)) throw new Error(`dna_s13_canary_${name}_invalid`)
  return value
}

function safeRoot(root: string) {
  const resolved = path.resolve(root)
  if (resolved.startsWith(SAFE_DEFAULT_PREFIX) || SAFE_TEST_PREFIXES.some((prefix) => resolved.startsWith(prefix))) return resolved
  throw new Error("dna_s13_canary_output_root_not_allowed")
}

function paths(root: string, sessionId: string) {
  const directory = path.join(safeRoot(root), "sessions", safeIdentifier(sessionId, "session_id"))
  return Object.freeze({
    directory,
    messages: path.join(directory, "messages.jsonl"),
    provenance: path.join(directory, "provenance.jsonl"),
    feedback: path.join(directory, "feedback.jsonl"),
    training: path.join(directory, "training-annotations.jsonl"),
    privacy: path.join(directory, "privacy-rejections.jsonl"),
    summary: path.join(directory, "summary.json"),
  })
}

async function ensureDirectory(directory: string) {
  await mkdir(directory, { recursive: true, mode: 0o700 })
  await chmod(directory, 0o700)
}

async function appendJsonLine(file: string, value: unknown) {
  await ensureDirectory(path.dirname(file))
  await appendFile(file, `${JSON.stringify(value)}\n`, { encoding: "utf8", mode: 0o600 })
  await chmod(file, 0o600)
}

async function readJsonLines<T>(file: string): Promise<T[]> {
  const source = await readFile(file, "utf8").catch((error: NodeJS.ErrnoException) => {
    if (error.code === "ENOENT") return ""
    throw error
  })
  return source.split("\n").map((line) => line.trim()).filter(Boolean).map((line) => JSON.parse(line) as T)
}

export async function appendDnaS13CanaryMessage(root: string, record: DnaS13CanaryMessageRecord) {
  const target = paths(root, record.sessionId)
  const messageWithoutRawProvenance = { ...record, provenance: null }
  await appendJsonLine(target.messages, messageWithoutRawProvenance)
  if (record.provenance) await appendJsonLine(target.provenance, record.provenance)
}

export async function appendDnaS13CanaryFeedback(root: string, record: DnaS13CanaryFeedbackRecord) {
  await appendJsonLine(paths(root, record.sessionId).feedback, record)
}

export async function appendDnaS13CanaryTrainingAnnotation(root: string, record: DnaS13CanaryTrainingAnnotation) {
  await appendJsonLine(paths(root, record.sessionId).training, record)
}

export async function appendDnaS13CanaryPrivacyRejection(root: string, input: Readonly<{
  sessionId: string
  messageId: string
  createdAt: string
  testerIdHash: string
  questionHash: string
  reasonCodes: readonly string[]
}>) {
  await appendJsonLine(paths(root, input.sessionId).privacy, input)
}

export async function readDnaS13CanarySession(root: string, sessionId: string) {
  const target = paths(root, sessionId)
  const [messages, provenance, feedback, trainingAnnotations, privacyRejections] = await Promise.all([
    readJsonLines<DnaS13CanaryMessageRecord>(target.messages),
    readJsonLines<DnaS13RealizationProvenance>(target.provenance),
    readJsonLines<DnaS13CanaryFeedbackRecord>(target.feedback),
    readJsonLines<DnaS13CanaryTrainingAnnotation>(target.training),
    readJsonLines<Record<string, unknown>>(target.privacy),
  ])
  return Object.freeze({ messages, provenance, feedback, trainingAnnotations, privacyRejections })
}

export async function writeDnaS13CanarySummary(root: string, sessionId: string, summary: unknown) {
  const target = paths(root, sessionId).summary
  await ensureDirectory(path.dirname(target))
  await writeFile(target, `${JSON.stringify(summary, null, 2)}\n`, { encoding: "utf8", mode: 0o600 })
  await chmod(target, 0o600)
}
