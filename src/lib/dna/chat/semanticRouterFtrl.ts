export const DNA_SEMANTIC_ROUTER_FEATURE_DIMENSION = 16_384 as const
export const DNA_SEMANTIC_ROUTER_HASH_SEED = 2_026_0803 as const

export type DnaSemanticRouterTrainingExample = Readonly<{
  text: string
  labels: readonly string[]
  contextTokens?: readonly string[]
}>

export type DnaSemanticRouterArtifact = Readonly<{
  schemaVersion: "dna-semantic-router-artifact@1"
  routerVersion: "dna-semantic-router@1"
  modelVersion: string
  algorithm: "ftrl_proximal_ovr"
  featureDimension: typeof DNA_SEMANTIC_ROUTER_FEATURE_DIMENSION
  hashSeed: typeof DNA_SEMANTIC_ROUTER_HASH_SEED
  labels: readonly string[]
  thresholds: Readonly<Record<string, number>>
  trainingCorpusSha256: string
  holdoutExclusionSha256: string
  trainedAt: string
  hyperparameters: Readonly<{
    alpha: number
    beta: number
    l1: number
    l2: number
    epochs: number
  }>
  labelWeights: readonly Readonly<{
    label: string
    bias: number
    weights: readonly (readonly [number, number])[]
  }>[]
}>

type FtrlState = {
  z: Map<number, number>
  n: Map<number, number>
  biasZ: number
  biasN: number
}

const encoder = new TextEncoder()

export function stableDnaSemanticHash(value: string, seed = DNA_SEMANTIC_ROUTER_HASH_SEED) {
  let hash = (2_166_136_261 ^ seed) >>> 0
  for (const byte of encoder.encode(value)) {
    hash ^= byte
    hash = Math.imul(hash, 16_777_619) >>> 0
  }
  return hash >>> 0
}

