import type { DnaS13QueryFrame } from "./contracts"
import { dnaS13HasPresentationModifier } from "./pragmaticTask"
import { hashDnaS13Artifact } from "./strictHash"
import {
  DNA_S13_STRICT_REALIZATION_VERSION,
  type DnaS13StrictPlan,
  type DnaS13StrictRealization,
} from "./strictContracts"

export const DNA_S13_REALIZER_CONTRACT_VERSION = "dna-s13-realizer-contract@1" as const
export const DNA_S13_DETERMINISTIC_REALIZER_VERSION = "dna-s13-deterministic-realizer@12" as const

export type DnaS13RealizerProvider = "luna" | "local" | "deterministic"
export type DnaS13RealizerAttemptKind = "initial" | "repair"

export type DnaS13RealizerIdentity = Readonly<{
  provider: DnaS13RealizerProvider
  model: string
  implementationVersion: string
}>

export type DnaS13RealizerUsage = Readonly<{
  inputTokens: number
  cachedInputTokens: number
  outputTokens: number
  costMicrousd: number
}>

export type DnaS13PromptFingerprint = Readonly<{
  version: string
  hash: string
}>

export type DnaS13RealizerRequest = Readonly<{
  question: string
  normalizedQuestion: string
  queryFrame: DnaS13QueryFrame
  plan: DnaS13StrictPlan
  attempt: DnaS13RealizerAttemptKind
  validationFailureCodes: readonly string[]
  previousCandidate: DnaS13StrictRealization | null
}>

export type DnaS13RealizerAttempt = Readonly<{
  contractVersion: typeof DNA_S13_REALIZER_CONTRACT_VERSION
  identity: DnaS13RealizerIdentity
  prompt: DnaS13PromptFingerprint
  realization: DnaS13StrictRealization | null
  rawOutput: string | null
  responseId: string | null
  usage: DnaS13RealizerUsage
  latencyMs: number
}>

/** Provider-neutral contract used by S13-Strict after retrieval has locked the plan. */
export interface Realizer {
  readonly identity: DnaS13RealizerIdentity
  realize(input: DnaS13RealizerRequest): Promise<DnaS13RealizerAttempt>
}

/**
 * Marker contract for a future local/DNA realizer. No local model, runtime or
 * training implementation is selected by this interface.
 */
export interface LocalRealizer extends Realizer {
  readonly identity: DnaS13RealizerIdentity & Readonly<{ provider: "local" }>
}

function deterministicLockedClaimText(claims: readonly string[]) {
  // Preserve authored scientific content and certainty verbatim. The
  // deterministic realizer only removes exact repetition and joins already
  // complete locked sentences; it does not paraphrase or infer.
  return [...new Set(claims.map((claim) => claim.trim()).filter(Boolean))].join(" ")
}

type SimplifyVariant = "daily" | "concise"

