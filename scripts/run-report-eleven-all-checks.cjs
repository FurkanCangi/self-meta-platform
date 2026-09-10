// Local-only Report regression orchestration. No production or provider access.
const fs = require("node:fs")
const path = require("node:path")
const { spawnSync } = require("node:child_process")
const output = path.resolve(process.env.REPORT_ELEVEN_OUTPUT || "output-eleven")
fs.mkdirSync(output, { recursive: true })
const commands = [
  ["compile-exact10", "./node_modules/.bin/tsc", ["-p", "tsconfig.report-eleven.json"]],
  ["compile-regression", "./node_modules/.bin/tsc", ["-p", "tsconfig.report-live-release.json", "--outDir", "compiled-regression"]],
  ...[
    "run-report-eleven-regression", "run-assessment-scoring-tests",
    "run-report-forbidden-imports", "run-report-privacy", "run-literature-integrity-tests",
  ].map(name => [name, process.execPath, [`compiled-eleven/scripts/${name}.js`]]),
  ...[
    "run-report-jury-readiness-tests", "run-report-zero-cost-language-hardening-tests",
    "run-report-form-dump-regression-tests", "run-report-surface-heading-compat-tests",
    "run-report-product-surface-integration",
  ].map(name => [name, process.execPath, [`compiled-regression/scripts/${name}.js`]]),
]
const results = []
for (const [name, command, args] of commands) {
  const started = Date.now()
  const result = spawnSync(command, args, { encoding: "utf8", env: process.env, maxBuffer: 8 * 1024 * 1024 })
  const row = { name, pass: result.status === 0, exitCode: result.status, durationMs: Date.now() - started, stdout: result.stdout, stderr: result.stderr }
  results.push(row)
  fs.writeFileSync(path.join(output, "test-logs.json"), JSON.stringify(results, null, 2))
  console.log(JSON.stringify({ name, pass: row.pass, exitCode: row.exitCode }))
  if (!row.pass) { console.error(result.stderr || result.stdout); process.exitCode = 1; break }
}