export function normalizeDnaSemanticText(value: string) {
  return String(value || "")
    .toLocaleLowerCase("tr-TR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ı/g, "i")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

export function extractDnaSemanticFeatures(
  text: string,
  contextTokens: readonly string[] = [],
) {
  const normalized = normalizeDnaSemanticText(text)
  const words = normalized.split(" ").filter(Boolean)
  const raw = new Set<string>(["bias"])
  for (const word of words) raw.add(`w:${word}`)
  for (let index = 0; index < words.length - 1; index += 1) {
    raw.add(`b:${words[index]}_${words[index + 1]}`)
  }
  const compact = `^${normalized.replace(/\s/g, "_")}$`
  for (let size = 3; size <= 5; size += 1) {
    for (let index = 0; index <= compact.length - size; index += 1) {
      raw.add(`c${size}:${compact.slice(index, index + size)}`)
    }
  }
  for (const token of contextTokens) raw.add(`ctx:${normalizeDnaSemanticText(token)}`)
  return [...raw]
    .map((feature) => stableDnaSemanticHash(feature) % DNA_SEMANTIC_ROUTER_FEATURE_DIMENSION)
    .sort((left, right) => left - right)
    .filter((feature, index, all) => index === 0 || feature !== all[index - 1])
}

function ftrlWeight(z: number, n: number, input: DnaSemanticRouterArtifact["hyperparameters"]) {
  if (Math.abs(z) <= input.l1) return 0
  return -(z - Math.sign(z) * input.l1) /
    ((input.beta + Math.sqrt(n)) / input.alpha + input.l2)
}

function sigmoid(value: number) {
  return 1 / (1 + Math.exp(-Math.max(-35, Math.min(35, value))))
}

export function trainDnaSemanticRouter(input: Readonly<{
  examples: readonly DnaSemanticRouterTrainingExample[]
  labels: readonly string[]
  modelVersion: string
  trainedAt: string
  trainingCorpusSha256: string
  holdoutExclusionSha256: string
  hyperparameters: DnaSemanticRouterArtifact["hyperparameters"]
}>): DnaSemanticRouterArtifact {
  const labels = [...input.labels].sort()
  const states = new Map<string, FtrlState>(labels.map((label) => [
    label,
    { z: new Map(), n: new Map(), biasZ: 0, biasN: 0 },
  ]))
  const ordered = [...input.examples].sort((left, right) =>
    stableDnaSemanticHash(`${left.text}:${left.labels.join(",")}`) -
    stableDnaSemanticHash(`${right.text}:${right.labels.join(",")}`))

  for (const label of labels) {
    const state = states.get(label)!
    const positives = ordered.filter((row) => row.labels.includes(label))
    const negatives = ordered
      .filter((row) => !row.labels.includes(label))
      .sort((left, right) =>
        stableDnaSemanticHash(`${label}:${left.text}`) - stableDnaSemanticHash(`${label}:${right.text}`))
      .slice(0, Math.max(positives.length * 2, 160))
    const rows = [...positives, ...negatives]
    for (let epoch = 0; epoch < input.hyperparameters.epochs; epoch += 1) {
      const epochRows = [...rows].sort((left, right) =>
        stableDnaSemanticHash(`${label}:${epoch}:${left.text}`) -
        stableDnaSemanticHash(`${label}:${epoch}:${right.text}`))
      for (const row of epochRows) {
        const features = extractDnaSemanticFeatures(row.text, row.contextTokens)
        const target = row.labels.includes(label) ? 1 : 0
        const bias = ftrlWeight(state.biasZ, state.biasN, input.hyperparameters)
        let score = bias
        for (const feature of features) {
          score += ftrlWeight(
            state.z.get(feature) ?? 0,
            state.n.get(feature) ?? 0,
            input.hyperparameters,
          )
        }
        const gradient = (sigmoid(score) - target) * (target ? 2 : 1)
        const biasSigma = (Math.sqrt(state.biasN + gradient ** 2) - Math.sqrt(state.biasN)) /
          input.hyperparameters.alpha
        state.biasZ += gradient - biasSigma * bias
        state.biasN += gradient ** 2
        for (const feature of features) {
          const previousN = state.n.get(feature) ?? 0
          const previousZ = state.z.get(feature) ?? 0
          const weight = ftrlWeight(previousZ, previousN, input.hyperparameters)
          const sigma = (Math.sqrt(previousN + gradient ** 2) - Math.sqrt(previousN)) /
            input.hyperparameters.alpha
          state.z.set(feature, previousZ + gradient - sigma * weight)
          state.n.set(feature, previousN + gradient ** 2)
        }
      }
    }
  }

  const labelWeights = labels.map((label) => {
    const state = states.get(label)!
    const weights = [...state.z.keys()].flatMap((feature) => {
      const weight = ftrlWeight(
        state.z.get(feature) ?? 0,
        state.n.get(feature) ?? 0,
        input.hyperparameters,
      )
      return Math.abs(weight) >= 0.001
        ? [[feature, Number(weight.toFixed(6))] as const]
        : []
    }).sort((left, right) => left[0] - right[0])
    return Object.freeze({
      label,
      bias: Number(ftrlWeight(state.biasZ, state.biasN, input.hyperparameters).toFixed(6)),
      weights: Object.freeze(weights),
    })
  })
  return Object.freeze({
    schemaVersion: "dna-semantic-router-artifact@1",
    routerVersion: "dna-semantic-router@1",
    modelVersion: input.modelVersion,
    algorithm: "ftrl_proximal_ovr",
    featureDimension: DNA_SEMANTIC_ROUTER_FEATURE_DIMENSION,
    hashSeed: DNA_SEMANTIC_ROUTER_HASH_SEED,
    labels: Object.freeze(labels),
    thresholds: Object.freeze(Object.fromEntries(labels.map((label) => [label, 0.5]))),
    trainingCorpusSha256: input.trainingCorpusSha256,
    holdoutExclusionSha256: input.holdoutExclusionSha256,
    trainedAt: input.trainedAt,
    hyperparameters: Object.freeze({ ...input.hyperparameters }),
    labelWeights: Object.freeze(labelWeights),
  })
}

const inferenceCache = new WeakMap<object, {
  biases: number[]
  featureWeights: Map<number, Array<[number, number]>>
}>()
const predictionCache = new WeakMap<object, Map<string, Array<{ label: string; probability: number }>>>()

export function predictDnaSemanticRouter(
  artifact: DnaSemanticRouterArtifact,
  text: string,
  contextTokens: readonly string[] = [],
) {
  let cachedPredictions = predictionCache.get(artifact)
  if (!cachedPredictions) {
    cachedPredictions = new Map()
    predictionCache.set(artifact, cachedPredictions)
  }
  const cacheKey = `${text}\u0000${contextTokens.join("\u0001")}`
  const cached = cachedPredictions.get(cacheKey)
  if (cached) return cached
  let indexed = inferenceCache.get(artifact)
  if (!indexed) {
    const featureWeights = new Map<number, Array<[number, number]>>()
    const biases = artifact.labels.map((label, labelIndex) => {
      const entry = artifact.labelWeights.find((row) => row.label === label)
      if (!entry) throw new Error(`dna_semantic_router_missing_label:${label}`)
      for (const [feature, weight] of entry.weights) {
        const bucket = featureWeights.get(feature) ?? []
        bucket.push([labelIndex, weight])
        featureWeights.set(feature, bucket)
      }
      return entry.bias
    })
    indexed = { biases, featureWeights }
    inferenceCache.set(artifact, indexed)
  }
  const scores = [...indexed.biases]
  for (const feature of extractDnaSemanticFeatures(text, contextTokens)) {
    for (const [labelIndex, weight] of indexed.featureWeights.get(feature) ?? []) {
      scores[labelIndex] += weight
    }
  }
  const result = artifact.labels.map((label, index) => ({
    label,
    probability: sigmoid(scores[index]),
  })).sort((left, right) =>
    right.probability - left.probability || left.label.localeCompare(right.label))
  if (cachedPredictions.size >= 4_096) cachedPredictions.clear()
  cachedPredictions.set(cacheKey, result)
  return result
}
