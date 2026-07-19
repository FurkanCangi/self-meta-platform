import { DNA_CHAT_CATALOG_VERSION } from "./catalog/types"
import { isDnaChatEngineResponseAuthentic } from "./engine"
import type { DnaChatResponse } from "./types"
import type { DnaV3RetrievalAnswer } from "./v3RetrievalCore"

export type DnaChatRuntimeMetadata = Readonly<{
  generation: "v2_legacy" | "v3"
  engineVersion: "dna-chat-engine@2" | "dna-chat-engine@3"
  catalogVersion: string
  packageVersion: string
  packageSha256: string | null
}>

export type DnaChatRuntimeAnswer = Readonly<
  | {
      generation: "v2_legacy"
      metadata: DnaChatRuntimeMetadata & Readonly<{ generation: "v2_legacy" }>
      answer: DnaChatResponse
    }
  | {
      generation: "v3"
      metadata: DnaChatRuntimeMetadata & Readonly<{ generation: "v3" }>
      answer: DnaV3RetrievalAnswer
    }
>

const AUTHENTIC_RUNTIME_ANSWERS = new WeakSet<object>()

function register<T extends DnaChatRuntimeAnswer>(answer: T): T {
  const frozen = Object.freeze(answer) as T
  AUTHENTIC_RUNTIME_ANSWERS.add(frozen)
  return frozen
}

export function createDnaV2RuntimeAnswer(answer: DnaChatResponse): DnaChatRuntimeAnswer {
  if (!isDnaChatEngineResponseAuthentic(answer)) {
    throw new Error("dna_v2_runtime_answer_not_authentic")
  }
  return register({
    generation: "v2_legacy",
    metadata: Object.freeze({
      generation: "v2_legacy",
      engineVersion: "dna-chat-engine@2",
      catalogVersion: DNA_CHAT_CATALOG_VERSION,
      packageVersion: DNA_CHAT_CATALOG_VERSION,
      packageSha256: null,
    }),
    answer,
  })
}

/** @internal Minted only after the server-only committed V3 release gate. */
export function createDnaV3RuntimeAnswerInternal(input: Readonly<{
  answer: DnaV3RetrievalAnswer
  catalogVersion: string
  packageVersion: string
  packageSha256: string
}>): DnaChatRuntimeAnswer {
  if (input.answer.engineVersion !== "dna-chat-engine@3"
    || !Object.isFrozen(input.answer)
    || !/^[a-f0-9]{64}$/.test(input.packageSha256)) {
    throw new Error("dna_v3_runtime_answer_not_authentic")
  }
  return register({
    generation: "v3",
    metadata: Object.freeze({
      generation: "v3",
      engineVersion: "dna-chat-engine@3",
      catalogVersion: input.catalogVersion,
      packageVersion: input.packageVersion,
      packageSha256: input.packageSha256,
    }),
    answer: input.answer,
  })
}

export function isDnaChatRuntimeAnswerAuthentic(
  value: unknown,
): value is DnaChatRuntimeAnswer {
  if (!value || typeof value !== "object" || !AUTHENTIC_RUNTIME_ANSWERS.has(value)) return false
  const runtime = value as DnaChatRuntimeAnswer
  if (runtime.generation !== runtime.metadata.generation
    || runtime.answer.engineVersion !== runtime.metadata.engineVersion) return false
  return runtime.generation === "v3"
    ? Object.isFrozen(runtime.answer) && Boolean(runtime.metadata.packageSha256)
    : isDnaChatEngineResponseAuthentic(runtime.answer)
}
