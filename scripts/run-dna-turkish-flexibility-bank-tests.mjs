#!/usr/bin/env node

import { test } from "./dna-turkish-flexibility-bank.mjs"

try {
  process.stdout.write(`${JSON.stringify(test(), null, 2)}\n`)
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
  process.exitCode = 1
}