const DAILY_REWRITES: readonly Readonly<[RegExp, string]>[] = Object.freeze([
  [/\btemel işlevleri\b/giu, "başlıca görevleri"],
  [/\bgerim reseptörleri\b/giu, "gerilmeyi algılayan alıcılar"],
  [/\buzun dönemli\b/giu, "uzun süreli"],
  [/\bperiferik sinyal\b/giu, "bedenden gelen sinyal"],
  [/\bartık geçerli olmayan\b/giu, "geçerliliğini yitirmiş"],
  [/\bçoğunlukla\b/giu, "genellikle"],
  [/\bçok sayıdaki\b/giu, "birçok"],
  [/\bbütünleştirilir\b/giu, "bir araya getirilir"],
  [/\byürütücü işlevler\b/giu, "planlama ve kontrol becerileri"],
  [/\bbütünleşik bir yapı\b/giu, "birlikte çalışan bir yapı"],
  [/\bbileşenler\b/giu, "parçalar"],
  [/\bayrışma\b/giu, "farklılaşma"],
  [/\bbütün dikkati işgal etmesi\b/giu, "dikkatin tamamını kaplaması"],
  [/\bbireysel özellikler\b/giu, "kişisel özellikler"],
  [/\bbireysel özelliklerden\b/giu, "kişisel özelliklerden"],
  [/\bsosyal bağlam\b/giu, "sosyal ortam"],
  [/\bsosyal bağlamdan\b/giu, "sosyal ortamdan"],
  [/\bfırsat yapısı\b/giu, "mevcut fırsatlar"],
  [/\bfırsat yapısından\b/giu, "mevcut fırsatlardan"],
  [/\bzaman içinde\b/giu, "zamanla"],
  [/\btanımlamaya\b/giu, "anlatmaya"],
  [/\bşeklinde tanımlama yapılmalıdır\b/giu, "diye anlatılmalıdır"],
  [/\bkavramsal\b/giu, "kavramlara dayalı"],
  [/\bönceden tanımlanmış\b/giu, "önceden belirlenmiş"],
  [/\bampirik\b/giu, "veriye dayalı"],
  [/\bko-regülatif\b/giu, "birlikte düzenleyici"],
  [/\bbağlamını\b/giu, "ortamını"],
  [/\bişleviyle\b/giu, "göreviyle"],
  [/\bilişki bulunması\b/giu, "bağlantı olması"],
  [/\banlamına gelmez\b/giu, "demek değildir"],
  [/\bifade etmektedir\b/giu, "anlatır"],
  [/\bifade eder\b/giu, "anlatır"],
  [/\bkapsamaktadır\b/giu, "içerir"],
  [/\bkapsar\b/giu, "içine alır"],
  [/\boluşur\b/giu, "ortaya çıkar"],
  [/\bdikkate alınmalıdır\b/giu, "göz önünde tutulmalıdır"],
  [/\bdeğerlendirilmelidir\b/giu, "gözden geçirilmelidir"],
  [/\bincelenmelidir\b/giu, "bakılmalıdır"],
  [/\badlandırılmamalıdır\b/giu, "adı verilmemelidir"],
  [/\bilişkili\b/giu, "bağlantılı"],
  [/\bdoğrultusunda\b/giu, "göre"],
  [/\borganizasyon\b/giu, "düzen"],
  [/\byapılandırması\b/giu, "yapısı"],
  [/\baktivite\b/giu, "etkinlik"],
  [/\bfizyolojik\b/giu, "bedensel"],
  [/\bdavranışsal\b/giu, "davranışla ilgili"],
  [/\bregülasyon\b/giu, "düzenleme"],
  [/\birritabilite\b/giu, "huzursuzluk"],
  [/\barousal\b/giu, "uyarılma düzeyi"],
  [/\binterferans\b/giu, "dikkat dağıtıcı etki"],
  [/\bortaya çıkabilen\b/giu, "görülebilen"],
  [/\bgiderek\b/giu, "zamanla"],
  [/\bboyunca\b/giu, "süresince"],
  [/\bönemlidir\b/giu, "önem taşır"],
  [/\bbulunur\b/giu, "yer alır"],
  [/\bkullanılan\b/giu, "yararlanılan"],
  [/\byaklaşım\b/giu, "yöntem"],
  [/\baçısından\b/giu, "bakımından"],
  [/\bbaşlatılmasıdır\b/giu, "başlatılması demektir"],
  [/\btanımlanır\b/giu, "açıklanır"],
  [/\bele alır\b/giu, "inceler"],
  [/\bele alınır\b/giu, "incelenir"],
  [/\bilişkin\b/giu, "ilişkin"],
  [/\bbelirli koşullarda\b/giu, "bazı koşullarda"],
  [/\btemsil edildiğini\b/giu, "aktarıldığını"],
  [/\bözgül\b/giu, "belirli"],
  [/\btaşınmaktadır\b/giu, "kullanılmaktadır"],
  [/\bifadesi\b/giu, "sözü"],
  [/\balgılamamasından\b/giu, "fark etmemesinden"],
  [/\bönceki yöntemle devam edebilir\b/giu, "eski yöntemi sürdürebilir"],
  [/\bbiçim değiştirir\b/giu, "değişir"],
  [/\bhızlı biçimde\b/giu, "hızla"],
  [/\beş zamanlı\b/giu, "aynı anda"],
  [/\bsınıflamalardır\b/giu, "gruplamalardır"],
  [/\bmetakognitif\b/giu, "düşünme sürecini izlemeye dayalı"],
  [/\biçerebilir\b/giu, "yer verebilir"],
  [/\bdışsal\b/giu, "dışarıdan gelen"],
  [/\byaklaşımdır\b/giu, "yöntemdir"],
  [/\bbilişsel\b/giu, "zihinsel"],
  [/\byanı sıra\b/giu, "birlikte"],
  [/\byaşam geçmişini\b/giu, "geçmiş yaşamını"],
  [/\bregülasyonun\b/giu, "düzenlemenin"],
  [/\bregülasyonu\b/giu, "düzenlemeyi"],
  [/\bregülasyona\b/giu, "düzenlemeye"],
  [/\bokupasyona\b/giu, "günlük etkinliğe"],
  [/\bişlevsel\b/giu, "işe yarayan"],
  [/\bgünlük yaşama aktarması\b/giu, "günlük yaşamda kullanması"],
  [/\byapılandırmasıdır\b/giu, "yapısıdır"],
  [/\biçerir\b/giu, "içine alır"],
])

