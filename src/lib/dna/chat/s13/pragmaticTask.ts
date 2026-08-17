import { normalizeDnaChatText } from "../text"
import type { DnaS13RequestedFacet } from "./contracts"

export const DNA_S13_PRAGMATIC_TASK_FRAME_VERSION = "dna-s13-pragmatic-task-frame@6" as const

export const DNA_S13_TARGET_RESOLUTIONS = Object.freeze([
  "EXPLICIT_TARGET",
  "CONTEXT_TARGET",
  "REPLACED_TARGET",
  "TOPIC_SWITCH",
  "MULTI_TARGET",
] as const)
export type DnaS13TargetResolution = typeof DNA_S13_TARGET_RESOLUTIONS[number]

export const DNA_S13_PRAGMATIC_ACTIONS = Object.freeze([
  "DEFINE",
  "EXPLAIN",
  "SIMPLIFY",
  "DEEPEN",
  "WHY_SIGNIFICANCE",
  "EXAMPLE",
  "COMPARE",
  "SUMMARIZE",
  "CORRECT_TARGET",
  "CLOSE_TOPIC",
  "OTHER",
] as const)
export type DnaS13PragmaticAction = typeof DNA_S13_PRAGMATIC_ACTIONS[number]
export type DnaS13PragmaticBaseAction = Exclude<DnaS13PragmaticAction, "SIMPLIFY">
export const DNA_S13_PRESENTATION_MODIFIERS = Object.freeze(["SIMPLIFY"] as const)
export type DnaS13PresentationModifier = typeof DNA_S13_PRESENTATION_MODIFIERS[number]
export type DnaS13RoutingConfidence = "HIGH" | "MEDIUM" | "LOW"

export const DNA_S13_DISCOURSE_CONSTRAINTS = Object.freeze([
  "preserve_order",
  "do_not_repeat",
  "only_active_target",
  "concise",
  "standard",
  "deep",
  "no_invention",
  "new_information_only",
] as const)
export type DnaS13DiscourseConstraint = typeof DNA_S13_DISCOURSE_CONSTRAINTS[number]

export type DnaS13PragmaticTarget = Readonly<{
  topicId: string
  surface: string | null
  polarity: "ACTIVE_TARGET" | "REJECTED_TARGET" | "CONTEXT_ONLY"
}>

/**
 * Provider-independent task contract. Target identity and the action requested
 * on that target are deliberately separate axes.
 */
export type DnaS13PragmaticTaskFrame = Readonly<{
  version: typeof DNA_S13_PRAGMATIC_TASK_FRAME_VERSION
  normalizedQuestion: string
  targetResolution: DnaS13TargetResolution
  targets: readonly DnaS13PragmaticTarget[]
  /** Primary semantic operation. Resolver-produced frames never use SIMPLIFY here. */
  pragmaticAction: DnaS13PragmaticAction
  /** Provider-independent semantic action, separated from surface presentation. */
  baseAction?: DnaS13PragmaticBaseAction
  presentationModifiers?: readonly DnaS13PresentationModifier[]
  requestedFacets: readonly DnaS13RequestedFacet[]
  discourseConstraints: readonly DnaS13DiscourseConstraint[]
  actionConfidence: DnaS13RoutingConfidence
  facetConfidence: DnaS13RoutingConfidence
}>

