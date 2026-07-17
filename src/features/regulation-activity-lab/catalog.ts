import {
  ACTIVITY_SCENE_VIEWBOX,
  type ActivityScene,
  ActivityMaterial,
  ActivitySafety,
  MotionEasing,
  MotionKeyframe,
  MotionTarget,
  MotionTrack,
  MotionTransform,
  RegulationActivity,
} from "./types"

type ActivityCatalogSeed = Omit<
  RegulationActivity,
  "domain" | "defaultCharacter" | "scene" | "supervision" | "stopConditions"
>

const COMMON_STOP_CONDITIONS = [
  "Ağrı veya belirgin bedensel rahatsızlık bildirilmesi",
  "Baş dönmesi, nefes darlığı veya yüz renginde belirgin değişiklik görülmesi",
  "Korku, yoğun huzursuzluk, denge kaybı veya devam etmek istememe görülmesi",
] as const

function transform(values: Partial<MotionTransform> = {}): MotionTransform {
  return {
    x: 0,
    y: 0,
    rotation: 0,
    scaleX: 1,
    scaleY: 1,
    opacity: 1,
    ...values,
  }
}

function keyframe(
  atMs: number,
  values: Partial<MotionTransform> = {},
  easing: MotionEasing = "ease-in-out",
): MotionKeyframe {
  return { atMs, easing, transform: transform(values) }
}

function track(id: string, target: MotionTarget, keyframes: readonly MotionKeyframe[]): MotionTrack {
  return { id, target, keyframes }
}

function material(
  id: string,
  label: string,
  quantity: number,
  safetyNote: string,
  required = true,
): ActivityMaterial {
  return { id, label, quantity, required, safetyNote }
}

function safety(params: {
  supervisionInstruction: string
  setupChecklist: readonly string[]
  contraindications: readonly string[]
  extraStopConditions?: readonly string[]
}): ActivitySafety {
  return {
    ageRange: {
      minYears: 7,
      maxYears: 12,
      label: "7–12 yaş",
    },
    supervision: {
      level: "continuous-adult",
      label: "Sürekli yetişkin gözetimi",
      instruction: params.supervisionInstruction,
    },
    setupChecklist: params.setupChecklist,
    contraindications: params.contraindications,
    stopConditions: [...COMMON_STOP_CONDITIONS, ...(params.extraStopConditions ?? [])],
    reviewStatus: "clinical-review-required",
  }
}

