import assert from "node:assert/strict"

import {
  REGULATION_ACTIVITIES,
  REGULATION_ACTIVITY_CATALOG,
  getRegulationActivityById,
} from "../src/features/regulation-activity-lab/catalog"
import {
  ACTIVITY_SCENE_VIEWBOX,
  type MotionTransform,
} from "../src/features/regulation-activity-lab/types"
import {
  buildMotionSnapshot,
  resolveMotionTrack,
} from "../src/features/regulation-activity-lab/timeline"

const EXPECTED_TITLES = [
  "Nefes hızımı ayarlıyorum",
  "Duvarı kontrollü itme",
  "Çamaşır sepetini it–çek",
  "Trafik ışığı",
  "Üç hareketi hatırla",
  "Kural değişti",
  "Minder adaları parkuru",
  "Altından geç–üstünden aş",
  "Ayı yürüyüşü rotası",
  "Bedenimi kontrol et–seç–geri dön",
] as const

const EXPECTED_DURATIONS_MS = [
  14_000,
  12_000,
  14_000,
  12_000,
  15_000,
  15_000,
  14_000,
  15_000,
  12_000,
  15_000,
] as const

const EXPECTED_CHARACTERS = [
  "girl",
  "boy",
  "girl",
  "boy",
  "girl",
  "boy",
  "girl",
  "boy",
  "girl",
  "boy",
] as const

const EXPECTED_IDS = [
  "pace-my-breath",
  "wall-controlled-push",
  "laundry-basket-push-pull",
  "traffic-light-go-slow-stop",
  "remember-three-movements",
  "red-right-blue-left-switch",
  "cushion-islands-course",
  "under-over-soft-course",
  "bear-walk-route",
  "body-check-choose-return",
] as const

const FORBIDDEN_URL = /(?:https?:\/\/|www\.|data:|javascript:)/i
const FORBIDDEN_EFFICACY_CLAIM =
  /(?:kesin (?:olarak )?(?:sakinleştirir|düzenler)|sinir sistemini düzenler|tedavi eder|iyileştirir|garanti eder|sonuç garantisi|tanı koyar|etkilidir|kanıtlanmış etki)/i

function assertUnique(values: readonly string[], context: string): void {
  assert.equal(new Set(values).size, values.length, `${context}: değerler benzersiz olmalı`)
}

function assertNonEmpty(value: string, context: string): void {
  assert.ok(value.trim().length > 0, `${context}: boş olamaz`)
}

function assertFiniteInRange(
  value: number,
  minimum: number,
  maximum: number,
  context: string,
): void {
  assert.ok(Number.isFinite(value), `${context}: sonlu bir sayı olmalı`)
  assert.ok(value >= minimum && value <= maximum, `${context}: ${minimum}–${maximum} aralığında olmalı`)
}

function assertTransform(transform: MotionTransform, context: string): void {
  assertFiniteInRange(transform.x, -250, 250, `${context}.x`)
  assertFiniteInRange(transform.y, -250, 250, `${context}.y`)
  assertFiniteInRange(transform.rotation, -180, 180, `${context}.rotation`)
  assertFiniteInRange(transform.scaleX, 0.5, 1.5, `${context}.scaleX`)
  assertFiniteInRange(transform.scaleY, 0.5, 1.5, `${context}.scaleY`)
  assertFiniteInRange(transform.opacity, 0, 1, `${context}.opacity`)
}

function requireActivity(id: string) {
  const activity = getRegulationActivityById(id)
  assert.ok(activity, `${id}: katalog aktivitesi bulunmalı`)
  return activity
}