const COMPARE = /\b(?:karsi karsiya|karsilastir\w*|compare\w*|versus|vs|(?:arasindaki|aradaki) (?:fark|ayrim|iliski)\w*|farki\w* (?:ne|nedir)|nasi(?:l)? ayril\w*|ayni (?:sey|duzey)\w*|yerine\b.{0,120}\b(?:neden|niye|ne zaman)|benzer\w*.{0,80}fark\w*|yakin kavram\w*.{0,80}nasi(?:l)? ayril\w*|birincinin.{0,100}ikincinin.{0,120}ayrim)\b/u
const PAIR_COMPARE = /\b(?:yan yana|birbirinden ayir\w*|ortak ve ayrilan|ayri ayri.{0,100}(?:fark|ayrim)|birini digerinden|farkli yon|ikisi\w*.{0,80}(?:fark|ayrim|ayni))\b/u
const EXPLICIT_CONTEXT_COMPARE = /\b(?:karsi karsiya|karsilastir\w*|compare\w*|versus|vs|fark\w*|ayrim\w*|birbirinden ayir\w*|yan yana)\b/u
const MULTI_PART = /\b(?:ilk bolum\w*|ikinci bolum\w*|sonraki bolum\w*|once\b.{0,160}\b(?:ardindan|sonra)|iki (?:yanit|kisim|bolum)\w*)\b/u
const EXAMPLE = /\b(?:ornek\w*|orneg\w*|ornegin|mesela|somut (?:bir )?(?:olay|durum|dayanak)|somutlastir\w*|gercek (?:bir )?(?:yasam|durum)|pratikte nasil gorunur|gundelik hayatta)\b/u
const SIMPLIFY = /\b(?:gunluk (?:konusma )?dil\w*|gundelik (?:bir )?(?:turkce|dil\w*)|normal (?:bir )?dil\w*|ogrenci gibi|ogrencinin anlayacag\w*|daha (?:basit|sade|yalin)|sadelestir\w*|jargonsuz|teknik (?:olmadan|terimleri azalt|kismi azalt)|ilk kez duyan|kolayca)\b/u
const COMPLEXITY_SIGNAL = /\b(?:teknik|jargon\w*|agir|karmasik|soyut|anlasilma\w*|kavrayama\w*)\b/u
const PLAIN_STYLE_SIGNAL = /\b(?:basit|sade|yalin|gundelik|gunluk|normal dil\w*|insan gibi|ogrenci gibi|ogrencinin anlayacag\w*|cocuk\w* anlay\w* gibi|kolay|anlasilir)\b/u
const REPHRASE_SIGNAL = /\b(?:anlat\w*|soyle\w*|acikla\w*|ifade\w*|kur\w*|cevir\w*)\b/u
const DEEPEN = /\b(?:once soylenmeyen|onceki (?:yanitta|aciklamada) olmayan|onceki ana aciklamayi yinelemek yerine|once soylemedig\w*|yeni (?:bir )?(?:ayrinti|bilgi|nokta|boyut)|ek (?:ayrinti|bilgi|nokta)|bir adim (?:daha|ilerlet|otesi)|bir kat (?:daha|ileri)|daha derine|derinlestir\w*|detaylandir\w*|ayrintiyi ac\w*|otesine gec\w*|otesindeki (?:guvenli )?ayrinti|varsa ac yoksa tekrarlama|biraz daha anlat\w*|mekanizma\w*.{0,40}ac\w*|devam et\w*)\b/u
const DEEPEN_CONTINUATION = /\b(?:biraz|brz|azicik|bir parca|bir tik|bir adim|bir kat|daha|dha|devam|ilerisi|otesi|derin|detay|ayrinti|genis|ek|yeni|baska)\b/u
const DEEPEN_OPERATION = /\b(?:ac(?:ar|abilir|alim|in|san|sak|mak)?|genislet\w*|ilerlet\w*|derinles\w*|detaylandir\w*|ayrintilandir\w*|devam (?:et|edelim)|ekle\w*|ustune (?:koy|ekle)\w*)\b/u
const WHY = /\b(?:neden onemli|niye onemli|nicin onem|neden dikkate|niye dikkate|degerli yapan nedir|asil onem|onem(?:i|ini) belirt|onemi ne|pratik deger|pratik onem|ne ise yarar|islevi ne|neden gerekli|gerekcesi nedir|hangi degeri tasir)\b/u
const WHY_INTERROGATIVE = /\b(?:neden|niye|nicin|ne diye)\b/u
const WHY_RELEVANCE = /\b(?:onem\w*|deger\w*|islev\w*|fayda\w*|yarar\w*|gerek\w*|katki\w*|kazandir\w*|rol\w*|ise yar\w*|dikkate al\w*|gunluk yasam\w*|katilim\w*|yorumlama\w*|olcum\w*)\b/u
const SUMMARIZE = /\b(?:ozetle\w*|kisaca toparla\w*|ana fikri toparla\w*|tek paragrafta toparla\w*)\b/u
const CLOSE = /\b(?:konuyu kapat\w*|burayi kapat\w*|bu basligi kapat\w*|bunu gecelim)\b/u
const DEFINE = /\b(?:nedir|ndr|ne demek|neyi ifade (?:eder|ediyor|etmekte)|tanimla\w*|tanimlar misin|tanim pls|akademik tanim\w*|tanimini acikla\w*|definition|what is|(?:bu )?neydi\w*|tam olarak ne|temel anlam|cekirdek anlam|ozunu kur|ana anlam|core meaning)\b/u
const MEANING_SIGNAL = /\b(?:anlam\w*|tanim\w*|ifade\w*|meaning)\b/u
const DEFINITION_INTERROGATIVE = /\b(?:ne|nedir|ndr|neyi|neydi\w*|tam olarak)\b/u
const EXPLAIN = /\b(?:acikla\w*|anlat\w*|nasil isler|ne anlatiliyor|kapsami nedir|ne anlama gelir)\b/u
const TOPIC_SWITCH = /\b(?:bagimsiz (?:bir )?konu|yeni (?:bir )?(?:konu|baslik)|konuya gec\w*|basliga gec\w*|sifirdan|eski konuyu tasima)\b/u
const REPEAT_ACT = /\b(?:tekrar\w*|yinele\w*|yineleme\w*|dondur\w*|soyleme\w*|anlatma\w*|yeniden anlat\w*|bastan anlat\w*)\b/u
const REPEAT_OBJECT = /\b(?:ayni|onceki|az onceki|soyledig\w*|anlattig\w*|yanit\w*|aciklama\w*|iddia\w*|bilgi\w*|sey\w*)\b/u
const NEGATED_REPEAT = /\b(?:etme\w*|soyleme\w*|anlatma\w*|dondurme\w*|yineleme\w*|tekrarlama\w*|olmasin\w*|istemiyorum|yerine|haric|disinda|atla\w*)\b/u
const NEW_INFORMATION = /\b(?:yeni|ek|baska|once soylenmeyen|oncekinde olmayan|varsa)\b.{0,60}\b(?:bilgi|ayrinti|nokta|iddia|sey|soyle\w*|ekle\w*)\b/u
const BOUNDARY_INTENT = /\b(?:kanit\w*.{0,48}(?:kesin )?soyleyemedig\w*|emin olamayacag\w*|guvenli bilimsel sinir|yorum sinir\w*|bilimsel sinir\w*|tek basina tani koy\w*|tek basina (?:kanit|goster)\w*|neyi (?:kanitlamaz|gostermez|soylemez)|ne (?:cikarilamaz|soylenemez)|ne kadar kesin|kesinlestirilemez|sinir\w* (?:ne|nedir|nerede))\b/u
const CORE_SCOPE_SIGNAL = /\b(?:core meaning|ana kapsam|temel kapsam|temel sey|ana sey|ana fikir|ana fikr\w*|ana tez|cekirdek kapsam|temel olarak ne anlat)\w*\b/u
const FUNCTION_SIGNAL = /\b(?:function|islev|ne ise yarar|neden onemli|niye onemli|onem\w*|significance)\b/u
const INCOMPLETE_CORE_SCOPE = /\b(?:hakkinda|konusunda)\b.{0,48}\b(?:temel|ana) (?:sey|nokta|cerceve)\b/u

