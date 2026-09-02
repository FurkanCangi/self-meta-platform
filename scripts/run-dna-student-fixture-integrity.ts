import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import { join } from "node:path"

const ROOT = join(process.cwd(), "scripts", "dna-student-fixtures")

type Expected = Readonly<{
  operation: string
  targetIds: readonly string[]
  requiredObligationKinds?: readonly string[]
}>

type HoldoutGoldExpected = Readonly<{
  turnId: string
  operation: string
  targetIds: readonly string[]
  required: readonly string[]
}>

type Turn = Readonly<{ turnId: string; user: string; expected?: Expected }>
type Conversation = Readonly<{ conversationId: string; turns: readonly Turn[] }>

function readJson<T>(name: string): T {
  return JSON.parse(readFileSync(join(ROOT, name), "utf8")) as T
}

function sha256(name: string): string {
  return createHash("sha256").update(readFileSync(join(ROOT, name))).digest("hex")
}

function normalized(value: string): string {
  return value.toLocaleLowerCase("tr-TR").normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9çğıöşü]+/giu, " ")
    .trim()
}

function flatten(conversations: readonly Conversation[]): Turn[] {
  return conversations.flatMap((conversation) => conversation.turns)
}

const manifest = readJson<{
  naturalMini24: { mutationAllowed: boolean; fixtureSha256: string; goldSha256: string }
  student40: { file: string; sha256: string; conversations: number; turns: number; certificationEligible: boolean }
  freshStudent60: {
    fixtureFile: string
    fixtureSha256: string
    goldFile: string
    goldSha256: string
    conversations: number
    turns: number
    openedAt: string | null
    evaluated: boolean
  }
}>("MANIFEST.json")

const development = readJson<{ certificationEligible: boolean; conversations: readonly Conversation[] }>(manifest.student40.file)
const holdout = readJson<{ status: string; certificationEligible: boolean; conversations: readonly Conversation[] }>(manifest.freshStudent60.fixtureFile)
const holdoutGold = readJson<{ status: string; rows: ReadonlyArray<HoldoutGoldExpected> }>(manifest.freshStudent60.goldFile)

const developmentTurns = flatten(development.conversations)
const holdoutTurns = flatten(holdout.conversations)
assert.equal(development.conversations.length, 5)
assert.equal(developmentTurns.length, 40)
assert.equal(holdout.conversations.length, 6)
assert.equal(holdoutTurns.length, 60)
assert.equal(holdoutGold.rows.length, 60)

assert.equal(development.certificationEligible, false)
assert.equal(holdout.certificationEligible, true)
assert.equal(holdout.status, "SEALED_UNOPENED")
assert.equal(holdoutGold.status, "SEALED_UNOPENED")
assert.equal(manifest.freshStudent60.openedAt, null)
assert.equal(manifest.freshStudent60.evaluated, false)
assert.equal(manifest.naturalMini24.mutationAllowed, false)

assert.equal(sha256(manifest.student40.file), manifest.student40.sha256)
assert.equal(sha256(manifest.freshStudent60.fixtureFile), manifest.freshStudent60.fixtureSha256)
assert.equal(sha256(manifest.freshStudent60.goldFile), manifest.freshStudent60.goldSha256)
assert.equal(manifest.naturalMini24.fixtureSha256, "9f146c18fe4cccf2a54aa4fa4aecd038dfecff3aee81e751f2308e6ea3845adc")
assert.equal(manifest.naturalMini24.goldSha256, "2a54904a77979b381948d7815f832013720b127a4199989087b9e3183723bc50")

const allIds = [...developmentTurns, ...holdoutTurns].map((turn) => turn.turnId)
assert.equal(new Set(allIds).size, 100, "student turn IDs must be unique")
const allMessages = [...developmentTurns, ...holdoutTurns].map((turn) => normalized(turn.user))
assert.equal(new Set(allMessages).size, 100, "student messages must be exact-normalized unique")

for (const conversation of [...development.conversations, ...holdout.conversations]) {
  assert.ok(conversation.turns.length >= 8, `${conversation.conversationId}: conversation must exercise multi-turn state`)
}
for (const turn of developmentTurns) {
  assert.ok(turn.expected)
  assert.ok(turn.expected!.targetIds.length > 0, `${turn.turnId}: target is required`)
  assert.ok((turn.expected!.requiredObligationKinds?.length ?? 0) > 0, `${turn.turnId}: obligations are required`)
}

const fixtureIds = holdoutTurns.map((turn) => turn.turnId)
const goldIds = holdoutGold.rows.map((turn) => turn.turnId)
assert.deepEqual(goldIds, fixtureIds, "holdout fixture/gold turn order must match exactly")
assert.ok(holdoutGold.rows.every((row) => row.targetIds.length > 0 && row.required.length > 0))

console.log(JSON.stringify({
  ok: true,
  naturalMini24Frozen: true,
  student40: { conversations: development.conversations.length, turns: developmentTurns.length, certificationEligible: false },
  freshStudent60: { conversations: holdout.conversations.length, turns: holdoutTurns.length, status: holdout.status, evaluated: false },
  uniqueTurnIds: allIds.length,
  uniqueMessages: allMessages.length,
}, null, 2))