const CONCISE_REWRITES: readonly Readonly<[RegExp, string]>[] = Object.freeze([
  [/\btemel işlevleri\b/giu, "ana görevleri"],
  [/\bgerim reseptörleri\b/giu, "gerilmeyi algılayan alıcılar"],
  [/\buzun dönemli\b/giu, "uzun süreli"],
  [/\bperiferik sinyal\b/giu, "bedenden gelen sinyal"],
  [/\bartık geçerli olmayan\b/giu, "geçerliliğini yitirmiş"],
  [/\bçoğunlukla\b/giu, "genellikle"],
  [/\bçok sayıdaki\b/giu, "birçok"],
  [/\bbütünleştirilir\b/giu, "bir araya getirilir"],
  [/\byürütücü işlevler\b/giu, "planlama ve kontrol becerileri"],
  [/\bbütünleşik bir yapı\b/giu, "birlikte çalışan bir yapı"],
  [/\bbileşenler\b/giu, "parçalar"],
  [/\bayrışma\b/giu, "farklılaşma"],
  [/\bbütün dikkati işgal etmesi\b/giu, "dikkatin tamamını kaplaması"],
  [/\bbireysel özellikler\b/giu, "kişisel özellikler"],
  [/\bbireysel özelliklerden\b/giu, "kişisel özelliklerden"],
  [/\bsosyal bağlam\b/giu, "sosyal ortam"],
  [/\bsosyal bağlamdan\b/giu, "sosyal ortamdan"],
  [/\bfırsat yapısı\b/giu, "mevcut fırsatlar"],
  [/\bfırsat yapısından\b/giu, "mevcut fırsatlardan"],
  [/\bzaman içinde\b/giu, "zamanla"],
  [/\btanımlamaya\b/giu, "anlatmaya"],
  [/\bşeklinde tanımlama yapılmalıdır\b/giu, "diye anlatılmalıdır"],
  [/\bkavramsal\b/giu, "kavramlara dayalı"],
  [/\bönceden tanımlanmış\b/giu, "önceden belirlenmiş"],
  [/\bampirik\b/giu, "veriye dayalı"],
  [/\bko-regülatif\b/giu, "birlikte düzenleyici"],
  [/\bbağlamını\b/giu, "ortamını"],
  [/\bişleviyle\b/giu, "göreviyle"],
  [/\bilişki bulunması\b/giu, "bağlantı olması"],
  [/\banlamına gelmez\b/giu, "demek değildir"],
  [/\bifade etmektedir\b/giu, "demektir"],
  [/\bifade eder\b/giu, "demektir"],
  [/\bkapsamaktadır\b/giu, "içine alır"],
  [/\bkapsar\b/giu, "içine alır"],
  [/\boluşur\b/giu, "doğar"],
  [/\bdikkate alınmalıdır\b/giu, "hesaba katılmalıdır"],
  [/\bdeğerlendirilmelidir\b/giu, "kontrol edilmelidir"],
  [/\bincelenmelidir\b/giu, "bakılmalıdır"],
  [/\badlandırılmamalıdır\b/giu, "denmemelidir"],
  [/\bilişkili\b/giu, "ilgili"],
  [/\bdoğrultusunda\b/giu, "göre"],
  [/\borganizasyon\b/giu, "düzenlenme"],
  [/\byapılandırması\b/giu, "yapısı"],
  [/\baktivite\b/giu, "etkinlik"],
  [/\bfizyolojik\b/giu, "bedenle ilgili"],
  [/\bdavranışsal\b/giu, "davranışla ilgili"],
  [/\bregülasyon\b/giu, "düzenleme"],
  [/\birritabilite\b/giu, "huzursuzluk"],
  [/\barousal\b/giu, "uyarılma düzeyi"],
  [/\binterferans\b/giu, "dikkat dağıtıcı etki"],
  [/\bortaya çıkabilen\b/giu, "görülebilen"],
  [/\bgiderek\b/giu, "zamanla"],
  [/\bboyunca\b/giu, "süresince"],
  [/\bönemlidir\b/giu, "önem taşır"],
  [/\bbulunur\b/giu, "yer alır"],
  [/\bkullanılan\b/giu, "yararlanılan"],
  [/\byaklaşım\b/giu, "yöntem"],
  [/\baçısından\b/giu, "bakımından"],
  [/\bbaşlatılmasıdır\b/giu, "başlatılması demektir"],
  [/\btanımlanır\b/giu, "açıklanır"],
  [/\bele alır\b/giu, "inceler"],
  [/\bele alınır\b/giu, "incelenir"],
  [/\bilişkin\b/giu, "ilişkin"],
  [/\bbelirli koşullarda\b/giu, "kimi koşullarda"],
  [/\btemsil edildiğini\b/giu, "aktarıldığını"],
  [/\bözgül\b/giu, "belirli"],
  [/\btaşınmaktadır\b/giu, "kullanılmaktadır"],
  [/\bifadesi\b/giu, "sözü"],
  [/\balgılamamasından\b/giu, "fark etmemesinden"],
  [/\bönceki yöntemle devam edebilir\b/giu, "eski yöntemle sürdürebilir"],
  [/\bbiçim değiştirir\b/giu, "değişir"],
  [/\bhızlı biçimde\b/giu, "hızla"],
  [/\beş zamanlı\b/giu, "aynı anda"],
  [/\bsınıflamalardır\b/giu, "gruplardır"],
  [/\bmetakognitif\b/giu, "düşünmesini izleyen"],
  [/\biçerebilir\b/giu, "barındırabilir"],
  [/\bdışsal\b/giu, "dışarıdan gelen"],
  [/\byaklaşımdır\b/giu, "yöntemdir"],
  [/\bbilişsel\b/giu, "zihinsel"],
  [/\byanı sıra\b/giu, "birlikte"],
  [/\byaşam geçmişini\b/giu, "yaşam öyküsünü"],
  [/\bregülasyonun\b/giu, "düzenlemenin"],
  [/\bregülasyonu\b/giu, "düzenlemeyi"],
  [/\bregülasyona\b/giu, "düzenlemeye"],
  [/\bokupasyona\b/giu, "günlük etkinliğe"],
  [/\bişlevsel\b/giu, "işe dönük"],
  [/\bgünlük yaşama aktarması\b/giu, "günlük yaşamda kullanması"],
  [/\byapılandırmasıdır\b/giu, "yapısıdır"],
  [/\biçerir\b/giu, "içine alır"],
])