function isMixedCoreFunctionSurface(normalized: string) {
  return CORE_SCOPE_SIGNAL.test(normalized) && FUNCTION_SIGNAL.test(normalized)
}

function unique<T>(values: readonly T[]) {
  return [...new Set(values)]
}

function isDeepenSurface(normalized: string) {
  if (DEEPEN.test(normalized)) return true
  if (NEW_INFORMATION.test(normalized) && /\b(?:ayrinti|bilgi|nokta|boyut|sey)\w*\b/u.test(normalized)) return true
  return DEEPEN_CONTINUATION.test(normalized) && DEEPEN_OPERATION.test(normalized)
}

function isWhySurface(normalized: string) {
  if (WHY.test(normalized)) return true
  return WHY_RELEVANCE.test(normalized)
    && (WHY_INTERROGATIVE.test(normalized)
      || /\b(?:ne|nerede|hangi)\b/u.test(normalized))
}

function isSimplifySurface(normalized: string) {
  return SIMPLIFY.test(normalized)
    || (COMPLEXITY_SIGNAL.test(normalized) && (PLAIN_STYLE_SIGNAL.test(normalized) || REPHRASE_SIGNAL.test(normalized)))
    || (PLAIN_STYLE_SIGNAL.test(normalized) && REPHRASE_SIGNAL.test(normalized))
}

export function dnaS13HasPresentationModifier(
  frame: DnaS13PragmaticTaskFrame | null | undefined,
  modifier: DnaS13PresentationModifier,
) {
  // Legacy hand-built fixtures may still carry primary SIMPLIFY. Runtime
  // resolver output is always base-action + modifier as of task-frame@6.
  return Boolean(frame?.presentationModifiers?.includes(modifier)
    || (modifier === "SIMPLIFY" && frame?.pragmaticAction === "SIMPLIFY"))
}

