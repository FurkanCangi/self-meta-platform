import { existsSync, readFileSync, statSync } from "node:fs"
import {
  dirname,
  extname,
  isAbsolute,
  join,
  relative,
  resolve,
  sep,
} from "node:path"

const LOCAL_MODULE_EXTENSIONS = Object.freeze([
  ".ts",
  ".tsx",
  ".mts",
  ".cts",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".json",
] as const)

const EXECUTABLE_SOURCE_EXTENSION = /\.(?:[cm]?[jt]s|[jt]sx)$/

function toProjectPath(value: string): string {
  return value.split(sep).join("/")
}

function compareProjectPaths(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0
}

function isFile(value: string): boolean {
  try {
    return statSync(value).isFile()
  } catch {
    return false
  }
}

function importedSpecifiers(source: string, relativePath: string): readonly string[] {
  const specifiers = new Set<string>()
  const literalPatterns = [
    /\bimport\s+(?:type\s+)?(?:[^"']+?\s+from\s+)?["']([^"']+)["']/g,
    /\bexport\s+(?:type\s+)?(?:\*(?:\s+as\s+[A-Za-z_$][\w$]*)?|\{[^}]*\})\s+from\s+["']([^"']+)["']/g,
    /\bimport\s*\(\s*["']([^"']+)["']\s*\)/g,
    /\brequire\s*\(\s*["']([^"']+)["']\s*\)/g,
  ]
  for (const pattern of literalPatterns) {
    for (const match of source.matchAll(pattern)) specifiers.add(match[1]!)
  }

  for (const match of source.matchAll(/\b(?:import|require)\s*\(([^)]*)\)/g)) {
    if (!/^\s*["'][^"']+["']\s*$/.test(match[1]!)) {
      throw new Error(`dna_evaluation_engine_non_literal_local_import_unknown:${relativePath}`)
    }
  }
  return Object.freeze([...specifiers].sort(compareProjectPaths))
}

function resolveLocalModule(input: Readonly<{
  projectRoot: string
  importer: string
  specifier: string
}>): string | null {
  if (!input.specifier.startsWith(".") && !input.specifier.startsWith("@/")) return null
  const absoluteBase = input.specifier.startsWith("@/")
    ? resolve(input.projectRoot, "src", input.specifier.slice(2))
    : resolve(input.projectRoot, dirname(input.importer), input.specifier)
  const candidates = extname(absoluteBase)
    ? [absoluteBase]
    : [
        absoluteBase,
        ...LOCAL_MODULE_EXTENSIONS.map((extension) => `${absoluteBase}${extension}`),
        ...LOCAL_MODULE_EXTENSIONS.map((extension) => join(absoluteBase, `index${extension}`)),
      ]
  const resolvedFile = candidates.find((candidate) => existsSync(candidate) && isFile(candidate))
  if (!resolvedFile) {
    throw new Error(
      `dna_evaluation_engine_local_import_unresolved:${input.importer}:${input.specifier}`,
    )
  }
  const relativePath = relative(input.projectRoot, resolvedFile)
  if (!relativePath || relativePath.startsWith("..") || isAbsolute(relativePath)) {
    throw new Error(`dna_evaluation_engine_local_import_outside_project:${resolvedFile}`)
  }
  return toProjectPath(relativePath)
}

/**
 * Deterministically follows every relative and `@/` import/export from the
 * committed engine roots. The caller supplies the single documented
 * self-referential attestation exclusion.
 */
export function collectDnaEvaluationEngineSourceClosure(input: Readonly<{
  projectRoot: string
  roots: readonly string[]
  exclusions?: readonly string[]
}>): readonly string[] {
  const projectRoot = resolve(input.projectRoot)
  const exclusions = new Set((input.exclusions ?? []).map(toProjectPath))
  const pending = [...new Set(input.roots.map(toProjectPath))]
    .sort((left, right) => compareProjectPaths(right, left))
  const visited = new Set<string>()

  while (pending.length) {
    const current = pending.pop()!
    if (visited.has(current) || exclusions.has(current)) continue
    const absolutePath = resolve(projectRoot, current)
    const projectRelative = relative(projectRoot, absolutePath)
    if (projectRelative.startsWith("..") || isAbsolute(projectRelative) || !isFile(absolutePath)) {
      throw new Error(`dna_evaluation_engine_source_missing_or_outside_project:${current}`)
    }
    visited.add(current)
    if (!EXECUTABLE_SOURCE_EXTENSION.test(current)) continue

    const source = readFileSync(absolutePath, "utf8")
    for (const specifier of importedSpecifiers(source, current)) {
      const dependency = resolveLocalModule({ projectRoot, importer: current, specifier })
      if (dependency && !visited.has(dependency) && !exclusions.has(dependency)) {
        pending.push(dependency)
      }
    }
    pending.sort((left, right) => compareProjectPaths(right, left))
  }

  return Object.freeze([...visited].sort(compareProjectPaths))
}
