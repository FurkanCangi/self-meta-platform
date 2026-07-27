#!/usr/bin/env node

import { runSelfTests } from "./dna-open-development-adversarial-bank.mjs";

try {
  const result = runSelfTests();
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
}