function isDefineSurface(normalized: string) {
  return DEFINE.test(normalized)
    || (MEANING_SIGNAL.test(normalized) && DEFINITION_INTERROGATIVE.test(normalized))
}

export function resolveDnaS13NoRepeatConstraint(normalizedQuestion: string) {
  const normalized = normalizeDnaChatText(normalizedQuestion)
  const repeatAct = REPEAT_ACT.test(normalized)
  const repeatObject = REPEAT_OBJECT.test(normalized)
  const prohibition = NEGATED_REPEAT.test(normalized)
  const newInformationOnly = NEW_INFORMATION.test(normalized)
  return Object.freeze({
    doNotRepeat: (repeatAct && (repeatObject || prohibition) && prohibition) || newInformationOnly,
    newInformationOnly,
  })
}

function resolveAction(normalized: string, correction: boolean): DnaS13PragmaticAction {
  if (correction) return "CORRECT_TARGET"
  if (COMPARE.test(normalized)) return "COMPARE"
  if (EXAMPLE.test(normalized)) return "EXAMPLE"
  // DEEPEN precedes WHY because a request for an unseen significance reason is
  // a new-information task even when it also contains an importance marker.
  if (isDeepenSurface(normalized)) return "DEEPEN"
  if (isMixedCoreFunctionSurface(normalized)) return "EXPLAIN"
  if (BOUNDARY_INTENT.test(normalized)) return "EXPLAIN"
  if (INCOMPLETE_CORE_SCOPE.test(normalized)) return "EXPLAIN"
  if (CORE_SCOPE_SIGNAL.test(normalized)) return "EXPLAIN"
  if (isWhySurface(normalized)) return "WHY_SIGNIFICANCE"
  if (SUMMARIZE.test(normalized)) return "SUMMARIZE"
  if (CLOSE.test(normalized)) return "CLOSE_TOPIC"
  if (isDefineSurface(normalized)) return "DEFINE"
  if (EXPLAIN.test(normalized)) return "EXPLAIN"
  return "OTHER"
}

function explicitFacets(normalized: string) {
  const facets: DnaS13RequestedFacet[] = []
  const add = (facet: DnaS13RequestedFacet) => {
    if (!facets.includes(facet) && facets.length < 3) facets.push(facet)
  }
  const limitation = /\b(?:sinirlilik|sinirliligi|kisiti|eksigi|yetersiz)\w*\b/u.test(normalized)
  const mixedCoreFunction = isMixedCoreFunctionSurface(normalized)
  const incompleteCoreScope = INCOMPLETE_CORE_SCOPE.test(normalized)
  const boundaryIntent = BOUNDARY_INTENT.test(normalized)
  if (limitation) add("limitation")
  const definition = isDefineSurface(normalized)
    && !mixedCoreFunction && !incompleteCoreScope && !boundaryIntent
    && (!isWhySurface(normalized) || /^(?:nedir|ndr)\b/u.test(normalized)
      || /\b(?:nedir|ndr)\b.{0,80}\b(?:ardindan|sonra)\b/u.test(normalized))
  if (!limitation && definition) add("definition")
  if (FUNCTION_SIGNAL.test(normalized) || /\b(?:nicin onem|rolu|katkisi|degerli yapan)\w*\b/u.test(normalized)) add("function")
  const boundary = /\b(?:ne degildir|yanlis yorum|temkin|yorum siniri|ayrim)\w*\b/u.test(normalized)
    || /\bsinir\w*\b.{0,40}\b(?:nedir|ne|nerede|ne soyler|neyi soylemez|yorum|ciz)\w*\b/u.test(normalized)
    || boundaryIntent
  if (!limitation && boundary) add("boundary")
  if (/\b(?:desteklenen|ne anlama gelir|yorumlanabilir|gosterir)\w*\b/u.test(normalized)) add("supported_meaning")
  if (/\b(?:bilesen|unsur|parca|nelerden olus)\w*\b/u.test(normalized)) add("components")
  if (CORE_SCOPE_SIGNAL.test(normalized)
    || /\b(?:kapsam|ana hat|ozu|temel cerceve|cekirdek anlam|ana anlam)\w*\b/u.test(normalized)) add("core_scope")
  if (/\b(?:mekanizma|isleyis|surec|daha derin|ayrinti|detay)\w*\b/u.test(normalized)) add("explanatory_detail")
  if (/\b(?:fark|ayrim|ayirt)\w*\b/u.test(normalized)) add("distinction")
  if (EXAMPLE.test(normalized)) add("verified_example")
  return facets
}

