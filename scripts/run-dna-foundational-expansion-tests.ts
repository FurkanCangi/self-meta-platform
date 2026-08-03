import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"

import { resolveDnaChat } from "../src/lib/dna/chat"

import {
  DNA_CHAT_CATALOG_CLAIMS,
  DNA_CHAT_CATALOG_RELATIONS,
  DNA_CHAT_CATALOG_SOURCES,
  DNA_CHAT_CATALOG_TOPICS,
  V6_FOUNDATIONAL_EXPANSION_CLAIMS,
  V6_FOUNDATIONAL_EXPANSION_PASSAGES,
  V6_FOUNDATIONAL_EXPANSION_RELATIONS,
  V6_FOUNDATIONAL_EXPANSION_SOURCES,
  V6_FOUNDATIONAL_EXPANSION_TOPICS,
  V6_FOUNDATIONAL_EXPANSION_VERSION,
  findCatalogTopic,
} from "../src/lib/dna/chat/catalog"

function assertUnique(values: readonly string[], label: string) {
  assert.equal(new Set(values).size, values.length, `${label} benzersiz olmalı`)
}

function normalize(value: string) {
  return value
    .toLocaleLowerCase("tr-TR")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ı/g, "i")
    .replace(/ç/g, "c")
    .replace(/ğ/g, "g")
    .replace(/ö/g, "o")
    .replace(/ş/g, "s")
    .replace(/ü/g, "u")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
}

function jaccard(left: string, right: string) {
  const leftTokens = new Set(normalize(left).split(" ").filter((token) => token.length >= 3))
  const rightTokens = new Set(normalize(right).split(" ").filter((token) => token.length >= 3))
  const intersection = [...leftTokens].filter((token) => rightTokens.has(token)).length
  const union = new Set([...leftTokens, ...rightTokens]).size
  return union === 0 ? 0 : intersection / union
}

assert.equal(V6_FOUNDATIONAL_EXPANSION_VERSION, "dna-foundational-expansion@1")
assert.equal(V6_FOUNDATIONAL_EXPANSION_SOURCES.length, 4)
assert.equal(V6_FOUNDATIONAL_EXPANSION_PASSAGES.length, 37)
assert.equal(V6_FOUNDATIONAL_EXPANSION_CLAIMS.length, 37)
assert.equal(V6_FOUNDATIONAL_EXPANSION_TOPICS.length, 18)
assert.equal(V6_FOUNDATIONAL_EXPANSION_RELATIONS.length, 16)

assertUnique(V6_FOUNDATIONAL_EXPANSION_SOURCES.map((entry) => entry.id), "Genişleme source kimlikleri")
assertUnique(V6_FOUNDATIONAL_EXPANSION_PASSAGES.map((entry) => entry.id), "Genişleme passage kimlikleri")
assertUnique(V6_FOUNDATIONAL_EXPANSION_CLAIMS.map((entry) => entry.id), "Genişleme claim kimlikleri")
assertUnique(V6_FOUNDATIONAL_EXPANSION_TOPICS.map((entry) => entry.id), "Genişleme topic kimlikleri")
assertUnique(V6_FOUNDATIONAL_EXPANSION_RELATIONS.map((entry) => entry.id), "Genişleme relation kimlikleri")

const sourceIds = new Set(V6_FOUNDATIONAL_EXPANSION_SOURCES.map((entry) => entry.id))
const passageById = new Map(V6_FOUNDATIONAL_EXPANSION_PASSAGES.map((entry) => [entry.id, entry]))
const claimIds = new Set(V6_FOUNDATIONAL_EXPANSION_CLAIMS.map((entry) => entry.id))
const topicIds = new Set(V6_FOUNDATIONAL_EXPANSION_TOPICS.map((entry) => entry.id))

