import assert from "node:assert/strict"
import { closeSync, existsSync, fsyncSync, mkdirSync, openSync, readFileSync, realpathSync, unlinkSync, writeFileSync } from "node:fs"
import path from "node:path"
import { replayHash, type StudentReplayInput, type StudentReplayTurn, type createStudentApplicationReplaySession } from "./dna-student-application-replay"

type Event = { key: string; inputSha256: string; stage: "started" | "completed"; value?: unknown; valueSha256?: string }
/** Append-before-call prevents a crash, transport uncertainty, or a failed
 * judgment from silently causing regeneration/rejudging on the next run. */
export function createStudentReplayJournal(io: { read(): string; append(line: string): void }) {
  const entries = new Map<string, Event>()
  for (const line of io.read().split(/\r?\n/).filter(Boolean)) {
    const event = JSON.parse(line) as Event
    assert.ok(event.key && /^[a-f0-9]{64}$/.test(event.inputSha256), "journal_invalid_event")
    const before = entries.get(event.key)
    if (event.stage === "started") assert.equal(before, undefined, "journal_duplicate_attempt")
    else {
      assert.equal(event.stage, "completed", "journal_invalid_stage")
      assert.equal(before?.stage, "started", "journal_completion_without_start")
      assert.equal(before.inputSha256, event.inputSha256, "journal_input_changed")
      assert.equal(event.valueSha256, replayHash(JSON.stringify(event.value)), "journal_value_tampered")
    }
    entries.set(event.key, event)
  }
  const lookup = <T>(key: string, input: unknown): T | undefined => {
    const entry = entries.get(key)
    if (!entry) return undefined
    assert.equal(entry.inputSha256, replayHash(JSON.stringify(input)), "journal_input_changed")
    assert.equal(entry.stage, "completed", "journal_indeterminate_attempt_do_not_retry")
    return entry.value as T
  }
  return {
    lookup,
    async once<T>(key: string, input: unknown, run: () => Promise<T>): Promise<T> {
      const prior = lookup<T>(key, input)
      if (prior !== undefined) return prior
      const started: Event = { key, inputSha256: replayHash(JSON.stringify(input)), stage: "started" }
      io.append(`${JSON.stringify(started)}\n`)
      entries.set(key, started)
      const value = await run()
      assert.notEqual(value, undefined, "journal_result_missing")
      const completed: Event = { ...started, stage: "completed", value, valueSha256: replayHash(JSON.stringify(value)) }
      io.append(`${JSON.stringify(completed)}\n`)
      entries.set(key, completed)
      return value
    },
  }
}

export function openStudentReplayJournal(suite: string, candidate: string, replay: string) {
  assert.match(suite, /^[a-z0-9-]+$/)
  assert.match(candidate, /^[a-f0-9]{64}$/)
  assert.match(replay, /^[a-f0-9]{64}$/)
  const root = "/Volumes/ResearchSSD"
  assert.ok(existsSync(root), "ResearchSSD_not_mounted_no_local_replay_fallback")
  assert.equal(realpathSync(root), root, "ResearchSSD_mount_path_redirected")
  const outputRoot = path.join(root, "Outputs")
  assert.ok(existsSync(outputRoot), "ResearchSSD_Outputs_missing")
  const directory = path.join(outputRoot, "SelfMetaAI", "dna-student-application-replay", candidate, replay)
  // Verify existing ancestors before mkdir, so a symlink cannot redirect even
  // the directory creation to the internal disk.
  for (let parent = directory; parent !== root; parent = path.dirname(parent)) {
    if (existsSync(parent)) assert.ok(realpathSync(parent).startsWith(`${root}/`), "replay_output_outside_ResearchSSD")
  }
  mkdirSync(directory, { recursive: true, mode: 0o700 })
  const file = path.join(directory, `${suite}.jsonl`)
  if (existsSync(file)) assert.ok(realpathSync(file).startsWith(`${root}/`), "replay_journal_outside_ResearchSSD")
  // The per-process journal cannot race a second runner for the same answers.
  // A killed process leaves the lock in place: inspect its actual process
  // before recovery, never infer a safe restart just from an old timestamp.
  const lockFile = `${file}.lock`
  const lock = openSync(lockFile, "wx", 0o600)
  writeFileSync(lock, JSON.stringify({ pid: process.pid, purpose: "single-writer-student-replay" }))
  fsyncSync(lock)
  let released = false
  const release = () => {
    if (released) return
    released = true
    closeSync(lock)
    unlinkSync(lockFile)
  }
  process.once("exit", release)
  return { file, journal: createStudentReplayJournal({
    read: () => existsSync(file) ? readFileSync(file, "utf8") : "",
    append: (line) => {
      const fd = openSync(file, "a", 0o600)
      try { writeFileSync(fd, line); fsyncSync(fd) } finally { closeSync(fd) }
    },
  }) }
}

export async function journalApplicationTurn(
  journal: ReturnType<typeof createStudentReplayJournal>, key: string,
  session: ReturnType<typeof createStudentApplicationReplaySession>, input: StudentReplayInput,
): Promise<StudentReplayTurn> {
  const prior = journal.lookup<StudentReplayTurn>(key, input)
  if (prior) return session.restore(input, prior)
  return journal.once(key, input, () => session.turn(input))
}
