import assert from "node:assert/strict"
import { readdirSync, statSync } from "node:fs"
import path from "node:path"
import ts from "typescript"

const root = process.cwd()
const configFile = ts.readConfigFile(path.join(root, "tsconfig.json"), ts.sys.readFile)
assert.equal(configFile.error, undefined)
const config = ts.parseJsonConfigFileContent(configFile.config, ts.sys, root)
assert.equal(config.errors.length, 0)
assert.equal(config.options.strict, true, "do not suppress strict source checks")
assert.equal(config.options.noEmit, true)
const roots = new Set(config.fileNames.map((file) => path.resolve(file)))
function sources(directory: string): string[] {
  return readdirSync(directory).flatMap((name) => {
    const file = path.join(directory, name)
    return statSync(file).isDirectory() ? sources(file) : /\.tsx?$/.test(file) ? [file] : []
  })
}
const applicationSources = sources(path.join(root, "src"))
assert.ok(applicationSources.length > 0)
for (const file of applicationSources) assert.ok(roots.has(file), `application_source_excluded:${path.relative(root, file)}`)
assert.ok(roots.has(path.join(root, "src/app/api/app/dna-chat/route.ts")))
assert.ok(roots.has(path.join(root, "src/app/dna-asistani/DnaAssistantClient.tsx")))
assert.ok(roots.has(path.join(root, "scripts/run-dna-student-one-hour-visible.ts")), "keep engineering tests in source type checks")
assert.equal([...roots].some((file) => file.startsWith(`${root}/artifacts/`) || file.startsWith(`${root}/deliverables/`)), false)

// Virtual-only compiler controls: no source, historical fixture or artifact is
// written. Exclusion affects root discovery, not dependencies imported by app code.
const virtualRoot = path.join(root, "src/__source_scope_negative_control.ts")
const virtualArchive = path.join(root, "artifacts/__source_scope_negative_control.ts")
const virtualSources = new Map([
  [virtualRoot, 'import { value } from "../artifacts/__source_scope_negative_control"; export const answer: string = value;'],
  [virtualArchive, 'export const value: string = 123;'],
])
const compilerOptions = { ...config.options, incremental: false, noEmit: true }
const host = ts.createCompilerHost(compilerOptions)
const originalFileExists = host.fileExists.bind(host)
const originalReadFile = host.readFile.bind(host)
const originalGetSourceFile = host.getSourceFile.bind(host)
host.fileExists = (file) => virtualSources.has(path.resolve(file)) || originalFileExists(file)
host.readFile = (file) => virtualSources.get(path.resolve(file)) ?? originalReadFile(file)
host.getSourceFile = (file, version, onError, shouldCreateNewSourceFile) => {
  const value = virtualSources.get(path.resolve(file))
  return value === undefined ? originalGetSourceFile(file, version, onError, shouldCreateNewSourceFile)
    : ts.createSourceFile(file, value, version, true)
}
const program = ts.createProgram([virtualRoot], compilerOptions, host)
const importedArchive = program.getSourceFile(virtualArchive)
assert.ok(importedArchive, "an imported archive dependency must still be checked")
const diagnostics = program.getSemanticDiagnostics(importedArchive)
assert.ok(diagnostics.some((diagnostic) => diagnostic.code === 2322), "imported dependency type error was hidden")
console.log(JSON.stringify({ ok: true, applicationSourcesIncluded: applicationSources.length,
  engineeringRunnerIncluded: true, historicalArchiveRootsExcluded: true,
  importedArchiveTypeErrorStillDetected: true, strictChecksPreserved: true,
  virtualControlFilesWritten: 0, nextProductionBuildTested: false }, null, 2))