for (const source of V6_FOUNDATIONAL_EXPANSION_SOURCES) {
  assert.equal(source.sourceVerified, true)
  assert.equal(source.verifiedAt, "2026-08-03")
  assert.match(source.url, /^https:\/\//)
}

for (const passage of V6_FOUNDATIONAL_EXPANSION_PASSAGES) {
  assert.ok(sourceIds.has(passage.catalogSourceId), `${passage.id}: katalog kaynağı yok`)
  assert.equal(passage.licenseSpdx, "CC-BY-4.0")
  assert.equal(passage.licenseDecision, "licensed_runtime_candidate")
  assert.match(passage.sourceContentSha256, /^[a-f0-9]{64}$/)
  assert.ok(passage.supportingExcerpt.length >= 10, `${passage.id}: destekleyici alıntı çok kısa`)
}

for (const claim of V6_FOUNDATIONAL_EXPANSION_CLAIMS) {
  assert.ok(topicIds.has(claim.topicId), `${claim.id}: genişleme topic'i yok`)
  assert.equal(claim.passageIds?.length, 1, `${claim.id}: tam bir passage bağlantısı olmalı`)
  const linkedPassage = passageById.get(claim.passageIds?.[0] ?? "")
  assert.ok(linkedPassage, `${claim.id}: passage bulunamadı`)
  assert.deepEqual(claim.sourceIds, [linkedPassage.catalogSourceId], `${claim.id}: source-passage uyuşmuyor`)
  assert.ok(["none", "not_established", "theory_only"].includes(claim.dnaRelation), `${claim.id}: dış bilim DNA ürün geçerliği üretemez`)
  assert.doesNotMatch(`${claim.text} ${claim.detail}`, /(?:tedavi edilmelidir|tanı koyar|ilaç dozu|seans planı)/i)
}

for (const topic of V6_FOUNDATIONAL_EXPANSION_TOPICS) {
  assert.ok(topic.claimIds.length >= 1)
  for (const claimId of topic.claimIds) assert.ok(claimIds.has(claimId), `${topic.id}: claim yok ${claimId}`)
  for (const sourceId of topic.sourceIds) assert.ok(sourceIds.has(sourceId), `${topic.id}: source yok ${sourceId}`)
}

for (const relation of V6_FOUNDATIONAL_EXPANSION_RELATIONS) {
  assert.equal(relation.maxHops, 1)
  assert.ok(DNA_CHAT_CATALOG_TOPICS.some((topic) => topic.id === relation.fromTopicId))
  assert.ok(DNA_CHAT_CATALOG_TOPICS.some((topic) => topic.id === relation.toTopicId))
  for (const sourceId of relation.sourceIds) assert.ok(sourceIds.has(sourceId), `${relation.id}: source yok ${sourceId}`)
}

for (const source of V6_FOUNDATIONAL_EXPANSION_SOURCES) {
  assert.equal(DNA_CHAT_CATALOG_SOURCES.filter((entry) => entry.id === source.id).length, 1)
}
for (const claim of V6_FOUNDATIONAL_EXPANSION_CLAIMS) {
  assert.equal(DNA_CHAT_CATALOG_CLAIMS.filter((entry) => entry.id === claim.id).length, 1)
}
for (const relation of V6_FOUNDATIONAL_EXPANSION_RELATIONS) {
  assert.equal(DNA_CHAT_CATALOG_RELATIONS.filter((entry) => entry.id === relation.id).length, 1)
}

const expansionClaimIdSet = new Set(V6_FOUNDATIONAL_EXPANSION_CLAIMS.map((entry) => entry.id))
const previousClaims = DNA_CHAT_CATALOG_CLAIMS.filter((entry) => !expansionClaimIdSet.has(entry.id))
const previousNormalized = new Set(previousClaims.map((entry) => normalize(entry.text)))
for (const claim of V6_FOUNDATIONAL_EXPANSION_CLAIMS) {
  assert.equal(previousNormalized.has(normalize(claim.text)), false, `${claim.id}: eski claim'in yazım kopyası`)
}

let closestPair = { left: "", right: "", score: 0 }
for (const claim of V6_FOUNDATIONAL_EXPANSION_CLAIMS) {
  for (const previous of previousClaims) {
    const score = jaccard(claim.text, previous.text)
    if (score > closestPair.score) closestPair = { left: claim.id, right: previous.id, score }
  }
}
assert.ok(closestPair.score < 0.92, `Semantik kopya şüphesi: ${closestPair.left} / ${closestPair.right}`)

const routingCases: readonly (readonly [string, string])[] = [
  ["Elektrokimyasal gradyan membran potansiyelini nasıl etkiler?", "neuro.membrane_potential"],
  ["Na K pump dinlenim potansiyeline nasıl katkı verir?", "neuro.membrane_potential"],
  ["Aksiyon potansiyelinde refrakter dönem ne işe yarar?", "neuro.action_potential"],
  ["Reseptör potansiyeli ile action potential farkı ne?", "neuro.action_potential"],
  ["Saltatorik iletim ve Ranvier düğümü ilişkisini açıkla", "neuro.myelin_conduction"],
  ["Miyelinli aksonda sinyal nerede yenilenir?", "neuro.myelin_conduction"],
  ["Kimyasal sinapsta kalsiyum girişi neyi başlatır?", "neuro.chemical_synapse"],
  ["Nörotransmiter salımı ve ekzositoz aynı süreçte nasıl bağlanır?", "neuro.chemical_synapse"],
  ["İyonotropik ve metabotropik reseptör farkı nedir?", "neuro.synaptic_receptors"],
  ["GPCR ikinci haberci reseptörleri ne demek?", "neuro.synaptic_receptors"],
  ["EPSP ile IPSP arasındaki fark nedir?", "neuro.synaptic_potentials"],
  ["Sinaptik toplama aksiyon eşiğine nasıl katkı verir?", "neuro.synaptic_potentials"],
  ["Suprakiazmatik çekirdek ne yapar?", "sleep.scn"],
  ["SCN görevi ışık ve melatoninle nasıl ilişkili?", "sleep.scn"],
  ["Uyku basıncı ne demek?", "sleep.sleep_pressure"],
  ["Adenozin ve uyku arasındaki temel ilişki ne?", "sleep.sleep_pressure"],
  ["Zeitgeber nedir?", "sleep.zeitgeber"],
  ["Sirkadiyen zaman ipucu iç saati nasıl ayarlar?", "sleep.zeitgeber"],
  ["PSG bileşenleri EEG EOG EMG neyi kaydeder?", "sleep.psg"],
  ["Polisomnografi ile aktigrafi farkı nedir?", "sleep.psg"],
  ["NREM 2 evresinde uyku iğciği ve K kompleksi ne anlatır?", "sleep.sleep_stages"],
  ["Uyku evreleri nasıl ayırt edilir?", "sleep.sleep_stages"],
  ["REM uykusu ve atoni ne demek?", "sleep.rem"],
  ["REM rüyaları hakkında temel olarak ne söylenebilir?", "sleep.rem"],
  ["Otonom ganglionda preganglionik ve postganglionik nöronlar nasıl sıralanır?", "ans.autonomic_relay"],
  ["İki nöronlu otonom yol hangi ileticileri kullanır?", "ans.autonomic_relay"],
  ["Barorefleks nedir?", "ans.baroreflex"],
  ["Basınç refleksi kalp ve damarları nasıl etkiler?", "ans.baroreflex"],
  ["HRV sinyal kalitesinde artefaktlar neden önemli?", "ans.hrv_signal_quality"],
  ["Interbeat interval ile kalp hızı aynı şey mi?", "ans.hrv_signal_quality"],
  ["SDNN ile RMSSD arasındaki fark nedir?", "ans.hrv_time_domain"],
  ["HRV kayıt süresi niye standart olmalı?", "ans.hrv_time_domain"],
  ["HRV ve solunum neden birlikte değerlendirilir?", "ans.hrv_respiration"],
  ["HF HRV ile RSA aynı şey mi?", "ans.hrv_respiration"],
  ["HRV stres gösterir mi?", "ans.hrv_interpretation"],
  ["Fazik ve tonik otonom etkinlik HRV yorumunda nasıl ayrılır?", "ans.hrv_interpretation"],
]

for (const [question, expectedTopicId] of routingCases) {
  const actual = findCatalogTopic(question)?.id ?? null
  assert.equal(actual, expectedTopicId, `Yönlendirme: ${question}`)
  const repeated = Array.from({ length: 20 }, () => findCatalogTopic(question)?.id ?? null)
  assert.equal(new Set(repeated).size, 1, `${question}: yönlendirme deterministik değil`)
}

const answerCases: readonly (readonly [string, string, string])[] = [
  ["İyonotropik ve metabotropik reseptör farkı nedir?", "İyonotropik ve metabotropik reseptörler", "catalog:OPEN_PHYSIOLOGY_UW_2023"],
  ["PSG bileşenleri EEG EOG EMG neyi kaydeder?", "Polisomnografi ve uyku sinyalleri", "catalog:OPEN_SCIENCE_OF_SLEEP_2022"],
  ["HRV ve solunum neden birlikte değerlendirilir?", "HRV ve solunum", "catalog:QUIGLEY_ET_AL_2024_HRV_GUIDELINES"],
]
for (const [question, expectedTopic, expectedSourceId] of answerCases) {
  const response = resolveDnaChat({ question, responseDepth: "deep" })
  assert.equal(response.outcome, "answered", `${question}: cevap üretilemedi`)
  assert.equal(response.topic, expectedTopic, `${question}: cevap topic'i yanlış`)
  assert.ok(response.sources.some((entry) => entry.id === expectedSourceId), `${question}: kaynak kartı eksik`)
  assert.ok(response.summary.length >= 30, `${question}: özet çok kısa`)
  assert.ok(response.details.length >= 2, `${question}: derin cevap yetersiz`)
  assert.doesNotMatch(`${response.summary} ${response.details.join(" ")}`, /dna-chat-engine@|claim\.|passage\.|rule\./i)
}

const ssdRoot = process.env.RESEARCH_SSD_ROOT ?? "/Volumes/ResearchSSD"
const registeredPassagesPath = path.join(ssdRoot, "Outputs/SelfMetaAI/dna-intelligence/book-catalog-v32/v1/passages.jsonl")
assert.ok(fs.existsSync(registeredPassagesPath), "Kayıtlı passage arşivi ResearchSSD üzerinde bulunamadı")
const registeredPassages = new Map<string, { originalText: string; contentSha256: string; licenseDecision: string }>()
for (const line of fs.readFileSync(registeredPassagesPath, "utf8").split("\n")) {
  if (!line.trim()) continue
  const row = JSON.parse(line) as { id: string; originalText: string; contentSha256: string; licenseDecision: string }
  registeredPassages.set(row.id, row)
}
for (const passage of V6_FOUNDATIONAL_EXPANSION_PASSAGES) {
  const registered = registeredPassages.get(passage.id)
  assert.ok(registered, `${passage.id}: SSD passage kaydı yok`)
  assert.equal(registered.contentSha256, passage.sourceContentSha256, `${passage.id}: kaynak hash uyuşmuyor`)
  assert.equal(registered.licenseDecision, passage.licenseDecision, `${passage.id}: lisans kararı uyuşmuyor`)
  assert.ok(registered.originalText.includes(passage.supportingExcerpt), `${passage.id}: alıntı kaynak metinde yok`)
}

console.log("DNA foundational expansion tests passed.")
console.log(JSON.stringify({
  version: V6_FOUNDATIONAL_EXPANSION_VERSION,
  sources: V6_FOUNDATIONAL_EXPANSION_SOURCES.length,
  passages: V6_FOUNDATIONAL_EXPANSION_PASSAGES.length,
  claims: V6_FOUNDATIONAL_EXPANSION_CLAIMS.length,
  topics: V6_FOUNDATIONAL_EXPANSION_TOPICS.length,
  relations: V6_FOUNDATIONAL_EXPANSION_RELATIONS.length,
  routingCases: routingCases.length,
  fullAnswerCases: answerCases.length,
  closestPriorClaimJaccard: Number(closestPair.score.toFixed(4)),
  closestPriorClaimPair: `${closestPair.left} / ${closestPair.right}`,
}, null, 2))