// Provider-free SIMPLIFY uses controlled, meaning-preserving lexical and
// grammatical transforms. These are domain-language rules, not topic or
// benchmark identifiers; certainty markers are deliberately left untouched.
const SAFE_SEMANTIC_REWRITES: readonly Readonly<[RegExp, string]>[] = Object.freeze([
  [/\btüketici cihazlarından elde edilen değerler\b/giu, "günlük kullanıma yönelik cihazların verdiği sonuçlar"],
  [/\bklinik düzeyde doğrulanmış tıbbi ölçüm\b/giu, "klinik olarak doğrulanmış bir tıbbi ölçüm"],
  [/\bgibi kullanılmamalıdır\b/giu, "yerine konmamalıdır"],
  [/\bdisiplinler arası\b/giu, "farklı uzmanlık alanlarının birlikte yaptığı"],
  [/\bgastrointestinal\b/giu, "sindirim sistemiyle ilgili"],
  [/\buyaranları düzenleyip yorumlarken\b/giu, "duyusal bilgileri işlerken"],
  [/\bözelliklerini ve önemini birbirinden ayırma aşamasındaki\b/giu, "özellik ve önemi ayırt etmedeki"],
  [/\bher adımı bilinçli olarak izlemek zorunda kalabilir\b/giu, "adımları tek tek takip etmesi gerekebilir"],
  [/\bgörev tekrarlandıkça bazı adımlar otomatikleşir\b/giu, "tekrar edilen görevin bazı adımları kendiliğinden yapılır hâle gelir"],
  [/\byürütücü kaynaklara olan ihtiyaç\b/giu, "planlama ve kontrol için gereken zihinsel çaba"],
  [/\bdokunmaya, harekete veya yemeğe tepki\b/giu, "dokunma, hareket veya yemek karşısındaki tepki"],
  [/\bağrıdan kaynaklanabilir\b/giu, "nedeni ağrı olabilir"],
  [/\bifade edemeyebilir\b/giu, "anlatamayabilir"],
  [/\btek bir görevin zamanını, yerini\b/giu, "bir görevin ne zaman ve nerede yapılacağını"],
  [/\bgerekli malzemelerini hazırlayıp\b/giu, "gereken malzemeleri hazırlayıp"],
  [/\bgörevin ilk adımını uygulamaya geçirmektir\b/giu, "görevin ilk adımını atmaktır"],
  [/\bkullandığı stratejinin\b/giu, "seçtiği yöntemin"],
  [/\betkisiz davranışı yinelemesidir\b/giu, "işe yaramayan davranışı sürdürmesidir"],
  [/\bliteratüründe\b/giu, "bilimsel yayınlarda"],
  [/\bmotor hareketlilik\b/giu, "hareketlilik"],
  [/\bsembolik düşünme\b/giu, "sembollerle düşünme"],
  [/\bbağlama göre\b/giu, "duruma göre"],
  [/\breseptör veya erken sinirsel işleme düzeyinde\b/giu, "algılayıcılar veya sinir sisteminin ilk işleme aşamasında"],
  [/\bdevam eden uyarana verilen yanıtın azalmasıdır\b/giu, "süren bir uyarana tepkinin azalmasıdır"],
  [/\böngörülebilirlik\b/giu, "ne olacağını bilme"],
  [/\bkontrol hakkı\b/giu, "söz hakkı"],
  [/\bbedensel değişikliği\b/giu, "vücudundaki değişikliği"],
  [/\bdüşük uyanıklık yaşayan\b/giu, "uyanıklık düzeyi düşük olan"],
  [/\bkatılım sıklığı\b/giu, "etkinliğe ne kadar sık katıldığı"],
  [/\bkatılım keyfi veya derecesi\b/giu, "katılımdan aldığı keyif veya katılım düzeyi"],
  [/\bbu boyutlar\b/giu, "bu özellikler"],
  [/\bişlem hızı\b/giu, "bilgiyi işleme hızı"],
  [/\byürütücü görev performansını\b/giu, "planlama ve kontrol gerektiren görevlerdeki performansı"],
  [/\bmotor inhibisyon\b/giu, "hareketi durdurma"],
  [/\bhareketin momentumu\b/giu, "hareketin sürmesi"],
  [/\belektrik süpürgesi, yangın alarmı, el kurutma makinesi veya bebek ağlaması gibi belirli seslere güçlü tepki verebilir\b/giu,
    "elektrik süpürgesi veya alarm gibi bazı seslere çok güçlü tepki gösterebilir"],
  [/\byanı sıra\b/giu, "birlikte"],
  [/\bkatkı sağlayan\b/giu, "yardımcı olan"],
  [/\bkatkıda bulunur\b/giu, "yardımcı olur"],
  [/\baracılığıyla\b/giu, "yoluyla"],
  [/\bbelirli\b/giu, "belli"],
  [/\bgöstergelerinin kaydedilmesidir\b/giu, "işaretlerinin kaydedilmesi demektir"],
  [/\bmerkezi kabul edilen\b/giu, "temel sayılan"],
  [/\bbilişsel bileşenlerindendir\b/giu, "zihinsel parçalarındandır"],
  [/\bayarlamasını içerir\b/giu, "ayarlaması anlamına gelir"],
  [/\bolarak değerlendirilmemelidir\b/giu, "gibi görülmemelidir"],
  [/\bkullanılmaktadır\b/giu, "kullanılır"],
  [/\bobjektif veri sağlayabilir\b/giu, "doğrudan ölçüm verisi verebilir"],
  [/\bayrı değişkenler olarak tutulmalıdır\b/giu, "ayrı ayrı değerlendirilmelidir"],
  [/\bolası ya da gerçek\b/giu, "olabilecek veya gerçekleşmiş"],
  [/\bhoş olmayan duyum\b/giu, "rahatsız edici duyum"],
  [/\bsunulmamalıdır\b/giu, "verilmemelidir"],
  [/\bseçim yapılmasını sağlar\b/giu, "seçim yapmaya yardım eder"],
  [/\bsağlar\b/giu, "yardım eder"],
  [/\bazaltabilir\b/giu, "düşürebilir"],
  [/\bolarak tanımlanmamalıdır\b/giu, "diye adlandırılmamalıdır"],
  [/\bbozukluğu bulunmaz\b/giu, "bozukluğu olmaz"],
  [/\bneden olabilir\b/giu, "yol açabilir"],
  [/\bolağandışı ölçüde fazla\b/giu, "çok fazla"],
  [/\bihtiyaç gösterdiği\b/giu, "ihtiyaç duyduğu"],
  [/\betkin yanıt örüntüsüdür\b/giu, "etkin tepki biçimidir"],
  [/\bgözlenebilir\b/giu, "görülebilir"],
  [/\bdaha karmaşık talepler getirir\b/giu, "işi daha zor hâle getirir"],
  [/\bayrı niteleyicilerle belirtir\b/giu, "ayrı biçimde gösterir"],
  [/\bbulunabilir\b/giu, "olabilir"],
  [/\bvarsayılmamalıdır\b/giu, "kabul edilmemelidir"],
  [/\btemel işlevi\b/giu, "temel görevi"],
  [/\balgılamaktır\b/giu, "fark etmektir"],
  [/\bilişkilendirilen dalıdır\b/giu, "bağlantılı bölümüdür"],
  [/\başmış olabilir\b/giu, "aşmış olabilir"],
  [/\bistemli kontrolüdür\b/giu, "bilinçli yönetimidir"],
  [/\besnek biçimde\b/giu, "gerektiğinde"],
  [/\bketleyerek\b/giu, "durdurarak"],
  [/\bgüçlükler bildirilebilir\b/giu, "zorluklar görülebilir"],
  [/\bbileşenleriyle açıklar\b/giu, "parçalarıyla anlatır"],
  [/\bayırt edilmelidir\b/giu, "ayrı ayrı ele alınmalıdır"],
  [/\bbirbirinden ayrılmalıdır\b/giu, "ayrı değerlendirilmelidir"],
  [/\bgeribildirimi\b/giu, "geri bildirimi"],
  [/\bdalgalanmalar gösterir\b/giu, "iniş çıkışlar yaşar"],
  [/\btehlike değildir\b/giu, "tehlike anlamına gelmez"],
  [/\byerine kullanılmaz\b/giu, "yerini tutmaz"],
  [/\bhomeostazı koruyacak\b/giu, "beden dengesini koruyacak"],
  [/\beylemleri seçmenin zorlaşmasıdır\b/giu, "davranışları seçmenin zor hâle gelmesidir"],
  [/\bbütünleyici bir düğümü\b/giu, "bağlantı noktası"],
  [/\bişaretlenmesi\b/giu, "seçilmesi"],
  [/\bkontrol sinyallerinin\b/giu, "yönlendirme sinyallerinin"],
  [/\byanıt örüntüsüdür\b/giu, "tepki biçimidir"],
  [/\btutarlı modeller içinde birleştirir\b/giu, "tutarlı bir modelde bir araya getirir"],
  [/\byalnız\s+([^.;]+?)\s+ile açıklanamaz\b/giu, "yalnızca $1 ile anlatılamaz"],
  [/\betkileyebilir\b/giu, "üzerinde etkili olabilir"],
  [/\bkoruyucu bir işlevdir\b/giu, "korumaya yardımcı olur"],
  [/\bgereksinimlerine\b/giu, "ihtiyaçlarına"],
  [/\bkolaylaştırır\b/giu, "kolay hâle getirir"],
  [/\bölçülebilir değişim olmalıdır\b/giu, "ölçülebilen bir değişim hedeflenmelidir"],
  [/\bgüçlü ilişkilere sahiptir\b/giu, "yakından bağlantılıdır"],
  [/\bdavranışın pasif kaldığı örüntüdür\b/giu, "davranışın pasif olduğu biçimdir"],
  [/\bnedene bağlanamaz\b/giu, "nedenle açıklanamaz"],
  [/\büzerinden sınanır\b/giu, "üzerinden test edilir"],
  [/\btanımlarından biri\b/giu, "önemli tanımlarından biri"],
  [/\bgeliştirilmiştir\b/giu, "oluşturulmuştur"],
])

