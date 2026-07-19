import assert from "node:assert/strict"
import { statSync } from "node:fs"
import fs from "node:fs/promises"
import path from "node:path"

const ROOT = process.cwd()
const ENTRYPOINT = path.join(ROOT, "src/app/api/app/dna-chat/route.ts")
const CHAT_ROOT = path.join(ROOT, "src/lib/dna/chat")
const SERVER_ONLY_BOUNDARIES = new Set([
  "src/lib/dna/chat/ownedCaseAnswer.ts",
  "src/lib/dna/chat/v3RetrievalServer.ts",
  "src/lib/dna/chat/catalog/generated/v3/server.ts",
])

const REQUIRED_GRAPH_FILES = [
  "src/app/api/app/dna-chat/route.ts",
  "src/lib/dna/chat/index.ts",
  "src/lib/dna/chat/apiResolver.ts",
  "src/lib/dna/chat/engine.ts",
  "src/lib/dna/chat/catalogReasoning.ts",
  "src/lib/dna/chat/safety.ts",
  "src/lib/dna/chat/intendedUse.ts",
] as const

const FORBIDDEN_MODULE_PATTERNS = [
  /(?:^|[/@])openai(?:$|\/)/i,
  /anthropic/i,
  /cohere/i,
  /generative-ai/i,
  /vertexai/i,
  /bedrock/i,
  /langchain/i,
  /llamaindex/i,
  /pinecone/i,
  /chroma(?:db)?/i,
  /qdrant/i,
  /weaviate/i,
  /voyageai/i,
  /huggingface.*inference/i,
] as const