const ACTIVITY_DEFINITIONS: readonly ActivityCatalogSeed[] = [
  {
    id: "wall-controlled-push",
    order: 2,
    title: "Duvarı kontrollü itme",
    shortLabel: "Duvar İtme",
    category: "heavy-work",
    categoryLabel: "Ağır iş ve direnç",
    skills: ["kontrollü kuvvet", "başla-dur", "beden hizası"],
    character: "boy",
    durationMs: 12_000,
    loop: true,
    instruction:
      "Ayaklar yer işaretinde ve avuçlar sabit duvarda kalırken dirsekleri yavaşça bük, gövdeyi duvara yaklaştır ve başlangıç konumuna dön.",
    materials: [
      material("stable-wall", "Boş ve sabit duvar alanı", 1, "Duvar yüzeyi kuru, sağlam ve çıkıntısız olmalıdır."),
      material("non-slip-marker", "Kaymaz yer işareti", 1, "İşaret zemine tam yapışmalı ve ayağın altında kıvrılmamalıdır."),
    ],
    sceneObjects: [
      {
        id: "wall",
        kind: "wall",
        label: "Sabit duvar",
        x: 540,
        y: 36,
        width: 42,
        height: 286,
        fill: "#E2E8F0",
        stroke: "#64748B",
        layer: "back",
      },
      {
        id: "feet-marker",
        kind: "floor-marker",
        label: "Ayak başlangıç çizgisi",
        x: 306,
        y: 318,
        width: 128,
        height: 10,
        fill: "#BAE6FD",
        stroke: "#0284C7",
        layer: "front",
      },
    ],
    motionTracks: [
      track("root-shift", "rig.root", [
        keyframe(0, { x: 80 }),
        keyframe(3_000, { x: 90, rotation: 2 }),
        keyframe(6_000, { x: 80 }),
        keyframe(9_000, { x: 90, rotation: 2 }),
        keyframe(12_000, { x: 80 }),
      ]),
      track("left-arm-press", "rig.arm.left.upper", [
        keyframe(0, { rotation: -96 }),
        keyframe(3_000, { rotation: -98 }),
        keyframe(6_000, { rotation: -96 }),
        keyframe(9_000, { rotation: -98 }),
        keyframe(12_000, { rotation: -96 }),
      ]),
      track("right-arm-press", "rig.arm.right.upper", [
        keyframe(0, { rotation: -80 }),
        keyframe(3_000, { rotation: -82 }),
        keyframe(6_000, { rotation: -80 }),
        keyframe(9_000, { rotation: -82 }),
        keyframe(12_000, { rotation: -80 }),
      ]),
      track("left-elbow-control", "rig.arm.left.lower", [
        keyframe(0, { rotation: 18 }),
        keyframe(3_000),
        keyframe(6_000, { rotation: 18 }),
        keyframe(9_000),
        keyframe(12_000, { rotation: 18 }),
      ]),
      track("right-elbow-control", "rig.arm.right.lower", [
        keyframe(0, { rotation: -18 }),
        keyframe(3_000),
        keyframe(6_000, { rotation: -18 }),
        keyframe(9_000),
        keyframe(12_000, { rotation: -18 }),
      ]),
      track("torso-control", "rig.torso", [
        keyframe(0),
        keyframe(3_000, { rotation: 4, scaleY: 0.98 }),
        keyframe(6_000),
        keyframe(9_000, { rotation: 4, scaleY: 0.98 }),
        keyframe(12_000),
      ]),
    ],
    cues: [
      { id: "wall-ready", atMs: 0, label: "Hazır", instruction: "Ayakları işarete, avuçları duvara yerleştir.", kind: "instruction" },
      { id: "wall-forward", atMs: 2_000, label: "Yaklaş", instruction: "Dirsekleri kontrollü biçimde bük.", kind: "timing" },
      { id: "wall-return", atMs: 5_000, label: "Geri dön", instruction: "Kolları açarak başlangıç konumuna dön.", kind: "transition" },
      { id: "wall-finish", atMs: 11_000, label: "Bitir", instruction: "Ayaklar sabitken hareketi tamamla.", kind: "stop" },
    ],
    safety: safety({
      supervisionInstruction: "Yetişkin yan tarafta durmalı, ayakların kaymadığını ve duvar alanının boş kaldığını izlemelidir.",
      setupChecklist: ["Zemin kuru ve kaymazdır.", "Duvar önünde mobilya veya keskin kenar yoktur.", "Ayak çizgisi duvardan rahat kol mesafesindedir."],
      contraindications: ["El, bilek, dirsek veya omuzda hareketi sınırlayan yakınma varsa uygulanmaz."],
    }),
  },
  {
    id: "laundry-basket-push-pull",
    order: 3,
    title: "Çamaşır sepetini it–çek",
    shortLabel: "Sepet İt–Çek",
    category: "heavy-work",
    categoryLabel: "Ağır iş ve direnç",
    skills: ["kuvvet ayarlama", "yön değiştirme", "iki elle çalışma"],
    character: "girl",
    durationMs: 14_000,
    loop: true,
    instruction:
      "Boş ve hafif sepeti iki elle başlangıç çizgisinden dönüş işaretine kadar it, orada dur ve aynı yolu kontrollü biçimde geri çek.",
    materials: [
      material("empty-basket", "Boş ve hafif çamaşır sepeti", 1, "Sepette ağırlık, sivri kenar veya gevşek parça bulunmamalıdır."),
      material("basket-route-markers", "Kaymaz rota işareti", 2, "İşaretler düz zemine tam yapışmalıdır."),
    ],
    sceneObjects: [
      { id: "basket", kind: "basket", label: "Boş sepet", x: 332, y: 250, width: 96, height: 62, fill: "#FDE68A", stroke: "#A16207", layer: "middle" },
      { id: "basket-start", kind: "floor-marker", label: "Başlangıç", x: 205, y: 320, width: 74, height: 10, fill: "#BBF7D0", stroke: "#15803D", layer: "front" },
      { id: "basket-turn", kind: "cone", label: "Dönüş", x: 505, y: 274, width: 34, height: 48, fill: "#FDBA74", stroke: "#C2410C", layer: "front" },
    ],
    motionTracks: [
      track("root-route", "rig.root", [
        keyframe(0, { x: -70 }),
        keyframe(5_000, { x: 75 }),
        keyframe(7_000, { x: 75, rotation: 4 }),
        keyframe(12_000, { x: -70 }),
        keyframe(14_000, { x: -70 }),
      ]),
      track("basket-route", "scene:basket", [
        keyframe(0, { x: -70 }),
        keyframe(5_000, { x: 75 }),
        keyframe(7_000, { x: 75 }),
        keyframe(12_000, { x: -70 }),
        keyframe(14_000, { x: -70 }),
      ]),
      track("left-hand-contact", "rig.arm.left.lower", [
        keyframe(0, { rotation: -38 }),
        keyframe(5_000, { rotation: -45 }),
        keyframe(7_000, { rotation: -22 }),
        keyframe(12_000, { rotation: -38 }),
        keyframe(14_000, { rotation: -38 }),
      ]),
      track("right-hand-contact", "rig.arm.right.lower", [
        keyframe(0, { rotation: 38 }),
        keyframe(5_000, { rotation: 45 }),
        keyframe(7_000, { rotation: 22 }),
        keyframe(12_000, { rotation: 38 }),
        keyframe(14_000, { rotation: 38 }),
      ]),
    ],
    cues: [
      { id: "basket-grip", atMs: 0, label: "İki elle tut", instruction: "Sepetin iki yanını kavra.", kind: "instruction" },
      { id: "basket-push", atMs: 1_000, label: "İt", instruction: "Dönüş işaretine doğru küçük adımlarla ilerle.", kind: "timing" },
      { id: "basket-turn-cue", atMs: 6_000, label: "Dur ve yön değiştir", instruction: "Sepeti kaldırmadan yönünü değiştir.", kind: "transition" },
      { id: "basket-stop", atMs: 13_000, label: "Çizgide dur", instruction: "Sepeti başlangıç çizgisinde bırak.", kind: "stop" },
    ],
    safety: safety({
      supervisionInstruction: "Yetişkin rota boyunca yakın durmalı, sepetin hafif ve yolun tamamen açık kaldığını kontrol etmelidir.",
      setupChecklist: ["Sepet boştur ve kolay kayar.", "Rota düz, kuru ve merdivenden uzaktır.", "Dönüş alanında başka kişi veya eşya yoktur."],
      contraindications: ["Bel, kalça, diz, el veya omuzda hareketi sınırlayan yakınma varsa uygulanmaz."],
      extraStopConditions: ["Sepet devrilir, takılır veya çocuk koşmaya başlarsa hareket durdurulur."],
    }),
  },
  {
    id: "bear-walk-route",
    order: 9,
    title: "Ayı yürüyüşü rotası",
    shortLabel: "Ayı Yürüyüşü",
    category: "heavy-work",
    categoryLabel: "Ağır iş ve direnç",
    skills: ["dört nokta destek", "rota takibi", "hareket sıralama"],
    character: "girl",
    durationMs: 12_000,
    loop: true,
    instruction:
      "Eller ve ayaklar yerde, dizler zeminden yukarıda olacak biçimde pati işaretlerini izleyerek altı kontrollü dört-nokta adımı at ve bitiş işaretinde dur.",
    materials: [
      material("soft-mat", "Kaymaz egzersiz matı", 1, "Mat düz zemine serilmeli ve kenarları kıvrılmamalıdır."),
      material("paw-markers", "Kaymaz pati işareti", 6, "İşaretler mat üzerinde kaymayacak biçimde sabitlenmelidir."),
    ],
    sceneObjects: [
      { id: "paw-one", kind: "paw-marker", label: "1. adım", x: 174, y: 305, width: 36, height: 26, fill: "#DDD6FE", stroke: "#7C3AED", layer: "front" },
      { id: "paw-two", kind: "paw-marker", label: "2. adım", x: 232, y: 305, width: 36, height: 26, fill: "#DDD6FE", stroke: "#7C3AED", layer: "front" },
      { id: "paw-three", kind: "paw-marker", label: "3. adım", x: 290, y: 305, width: 36, height: 26, fill: "#DDD6FE", stroke: "#7C3AED", layer: "front" },
      { id: "paw-four", kind: "paw-marker", label: "4. adım", x: 348, y: 305, width: 36, height: 26, fill: "#DDD6FE", stroke: "#7C3AED", layer: "front" },
      { id: "paw-five", kind: "paw-marker", label: "5. adım", x: 406, y: 305, width: 36, height: 26, fill: "#DDD6FE", stroke: "#7C3AED", layer: "front" },
      { id: "paw-six", kind: "paw-marker", label: "6. adım", x: 464, y: 305, width: 36, height: 26, fill: "#DDD6FE", stroke: "#7C3AED", layer: "front" },
      { id: "bear-finish", kind: "floor-marker", label: "Bitiş", x: 520, y: 318, width: 54, height: 10, fill: "#BAE6FD", stroke: "#0369A1", layer: "front" },
    ],
    motionTracks: [
      track("bear-root-route", "rig.root", [
        keyframe(0, { x: -130, y: 56, rotation: 82 }),
        keyframe(500, { x: -130, y: 56, rotation: 82 }),
        keyframe(2_000, { x: -90, y: 56, rotation: 82 }),
        keyframe(3_500, { x: -50, y: 56, rotation: 82 }),
        keyframe(5_000, { x: -10, y: 56, rotation: 82 }),
        keyframe(6_500, { x: 30, y: 56, rotation: 82 }),
        keyframe(8_000, { x: 70, y: 56, rotation: 82 }),
        keyframe(9_500, { x: 110, y: 56, rotation: 82 }),
        keyframe(11_000, { x: 110, y: 56, rotation: 82 }),
        keyframe(12_000, { x: -130, y: 56, rotation: 82 }),
      ]),
      track("bear-left-arm", "rig.arm.left.upper", [
        keyframe(0, { rotation: -62 }),
        keyframe(2_000, { rotation: -35 }),
        keyframe(3_500, { rotation: -62 }),
        keyframe(5_000, { rotation: -35 }),
        keyframe(6_500, { rotation: -62 }),
        keyframe(8_000, { rotation: -35 }),
        keyframe(9_500, { rotation: -62 }),
        keyframe(11_500, { rotation: -62 }),
        keyframe(12_000, { rotation: -62 }),
      ]),
      track("bear-right-arm", "rig.arm.right.upper", [
        keyframe(0, { rotation: 35 }),
        keyframe(2_000, { rotation: 62 }),
        keyframe(3_500, { rotation: 35 }),
        keyframe(5_000, { rotation: 62 }),
        keyframe(6_500, { rotation: 35 }),
        keyframe(8_000, { rotation: 62 }),
        keyframe(9_500, { rotation: 35 }),
        keyframe(11_500, { rotation: 35 }),
        keyframe(12_000, { rotation: 35 }),
      ]),
      track("bear-leg-alternation", "rig.leg.left.upper", [
        keyframe(0, { rotation: -24 }),
        keyframe(2_000, { rotation: 18 }),
        keyframe(3_500, { rotation: -24 }),
        keyframe(5_000, { rotation: 18 }),
        keyframe(6_500, { rotation: -24 }),
        keyframe(8_000, { rotation: 18 }),
        keyframe(9_500, { rotation: -24 }),
        keyframe(11_500, { rotation: -24 }),
        keyframe(12_000, { rotation: -24 }),
      ]),
    ],
    cues: [
      { id: "bear-ready", atMs: 0, label: "Dört noktada hazır", instruction: "Eller ve ayaklar matta, dizler zeminden yukarıda.", kind: "instruction" },
      { id: "bear-steps-one-two", atMs: 1_000, label: "1–2. adım", instruction: "İki küçük dört-nokta adımı at.", kind: "timing" },
      { id: "bear-steps-three-four", atMs: 4_000, label: "3–4. adım", instruction: "Kontrollü ritimle iki adım daha at.", kind: "timing" },
      { id: "bear-steps-five-six", atMs: 7_000, label: "5–6. adım", instruction: "Son iki kontrollü adımı tamamla.", kind: "transition" },
      { id: "bear-finish", atMs: 10_000, label: "Bitişte dur", instruction: "Altıncı adımdan sonra dur ve dizlerini kontrollü indir.", kind: "stop" },
    ],
    safety: safety({
      supervisionInstruction: "Yetişkin matın yanında kalmalı; baş, boyun ve ellerin çevresinin boş olduğunu izlemelidir.",
      setupChecklist: ["Mat düz ve kaymazdır.", "Altı adımlık rota kısa ve mobilyalardan uzaktır.", "Pati işaretleri arasında çarpışma riski yoktur."],
      contraindications: ["El bileği, dirsek, omuz, boyun, bel veya dizde yük vermeyi sınırlayan yakınma varsa uygulanmaz."],
      extraStopConditions: ["Başın yere yaklaşması veya kolların yükü taşıyamaması görülürse hareket durdurulur."],
    }),
  },
  {
    id: "cushion-islands-course",
    order: 7,
    title: "Minder adaları parkuru",
    shortLabel: "Minder Adaları",
    category: "motor-planning",
    categoryLabel: "Motor planlama ve parkur",
    skills: ["adım sıralama", "denge", "rota planlama"],
    character: "girl",
    durationMs: 14_000,
    loop: true,
    instruction:
      "Zemine sabitlenmiş üç alçak mindere yalnız sırayla bas, minderler arasında zıplama yapma ve üçüncü minderde bitiş işaretini görünce dur.",
    materials: [
      material("firm-cushions", "Alçak ve sert minder", 3, "Minderler ezilmeyen, kaymayan ve üst üste konmamış parçalar olmalıdır."),
      material("course-start-marker", "Kaymaz başlangıç işareti", 1, "İşaret düz zemine tam yapışmalıdır."),
    ],
    sceneObjects: [
      { id: "island-one", kind: "cushion", label: "Birinci ada", x: 208, y: 284, width: 76, height: 30, fill: "#BFDBFE", stroke: "#2563EB", layer: "front" },
      { id: "island-two", kind: "cushion", label: "İkinci ada", x: 320, y: 264, width: 76, height: 30, fill: "#C4B5FD", stroke: "#7C3AED", layer: "front" },
      { id: "island-three", kind: "cushion", label: "Üçüncü ada", x: 432, y: 284, width: 76, height: 30, fill: "#FBCFE8", stroke: "#DB2777", layer: "front" },
      { id: "island-start", kind: "floor-marker", label: "Başlangıç", x: 126, y: 318, width: 64, height: 10, fill: "#BBF7D0", stroke: "#15803D", layer: "front" },
    ],
    motionTracks: [
      track("island-root-route", "rig.root", [
        keyframe(0, { x: -142 }),
        keyframe(500, { x: -142 }),
        keyframe(4_000, { x: -62, y: -10 }),
        keyframe(7_000, { x: 46, y: -25 }),
        keyframe(10_000, { x: 142, y: -10 }),
        keyframe(13_000, { x: 142, y: -10 }),
        keyframe(14_000, { x: -142 }),
      ]),
      track("island-left-step", "rig.leg.left.upper", [
        keyframe(0, { rotation: -8 }),
        keyframe(4_000, { rotation: 28 }),
        keyframe(7_000, { rotation: -8 }),
        keyframe(10_000, { rotation: 28 }),
        keyframe(13_500, { rotation: -8 }),
        keyframe(14_000, { rotation: -8 }),
      ]),
      track("island-right-step", "rig.leg.right.upper", [
        keyframe(0, { rotation: 8 }),
        keyframe(4_000, { rotation: 8 }),
        keyframe(7_000, { rotation: -28 }),
        keyframe(10_000, { rotation: 8 }),
        keyframe(13_500, { rotation: 8 }),
        keyframe(14_000, { rotation: 8 }),
      ]),
      track("island-balance-arms", "rig.arm.left.upper", [
        keyframe(0, { rotation: -22 }),
        keyframe(4_000, { rotation: -72 }),
        keyframe(7_000, { rotation: -58 }),
        keyframe(10_000, { rotation: -72 }),
        keyframe(13_500, { rotation: -22 }),
        keyframe(14_000, { rotation: -22 }),
      ]),
    ],
    cues: [
      { id: "island-ready", atMs: 0, label: "Sırayı gör", instruction: "Üç minderi sırayla izle; aralarında zıplama.", kind: "instruction" },
      { id: "island-one", atMs: 3_000, label: "1. minder", instruction: "Birinci mindere kontrollü bas.", kind: "timing" },
      { id: "island-two", atMs: 6_000, label: "2. minder", instruction: "İkinci mindere adımla geç.", kind: "timing" },
      { id: "island-three", atMs: 9_000, label: "3. minder", instruction: "Üçüncü mindere adımla geç.", kind: "transition" },
      { id: "island-stop", atMs: 12_000, label: "Bitişte dur", instruction: "Üçüncü minderde dengen yerindeyken dur.", kind: "stop" },
    ],
    safety: safety({
      supervisionInstruction: "Yetişkin parkurun yanında ve uzanma mesafesinde kalmalı, minderlerin kaymadığını her turda kontrol etmelidir.",
      setupChecklist: ["Minderler alçak, tek kat ve sabittir.", "Parkur duvar, sehpa ve merdivenden uzaktır.", "Zemin kuru, çevre aydınlıktır."],
      contraindications: ["Dengeyi, alt ekstremite yük vermeyi veya güvenli adım almayı sınırlayan yakınma varsa uygulanmaz."],
      extraStopConditions: ["Minderlerden biri kayar veya çocuk minderler arasında zıplamaya başlarsa hareket durdurulur."],
    }),
  },
  {
    id: "under-over-soft-course",
    order: 8,
    title: "Altından geç–üstünden aş",
    shortLabel: "Alt–Üst Parkur",
    category: "motor-planning",
    categoryLabel: "Motor planlama ve parkur",
    skills: ["hareket sıralama", "mekânsal planlama", "yavaş geçiş"],
    character: "boy",
    durationMs: 15_000,
    loop: true,
    instruction:
      "Yumuşak tünelin altından emekleyerek geç, zemindeki çok alçak sünger çizginin üzerinden tek adımla aş ve bitiş işaretinde iki ayağın yerdeyken dur.",
    materials: [
      material("foam-arch", "Sabit yumuşak geçiş tüneli", 1, "Tünel devrilmeyecek biçimde zemine sabitlenmeli ve baş seviyesinde sert parça bulunmamalıdır."),
      material("low-soft-bar", "Çok alçak sünger çizgi", 1, "Çizgi ayak bileği yüksekliğini geçmemeli ve kolayca yerinden ayrılabilmelidir."),
      material("finish-line", "Kaymaz bitiş işareti", 1, "İşaret zemine tam yapışmalıdır."),
    ],
    sceneObjects: [
      { id: "soft-arch", kind: "foam-arch", label: "Yumuşak tünel", x: 208, y: 174, width: 120, height: 142, fill: "#A7F3D0", stroke: "#047857", layer: "middle" },
      { id: "low-bar", kind: "soft-bar", label: "Alçak sünger çizgi", x: 396, y: 292, width: 116, height: 16, fill: "#FED7AA", stroke: "#C2410C", layer: "front" },
      { id: "course-finish", kind: "floor-marker", label: "Bitiş işareti", x: 530, y: 318, width: 58, height: 10, fill: "#FDE68A", stroke: "#A16207", layer: "front" },
    ],
    motionTracks: [
      track("course-root-route", "rig.root", [
        keyframe(0, { x: -160 }),
        keyframe(500, { x: -160 }),
        keyframe(5_000, { x: -45, y: 54, rotation: 78 }),
        keyframe(9_000, { x: 95, y: -18 }),
        keyframe(12_000, { x: 160 }),
        keyframe(14_000, { x: 160 }),
        keyframe(15_000, { x: -160 }),
      ]),
      track("course-torso-level", "rig.torso", [
        keyframe(0),
        keyframe(5_000, { rotation: 70, scaleY: 0.92 }),
        keyframe(9_000),
        keyframe(12_000),
        keyframe(14_500),
        keyframe(15_000),
      ]),
      track("course-leading-leg", "rig.leg.left.upper", [
        keyframe(0),
        keyframe(5_000, { rotation: 16 }),
        keyframe(9_000, { rotation: 42 }),
        keyframe(12_000),
        keyframe(14_500),
        keyframe(15_000),
      ]),
      track("course-head-clearance", "rig.head", [
        keyframe(0),
        keyframe(5_000, { y: 10, rotation: -8 }),
        keyframe(9_000),
        keyframe(12_000),
        keyframe(14_500),
        keyframe(15_000),
      ]),
    ],
    cues: [
      { id: "course-look", atMs: 0, label: "Parkura bak", instruction: "Önce tüneli, sonra alçak çizgiyi gör.", kind: "instruction" },
      { id: "course-under", atMs: 2_000, label: "Tünelin altından geç", instruction: "Baş açıklığını koruyarak yavaş ilerle.", kind: "timing" },
      { id: "course-over", atMs: 7_000, label: "Çizginin üzerinden aş", instruction: "Sünger çizgiyi tek kontrollü adımla geç.", kind: "transition" },
      { id: "course-finish", atMs: 11_000, label: "Bitişe ilerle", instruction: "Bitiş işaretine iki küçük adımla ilerle.", kind: "timing" },
      { id: "course-stop", atMs: 13_000, label: "Bitişte dur", instruction: "İki ayağın yerdeyken dur.", kind: "stop" },
    ],
    safety: safety({
      supervisionInstruction: "Yetişkin tünel ve çizginin yanında kalmalı; geçiş sırasında baş ve ayak açıklığını izlemelidir.",
      setupChecklist: ["Tünel yumuşak ve devrilmeye karşı sabittir.", "Çizgi çok alçak, yumuşak ve kolay ayrılır durumdadır.", "Parkur düz zeminde ve keskin eşyalardan uzaktadır."],
      contraindications: ["Emekleme, çömelme, baş kontrolü veya güvenli adım almayı sınırlayan yakınma varsa uygulanmaz."],
      extraStopConditions: ["Baş tünele temas eder, ayak çizgiye takılır veya çocuk parkurda koşarsa hareket durdurulur."],
    }),
  },
  {
    id: "traffic-light-go-slow-stop",
    order: 4,
    title: "Trafik ışığı",
    shortLabel: "Trafik Işığı",
    category: "inhibitory-control",
    categoryLabel: "Dürtü kontrolü ve durabilme",
    skills: ["işarete göre hareket", "hız ayarlama", "duruşu koruma"],
    character: "boy",
    durationMs: 12_000,
    loop: true,
    instruction:
      "Yeşil ışıkta çizgi üzerinde yürü, sarı ışıkta adımlarını küçült ve kırmızı ışıkta iki ayağın yerde olacak biçimde dur.",
    materials: [
      material("traffic-cards", "Yeşil, sarı ve kırmızı işaret", 3, "İşaretler yetişkin tarafından görünür yükseklikte tutulmalıdır."),
      material("walking-line", "Kaymaz yürüme çizgisi", 1, "Çizgi düz zemine tam yapışmalıdır."),
    ],
    sceneObjects: [
      { id: "traffic-signal", kind: "traffic-light", label: "Trafik ışığı", x: 490, y: 70, width: 78, height: 178, fill: "#E2E8F0", stroke: "#334155", layer: "back" },
      { id: "traffic-line", kind: "floor-marker", label: "Yürüme çizgisi", x: 126, y: 320, width: 352, height: 10, fill: "#BAE6FD", stroke: "#0284C7", layer: "front" },
    ],
    motionTracks: [
      track("traffic-root", "rig.root", [
        keyframe(0, { x: -120 }),
        keyframe(4_000, { x: 20 }),
        keyframe(7_000, { x: 65 }),
        keyframe(9_000, { x: 65 }),
        keyframe(12_000, { x: -120 }),
      ]),
      track("traffic-left-leg", "rig.leg.left.upper", [
        keyframe(0, { rotation: -18 }),
        keyframe(2_000, { rotation: 24 }),
        keyframe(4_000, { rotation: -18 }),
        keyframe(7_000, { rotation: 8 }),
        keyframe(9_000),
        keyframe(12_000, { rotation: -18 }),
      ]),
      track("traffic-right-leg", "rig.leg.right.upper", [
        keyframe(0, { rotation: 24 }),
        keyframe(2_000, { rotation: -18 }),
        keyframe(4_000, { rotation: 24 }),
        keyframe(7_000, { rotation: -8 }),
        keyframe(9_000),
        keyframe(12_000, { rotation: 24 }),
      ]),
      track("traffic-signal-pulse", "scene:traffic-signal", [
        keyframe(0),
        keyframe(4_000, { scaleX: 1.04, scaleY: 1.04 }),
        keyframe(7_000, { scaleX: 1.08, scaleY: 1.08 }),
        keyframe(9_000, { scaleX: 1.08, scaleY: 1.08 }),
        keyframe(12_000),
      ]),
    ],
    cues: [
      { id: "traffic-green", atMs: 0, label: "Yeşil: git", instruction: "Çizgi üzerinde normal adımlarla yürü.", kind: "instruction" },
      { id: "traffic-yellow", atMs: 4_000, label: "Sarı: yavaşla", instruction: "Adımları küçült ve hızını azalt.", kind: "timing" },
      { id: "traffic-red", atMs: 7_000, label: "Kırmızı: dur", instruction: "İki ayağı yere koy ve bekle.", kind: "stop" },
      { id: "traffic-reset", atMs: 10_000, label: "Başa dön", instruction: "Yürüyerek başlangıç çizgisine dön.", kind: "transition" },
    ],
    safety: safety({
      supervisionInstruction: "Yetişkin işaretleri göstermeli ve yürüme hattının önünü boş tutmalıdır.",
      setupChecklist: ["Yürüme çizgisi düz ve kaymazdır.", "Durma alanında engel yoktur.", "İşaretler net biçimde ayırt edilir."],
      contraindications: ["Güvenli yürüme veya ani olmayan duruşu sınırlayan yakınma varsa oturarak kol hareketi uyarlaması dışında uygulanmaz."],
    }),
  },
  {
    id: "remember-three-movements",
    order: 5,
    title: "Üç hareketi hatırla",
    shortLabel: "Üç Hareket",
    category: "working-memory",
    categoryLabel: "Çalışma belleği ve sıralama",
    skills: ["üç adımlı sıra", "hareket taklidi", "sırayı tamamlama"],
    character: "girl",
    durationMs: 15_000,
    loop: true,
    instruction:
      "Önce iki elinle omuzlarına dokun, sonra ellerini başının üzerine kaldır ve son olarak dizlerine dokun; üç hareketi sırayla tamamlayıp başlangıç duruşuna dön.",
    materials: [
      material("sequence-cards", "Omuz, eller yukarı ve diz sırası kartı", 3, "Kartlar zeminde değil, göz hizasına yakın ve yetişkinin elinde gösterilmelidir."),
    ],
    sceneObjects: [
      { id: "card-shoulder", kind: "sequence-card", label: "1. Omuzlarına dokun", x: 190, y: 62, width: 82, height: 62, fill: "#DBEAFE", stroke: "#2563EB", layer: "back" },
      { id: "card-hands-up", kind: "sequence-card", label: "2. Ellerini kaldır", x: 280, y: 62, width: 82, height: 62, fill: "#EDE9FE", stroke: "#7C3AED", layer: "back" },
      { id: "card-knees", kind: "sequence-card", label: "3. Dizlerine dokun", x: 370, y: 62, width: 82, height: 62, fill: "#FCE7F3", stroke: "#DB2777", layer: "back" },
    ],
    motionTracks: [
      track("sequence-left-arm", "rig.arm.left.upper", [
        keyframe(0, { rotation: -105 }),
        keyframe(4_000, { rotation: -105 }),
        keyframe(6_000, { rotation: -160 }),
        keyframe(9_000, { rotation: -24 }),
        keyframe(12_000, { rotation: -18 }),
        keyframe(15_000, { rotation: -105 }),
      ]),
      track("sequence-right-arm", "rig.arm.right.upper", [
        keyframe(0, { rotation: 105 }),
        keyframe(4_000, { rotation: 105 }),
        keyframe(6_000, { rotation: 160 }),
        keyframe(9_000, { rotation: 24 }),
        keyframe(12_000, { rotation: 18 }),
        keyframe(15_000, { rotation: 105 }),
      ]),
      track("sequence-body-level", "rig.root", [
        keyframe(0),
        keyframe(4_000),
        keyframe(6_000),
        keyframe(9_000, { y: 30 }),
        keyframe(12_000),
        keyframe(15_000),
      ]),
      track("sequence-shoulder-card", "scene:card-shoulder", [
        keyframe(0),
        keyframe(2_000, { scaleX: 1.08, scaleY: 1.08 }),
        keyframe(4_000),
        keyframe(15_000),
      ]),
      track("sequence-hands-up-card", "scene:card-hands-up", [
        keyframe(0),
        keyframe(4_000),
        keyframe(6_000, { scaleX: 1.08, scaleY: 1.08 }),
        keyframe(8_000),
        keyframe(15_000),
      ]),
      track("sequence-knees-card", "scene:card-knees", [
        keyframe(0),
        keyframe(8_000),
        keyframe(10_000, { scaleX: 1.08, scaleY: 1.08 }),
        keyframe(12_000),
        keyframe(15_000),
      ]),
    ],
    cues: [
      { id: "sequence-shoulders", atMs: 0, label: "1. Omuz", instruction: "İki elinle omuzlarına dokun.", kind: "instruction" },
      { id: "sequence-hands-up", atMs: 4_000, label: "2. Eller yukarı", instruction: "İki elini başının üzerine kaldır.", kind: "timing" },
      { id: "sequence-knees", atMs: 8_000, label: "3. Diz", instruction: "Dizlerine dokun.", kind: "transition" },
      { id: "sequence-end", atMs: 12_000, label: "Sırayı bitir", instruction: "Başlangıç duruşuna dön ve dur.", kind: "stop" },
    ],
    safety: safety({
      supervisionInstruction: "Yetişkin üç kartı aynı sırayla göstermeli ve hareket alanını boş tutmalıdır.",
      setupChecklist: ["Karakterin çevresinde kol açıklığı kadar boşluk vardır.", "Kartlar okunaklı ve sabit sıradadır.", "Adım alanı kaymazdır."],
      contraindications: ["Omuz, kol, gövde veya diz hareketini sınırlayan yakınma varsa uygun bireysel uyarlama olmadan uygulanmaz."],
    }),
  },
  {
    id: "red-right-blue-left-switch",
    order: 6,
    title: "Kural değişti",
    shortLabel: "Kural Değiştir",
    category: "cognitive-flexibility",
    categoryLabel: "Bilişsel esneklik ve kural değiştirme",
    skills: ["iki kurallı seçim", "eşlemeyi tersine çevirme", "işareti bekleme"],
    character: "boy",
    durationMs: 15_000,
    loop: true,
    instruction:
      "İlk turda kırmızı kartta sola, mavi kartta sağa adım atıp ortaya dön; kural değişti işaretinden sonra kırmızıda sağa, mavide sola adım at ve bitişte ortada dur.",
    materials: [
      material("red-blue-cards", "Kırmızı ve mavi yön kartı", 2, "Kartlar net renkte, yırtıksız ve yetişkinin elinde tutulmalıdır."),
      material("direction-spots", "Sağ, sol ve orta yer işareti", 3, "İşaretler kaymayacak biçimde zemine sabitlenmelidir."),
    ],
    sceneObjects: [
      { id: "red-card", kind: "direction-card", label: "Kırmızı kart", x: 446, y: 72, width: 82, height: 62, fill: "#FCA5A5", stroke: "#B91C1C", layer: "back" },
      { id: "blue-card", kind: "direction-card", label: "Mavi kart", x: 112, y: 72, width: 82, height: 62, fill: "#93C5FD", stroke: "#1D4ED8", layer: "back" },
      { id: "left-spot", kind: "floor-marker", label: "Sol işaret", x: 184, y: 316, width: 72, height: 12, fill: "#BFDBFE", stroke: "#2563EB", layer: "front" },
      { id: "center-spot", kind: "floor-marker", label: "Orta işaret", x: 284, y: 316, width: 72, height: 12, fill: "#E2E8F0", stroke: "#475569", layer: "front" },
      { id: "right-spot", kind: "floor-marker", label: "Sağ işaret", x: 384, y: 316, width: 72, height: 12, fill: "#FECACA", stroke: "#DC2626", layer: "front" },
    ],
    motionTracks: [
      track("switch-root", "rig.root", [
        keyframe(0),
        keyframe(2_000, { x: -92 }),
        keyframe(4_000),
        keyframe(6_000, { x: 92 }),
        keyframe(7_500),
        keyframe(9_500, { x: 92 }),
        keyframe(11_000),
        keyframe(13_000, { x: -92 }),
        keyframe(14_500),
        keyframe(15_000),
      ]),
      track("switch-red-card", "scene:red-card", [
        keyframe(0, { opacity: 0.55 }),
        keyframe(2_000, { scaleX: 1.08, scaleY: 1.08, opacity: 1 }),
        keyframe(4_000, { opacity: 0.55 }),
        keyframe(7_500, { opacity: 0.55 }),
        keyframe(9_500, { scaleX: 1.08, scaleY: 1.08, opacity: 1 }),
        keyframe(11_000, { opacity: 0.55 }),
        keyframe(15_000, { opacity: 0.55 }),
      ]),
      track("switch-blue-card", "scene:blue-card", [
        keyframe(0, { opacity: 0.55 }),
        keyframe(4_000, { opacity: 0.55 }),
        keyframe(6_000, { scaleX: 1.08, scaleY: 1.08, opacity: 1 }),
        keyframe(7_500, { opacity: 0.55 }),
        keyframe(11_000, { opacity: 0.55 }),
        keyframe(13_000, { scaleX: 1.08, scaleY: 1.08, opacity: 1 }),
        keyframe(15_000, { opacity: 0.55 }),
      ]),
      track("switch-head", "rig.head", [
        keyframe(0),
        keyframe(2_000, { rotation: -16 }),
        keyframe(4_000),
        keyframe(6_000, { rotation: 16 }),
        keyframe(7_500),
        keyframe(9_500, { rotation: 16 }),
        keyframe(11_000),
        keyframe(13_000, { rotation: -16 }),
        keyframe(14_500),
        keyframe(15_000),
      ]),
    ],
    cues: [
      { id: "switch-first-rule", atMs: 0, label: "İlk kural", instruction: "Kırmızı sol, mavi sağ anlamına gelir.", kind: "instruction" },
      { id: "switch-red-left", atMs: 2_000, label: "Kırmızı: sol", instruction: "Sol işarete bas ve ortaya dön.", kind: "timing" },
      { id: "switch-blue-right", atMs: 5_000, label: "Mavi: sağ", instruction: "Sağ işarete bas ve ortaya dön.", kind: "timing" },
      { id: "switch-change", atMs: 7_500, label: "Kural değişti", instruction: "Şimdi eşlemeyi tersine çevir: kırmızı sağ, mavi sol.", kind: "transition" },
      { id: "switch-red-right", atMs: 9_000, label: "Kırmızı: sağ", instruction: "Sağ işarete bas ve ortaya dön.", kind: "timing" },
      { id: "switch-blue-left", atMs: 12_000, label: "Mavi: sol", instruction: "Sol işarete bas ve ortaya dön.", kind: "timing" },
      { id: "switch-stop", atMs: 14_500, label: "Ortada dur", instruction: "İki ayağı orta işarete getir.", kind: "stop" },
    ],
    safety: safety({
      supervisionInstruction: "Yetişkin kartları sırayla göstermeli, yön alanlarının boş ve kaymaz kaldığını izlemelidir.",
      setupChecklist: ["Üç yer işareti aynı hizada ve sabittir.", "Sağ ve sol tarafta çarpılacak eşya yoktur.", "Renk kartları net biçimde ayırt edilir."],
      contraindications: ["Güvenli yana adım alma veya ayakta durmayı sınırlayan yakınma varsa oturarak kol yönlendirme uyarlaması dışında uygulanmaz."],
    }),
  },
  {
    id: "pace-my-breath",
    order: 1,
    title: "Nefes hızımı ayarlıyorum",
    shortLabel: "Nefes Hızım",
    category: "rhythm-and-pacing",
    categoryLabel: "Ritim, tempo ve toparlanma",
    skills: ["nefesi tutmadan ritim izleme", "yavaş görsel tempo", "başlangıç konumuna dönme"],
    character: "girl",
    durationMs: 14_000,
    loop: true,
    instruction:
      "Rahat oturuşta bir eli göğse, diğer eli karın bölgesine yerleştir; ekrandaki dairenin açılıp kapanmasını izlerken nefesi tutmadan kendi rahat ritminde alıp ver.",
    materials: [
      material("stable-chair", "Sırtı destekleyen sabit sandalye", 1, "Sandalye dört ayağı üzerinde, kaymaz zeminde ve tekerleksiz olmalıdır."),
      material("breath-circle", "Açılıp kapanan görsel ritim işareti", 1, "İşaret yalnız görsel tempo sunmalı; nefes tutma komutu içermemelidir."),
    ],
    sceneObjects: [
      { id: "breath-orb", kind: "rhythm-dot", label: "Nefes ritim dairesi", x: 442, y: 98, width: 92, height: 92, fill: "#BAE6FD", stroke: "#0284C7", layer: "back" },
      { id: "seated-marker", kind: "return-spot", label: "Rahat oturuş alanı", x: 248, y: 306, width: 144, height: 20, fill: "#E2E8F0", stroke: "#64748B", layer: "front" },
    ],
    motionTracks: [
      track("breath-body", "rig.breath", [
        keyframe(0, { scaleX: 0.98, scaleY: 0.98 }),
        keyframe(3_000, { scaleX: 1.05, scaleY: 1.05 }),
        keyframe(7_000, { scaleX: 0.98, scaleY: 0.98 }),
        keyframe(10_000, { scaleX: 1.05, scaleY: 1.05 }),
        keyframe(14_000, { scaleX: 0.98, scaleY: 0.98 }),
      ]),
      track("breath-left-hand", "rig.arm.left.upper", [
        keyframe(0, { rotation: -54 }),
        keyframe(3_000, { rotation: -58 }),
        keyframe(7_000, { rotation: -54 }),
        keyframe(10_000, { rotation: -58 }),
        keyframe(14_000, { rotation: -54 }),
      ]),
      track("breath-right-hand", "rig.arm.right.upper", [
        keyframe(0, { rotation: 82 }),
        keyframe(3_000, { rotation: 86 }),
        keyframe(7_000, { rotation: 82 }),
        keyframe(10_000, { rotation: 86 }),
        keyframe(14_000, { rotation: 82 }),
      ]),
      track("breath-orb", "scene:breath-orb", [
        keyframe(0, { scaleX: 0.82, scaleY: 0.82, opacity: 0.72 }),
        keyframe(3_000, { scaleX: 1.12, scaleY: 1.12, opacity: 1 }),
        keyframe(7_000, { scaleX: 0.82, scaleY: 0.82, opacity: 0.72 }),
        keyframe(10_000, { scaleX: 1.12, scaleY: 1.12, opacity: 1 }),
        keyframe(14_000, { scaleX: 0.82, scaleY: 0.82, opacity: 0.72 }),
      ]),
    ],
    cues: [
      { id: "breath-in-one", atMs: 0, label: "Nefes al", instruction: "0–3 saniye: Daire açılırken nefesi tutmadan rahatça al.", kind: "instruction" },
      { id: "breath-out-one", atMs: 3_000, label: "Nefes ver", instruction: "3–7 saniye: Daire kapanırken nefesi zorlamadan ver.", kind: "transition" },
      { id: "breath-in-two", atMs: 7_000, label: "Yeniden nefes al", instruction: "7–10 saniye: Daire açılırken rahat ritmi sürdür.", kind: "timing" },
      { id: "breath-out-two", atMs: 10_000, label: "Yeniden nefes ver", instruction: "10–14 saniye: Daire kapanırken doğal ritme dön.", kind: "stop" },
    ],
    safety: safety({
      supervisionInstruction: "Yetişkin yakında kalmalı; nefes tutma, zorlama veya hızlı art arda nefes alma olmadığını izlemelidir.",
      setupChecklist: ["Sandalye sabit ve tekerleksizdir.", "Ayaklar zemine rahatça ulaşır.", "Giysi boyun ve göğüs çevresinde sıkı değildir."],
      contraindications: ["Akut solunum yakınması, açıklanamayan göğüs ağrısı veya sağlık uzmanının kısıtladığı bir durum varsa uygulanmaz."],
      extraStopConditions: ["Baş dönmesi, karıncalanma, öksürük artışı veya nefes alma güçlüğü görülürse hareket hemen durdurulur."],
    }),
  },
  {
    id: "body-check-choose-return",
    order: 10,
    title: "Bedenimi kontrol et–seç–geri dön",
    shortLabel: "Kontrol Et–Seç",
    category: "body-awareness-and-transition",
    categoryLabel: "Beden farkındalığı ve geçiş",
    skills: ["kısa beden kontrolü", "iki seçenekten birini gösterme", "başlangıç noktasına dönme"],
    character: "boy",
    durationMs: 15_000,
    loop: true,
    instruction:
      "Başlangıç noktasında iki ayağını ve omuzlarını kontrol et, yetişkinin sunduğu iki görsel seçenekten birini işaret et ve geri dönüş noktasında yeniden dur.",
    materials: [
      material("choice-cards", "İki sade hareket seçeneği kartı", 2, "Kartlarda yalnız önceden onaylanmış hareket sembolleri bulunmalıdır."),
      material("return-marker", "Kaymaz geri dönüş işareti", 1, "İşaret düz zemine tam yapışmalıdır."),
    ],
    sceneObjects: [
      { id: "choice-one", kind: "choice-card", label: "Birinci seçenek", x: 180, y: 96, width: 96, height: 72, fill: "#DBEAFE", stroke: "#2563EB", layer: "back" },
      { id: "choice-two", kind: "choice-card", label: "İkinci seçenek", x: 364, y: 96, width: 96, height: 72, fill: "#EDE9FE", stroke: "#7C3AED", layer: "back" },
      { id: "return-spot", kind: "return-spot", label: "Geri dönüş noktası", x: 274, y: 310, width: 92, height: 18, fill: "#BBF7D0", stroke: "#15803D", layer: "front" },
    ],
    motionTracks: [
      track("check-root", "rig.root", [
        keyframe(0),
        keyframe(3_000, { y: 4 }),
        keyframe(7_000, { x: -34 }),
        keyframe(10_000),
        keyframe(13_000, { y: 4 }),
        keyframe(15_000),
      ]),
      track("check-head", "rig.head", [
        keyframe(0),
        keyframe(3_000, { rotation: -8 }),
        keyframe(7_000, { rotation: -14 }),
        keyframe(10_000),
        keyframe(13_000, { rotation: 6 }),
        keyframe(15_000),
      ]),
      track("choose-left-arm", "rig.arm.left.upper", [
        keyframe(0, { rotation: -18 }),
        keyframe(3_000, { rotation: -18 }),
        keyframe(7_000, { rotation: -96 }),
        keyframe(10_000, { rotation: -18 }),
        keyframe(13_000, { rotation: -18 }),
        keyframe(15_000, { rotation: -18 }),
      ]),
      track("return-breath-marker", "rig.breath", [
        keyframe(0),
        keyframe(3_000, { scaleX: 1.02, scaleY: 1.02 }),
        keyframe(7_000),
        keyframe(10_000),
        keyframe(13_000, { scaleX: 1.02, scaleY: 1.02 }),
        keyframe(15_000),
      ]),
    ],
    cues: [
      { id: "check-feet", atMs: 0, label: "Kontrol et", instruction: "Ayakların ve omuzların nerede olduğuna bak.", kind: "instruction" },
      { id: "check-pause", atMs: 3_000, label: "Kısa bekle", instruction: "İki ayağı yerde tut.", kind: "timing" },
      { id: "check-choose", atMs: 6_000, label: "Birini seç", instruction: "Yetişkinin gösterdiği iki karttan birini işaret et.", kind: "transition" },
      { id: "check-return", atMs: 10_000, label: "Geri dön", instruction: "Geri dönüş işaretine gel.", kind: "transition" },
      { id: "check-stop", atMs: 14_000, label: "Rutini bitir", instruction: "İki ayağın işaretteyken dur.", kind: "stop" },
    ],
    safety: safety({
      supervisionInstruction: "Yetişkin iki onaylı seçeneği sunmalı, seçimi zorlamamalı ve geri dönüş alanını açık tutmalıdır.",
      setupChecklist: ["Kartlar sade, anlaşılır ve önceden onaylıdır.", "Geri dönüş işareti kaymazdır.", "Karakterin çevresinde kol açıklığı kadar boşluk vardır."],
      contraindications: ["Görsel seçim veya ayakta durma sırasında belirgin rahatsızlık oluşuyorsa uygun bireysel uyarlama olmadan uygulanmaz."],
      extraStopConditions: ["Çocuk seçim yapmak istemediğini belirtirse rutin sonlandırılır."],
    }),
  },
]

function completeActivity(seed: ActivityCatalogSeed): RegulationActivity {
  const scene: ActivityScene = Object.freeze({
    viewBox: ACTIVITY_SCENE_VIEWBOX,
    objects: seed.sceneObjects,
  })

  return Object.freeze({
    ...seed,
    domain: "self-regulation",
    defaultCharacter: seed.character,
    scene,
    supervision: seed.safety.supervision,
    stopConditions: seed.safety.stopConditions,
  })
}

export const REGULATION_ACTIVITIES: readonly RegulationActivity[] = Object.freeze(
  [...ACTIVITY_DEFINITIONS]
    .sort((left, right) => left.order - right.order)
    .map(completeActivity),
)

export const REGULATION_ACTIVITY_CATALOG = REGULATION_ACTIVITIES

export function getRegulationActivityById(id: string): RegulationActivity | undefined {
  return REGULATION_ACTIVITIES.find((activity) => activity.id === id)
}