export function resolveDnaS13RequiredFacets(input: Readonly<{
  action: DnaS13PragmaticAction
  normalizedQuestion: string
  previousFacets?: readonly DnaS13RequestedFacet[]
}>): readonly DnaS13RequestedFacet[] {
  const action = input.action
  const normalized = input.normalizedQuestion
  const explicit = explicitFacets(normalized)
  if (action === "COMPARE") {
    return Object.freeze(["distinction"])
  }
  if (action === "EXAMPLE") {
    const multiFacetExample = explicit.includes("verified_example")
      && explicit.some((facet) => ["definition", "function", "core_scope"].includes(facet))
    return Object.freeze(multiFacetExample ? explicit : ["verified_example"])
  }
  // A primary speech act must not erase other facets explicitly requested in
  // the same sentence. Limitation questions commonly end in “nedir”; that
  // surface form is still a limitation request, not a definition request.
  if (explicit.includes("limitation") || explicit.length > 1) return Object.freeze(explicit)
  if (action === "DEFINE") return Object.freeze(["definition"])
  if (action === "WHY_SIGNIFICANCE") return Object.freeze(["function"])
  if (action === "DEEPEN") return Object.freeze(["explanatory_detail"])
  if (action === "SIMPLIFY") return Object.freeze(unique(input.previousFacets ?? []).slice(0, 4).length
    ? unique(input.previousFacets ?? []).slice(0, 4) : ["core_scope"])
  if (action === "CORRECT_TARGET") return Object.freeze(unique(input.previousFacets ?? []).slice(0, 4).length
    ? unique(input.previousFacets ?? []).slice(0, 4) : ["core_scope"])
  return Object.freeze(explicit.length ? explicit : ["core_scope"])
}

function constraintsFor(input: Readonly<{
  normalized: string
  action: DnaS13PragmaticAction
  responseDepth: "short" | "standard" | "deep"
}>) {
  const constraints: DnaS13DiscourseConstraint[] = []
  const add = (value: DnaS13DiscourseConstraint) => {
    if (!constraints.includes(value)) constraints.push(value)
  }
  const noRepeat = resolveDnaS13NoRepeatConstraint(input.normalized)
  if (input.action === "COMPARE" || /\b(?:once|sonra|en sonda|sirayi|siralamayi|ilk bolum|ikinci bolum)\b/u.test(input.normalized)) add("preserve_order")
  if (["WHY_SIGNIFICANCE", "DEEPEN"].includes(input.action) || noRepeat.doNotRepeat) add("do_not_repeat")
  if (input.action === "CORRECT_TARGET" || /\b(?:sadece bu baslik|yalniz bu|eski konuyu tasima|asil hedef)\b/u.test(input.normalized)) add("only_active_target")
  if (/\b(?:kisa|kisaca|oz|tek cumle|tek paragraf)\b/u.test(input.normalized)
    || isSimplifySurface(input.normalized) || input.responseDepth === "short") add("concise")
  else if (input.responseDepth === "deep" || input.action === "DEEPEN") add("deep")
  else add("standard")
  if (/\b(?:uydurma|uretme|tasmadan|yalniz desteklenen|kanit siniri|dogrulanmis)\b/u.test(input.normalized)
    || ["WHY_SIGNIFICANCE", "DEEPEN", "EXAMPLE", "COMPARE"].includes(input.action)) add("no_invention")
  if (input.action === "DEEPEN" || noRepeat.newInformationOnly) add("new_information_only")
  return Object.freeze(constraints)
}