const FORBIDDEN_RUNTIME_PATTERNS = [
  { name: "fetch", pattern: /\bfetch\s*\(/ },
  { name: "XMLHttpRequest", pattern: /\bXMLHttpRequest\b/ },
  { name: "WebSocket", pattern: /\bnew\s+WebSocket\b/ },
  { name: "EventSource", pattern: /\bnew\s+EventSource\b/ },
  { name: "http request", pattern: /\bhttps?\s*\.\s*(?:request|get)\s*\(/ },
  { name: "axios", pattern: /\baxios\s*(?:\.|\()/ },
  { name: "model credential", pattern: /\b(?:OPENAI|ANTHROPIC|COHERE|GEMINI|GOOGLE_AI|MODEL_API)_?(?:API_?)?KEY\b/i },
  { name: "model generation call", pattern: /\b(?:responses\.create|chat\.completions|generateContent|invokeModel)\b/ },
] as const

type ParsedImports = {
  specifiers: string[]
  nonLiteralDynamicImport: boolean
  nonLiteralRequire: boolean
}

function exists(filePath: string): boolean {
  try {
    return statSync(filePath).isFile()
  } catch {
    return false
  }
}

function resolveCandidate(base: string): string | null {
  const candidates = [
    base,
    `${base}.ts`,
    `${base}.tsx`,
    `${base}.js`,
    `${base}.jsx`,
    `${base}.json`,
    path.join(base, "index.ts"),
    path.join(base, "index.tsx"),
    path.join(base, "index.js"),
  ]
  return candidates.find(exists) ?? null
}

function resolveLocalImport(fromFile: string, specifier: string): string | null {
  if (specifier.startsWith("@/")) {
    return resolveCandidate(path.join(ROOT, "src", specifier.slice(2)))
  }
  if (specifier.startsWith(".")) {
    return resolveCandidate(path.resolve(path.dirname(fromFile), specifier))
  }
  return null
}

function parseImports(source: string): ParsedImports {
  const specifiers = new Set<string>()
  const literalPatterns = [
    /\bimport\s+(?:type\s+)?(?:[^"']+from\s+)?["']([^"']+)["']/g,
    /\bexport\s+(?:type\s+)?[^"']*from\s+["']([^"']+)["']/g,
    /\bimport\s*\(\s*["']([^"']+)["']\s*\)/g,
    /\brequire\s*\(\s*["']([^"']+)["']\s*\)/g,
  ]
  for (const pattern of literalPatterns) {
    for (const match of source.matchAll(pattern)) specifiers.add(match[1])
  }
  const dynamicCalls = [...source.matchAll(/\bimport\s*\(([^)]*)\)/g)]
  const nonLiteralDynamicImport = dynamicCalls.some((match) => !/^\s*["'][^"']+["']\s*$/.test(match[1]))
  const requireCalls = [...source.matchAll(/\brequire\s*\(([^)]*)\)/g)]
  const nonLiteralRequire = requireCalls.some((match) => !/^\s*["'][^"']+["']\s*$/.test(match[1]))
  return { specifiers: [...specifiers], nonLiteralDynamicImport, nonLiteralRequire }
}

async function walkGraph(entrypoint: string) {
  const visited = new Set<string>()
  const unresolved: string[] = []
  const externalSpecifiers = new Set<string>()
  const stack = [entrypoint]

  while (stack.length) {
    const current = stack.pop()!
    if (visited.has(current)) continue
    visited.add(current)
    const source = await fs.readFile(current, "utf8")
    const parsed = parseImports(source)
    if (parsed.nonLiteralDynamicImport) {
      unresolved.push(`${path.relative(ROOT, current)}: non-literal dynamic import`)
    }
    if (parsed.nonLiteralRequire) {
      unresolved.push(`${path.relative(ROOT, current)}: non-literal require`)
    }
    for (const specifier of parsed.specifiers) {
      const isLocal = specifier.startsWith("@/") || specifier.startsWith(".")
      if (!isLocal) {
        if (!specifier.startsWith("node:")) externalSpecifiers.add(specifier)
        continue
      }
      const resolved = resolveLocalImport(current, specifier)
      if (!resolved) {
        unresolved.push(`${path.relative(ROOT, current)} -> ${specifier}`)
        continue
      }
      if (!resolved.startsWith(ROOT)) {
        unresolved.push(`${path.relative(ROOT, current)} -> outside workspace: ${resolved}`)
        continue
      }
      stack.push(resolved)
    }
  }

  return {
    files: [...visited].sort((left, right) => left.localeCompare(right, "en")),
    unresolved: unresolved.sort((left, right) => left.localeCompare(right, "en")),
    externalSpecifiers: [...externalSpecifiers].sort((left, right) => left.localeCompare(right, "en")),
  }
}

async function main() {
  const parserControl = parseImports('import OpenAI from "openai"; const local = require("./local")')
  assert.ok(parserControl.specifiers.includes("openai"), "Import parser control failed for external module")
  assert.ok(FORBIDDEN_MODULE_PATTERNS.some((pattern) => pattern.test("openai")), "Forbidden module control failed")
  assert.ok(FORBIDDEN_RUNTIME_PATTERNS.some((row) => row.pattern.test("fetch('https://example.test')")), "Runtime network control failed")
  assert.equal(parseImports("import(moduleName)").nonLiteralDynamicImport, true)
  assert.equal(parseImports("require(moduleName)").nonLiteralRequire, true)

  const graph = await walkGraph(ENTRYPOINT)
  assert.deepEqual(graph.unresolved, [], "DNA chat import grafında çözülemeyen veya dinamik import olmamalı")

  const relativeFiles = graph.files.map((file) => path.relative(ROOT, file))
  for (const required of REQUIRED_GRAPH_FILES) {
    assert.ok(relativeFiles.includes(required), `DNA chat import grafı zorunlu dosyayı kapsamıyor: ${required}`)
  }

  const failures: string[] = []
  for (const specifier of graph.externalSpecifiers) {
    if (FORBIDDEN_MODULE_PATTERNS.some((pattern) => pattern.test(specifier))) {
      failures.push(`forbidden external module: ${specifier}`)
    }
  }

  const chatFiles = graph.files.filter((file) => file === CHAT_ROOT || file.startsWith(`${CHAT_ROOT}${path.sep}`))
  assert.ok(chatFiles.length >= 15, `DNA chat yerel import grafı beklenenden dar: ${chatFiles.length}`)
  for (const file of chatFiles) {
    const source = await fs.readFile(file, "utf8")
    const parsed = parseImports(source)
    for (const specifier of parsed.specifiers) {
      if (specifier === "server-only") {
        if (!SERVER_ONLY_BOUNDARIES.has(path.relative(ROOT, file))) {
          failures.push(`${path.relative(ROOT, file)}: unregistered server-only boundary`)
        }
        continue
      }
      if (!specifier.startsWith(".") && !specifier.startsWith("@/") && !specifier.startsWith("node:")) {
        failures.push(`${path.relative(ROOT, file)}: chat runtime external dependency: ${specifier}`)
      }
    }
    for (const forbidden of FORBIDDEN_RUNTIME_PATTERNS) {
      if (forbidden.pattern.test(source)) {
        failures.push(`${path.relative(ROOT, file)}: forbidden runtime primitive: ${forbidden.name}`)
      }
    }
  }

  assert.deepEqual(failures, [], failures.join("\n"))
  console.log(JSON.stringify({
    ok: true,
    entrypoint: path.relative(ROOT, ENTRYPOINT),
    graphFiles: graph.files.length,
    chatRuntimeFiles: chatFiles.length,
    unresolvedImports: graph.unresolved.length,
    externalSpecifiers: graph.externalSpecifiers,
    externalModelModules: 0,
    chatRuntimeNetworkPrimitives: 0,
    serverOnlyRuntimeBoundaries: [...SERVER_ONLY_BOUNDARIES].sort(),
  }, null, 2))
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