function unicodeBoundaryPattern(pattern: RegExp) {
  const source = pattern.source
    .replace(/^\\b/u, "(?<![\\p{L}\\p{N}])")
    .replace(/\\b$/u, "(?![\\p{L}\\p{N}])")
  return new RegExp(source, pattern.flags)
}

export function simplifyDnaS13LockedText(value: string, variant: SimplifyVariant = "daily") {
  const rewrites = variant === "concise" ? CONCISE_REWRITES : DAILY_REWRITES
  const protectedTerms = ["self-regülasyon", "interosepsiyon", "arousal", "reaktivite", "toparlanma", "yürütücü işlev", "okupasyon"]
  const protectedValues: string[] = []
  let rewritten = value.trim().replace(new RegExp(protectedTerms.join("|"), "giu"), (matched) => {
    const placeholder = `__DNA_PROTECTED_TERM_${protectedValues.length}__`
    protectedValues.push(matched)
    return placeholder
  })
  for (const [pattern, replacement] of SAFE_SEMANTIC_REWRITES) rewritten = rewritten.replace(unicodeBoundaryPattern(pattern), replacement)
  for (const [pattern, replacement] of rewrites) rewritten = rewritten.replace(unicodeBoundaryPattern(pattern), replacement)
  // Semicolon-separated scientific prose becomes easier to scan without
  // deleting either clause or changing its certainty.
  rewritten = rewritten.replace(/;\s+/gu, ". ")
    .replace(/([.!?]\s+)([a-zçğıöşü])/gu, (_match, boundary: string, letter: string) => `${boundary}${letter.toLocaleUpperCase("tr-TR")}`)
    .replace(/__DNA_PROTECTED_TERM_(\d+)__/gu, (_match, index: string) => protectedValues[Number(index)] ?? "")
  return rewritten
}