assert.equal(REGULATION_ACTIVITIES.length, 10, "Pilot katalog tam olarak 10 aktivite içermeli")
assert.ok(Object.isFrozen(REGULATION_ACTIVITIES), "Katalog dizisi çalışma anında değiştirilememeli")
assert.strictEqual(
  REGULATION_ACTIVITY_CATALOG,
  REGULATION_ACTIVITIES,
  "Eski katalog adı aynı deterministik kaynağa işaret etmeli",
)
assert.deepEqual(
  REGULATION_ACTIVITIES.map((activity) => activity.title),
  EXPECTED_TITLES,
  "Aktiviteler onaylanan sırada ve başlıklarla gelmeli",
)
assert.deepEqual(
  REGULATION_ACTIVITIES.map((activity) => activity.durationMs),
  EXPECTED_DURATIONS_MS,
  "Aktivite süreleri onaylanan paketle aynı olmalı",
)
assert.deepEqual(
  REGULATION_ACTIVITIES.map((activity) => activity.character),
  EXPECTED_CHARACTERS,
  "Karakterler kız/erkek sırasıyla dönüşümlü olmalı",
)
assert.deepEqual(
  REGULATION_ACTIVITIES.map((activity) => activity.id),
  EXPECTED_IDS,
  "Aktivite kimlikleri beklenen kararlı sırada olmalı",
)
assert.deepEqual(
  REGULATION_ACTIVITIES.map((activity) => activity.order),
  [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
  "Sıra numaraları 1–10 arasında kesintisiz olmalı",
)

assertUnique(REGULATION_ACTIVITIES.map((activity) => activity.id), "Katalog kimlikleri")
assert.equal(
  REGULATION_ACTIVITIES.filter((activity) => activity.character === "girl").length,
  5,
  "Katalogda beş kız karakterli aktivite olmalı",
)
assert.equal(
  REGULATION_ACTIVITIES.filter((activity) => activity.character === "boy").length,
  5,
  "Katalogda beş erkek karakterli aktivite olmalı",
)
assert.ok(
  !REGULATION_ACTIVITIES.some((activity) => activity.id === "slow-cross-body-rhythm"),
  "Kaldırılan eski pilot aktivitesi kataloğa geri dönmemeli",
)

for (const activity of REGULATION_ACTIVITIES) {
  const activityContext = `Aktivite ${activity.id}`

  assert.ok(Object.isFrozen(activity), `${activityContext}: tamamlanmış kayıt değiştirilememeli`)
  assert.equal(activity.domain, "self-regulation", `${activityContext}: domain self-regulation olmalı`)
  assert.equal(activity.defaultCharacter, activity.character, `${activityContext}: defaultCharacter karakter alias'ı olmalı`)
  assert.ok(Object.isFrozen(activity.scene), `${activityContext}: scene alias'ı değiştirilememeli`)
  assert.deepEqual(activity.scene.viewBox, { width: 1280, height: 720 }, `${activityContext}: scene viewBox 1280×720 olmalı`)
  assert.strictEqual(activity.scene.objects, activity.sceneObjects, `${activityContext}: scene.objects aynı nesne listesini kullanmalı`)
  assert.strictEqual(activity.supervision, activity.safety.supervision, `${activityContext}: supervision güvenlik alias'ı olmalı`)
  assert.strictEqual(activity.stopConditions, activity.safety.stopConditions, `${activityContext}: stopConditions güvenlik alias'ı olmalı`)
  assertNonEmpty(activity.title, `${activityContext}.title`)
  assertNonEmpty(activity.shortLabel, `${activityContext}.shortLabel`)
  assertNonEmpty(activity.categoryLabel, `${activityContext}.categoryLabel`)
  assertNonEmpty(activity.instruction, `${activityContext}.instruction`)
  assert.ok(activity.skills.length > 0, `${activityContext}: en az bir beceri etiketi içermeli`)
  activity.skills.forEach((skill, index) => assertNonEmpty(skill, `${activityContext}.skills[${index}]`))
  assert.equal(activity.loop, true, `${activityContext}: deterministik döngü olarak işaretlenmeli`)
  assert.ok(activity.durationMs > 0, `${activityContext}: süre pozitif olmalı`)
  assert.ok(activity.durationMs <= 15_000, `${activityContext}: süre 15 saniyeyi aşmamalı`)
  assert.equal(activity.durationMs % 1_000, 0, `${activityContext}: süre tam saniye olmalı`)

  assert.ok(activity.materials.length > 0, `${activityContext}: en az bir materyal içermeli`)
  assertUnique(activity.materials.map((item) => item.id), `${activityContext} materyal kimlikleri`)
  for (const item of activity.materials) {
    const materialContext = `${activityContext}.materials.${item.id}`
    assertNonEmpty(item.label, `${materialContext}.label`)
    assert.ok(Number.isInteger(item.quantity) && item.quantity > 0, `${materialContext}: miktar pozitif tam sayı olmalı`)
    assert.equal(typeof item.required, "boolean", `${materialContext}: required boolean olmalı`)
    assertNonEmpty(item.safetyNote, `${materialContext}.safetyNote`)
  }

  assert.ok(activity.sceneObjects.length > 0, `${activityContext}: en az bir sahne nesnesi içermeli`)
  assertUnique(activity.sceneObjects.map((object) => object.id), `${activityContext} sahne nesnesi kimlikleri`)
  for (const object of activity.sceneObjects) {
    const objectContext = `${activityContext}.sceneObjects.${object.id}`
    assertNonEmpty(object.label, `${objectContext}.label`)
    assertFiniteInRange(object.x, 0, ACTIVITY_SCENE_VIEWBOX.width / 2, `${objectContext}.x`)
    assertFiniteInRange(object.y, 0, ACTIVITY_SCENE_VIEWBOX.height / 2, `${objectContext}.y`)
    assert.ok(Number.isFinite(object.width) && object.width > 0, `${objectContext}.width pozitif olmalı`)
    assert.ok(Number.isFinite(object.height) && object.height > 0, `${objectContext}.height pozitif olmalı`)
    assert.ok(
      (object.x + object.width) * 2 <= ACTIVITY_SCENE_VIEWBOX.width,
      `${objectContext}: nesne 1280 genişlikteki sahnenin dışına taşmamalı`,
    )
    assert.ok(
      (object.y + object.height) * 2 <= ACTIVITY_SCENE_VIEWBOX.height,
      `${objectContext}: nesne 720 yükseklikteki sahnenin dışına taşmamalı`,
    )
    assertNonEmpty(object.fill, `${objectContext}.fill`)
    assertNonEmpty(object.stroke, `${objectContext}.stroke`)
  }

  assert.ok(activity.motionTracks.length > 0, `${activityContext}: en az bir hareket izi içermeli`)
  assertUnique(activity.motionTracks.map((motionTrack) => motionTrack.id), `${activityContext} hareket izi kimlikleri`)
  const sceneObjectIds = new Set(activity.sceneObjects.map((object) => object.id))
  for (const motionTrack of activity.motionTracks) {
    const trackContext = `${activityContext}.motionTracks.${motionTrack.id}`
    assert.ok(motionTrack.keyframes.length >= 2, `${trackContext}: en az iki anahtar kare içermeli`)
    assert.equal(motionTrack.keyframes[0]?.atMs, 0, `${trackContext}: ilk kare 0 ms olmalı`)
    assert.equal(
      motionTrack.keyframes.at(-1)?.atMs,
      activity.durationMs,
      `${trackContext}: son kare aktivite süresinde olmalı`,
    )

    for (let index = 0; index < motionTrack.keyframes.length; index += 1) {
      const current = motionTrack.keyframes[index]
      assert.ok(current, `${trackContext}.keyframes[${index}] bulunmalı`)
      assert.ok(Number.isInteger(current.atMs), `${trackContext}.keyframes[${index}].atMs tam sayı olmalı`)
      assert.ok(
        current.atMs >= 0 && current.atMs <= activity.durationMs,
        `${trackContext}.keyframes[${index}].atMs aktivite süresi içinde olmalı`,
      )
      if (index > 0) {
        const previous = motionTrack.keyframes[index - 1]
        assert.ok(previous && current.atMs > previous.atMs, `${trackContext}: kare zamanları artan olmalı`)
      }
      assertTransform(current.transform, `${trackContext}.keyframes[${index}].transform`)
    }

    assert.deepEqual(
      motionTrack.keyframes[0]?.transform,
      motionTrack.keyframes.at(-1)?.transform,
      `${trackContext}: kusursuz döngü için ilk ve son dönüşüm aynı olmalı`,
    )

    if (motionTrack.target.startsWith("scene:")) {
      const targetObjectId = motionTrack.target.slice("scene:".length)
      assert.ok(sceneObjectIds.has(targetObjectId), `${trackContext}: sahne hedefi mevcut bir nesne olmalı`)
    }
  }

  assert.ok(activity.cues.length > 0, `${activityContext}: en az bir yönerge işareti içermeli`)
  assertUnique(activity.cues.map((cue) => cue.id), `${activityContext} yönerge kimlikleri`)
  for (let index = 0; index < activity.cues.length; index += 1) {
    const cue = activity.cues[index]
    assert.ok(cue, `${activityContext}.cues[${index}] bulunmalı`)
    assertNonEmpty(cue.label, `${activityContext}.cues[${index}].label`)
    if (cue.instruction !== undefined) {
      assertNonEmpty(cue.instruction, `${activityContext}.cues[${index}].instruction`)
    }
    assert.ok(Number.isInteger(cue.atMs), `${activityContext}.cues[${index}].atMs tam sayı olmalı`)
    assert.ok(
      cue.atMs >= 0 && cue.atMs <= activity.durationMs,
      `${activityContext}.cues[${index}].atMs aktivite süresi içinde olmalı`,
    )
    if (index > 0) {
      const previous = activity.cues[index - 1]
      assert.ok(previous && cue.atMs > previous.atMs, `${activityContext}: yönerge zamanları artan olmalı`)
    }
  }

  assert.deepEqual(
    activity.safety.ageRange,
    { minYears: 7, maxYears: 12, label: "7–12 yaş" },
    `${activityContext}: varsayılan yaş aralığı 7–12 olmalı`,
  )
  assert.equal(activity.safety.supervision.level, "continuous-adult", `${activityContext}: sürekli yetişkin gözetimi gerekli`)
  assertNonEmpty(activity.safety.supervision.label, `${activityContext}.safety.supervision.label`)
  assertNonEmpty(activity.safety.supervision.instruction, `${activityContext}.safety.supervision.instruction`)
  assert.ok(activity.safety.setupChecklist.length > 0, `${activityContext}: kurulum kontrol listesi içermeli`)
  assert.ok(activity.safety.contraindications.length > 0, `${activityContext}: uygulanmama koşulu içermeli`)
  assert.ok(activity.safety.stopConditions.length >= 3, `${activityContext}: durdurma koşulları içermeli`)
  assert.equal(
    activity.safety.reviewStatus,
    "clinical-review-required",
    `${activityContext}: klinik inceleme gerekliliği açıkça işaretlenmeli`,
  )

  const sampleTimes = [
    0,
    Math.round(activity.durationMs * 0.25),
    Math.round(activity.durationMs * 0.5),
    Math.round(activity.durationMs * 0.75),
    activity.durationMs,
  ]
  const firstPass = sampleTimes.map((timeMs) =>
    buildMotionSnapshot(activity.motionTracks, timeMs),
  )
  const secondPass = sampleTimes.map((timeMs) =>
    buildMotionSnapshot(activity.motionTracks, timeMs),
  )

  assert.deepEqual(
    firstPass,
    secondPass,
    `${activityContext}: aynı zaman noktaları her tekrarda aynı pozu üretmeli`,
  )
  assert.deepEqual(
    firstPass[0],
    firstPass.at(-1),
    `${activityContext}: hesaplanan başlangıç ve bitiş pozları aynı olmalı`,
  )

  for (const motionTrack of activity.motionTracks) {
    for (const timeMs of sampleTimes) {
      assertTransform(
        resolveMotionTrack(motionTrack, timeMs),
        `${activityContext}.resolved.${motionTrack.id}.${timeMs}`,
      )
    }
  }
}

const breathActivity = requireActivity("pace-my-breath")
assert.deepEqual(
  breathActivity.cues.map((cue) => cue.atMs),
  [0, 3_000, 7_000, 10_000],
  "Nefes aktivitesi 0–3 al, 3–7 ver, 7–10 al, 10–14 ver zamanlamasını korumalı",
)
assert.deepEqual(
  breathActivity.cues.map((cue) => cue.label),
  ["Nefes al", "Nefes ver", "Yeniden nefes al", "Yeniden nefes ver"],
  "Nefes yönergeleri iki al-ver döngüsünü açıkça göstermeli",
)

const memoryActivity = requireActivity("remember-three-movements")
assert.deepEqual(
  memoryActivity.cues.map((cue) => cue.label),
  ["1. Omuz", "2. Eller yukarı", "3. Diz", "Sırayı bitir"],
  "Bellek aktivitesi omuz, eller yukarı ve diz sırasını korumalı",
)
assert.deepEqual(
  memoryActivity.sceneObjects.map((object) => object.id),
  ["card-shoulder", "card-hands-up", "card-knees"],
  "Bellek kartları yalnız onaylanan üç hareketi göstermeli",
)

const ruleActivity = requireActivity("red-right-blue-left-switch")
assert.deepEqual(
  ruleActivity.cues.map((cue) => cue.atMs),
  [0, 2_000, 5_000, 7_500, 9_000, 12_000, 14_500],
  "Kural değişimi döngünün orta noktasında gerçekleşmeli",
)
assert.deepEqual(
  ruleActivity.cues.map((cue) => cue.label),
  ["İlk kural", "Kırmızı: sol", "Mavi: sağ", "Kural değişti", "Kırmızı: sağ", "Mavi: sol", "Ortada dur"],
  "Kural aktivitesi ilk eşlemeyi ve tersine çevrilmiş ikinci eşlemeyi korumalı",
)

const cushionActivity = requireActivity("cushion-islands-course")
assert.match(cushionActivity.instruction, /üç alçak mindere yalnız sırayla bas/i)
assert.match(cushionActivity.instruction, /zıplama yapma/i)
assert.doesNotMatch(cushionActivity.instruction, /geri dön/i)
assert.deepEqual(
  cushionActivity.cues.map((cue) => cue.label),
  ["Sırayı gör", "1. minder", "2. minder", "3. minder", "Bitişte dur"],
  "Minder aktivitesi üç sıralı basış ve bitiş duruşundan oluşmalı",
)

const underOverActivity = requireActivity("under-over-soft-course")
assert.match(underOverActivity.instruction, /tünelin altından/i)
assert.match(underOverActivity.instruction, /sünger çizginin üzerinden/i)
assert.match(underOverActivity.instruction, /bitiş işaretinde/i)
assert.doesNotMatch(underOverActivity.instruction, /geri/i)
assert.equal(
  underOverActivity.sceneObjects.at(-1)?.id,
  "course-finish",
  "Alt-üst parkuru dönüş değil bitiş işaretiyle tamamlanmalı",
)

const bearActivity = requireActivity("bear-walk-route")
assert.match(bearActivity.instruction, /altı kontrollü dört-nokta adımı/i)
assert.match(bearActivity.instruction, /bitiş işaretinde dur/i)
assert.doesNotMatch(bearActivity.instruction, /geri dön/i)
assert.equal(
  bearActivity.sceneObjects.filter((object) => object.kind === "paw-marker").length,
  6,
  "Ayı yürüyüşü altı pati/adım işareti içermeli",
)
assert.deepEqual(
  bearActivity.cues.map((cue) => cue.label),
  ["Dört noktada hazır", "1–2. adım", "3–4. adım", "5–6. adım", "Bitişte dur"],
  "Ayı yürüyüşü altı kontrollü adımı ve bitiş duruşunu göstermeli",
)

const serializedCatalog = JSON.stringify(REGULATION_ACTIVITIES)
assert.equal(serializedCatalog, JSON.stringify(REGULATION_ACTIVITIES), "Katalog serileştirmesi deterministik olmalı")
assert.ok(!FORBIDDEN_URL.test(serializedCatalog), "Katalog dış URL veya çalıştırılabilir URL şeması içermemeli")
assert.ok(!FORBIDDEN_EFFICACY_CLAIM.test(serializedCatalog), "Katalog klinik etki veya sonuç garantisi iddiası içermemeli")

for (const activity of REGULATION_ACTIVITIES) {
  assert.strictEqual(
    getRegulationActivityById(activity.id),
    activity,
    `Kimlik araması ${activity.id} için katalog nesnesini döndürmeli`,
  )
}
assert.equal(getRegulationActivityById("unknown-activity"), undefined, "Bilinmeyen kimlik undefined döndürmeli")

console.log(
  `Regülasyon aktivite laboratuvarı sözleşmesi geçti: ${REGULATION_ACTIVITIES.length} aktivite, 5 kız + 5 erkek, azami 15 sn, 7–12 yaş.`,
)