export function resolveDnaS13PragmaticTask(input: Readonly<{
  question: string
  responseDepth: "short" | "standard" | "deep"
  correction: boolean
  contextInherited: boolean
  namedTargetCount: number
  targets: readonly DnaS13PragmaticTarget[]
  previousAction?: DnaS13PragmaticAction | null
  previousFacets?: readonly DnaS13RequestedFacet[]
}>): DnaS13PragmaticTaskFrame {
  const normalized = normalizeDnaChatText(input.question)
  const actionText = input.targets.map((target) => normalizeDnaChatText(target.surface ?? ""))
    .filter(Boolean).sort((left, right) => right.length - left.length)
    .reduce((value, surface) => value.split(surface).join(" "), normalized)
    .replace(/\s+/gu, " ").trim()
  const presentationModifiers: readonly DnaS13PresentationModifier[] = isSimplifySurface(actionText)
    || isSimplifySurface(normalized) ? Object.freeze(["SIMPLIFY" as const]) : Object.freeze([])
  const strippedAction = resolveAction(actionText, input.correction)
  // A heading may itself contain the interrogative surface (for example a
  // catalog heading ending in “Nedir?”). Removing the target must not remove
  // the user's speech act with it, so a structurally empty/unknown remainder
  // is re-evaluated on the full normalized utterance.
  const baseAction = strippedAction === "OTHER"
    ? resolveAction(normalized, input.correction)
    : strippedAction
  const detectedAction = input.namedTargetCount > 1 && (baseAction === "COMPARE" || PAIR_COMPARE.test(actionText))
    ? "COMPARE" as const
    : input.namedTargetCount > 1 && MULTI_PART.test(actionText)
      ? "EXPLAIN" as const
    : baseAction
  const detectedSemanticAction = detectedAction === "CLOSE_TOPIC" && input.namedTargetCount > 0
    ? isDefineSurface(actionText) ? "DEFINE" as const : "EXPLAIN" as const
    : detectedAction
  const contextualPresentationOnly = presentationModifiers.includes("SIMPLIFY")
    && input.contextInherited && input.namedTargetCount === 0
    && !isDefineSurface(actionText) && !isWhySurface(actionText)
    && !EXPLICIT_CONTEXT_COMPARE.test(actionText) && !EXAMPLE.test(actionText)
    && !isDeepenSurface(actionText)
  const presentationOnlyRequest = contextualPresentationOnly || presentationModifiers.includes("SIMPLIFY")
    && ["EXPLAIN", "OTHER"].includes(detectedSemanticAction)
    && !isDefineSurface(actionText)
    && !isWhySurface(actionText)
    && !COMPARE.test(actionText)
    && !EXAMPLE.test(actionText)
    && !isDeepenSurface(actionText)
  const inheritedBaseAction = input.previousAction && input.previousAction !== "SIMPLIFY"
    ? input.previousAction
    : "EXPLAIN"
  const pragmaticAction: DnaS13PragmaticBaseAction = (presentationOnlyRequest
    ? input.contextInherited ? inheritedBaseAction : "EXPLAIN"
    : detectedSemanticAction === "SIMPLIFY" ? "EXPLAIN" : detectedSemanticAction) as DnaS13PragmaticBaseAction
  const activeTargets = input.targets.filter((target) => target.polarity === "ACTIVE_TARGET")
  const targetResolution: DnaS13TargetResolution = pragmaticAction === "CORRECT_TARGET"
    ? "REPLACED_TARGET"
    : activeTargets.length > 1 || input.namedTargetCount > 1
      ? "MULTI_TARGET"
      : TOPIC_SWITCH.test(normalized)
        ? "TOPIC_SWITCH"
        : input.namedTargetCount > 0
          ? "EXPLICIT_TARGET"
          : input.contextInherited
            ? "CONTEXT_TARGET"
            : "EXPLICIT_TARGET"
  const previousFacets = unique(input.previousFacets ?? []).slice(0, 4)
  const requestedFacets = presentationOnlyRequest && input.contextInherited && previousFacets.length
    ? Object.freeze(previousFacets)
    : resolveDnaS13RequiredFacets({
        action: pragmaticAction,
        normalizedQuestion: actionText,
        previousFacets: input.previousFacets,
      })
  return Object.freeze({
    version: DNA_S13_PRAGMATIC_TASK_FRAME_VERSION,
    normalizedQuestion: normalized,
    targetResolution,
    targets: Object.freeze(input.targets.map((target) => Object.freeze({ ...target }))),
    pragmaticAction,
    baseAction: pragmaticAction,
    presentationModifiers,
    requestedFacets,
    discourseConstraints: constraintsFor({ normalized: actionText, action: pragmaticAction, responseDepth: input.responseDepth }),
    actionConfidence: pragmaticAction === "OTHER" ? "LOW" : "HIGH",
    facetConfidence: pragmaticAction === "OTHER" && explicitFacets(actionText).length === 0 ? "LOW" : "HIGH",
  })
}

export function mergeDnaS13PragmaticTargets(
  frame: DnaS13PragmaticTaskFrame,
  targets: readonly DnaS13PragmaticTarget[],
): DnaS13PragmaticTaskFrame {
  return Object.freeze({
    ...frame,
    targets: Object.freeze(unique(targets.map((target) => JSON.stringify(target)))
      .map((target) => Object.freeze(JSON.parse(target) as DnaS13PragmaticTarget))),
  })
}
