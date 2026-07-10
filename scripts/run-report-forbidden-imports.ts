import fs from "node:fs/promises"
import path from "node:path"

const ROOT = process.cwd()
const ENTRYPOINT = path.join(ROOT, "src/app/api/ai-report/route.ts")
const LEGACY_MODULES = [
  "aiRewrite",
  "rewriteClinicalReport",
  "aiClinicalPrompt",
  "aiReportService",
  "aiReportPrompt",
  "ragSelector",
  "proRag",
]
const FORBIDDEN_TEXT_PATTERNS = [
  /\bfrom\s+["'][^"']*openai[^"']*["']/i,
  /\bnew\s+OpenAI\b/i,
  /\bOPENAI_API_KEY\b/i,
  /\bOPENAI_REPORT_MODEL\b/i,
  /\bresponses\.(?:create|parse)\b/i,
  /\bchat\.completions\b/i,
  /\baxios\s*\(/i,
]

function isProductionIgnored(filePath: string): boolean {
  return /\.(bak|debug|fixregex)(?:\.|$)/i.test(filePath)
}

function resolveImport(fromFile: string, specifier: string): string | null {
  if (specifier.startsWith("@/")) {
    return resolveCandidate(path.join(ROOT, "src", specifier.slice(2)))
  }
  if (specifier.startsWith(".")) {
    return resolveCandidate(path.resolve(path.dirname(fromFile), specifier))
  }
  return null
}

function resolveCandidate(base: string): string | null {
  const candidates = [
    base,
    `${base}.ts`,
    `${base}.tsx`,
    `${base}.js`,
    `${base}.jsx`,
    path.join(base, "index.ts"),
    path.join(base, "index.tsx"),
  ]
  return candidates.find((candidate) => fsSyncExists(candidate)) || null
}

function fsSyncExists(filePath: string): boolean {
  try {
    require("node:fs").accessSync(filePath)
    return true
  } catch {
    return false
  }
}

function extractImports(source: string): string[] {
  const imports = new Set<string>()
  for (const match of source.matchAll(/\bimport\s+(?:type\s+)?(?:[^"']+from\s+)?["']([^"']+)["']/g)) {
    imports.add(match[1])
  }
  for (const match of source.matchAll(/\bexport\s+(?:type\s+)?[^"']*from\s+["']([^"']+)["']/g)) {
    imports.add(match[1])
  }
  for (const match of source.matchAll(/\bimport\s*\(\s*["']([^"']+)["']\s*\)/g)) {
    imports.add(match[1])
  }
  return Array.from(imports)
}

async function walkGraph(entrypoint: string) {
  const visited = new Set<string>()
  const stack = [entrypoint]
  while (stack.length) {
    const current = stack.pop()!
    if (visited.has(current) || isProductionIgnored(current)) continue
    visited.add(current)
    const source = await fs.readFile(current, "utf8")
    for (const specifier of extractImports(source)) {
      const resolved = resolveImport(current, specifier)
      if (resolved && resolved.startsWith(ROOT)) stack.push(resolved)
    }
  }
  return Array.from(visited).sort((a, b) => a.localeCompare(b))
}

async function main() {
  const files = await walkGraph(ENTRYPOINT)
  const failures: string[] = []
  const warnings: string[] = []

  for (const file of files) {
    const rel = path.relative(ROOT, file)
    const source = await fs.readFile(file, "utf8")
    for (const legacy of LEGACY_MODULES) {
      if (new RegExp(`\\b${legacy}\\b`).test(source)) {
        failures.push(`${rel}: production graph içinde legacy AI/RAG referansı bulundu: ${legacy}`)
      }
    }
    for (const pattern of FORBIDDEN_TEXT_PATTERNS) {
      if (pattern.test(source)) {
        failures.push(`${rel}: production graph içinde yasak model/API kullanımı bulundu: ${pattern}`)
      }
    }
  }

  const dnaFiles = await fs.readdir(path.join(ROOT, "src/lib/dna"))
  for (const file of dnaFiles) {
    if (/\.(bak|debug|fixregex)(?:\.|$)/i.test(file)) warnings.push(`src/lib/dna/${file}`)
  }

  console.log("=== REPORT FORBIDDEN IMPORTS ===")
  console.log(`Production graph dosya sayısı: ${files.length}`)
  if (warnings.length) {
    console.log(`Hijyen uyarısı (.bak/.debug/.fixregex): ${warnings.length}`)
    warnings.slice(0, 10).forEach((warning) => console.log(`- ${warning}`))
  }
  if (failures.length) {
    console.error("FAIL")
    failures.forEach((failure) => console.error(`- ${failure}`))
    process.exit(1)
  }
  console.log("PASS: production report path harici model, runtime retrieval veya model API çağrısı içermiyor.")
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