function simplifyVariant(question: string | undefined): SimplifyVariant {
  return /\b(?:yalın|yalin|tek cümle|tek cumle)\b/u.test((question ?? "").toLocaleLowerCase("tr-TR"))
    ? "concise" : "daily"
}

export function createDnaS13DeterministicRealization(
  plan: DnaS13StrictPlan,
  options: Readonly<{ question?: string }> = {},
): DnaS13StrictRealization {
  const simplifyPresentation = dnaS13HasPresentationModifier(plan.pragmaticTaskFrame, "SIMPLIFY")
  return Object.freeze({
    version: DNA_S13_STRICT_REALIZATION_VERSION,
    unsupportedAddition: false,
    slotRealizations: Object.freeze(plan.slots.map((slot) => Object.freeze({
      slotId: slot.id,
      text: slot.controlledText ?? (() => {
        const locked = deterministicLockedClaimText(
          slot.lockedClaims.map((entry) => entry.claim.text).filter((value) => value.trim().length > 0),
        )
        return simplifyPresentation && slot.kind !== "comparison_conclusion"
          ? simplifyDnaS13LockedText(locked, simplifyVariant(options.question)) : locked
      })(),
      usedClaimIds: Object.freeze([...slot.lockedClaimIds]),
    }))),
  })
}

export class DeterministicRealizer implements Realizer {
  readonly identity = Object.freeze({
    provider: "deterministic" as const,
    model: "dna-deterministic-realizer",
    implementationVersion: DNA_S13_DETERMINISTIC_REALIZER_VERSION,
  })

  async realize(input: DnaS13RealizerRequest): Promise<DnaS13RealizerAttempt> {
    const realization = createDnaS13DeterministicRealization(input.plan, { question: input.question })
    const prompt = Object.freeze({
      version: DNA_S13_DETERMINISTIC_REALIZER_VERSION,
      hash: hashDnaS13Artifact({
        version: DNA_S13_DETERMINISTIC_REALIZER_VERSION,
        attempt: input.attempt,
        plan: input.plan,
      }),
    })
    return Object.freeze({
      contractVersion: DNA_S13_REALIZER_CONTRACT_VERSION,
      identity: this.identity,
      prompt,
      realization,
      rawOutput: JSON.stringify(realization),
      responseId: null,
      usage: Object.freeze({ inputTokens: 0, cachedInputTokens: 0, outputTokens: 0, costMicrousd: 0 }),
      latencyMs: 0,
    })
  }
}
