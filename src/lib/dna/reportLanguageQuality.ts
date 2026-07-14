export type ReportLanguageIssueSeverity = "high" | "medium" | "low";

export type ReportLanguageIssue = {
  code: string;
  severity: ReportLanguageIssueSeverity;
  message: string;
  evidence?: string;
};

export type ReportLanguageQualityResult = {
  score: number;
  classification: "strong" | "needs_review" | "problem";
  issues: ReportLanguageIssue[];
  metrics: {
    sentenceCount: number;
    averageSentenceWords: number;
    longSentenceCount: number;
    repeatedSentenceCount: number;
  };
};

type TextReplacement = string | ((substring: string, ...args: any[]) => string);

// Serbest anamnez ve ek test metinlerinde kalan ASCII Turkce yazimlari
// merkezi olarak duzeltir. Eslesmeler tam kelimedir; klinik metin disindaki
// parcali ifadeleri degistirmez.
const TURKISH_ASCII_WORD_REPLACEMENTS: Record<string, string> = {
  adimli: "adımlı",
  adimlar: "adımlar",
  alici: "alıcı",
  ayrilma: "ayrılma",
  ayrilmasi: "ayrılması",
  ayrilmama: "ayrılmama",
  arttigi: "arttığı",
  artirmak: "artırmak",
  basamaklarinda: "basamaklarında",
  basamaklarini: "basamaklarını",
  baglamda: "bağlamda",
  baglamlarda: "bağlamlarda",
  bagli: "bağlı",
  baslangic: "başlangıç",
  baslangici: "başlangıcı",
  baslangicta: "başlangıçta",
  baslama: "başlama",
  baslayacagini: "başlayacağını",
  baslayabiliyor: "başlayabiliyor",
  basliyor: "başlıyor",
  belleigi: "belleği",
  belleginde: "belleğinde",
  belirginlesmektedir: "belirginleşmektedir",
  biriktiginde: "biriktiğinde",
  buyuk: "büyük",
  cabuk: "çabuk",
  calismada: "çalışmada",
  calismayi: "çalışmayı",
  carpiyor: "çarpıyor",
  cekingenlik: "çekingenlik",
  cevreye: "çevreye",
  cumle: "cümle",
  dagilim: "dağılım",
  dagilimi: "dağılımı",
  dagilmasi: "dağılması",
  davranisini: "davranışını",
  degerlendirme: "değerlendirme",
  degisiklik: "değişiklik",
  degisiklikleri: "değişiklikleri",
  degisikligi: "değişikliği",
  degisime: "değişime",
  degisiyor: "değişiyor",
  degistiginde: "değiştiğinde",
  degistirme: "değiştirme",
  destegiyle: "desteğiyle",
  destegin: "desteğin",
  destegine: "desteğine",
  donuldugu: "dönüldüğü",
  donebildi: "dönebildi",
  donebilme: "dönebilme",
  donuyor: "dönüyor",
  donus: "dönüş",
  dustu: "düştü",
  dusme: "düşme",
  dustugunde: "düştüğünde",
  dususu: "düşüşü",
  dusus: "düşüş",
  dusuyor: "düşüyor",
  duyarliilik: "duyarlılık",
  duyarliligi: "duyarlılığı",
  duyarliliginda: "duyarlılığında",
  duyarlilik: "duyarlılık",
  duzenini: "düzenini",
  duzenlenebildi: "düzenlenebildi",
  duzenlenebiliyor: "düzenlenebiliyor",
  duzenlenince: "düzenlenince",
  duzenleyici: "düzenleyici",
  duzenliydi: "düzenliydi",
  duzeni: "düzeni",
  duzene: "düzene",
  duzey: "düzey",
  esdegeri: "eşdeğeri",
  etkinlige: "etkinliğe",
  etkinliginde: "etkinliğinde",
  etkinligine: "etkinliğine",
  frustrasyona: "engellenme karşısındaki zorlanmaya",
  frustrasyonlar: "engellenme anları",
  frustrasyonu: "engellenme karşısındaki zorlanmayı",
  gelisim: "gelişim",
  gelisimi: "gelişimi",
  genisleme: "genişleme",
  gerektiginde: "gerektiğinde",
  girdiginde: "girdiğinde",
  giris: "giriş",
  gore: "göre",
  goreve: "göreve",
  gorevi: "görevi",
  gorevleri: "görevleri",
  goruldu: "görüldü",
  goruluyor: "görülüyor",
  gozleme: "gözleme",
  gozlem: "gözlem",
  gozlenebilir: "gözlenebilir",
  goze: "göze",
  guclendirmek: "güçlendirmek",
  guclenmesi: "güçlenmesi",
  guclugun: "güçlüğün",
  guclukleri: "güçlükleri",
  "hafif-yukselmis": "hafif-yükselmiş",
  hizlandirmak: "hızlandırmak",
  icin: "için",
  ihtiyacini: "ihtiyacını",
  ihtiyaclarini: "ihtiyaçlarını",
  iliskide: "ilişkide",
  iliskili: "ilişkili",
  iliskin: "ilişkin",
  iliskiye: "ilişkiye",
  islevlerde: "işlevlerde",
  islevsellik: "işlevsellik",
  istenmistir: "istenmiştir",
  katilimi: "katılımı",
  katilma: "katılma",
  katiliyor: "katılıyor",
  kisalmasi: "kısalması",
  korunmusluk: "korunmuşluk",
  kullanim: "kullanım",
  oral: "ağız içi",
  ortami: "ortamı",
  ozbakim: "öz bakım",
  ozellikle: "özellikle",
  pasiflesme: "pasifleşme",
  sakinlesmek: "sakinleşmek",
  secme: "seçme",
  sinir: "sınır",
  sinirda: "sınırda",
  sinirlama: "sınırlama",
  sinirlari: "sınırları",
  sira: "sıra",
  sirasi: "sırası",
  sozel: "sözel",
  sonlandirma: "sonlandırma",
  sonrasi: "sonrası",
  sonrasinda: "sonrasında",
  sureci: "süreci",
  surede: "sürede",
  suregen: "süregen",
  surekliligi: "sürekliliği",
  sureli: "süreli",
  surelerinin: "sürelerinin",
  suresinde: "süresinde",
  suresini: "süresini",
  suresinin: "süresinin",
  suresi: "süresi",
  surdurmede: "sürdürmede",
  surdurmekte: "sürdürmekte",
  surdurebiliyor: "sürdürebiliyor",
  surdurulebilir: "sürdürülebilir",
  tamamlamayi: "tamamlamayı",
  temasi: "teması",
  tutarli: "tutarlı",
  tutarlilik: "tutarlılık",
  uc: "üç",
  uzaklasma: "uzaklaşma",
  uyaranli: "uyaranlı",
  verildiginde: "verildiğinde",
  yalnizca: "yalnızca",
  yapilandirma: "yapılandırma",
  yapilandirmasi: "yapılandırması",
  yapilandirmaya: "yapılandırmaya",
  yapilar: "yapılar",
  yardimla: "yardımla",
  yetiskine: "yetişkine",
  yonelme: "yönelme",
  yonergeyi: "yönergeyi",
  yonergelerde: "yönergelerde",
  yonetiminde: "yönetiminde",
  yonetmek: "yönetmek",
  yongerge: "yönerge",
  yuklendigi: "yüklendiği",
  yuklenme: "yüklenme",
  yuklenmede: "yüklenmede",
  yuksekligi: "yüksekliği",
  yukselmeden: "yükselmeden",
  yukselmesi: "yükselmesi",
  yukselmis: "yükselmiş",
  yukseliyor: "yükseliyor",
  yukunde: "yükünde",
  yukune: "yüküne",
  yukunun: "yükünün",
  yumusak: "yumuşak",
  zamanlamasinda: "zamanlamasında",
  zorlandigi: "zorlandığı",
  zorlandiginda: "zorlandığında",
  adlandirma: "adlandırma",
  anladigini: "anladığını",
  anlatilani: "anlatılanı",
  ardindan: "ardından",
  artmasi: "artması",
  ayrisma: "ayrışma",
  belirginlesti: "belirginleşti",
  dustugunu: "düştüğünü",
  erisince: "erişince",
  gec: "geç",
  gosterebilme: "gösterebilme",
  goz: "göz",
  kacirma: "kaçırma",
  kirilgan: "kırılgan",
  molasi: "molası",
  oldugunda: "olduğunda",
  oldukca: "oldukça",
  postur: "postür",
  rahatsizligi: "rahatsızlığı",
  toleransinin: "toleransının",
  uzadikca: "uzadıkça",
  yarisi: "yarısı",
  yararlaniyor: "yararlanıyor",
  aciklik: "açıklık",
  yonlerini: "yönlerini",
  netlestirmektir: "netleştirmektir",
  kurali: "kuralı",
  hazirlik: "hazırlık",
  gun: "gün",
  cekici: "çekici",
  acisindan: "açısından",
  oncesi: "öncesi",
  sirasinda: "sırasında",
  seklinde: "şeklinde",
  olmadiginin: "olmadığının",
  ogretildiginde: "öğretildiğinde",
  kisaltmak: "kısaltmak",
  kirikligi: "kırıklığı",
  esigi: "eşiği",
  cekildigi: "çekildiği",
  zamaninda: "zamanında",
  sonlandirildiginda: "sonlandırıldığında",
  cozme: "çözme",
  anlarinda: "anlarında",
  zorlanmalarin: "zorlanmaların",
  zamanli: "zamanlı",
  yuze: "yüze",
  yurutuucu: "yürütücü",
  yurutucu: "yürütücü",
  yurutme: "yürütme",
  yorumlanmali: "yorumlanmalı",
  yorgunlugu: "yorgunluğu",
  yonelim: "yönelim",
  yogun: "yoğun",
  yavaslama: "yavaşlama",
  yatismayi: "yatışmayı",
  yatismakta: "yatışmakta",
  yarim: "yarım",
  yapisir: "yapışır",
  yanlis: "yanlış",
  yakinligiyla: "yakınlığıyla",
  tasma: "taşma",
  tarafli: "taraflı",
  tanimlamak: "tanımlamak",
  tamamlamasi: "tamamlaması",
  suruyor: "sürüyor",
  sik: "sık",
  seyin: "şeyin",
  saglama: "sağlama",
  rahatsizlik: "rahatsızlık",
  paylasma: "paylaşma",
  oyuncaga: "oyuncağa",
  oruntusunde: "örüntüsünde",
  onceden: "önceden",
  olmasi: "olması",
  oldugu: "olduğu",
  ogreniyor: "öğreniyor",
  netlestirilmesi: "netleştirilmesi",
  merakli: "meraklı",
  kucuk: "küçük",
  kolaylastiriyor: "kolaylaştırıyor",
  kesildigi: "kesildiği",
  kazanmasi: "kazanması",
  kazaniyor: "kazanıyor",
  kaydirma: "kaydırma",
  kaybi: "kaybı",
  karsisinda: "karşısında",
  karsilikliligi: "karşılıklılığı",
  kalktiginda: "kalktığında",
  kacma: "kaçma",
  istikrarli: "istikrarlı",
  istedigi: "istediği",
  isaretleri: "işaretleri",
  iletisimde: "iletişimde",
  icindeki: "içindeki",
  hatti: "hattı",
  hatirlatmayla: "hatırlatmayla",
  hatirlatmasi: "hatırlatması",
  haritasi: "haritası",
  gunlerinde: "günlerinde",
  gosteriyor: "gösteriyor",
  gosterebiliyor: "gösterebiliyor",
  gercek: "gerçek",
  etrafinda: "etrafında",
  eslestirme: "eşleştirme",
  edilmediginde: "edilmediğinde",
  duzelmesi: "düzelmesi",
  durtusellikte: "dürtüsellikte",
  durtu: "dürtü",
  dinlenmis: "dinlenmiş",
  dayanikliligin: "dayanıklılığının",
  cokuslerini: "çöküşlerini",
  cizelge: "çizelge",
  cesitliligi: "çeşitliliği",
  cekiyor: "çekiyor",
  cekilmenin: "çekilmenin",
  birakma: "bırakma",
  baskin: "baskın",
  basinda: "başında",
  bag: "bağ",
  azaltilmak: "azaltılmak",
  ayirt: "ayırt",
  asil: "asıl",
  arayis: "arayış",
  arasinda: "arasında",
  aliyor: "alıyor",
  alindiginda: "alındığında",
  algisiyla: "algısıyla",
  zorlanmanin: "zorlanmanın",
  zorlaniyor: "zorlanıyor",
  yonelimi: "yönelimi",
  yogunlugu: "yoğunluğu",
  yapisal: "yapısal",
  yansidigini: "yansıdığını",
  tekrarli: "tekrarlı",
  sozsuz: "sözsüz",
  sekillerini: "şekillerini",
  oruntusunu: "örüntüsünü",
  olusturma: "oluşturma",
  ogrenilmis: "öğrenilmiş",
  nasil: "nasıl",
  kuralina: "kuralına",
  kolaylasiyor: "kolaylaşıyor",
  kirikligina: "kırıklığına",
  kaciriyor: "kaçırıyor",
  icine: "içine",
  geldikce: "geldikçe",
  eslesme: "eşleşme",
  degisimi: "değişimi",
  coklu: "çoklu",
  cevabi: "cevabı",
  basina: "başına",
  artinca: "artınca",
  anlatiminda: "anlatımında",
  toparlanmasi: "toparlanması",
  acikma: "acıkma",
  anlarini: "anlarını",
  derinlesebilme: "derinleşebilme",
  gunler: "günler",
  pekistirece: "pekiştirece",
  toleransi: "toleransı",
  toparlamasi: "toparlaması",
  yuz: "yüz",
  zorlanmande: "zorlanmada",
  sosyallesme: "sosyalleşme",
  alti: "altı",
  degiskenlik: "değişkenlik",
  degisken: "değişken",
  aralik: "aralık",
  yakin: "yakın",
  "oz-bakim": "öz bakım",
  zamanlanmasinda: "zamanlanmasında",
  saptanmadi: "saptanmadı",
  olceklerinde: "ölçeklerinde",
  kayit: "kayıt",
  kacinma: "kaçınma",
  ici: "içi",
  duzeyinde: "düzeyinde",
  duygulanima: "duygulanıma",
  ayri: "ayrı",
  arayisi: "arayışı",
  alani: "alanı",
  yaratiyor: "yaratıyor",
  oruntu: "örüntü",
  olcude: "ölçüde",
  gurultude: "gürültüde",
  cevresel: "çevresel",
  bagimsizlikta: "bağımsızlıkta",
  "oz-denetim": "öz denetim",
  bandinda: "bandında",
};

const TURKISH_ASCII_WORD_PATTERN_SOURCE = `(?<![\\p{L}\\p{N}_])(?:${Object.keys(TURKISH_ASCII_WORD_REPLACEMENTS)
  .sort((a, b) => b.length - a.length)
  .map((word) => word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
  .join("|")})(?![\\p{L}\\p{N}_])`;
const TURKISH_ASCII_WORD_REPLACEMENT_PATTERN = new RegExp(TURKISH_ASCII_WORD_PATTERN_SOURCE, "giu");
const TURKISH_ASCII_WORD_DETECTION_PATTERN = new RegExp(TURKISH_ASCII_WORD_PATTERN_SOURCE, "iu");

const TURKISH_ASCII_REPLACEMENTS: Array<[RegExp, TextReplacement]> = [
  [/\bIlk\b/g, "İlk"],
  [/\bTanilanmis bozukluk bildirilmiyor\b/gi, "Klinik izlem ve işlevsel değerlendirme"],
  [/\btanilanmis bozukluk bildirilmiyor\b/gi, "klinik izlem ve işlevsel değerlendirme"],
  [/\bTanilanmis gelisimsel bozukluk bildirilmedi\b/gi, "Klinik izlem ve işlevsel değerlendirme"],
  [/\bOtizm spektrum bozuklugu izlemi\b/gi, "Klinik izlem ve işlevsel değerlendirme"],
  [/\bOtizm spektrum bozuklugu\b/gi, "Klinik izlem ve işlevsel değerlendirme"],
  [/\bOrnek\b/g, "Örnek"],
  [/\bZayif\b/g, "Zayıf"],
  [/\bzayif\b/gi, "zayıf"],
  [/\bGuclu\b/g, "Güçlü"],
  [/\bguclu\b/gi, "güçlü"],
  [/\bCeliskili\b/g, "Çelişkili"],
  [/\bceliskili\b/gi, "çelişkili"],
  [/\bTurkce\b/g, "Türkçe"],
  [/\bturkce\b/gi, "Türkçe"],
  [/\bSinirli\b/g, "Sınırlı"],
  [/\bsinirli\b/gi, "sınırlı"],
  [/\bLiteratur\b/g, "Literatür"],
  [/\bliteratur\b/gi, "literatür"],
  [/\bKaniti\b/g, "Kanıtı"],
  [/\bkaniti\b/gi, "kanıtı"],
  [/\bAbsurt\b/g, "Absürt"],
  [/\babsurt\b/gi, "absürt"],
  [/\bamacli\b/gi, "amaçlı"],
  [/\bbasvuru\b/gi, "başvuru"],
  [/\bGelisimsel\b/g, "Gelişimsel"],
  [/\bgelisimsel\b/g, "gelişimsel"],
  [/\bsupheleri\b/gi, "şüpheleri"],
  [/\bsuphe\b/gi, "şüphe"],
  [/\bcocukluk\b/gi, "çocukluk"],
  [/\bdavranis\b/gi, "davranış"],
  [/\bdavranissal\b/gi, "davranışsal"],
  [/\bTani yok\b/g, "Tanı yok"],
  [/\btani yok\b/gi, "tanı yok"],
  [/\bagir\b/gi, "ağır"],
  [/\bayni\b/gi, "aynı"],
  [/\bbazi\b/gi, "bazı"],
  [/\bhic\b/gi, "hiç"],
  [/\bgorusme\b/gi, "görüşme"],
  [/\bgorev\b/gi, "görev"],
  [/\bgorev\b/gi, "görev"],
  [/\bDanisan\b/g, "Danışan"],
  [/\bdanisan\b/gi, "danışan"],
  [/\bDort\b/g, "Dört"],
  [/\bUc\b/g, "Üç"],
  [/\bIki\b/g, "İki"],
  [/\biki\b/g, "iki"],
  [/\barasi\b/gi, "arası"],
  [/\bfarki\b/gi, "farkı"],
  [/\bsirayi\b/gi, "sırayı"],
  [/\bsirada\b/gi, "sırada"],
  [/\byardimi\b/gi, "yardımı"],
  [/\bongorulebilir\b/gi, "öngörülebilir"],
  [/\bBilesik\b/g, "Bileşik"],
  [/\bbilesik\b/g, "bileşik"],
  [/\byapildi\b/gi, "yapıldı"],
  [/\bcesitli\b/gi, "çeşitli"],
  [/\bistegi\b/gi, "isteği"],
  [/\byetiskinle\b/gi, "yetişkinle"],
  [/\bazaldiginda\b/gi, "azaldığında"],
  [/\bsiralama\b/gi, "sıralama"],
  [/\byapabildigi\b/gi, "yapabildiği"],
  [/\bbagimsiz\b/gi, "bağımsız"],
  [/\banlamli\b/gi, "anlamlı"],
  [/\bbaglama\b/gi, "bağlama"],
  [/\bduzelme\b/gi, "düzelme"],
  [/\bduzeyi\b/gi, "düzeyi"],
  [/\bbilesigi\b/gi, "bileşiği"],
  [/\bolcekleri\b/gi, "ölçekleri"],
  [/\bolcegi\b/gi, "ölçeği"],
  [/\bparcasi\b/gi, "parçası"],
  [/\bisleme\b/gi, "işleme"],
  [/\bifade\b/gi, "ifade"],
  [/\bcanta\b/gi, "çanta"],
  [/\bhazirlama\b/gi, "hazırlama"],
  [/\bbaslatmada\b/gi, "başlatmada"],
  [/\bdis\b/gi, "dış"],
  [/\bhatirlatici\b/gi, "hatırlatıcı"],
  [/\bazalmasi\b/gi, "azalması"],
  [/\bGorsel\b/g, "Görsel"],
  [/\bgorsel\b/gi, "görsel"],
  [/\badimlari\b/gi, "adımları"],
  [/\bayirma\b/gi, "ayırma"],
  [/\btoparliyor\b/gi, "toparlıyor"],
  [/\byonergede\b/gi, "yönergede"],
  [/\byuku\b/gi, "yükü"],
  [/\bbaskili\b/gi, "baskılı"],
  [/\bgorevden\b/gi, "görevden"],
  [/\bperformansi\b/gi, "performansı"],
  [/\bdegerlendirmede\b/gi, "değerlendirmede"],
  [/\bgecisli\b/gi, "geçişli"],
  [/\bduydugu\b/gi, "duyduğu"],
  [/\banlik\b/gi, "anlık"],
  [/\bbicimde\b/gi, "biçimde"],
  [/\bgozleminde\b/gi, "gözleminde"],
  [/\bsure\b/gi, "süre"],
  [/\buzamasi\b/gi, "uzaması"],
  [/\bgorundu\b/gi, "göründü"],
  [/\besdeger\b/gi, "eşdeğer"],
  [/\baralikta\b/gi, "aralıkta"],
  [/\bkarsiliklilik\b/gi, "karşılıklılık"],
  [/\bragmen\b/gi, "rağmen"],
  [/\bsoyluyor\b/gi, "söylüyor"],
  [/\banlatiyor\b/gi, "anlatıyor"],
  [/\banlatiliyor\b/gi, "anlatılıyor"],
  [/\bolmadigini\b/gi, "olmadığını"],
  [/\boldugunu\b/gi, "olduğunu"],
  [/\bduygu\b/gi, "duygu"],
  [/\biliski\b/gi, "ilişki"],
  [/\balinca\b/gi, "alınca"],
  [/\btanidik\b/gi, "tanıdık"],
  [/\byapilandirmada\b/gi, "yapılandırmada"],
  [/\bis birligi\b/gi, "iş birliği"],
  [/\bsevdigi\b/gi, "sevdiği"],
  [/\bbelirtiyor\b/gi, "belirtiyor"],
  [/\banlasilmasi\b/gi, "anlaşılması"],
  [/\bgorusmede\b/gi, "görüşmede"],
  [/\bcalisma\b/gi, "çalışma"],
  [/\bbellegi\b/gi, "belleği"],
  [/\bIsitsel\b/g, "İşitsel"],
  [/\bisitsel\b/gi, "işitsel"],
  [/\bsinir ustu\b/gi, "sınır üstü"],
  [/\bsinir-klinik\b/gi, "sınır-klinik"],
  [/\bInhibisyon\b/g, "İnhibisyon"],
  [/\bdiger\b/gi, "diğer"],
  [/\byuksek\b/gi, "yüksek"],
  [/\bdegil\b/gi, "değil"],
  [/\bCocuk\b/g, "Çocuk"],
  [/\bcocuk\b/gi, "çocuk"],
  [/\bkatildi\b/gi, "katıldı"],
  [/\bazaldi\b/gi, "azaldı"],
  [/\bayakkabi\b/gi, "ayakkabı"],
  [/\byaptigini\b/gi, "yaptığını"],
  [/\baltina\b/gi, "altına"],
  [/\byakinligi\b/gi, "yakınlığı"],
  [/\bkarmasik\b/gi, "karmaşık"],
  [/\byoresinde\b/gi, "yönergesinde"],
  [/\bbasla-dur\b/gi, "başla-dur"],
  [/\bpazarlik\b/gi, "pazarlık"],
  [/\bsirayla\b/gi, "sırayla"],
  [/\bkirmizi\b/gi, "kırmızı"],
  [/\bsaydi\b/gi, "saydı"],
  [/\bmizahi\b/gi, "mizahi"],
  [/\byorelgeleri\b/gi, "yönergeleri"],
  [/\byorelge\b/gi, "yönerge"],
  [/\byasina\b/gi, "yaşına"],
  [/\byaygin\b/gi, "yaygın"],
  [/\bnetlesmesi\b/gi, "netleşmesi"],
  [/\bgorundugunun\b/gi, "göründüğünün"],
  [/\byayilip\b/gi, "yayılıp"],
  [/\byayilmadigi\b/gi, "yayılmadığı"],
  [/\banlasilmak\b/gi, "anlaşılmak"],
  [/\bbaslatmakta\b/gi, "başlatmakta"],
  [/\bzorlandi\b/gi, "zorlandı"],
  [/\bolcek\b/gi, "ölçek"],
  [/\bfarkli\b/gi, "farklı"],
  [/\bsekilde\b/gi, "şekilde"],
  [/\byapilmasi\b/gi, "yapılması"],
  [/\bartti\b/gi, "arttı"],
  [/\bartmis\b/gi, "artmış"],
  [/\byaklasmak\b/gi, "yaklaşmak"],
  [/\bsikayet\b/gi, "şikayet"],
  [/\bsurdu\b/gi, "sürdü"],
  [/\bakisi\b/gi, "akışı"],
  [/\betkilesim\b/gi, "etkileşim"],
  [/\byonlendirme\b/gi, "yönlendirme"],
  [/\bnin amaci\b/gi, "ailenin amacı"],
  [/\byonergeleri\b/gi, "yönergeleri"],
  [/\bcocugun\b/gi, "çocuğun"],
  [/\bcocugu\b/gi, "çocuğu"],
  [/\bcocuga\b/gi, "çocuğa"],
  [/\bdogrudan\b/gi, "doğrudan"],
  [/\btibbi\b/gi, "tıbbi"],
  [/\baclik\b/gi, "açlık"],
  [/\bsusuzluk\b/gi, "susuzluk"],
  [/\bcekinme\b/gi, "çekinme"],
  [/\bgiriste\b/gi, "girişte"],
  [/\bzorlanmayi\b/gi, "zorlanmayı"],
  [/\btetiklemeyecegi\b/gi, "tetiklemeyeceği"],
  [/\byaklasmak\b/gi, "yaklaşmak"],
  [/\bzorlugu\b/gi, "zorluğu"],
  [/\barttiginda\b/gi, "arttığında"],
  [/\bkalis\b/gi, "kalış"],
  [/\bbasaramadigini\b/gi, "başaramadığını"],
  [/\bhissettigi\b/gi, "hissettiği"],
  [/\besik\b/gi, "eşik"],
  [/\bdusebiliyor\b/gi, "düşebiliyor"],
  [/\bhizla\b/gi, "hızla"],
  [/\banliyor\b/gi, "anlıyor"],
  [/\bgosterdigin\b/gi, "gösterdiğin"],
  [/\bacik\b/gi, "açık"],
  [/\byakinlik\b/gi, "yakınlık"],
  [/\bbasardigi\b/gi, "başardığı"],
  [/\bGoz-el\b/g, "Göz-el"],
  [/\bgoz-el\b/gi, "göz-el"],
  [/\baltinda\b/gi, "altında"],
  [/\bBakimveren\b/g, "Bakımveren"],
  [/\bbakimveren\b/gi, "bakımveren"],
  [/\bkurallari\b/gi, "kuralları"],
  [/\bsurdurme\b/gi, "sürdürme"],
  [/\byorgun\b/gi, "yorgun"],
  [/\bkalabalik\b/gi, "kalabalık"],
  [/\bgunlerde\b/gi, "günlerde"],
  [/\btoparlanmanin\b/gi, "toparlanmanın"],
  [/\bYapilandirilmis\b/g, "Yapılandırılmış"],
  [/\byapilandirilmis\b/gi, "yapılandırılmış"],
  [/\betkilesimde\b/gi, "etkileşimde"],
  [/\bcok\b/gi, "çok"],
  [/\bbasamakli\b/gi, "basamaklı"],
  [/\bgorevlerde\b/gi, "görevlerde"],
  [/\betkinligi\b/gi, "etkinliği"],
  [/\bverilmediginde\b/gi, "verilmediğinde"],
  [/\bdagilma\b/gi, "dağılma"],
  [/\bkisa\b/gi, "kısa"],
  [/\bsaglanabiliyor\b/gi, "sağlanabiliyor"],
  [/\bGrup\b/g, "Grup"],
  [/\bicinde\b/gi, "içinde"],
  [/\bkacirmama\b/gi, "kaçırmama"],
  [/\bkuralli\b/gi, "kurallı"],
  [/\bdagilmadan\b/gi, "dağılmadan"],
  [/\byapida\b/gi, "yapıda"],
  [/\bust uste\b/gi, "üst üste"],
  [/\bgeldiginde\b/gi, "geldiğinde"],
  [/\byavasliyor\b/gi, "yavaşlıyor"],
  [/\byanit\b/gi, "yanıt"],
  [/\bdaginligi\b/gi, "dağınıklığı"],
  [/\bbaglam\b/gi, "bağlam"],
  [/\balanlarinda\b/gi, "alanlarında"],
  [/\balanlari\b/gi, "alanları"],
  [/\bskorlarinda\b/gi, "skorlarında"],
  [/\bislemleme\b/gi, "işlemleme"],
  [/\bSozlu\b/g, "Sözlü"],
  [/\bsozlu\b/gi, "sözlü"],
  [/\byonerge\b/gi, "yönerge"],
  [/\bisleme\b/gi, "işleme"],
  [/\bicerikli\b/gi, "içerikli"],
  [/\bbaglamsal\b/gi, "bağlamsal"],
  [/\bfarkindalik\b/gi, "farkındalık"],
  [/\bkarsilikli\b/gi, "karşılıklı"],
  [/\byukseklik\b/gi, "yükseklik"],
  [/\bzorlanmasi\b/gi, "zorlanması"],
  [/\bdavranisi\b/gi, "davranışı"],
  [/\bnoktasinda\b/gi, "noktasında"],
  [/\balaninda\b/gi, "alanında"],
  [/\bortalamanin\b/gi, "ortalamanın"],
  [/\byas\b/gi, "yaş"],
  [/\bguclugunun\b/gi, "güçlüğünün"],
  [/\bguclugu\b/gi, "güçlüğü"],
  [/\bduygu ilişkili self-regülasyonun\b/gi, "duyguyla ilişkili self-regülasyonun"],
  [/\barttigini\b/gi, "arttığını"],
  [/\buzadigini\b/gi, "uzadığını"],
  [/\bartiyor\b/gi, "artıyor"],
  [/\bbelirginlesiyor\b/gi, "belirginleşiyor"],
  [/\bislevsel\b/gi, "işlevsel"],
  [/\bguclugu\b/gi, "güçlüğü"],
  [/\bbutunleme\b/gi, "bütünleme"],
  [/\bacilma\b/gi, "açılma"],
  [/\bihtiyaci\b/gi, "ihtiyacı"],
  [/\bipuclarini\b/gi, "ipuçlarını"],
  [/\bbuyumeden\b/gi, "büyümeden"],
  [/\byardim\b/gi, "yardım"],
  [/\bgun icinde\b/gi, "gün içinde"],
  [/\bduzenli\b/gi, "düzenli"],
  [/\bfarkindaligi\b/gi, "farkındalığı"],
  [/\bGozlemde\b/g, "Gözlemde"],
  [/\bgozlemde\b/gi, "gözlemde"],
  [/\bgozledi\b/gi, "gözledi"],
  [/\bgordu\b/gi, "gördü"],
  [/\bkotu\b/gi, "kötü"],
  [/\bcift\b/gi, "çift"],
  [/\bsayili\b/gi, "sayılı"],
  [/\btek sayili\b/gi, "tek sayılı"],
  [/\bmukemmel\b/gi, "iyi"],
  [/\bsecmez\b/gi, "seçmez"],
  [/\bhicbir\b/gi, "hiçbir"],
  [/\bsey\b/gi, "şey"],
  [/\bdikkatli bakilsin\b/gi, "daha ayrıntılı değerlendirilmesi istiyor"],
  [/\bbasi\b/gi, "başı"],
  [/\bkatilim\b/gi, "katılım"],
  [/\bbelirginlestiginde\b/gi, "belirginleştiğinde"],
  [/\bonce\b/gi, "önce"],
  [/\bdagiliyor\b/gi, "dağılıyor"],
  [/\bcekilme\b/gi, "çekilme"],
  [/\bhizli\b/gi, "hızlı"],
  [/\btoparlaniyor\b/gi, "toparlanıyor"],
  [/\bgorevde\b/gi, "görevde"],
  [/\byasa\b/gi, "yaşa"],
  [/\bgecisleri\b/gi, "geçişleri"],
  [/\bIletisim\b/g, "İletişim"],
  [/\biletisim\b/gi, "iletişim"],
  [/\bgoreli\b/gi, "göreli"],
  [/\bdusukluk\b/gi, "düşüklük"],
  [/\bdusuk\b/gi, "düşük"],
  [/\bgunluk\b/gi, "günlük"],
  [/\byasam\b/gi, "yaşam"],
  [/\bgecis(?:ler(?:de)?)?\b/gi, (match) => match.toLocaleLowerCase("tr-TR").includes("lerde") ? "geçişlerde" : "geçiş"],
  [/\besya\b/gi, "eşya"],
  [/\bhatirlatma\b/gi, "hatırlatma"],
  [/\bkorunmus\b/gi, "korunmuş"],
  [/\bgorunuyor\b/gi, "görünüyor"],
  [/\bbaslatma\b/gi, "başlatma"],
  [/\byetiskin\b/gi, "yetişkin"],
  [/\byukselme\b/gi, "yükselme"],
  [/\byuk\b/gi, "yük"],
  [/\bduzenleme\b/gi, "düzenleme"],
  [/\bduyarli\b/gi, "duyarlı"],
  [/\bsiniri\b/gi, "sınırı"],
  [/\balt sinirinda\b/gi, "alt sınırında"],
  [/\bsonuc\b/gi, "sonuç"],
  [/\boz bakim\b/gi, "öz bakım"],
];

const INTERNAL_INSTRUCTION_REPLACEMENTS: Array<[RegExp, string]> = [
  [
    /Yürütücü işlev dili, davranış organizasyonunun görev akışı içinde nasıl çözüldüğünü göstermeli; sorunu yalnız uyumsuzluk veya itaat eksikliği gibi sunmamalıdır\./g,
    "Yürütücü işlev güçlüğü, davranış organizasyonunun görev akışı içinde nerede zorlandığını görünür kılar. Bu bulgu görev düzenleme becerileri üzerinden değerlendirilir.",
  ],
  [
    /İnterosepsiyon öne çıktığında rapor, iç beden sinyallerinin günlük öz bakım ve toparlanma akışına nasıl katılamadığını anlatmalı; tek başına medikal açıklama üretmemelidir\./g,
    "İnteroseptif güçlük, iç beden sinyallerinin günlük öz bakım ve toparlanma akışına zamanında katılamaması üzerinden klinik anlam kazanır.",
  ],
  [
    /Fizyolojik regülasyon öne çıktığında rapor, bedensel toparlanma zemininin günlük akışta ne zaman kırılganlaştığını anlatmalı; tıbbi nedensellik veya otonom bozukluk dili kurmamalıdır\./g,
    "Fizyolojik regülasyon güçlüğü, bedensel toparlanmanın günlük akışta hangi koşullarda zorlandığını açıklar. Bu bulgu tıbbi bir neden veya otonom işlev bozukluğu göstermez.",
  ],
  [
    /Duyusal regülasyon öne çıktığında rapor, çevresel uyaran yükünün işlevsel performansı nasıl dalgalandırdığını açıklamalı; sorunu yalnız davranış etiketiyle tanımlamamalıdır\./g,
    "Duyusal regülasyon yükü, çevresel uyaranların işlevsel performansı hangi koşullarda dalgalandırdığını açıklar; davranışı tek başına etiketleyen bir yorum değildir.",
  ],
  [
    /Duygusal regülasyon dili, yoğunluğun ne zaman yükseldiğini ve toparlanmanın hangi bağlamlarda zorlandığını anlatmalı; psikiyatrik etiket ya da kişilik çıkarımı yapmamalıdır\./g,
    "Duygusal regülasyon yükü, yoğunluğun hangi bağlamlarda yükseldiği ve toparlanmanın ne zaman zorlandığı üzerinden yorumlanır; psikiyatrik etiket ya da kişilik çıkarımı üretmez.",
  ],
  [
    /Bilişsel regülasyon öne çıktığında rapor, sözel talep veya eşzamanlı görev yükü altında zihinsel organizasyonun nasıl zorlandığını anlatmalı; genel zeka veya öğrenme kapasitesi hükmüne gitmemelidir\./g,
    "Sözel talep veya eşzamanlı görev arttığında zihinsel organizasyon zorlanabilir. Bu bulgu tek başına genel zekâ veya öğrenme kapasitesi hakkında sonuç vermez.",
  ],
];

const FORBIDDEN_LANGUAGE_PATTERNS: Array<{ code: string; severity: ReportLanguageIssueSeverity; pattern: RegExp; message: string }> = [
  { code: "kb_instruction_leak", severity: "high", pattern: /\b(?:rapor[^.]{0,120})?(?:anlatmalı|göstermeli|yazılmalı|yazılmalıdır|açıklamalı|kurmamalıdır|üretmemelidir)\b/i, message: "KB yönerge dili final rapora sızmış." },
  { code: "technical_item_language", severity: "high", pattern: /\b(?:madde düzeyi|anket maddesi|yanıt dizisi|soru numarası)\b/i, message: "Teknik ölçek/madde dili final raporda görünüyor." },
  { code: "pathology_language", severity: "high", pattern: /\bpatolojik\b/i, message: "Patoloji dili final raporda görünmemeli." },
  { code: "raw_diagnosis_placeholder", severity: "high", pattern: /tan[ıi]lanm[ıi]s bozukluk bildirilmiyor/i, message: "Tanı placeholder metni final rapora taşınmış." },
  { code: "treatment_focused_vocabulary", severity: "high", pattern: /\b(?:tedavi|müdahale|terapi|seans|ilaç|danışmanlık|destek planı|uygulama yönergesi)\b/i, message: "Tedavi/terapi odaklı kelime final raporda görünmemeli." },
  { code: "directive_modal_language", severity: "high", pattern: /\b(?:yapılmalıdır|uygulanmalıdır|başlanmalıdır|baslanmalidir|kullanılmalıdır|kullanılmamalıdır|edilmemeli|gerekir)\b/i, message: "Direktif uygulama dili final raporda görünmemeli." },
  { code: "practice_plan_language", severity: "high", pattern: /\b(?:program|protokol|egzersiz listesi|seans akışı|seans akisi)\b/i, message: "Uygulama planı çağrıştıran dil final raporda görünmemeli." },
  { code: "diagnostic_semantic_language", severity: "high", pattern: /\b(?:tanı ile uyumlu|tani ile uyumlu|belirtisidir|semptom|bozukluk|patoloji)\b/i, message: "Tanısal çağrışım yapan dil final raporda görünmemeli." },
  { code: "legacy_watch_range", severity: "medium", pattern: /watch range/i, message: "İngilizce watch range ifadesi görünmemeli." },
  { code: "awkward_clinical_reading", severity: "medium", pattern: /klinik okuma|klinik açıdan en güçlü okuma/i, message: "Mekanik klinik okuma kalıbı görünüyor." },
  { code: "visible_debug_metric", severity: "high", pattern: /\b(?:Runtime RAG|Deterministic Knowledge Base|LLM:\s*%0)\b/i, message: "Teknik/debug metrikleri görünür raporda yer almamalı." },
  { code: "system_label_leak", severity: "high", pattern: /\b(?:Klinik karar cümlesi|Bağlam notu|Kanıt entegrasyonu|Kalibrasyon|Ayırıcı sınır|İkincil izlem alanları|Birincil mekanizma|İkincil yayılım)\s*:/i, message: "Sistem etiketi kokan kalıp görünür rapora sızmış." },
  { code: "awkward_profile_label", severity: "high", pattern: /Klinik profil\s+"[^"]*(?:Kırılganlık|Kanıt-Sınırlı)[^"]*"/i, message: "Profil adı doğal olmayan kırılganlık veya kanıt-sınırlı etiketi içeriyor." },
  { code: "singular_domain_plural", severity: "high", pattern: /(?<!ve )(?<!, )(?:Fizyolojik Regülasyon|Duyusal Regülasyon|Duygusal Regülasyon|Bilişsel Regülasyon|Yürütücü İşlev|İnterosepsiyon) alanlar(?:ı|ında)\b/i, message: "Tek bir alan adı çoğul ekle kullanılmış." },
  { code: "system_decision_wording", severity: "high", pattern: /karar notu toplam skor görünümü|alan bazlı kırılganlığı birlikte okur/i, message: "Kullanıcıya dönük raporda sistem dili kalmış." },
  { code: "functional_friction", severity: "high", pattern: /işlevsel sürtünme/i, message: "İşlevsel sürtünme ifadesi doğal klinik Türkçe değil." },
  { code: "internal_english_term", severity: "high", pattern: /\b(?:emotional|cognitive|executive) yayılım|motor\/praxis|scaled score\b/i, message: "İç sistemde kullanılan İngilizce terim görünür rapora sızmış." },
  { code: "lowercase_sentence_start", severity: "high", pattern: /\.\s+(?:sözel|yardım|ilişki|görsel|duyusal|bilişsel|yürütücü|öz bakım)\b/, message: "Noktadan sonra cümle küçük harfle başlıyor." },
  { code: "self_regulation_problem", severity: "high", pattern: /self-regülasyon problemi/i, message: "Self-regülasyon problemi yerine daha açık güçlük dili kullanılmalı." },
  { code: "broken_turkish_suffix", severity: "high", pattern: /güçlüğünin|güçlüğündan|güçlüğünı\b/i, message: "Klinik metinde bozuk Türkçe çekim eki bulundu." },
  { code: "visible_meta_instruction", severity: "high", pattern: /güvence gibi yazılmamalıdır|tek bir yüzeysel açıklama|risk iddiasını genişletmek|öncelikli karar ekseni/i, message: "Klinik raporda sistem talimatı veya denetim dili kalmış." },
  { code: "functional_impact_repetition", severity: "high", pattern: /gösterebilme performansıdır/i, message: "İşlevsel karşılık cümlesinde anlam tekrarı var." },
  { code: "legacy_global_label", severity: "high", pattern: /\bGlobal sınıflama\b/i, message: "Görünür raporda genel sınıflama yerine eski teknik etiket kullanılmış." },
  { code: "abstract_primary_problem", severity: "high", pattern: /ana sorunun günlük işlevdeki görünümü/i, message: "Ana sorun ifadesi yerine temel klinik güçlük açıkça yazılmalı." },
  { code: "limited_observation_as_evidence", severity: "high", pattern: /Kararı destekleyen bulgular:\s*\n-\s*Terapist gözlemi:\s*kısa görüşme/i, message: "Sınırlı gözlem destekleyici kanıt gibi sunulmuş." },
  { code: "external_evidence_sentence_fragment", severity: "high", pattern: /bulgularının yorum içine alınması\./i, message: "Dış test kanıtı yüklemsiz bir cümle olarak yazılmış." },
  { code: "exploratory_jargon", severity: "high", pattern: /exploratuvar/i, message: "Gelişimsel temkin yerine anlaşılması güç exploratuvar terimi kullanılmış." },
  { code: "broken_selective_word", severity: "high", pattern: /seçiçi/i, message: "Seçici kelimesi hatalı yazılmış." },
  { code: "mechanism_grammar_error", severity: "high", pattern: /yansıması göstermektedir/i, message: "Klinik mekanizma cümlesinde dilbilgisi hatası var." },
  { code: "visible_negative_instruction", severity: "high", pattern: /\b(?:kullanılmamalıdır|yorumlanmamalıdır|indirgenmemelidir)\b/i, message: "Final raporda kullanıcıya dönük bulgu yerine yazım talimatı kalmış." },
  { code: "legacy_primary_axis_wording", severity: "high", pattern: /ana eksen üzerinden tutulur/i, message: "Ana eksen ifadesi yerine temel klinik odak açıkça yazılmalı." },
  { code: "abstract_regulation_load", severity: "high", pattern: /düzenleme yükü olarak okunur/i, message: "Düzenleme yükü olarak okunur ifadesi gereksiz derecede soyut." },
  { code: "uppercase_after_anamnesis_lead", severity: "high", pattern: /Anamnezde\s+(?:Sözel|Görsel|Duyusal|Bilişsel|Yürütücü|Çevresel|Dokunsal|Geçiş|Sosyal|Öz)(?![\p{L}\p{N}_])/u, message: "Anamnez girişinden sonra cümle gereksiz büyük harfle devam ediyor." },
  { code: "abstract_regulatory_load", severity: "high", pattern: /\b(?:yürütücü|düzenleyici) yük(?:ün)?\b/i, message: "Yük ifadesi yerine somut self-regülasyon güçlüğü yazılmalı." },
  { code: "age_mismatch_instruction_language", severity: "high", pattern: /ana klinik karar mekanizmasına dahil edilmemeli/i, message: "Yaş uyumsuz test sınırı, kullanıcıya dönük klinik cümleyle yazılmalı." },
];

const ASCII_TURKISH_PATTERNS = [
  TURKISH_ASCII_WORD_DETECTION_PATTERN,
  /\bgunluk\b/i,
  /\byasam\b/i,
  /\bgecis/i,
  /\besya\b/i,
  /\bhatirlatma\b/i,
  /\bkorunmus\b/i,
  /\bgorunuyor\b/i,
  /\bbaslatma\b/i,
  /\byetiskin\b/i,
  /\bIletisim\b/,
  /\bdusuk/i,
  /\bcesitli\b/i,
  /\bistegi\b/i,
  /\byetiskinle\b/i,
  /\bazaldiginda\b/i,
  /\bsiralama\b/i,
  /\byapabildigi\b/i,
  /\bbagimsiz\b/i,
  /\banlamli\b/i,
  /\bbaglama\b/i,
  /\bIki\b/,
  /\bUc\b/,
  /\barasi\b/i,
  /\bfarki\b/i,
  /\bsirayi\b/i,
  /\bsirada\b/i,
  /\byardimi\b/i,
  /\bongorulebilir\b/i,
  /\bbilesik\b/i,
  /\byapildi\b/i,
];

function applyReplacements(text: string, replacements: Array<[RegExp, TextReplacement]>) {
  return replacements.reduce((current, [pattern, replacement]) => current.replace(pattern, replacement as any), text);
}

function preserveReplacementCase(match: string, replacement: string): string {
  if (match === match.toLocaleUpperCase("tr-TR")) return replacement.toLocaleUpperCase("tr-TR");
  if (/^[A-Z]/.test(match)) {
    return `${replacement.charAt(0).toLocaleUpperCase("tr-TR")}${replacement.slice(1)}`;
  }
  return replacement;
}

function replaceTurkishAsciiWords(text: string): string {
  return text.replace(TURKISH_ASCII_WORD_REPLACEMENT_PATTERN, (match) => {
    const replacement = TURKISH_ASCII_WORD_REPLACEMENTS[match.toLocaleLowerCase("tr-TR")];
    return replacement ? preserveReplacementCase(match, replacement) : match;
  });
}

export function normalizeTurkishClinicalText(text: unknown): string {
  const value = String(text || "");
  if (!value) return "";
  return replaceTurkishAsciiWords(applyReplacements(value, TURKISH_ASCII_REPLACEMENTS))
    .replace(/[ \t]{2,}/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n[ \t]+/g, "\n")
    .trim();
}

function normalizeRepeatedMechanismLabels(text: string): string {
  return text
    .replace(/Ek bulgu hattı \(([^)]+)\) bu formülasyonu destekleyen bağlamsal kanıt olarak kalır\./g, "$1; bu bulgu formülasyonu destekleyen ek klinik kanıtlar arasında yer alır.")
    .replace(/Ek bulgu hattı \(([^)]+)\) bu formülasyonu büyüten değil, yorum sınırını ve korunmuş işlev alanlarını görünür kılan dengeleyici bağlam olarak kalır\./g, "$1; bu bulgu ana formülasyonu büyütmek yerine yorum sınırını ve korunmuş işlev alanlarını görünür kılar.")
    .replace(/Bu nedenle anamnez ile ölçek arasında doğrudan patolojik uyumdan çok,/g, "Bu nedenle anamnez ile ölçek arasında doğrudan risk eşleşmesinden çok,")
    .replace(/Ölçek içi mikro-kanıt/g, "Ölçek yanıt örüntüsü")
    .replace(/mikro-kanıt/gi, "ölçek yanıt örüntüsü")
    .replace(/Madde düzeyi yanıt dizisi bulunmadığı için/g, "Ölçek içi ayrıntılı yanıt örüntüsü bulunmadığı için")
    .replace(/madde düzeyi yanıt dizisi bulunmadığı için/g, "ölçek içi ayrıntılı yanıt örüntüsü bulunmadığı için")
    .replace(/mekanizma-temelli bir regülasyon profili olarak okunmalıdır\./g, "klinik izlemde mekanizma temelli olarak ele alınmalıdır.")
    .replace(/Bu alan belirli koşullarda, özellikle ([^.]+) olarak yazılmalıdır\./g, "Bu alan belirli koşullarda, özellikle $1 olarak klinik anlam kazanır.")
    .replace(/Bu alandaki kırılganlık, ([^.]+) üzerinden yazılmalıdır/g, "Bu alandaki kırılganlık, $1 üzerinden klinik anlam kazanır")
    .replace(/anlamlı birliktelik olarak yazılmalıdır/g, "anlamlı birliktelik olarak ele alınır")
    .replace(/ayrıştırılarak yazılmalıdır/g, "ayrıştırılarak ele alınır")
    .replace(/birlikte gösterilmelidir/g, "birlikte görünür kılınır")
    .replace(/biçimde anlatmalıdır/g, "biçimde ele alınır")
    .replace(/üretmemelidir/g, "üretmez");
}

function replaceInternalMechanismIds(text: string): string {
  return text
    .replace(/\blanguage_social_pragmatic\b/g, "dilsel ve sosyal-pragmatik talep")
    .replace(/\blanguage_communication\b/g, "dilsel iletişim")
    .replace(/\bsocial_pragmatic\b/g, "sosyal-pragmatik talep")
    .replace(/\badaptive_daily_living\b/g, "günlük yaşam ve öz bakım")
    .replace(/\bmotor_praxis\b/g, "motor planlama ve praksi")
    .replace(/\bphysiological_interoceptive\b/g, "beden-temelli toparlanma ve interoseptif düzenleme")
    .replace(/\bevidence_limited_mixed\b/g, "kanıtı sınırlı, bağlama duyarlı profil")
    .replace(/\bexecutive_behavior\b/g, "yürütücü davranış düzenleme")
    .replace(/\bsensory_processing\b/g, "duyusal işlemleme")
    .replace(/\bdevelopment_general\b/g, "genel gelişim")
    .replace(/sensory-emotional/g, "duyusal-duygusal")
    .replace(/social-pragmatic/g, "sosyal-pragmatik")
    .replace(/\bve dilsel ve sosyal-pragmatik talep\b/g, "ve dilsel-sosyal pragmatik talep")
    .replace(/bakımveren anlatısı/gi, "aileden gelen bilgi")
    .replace(/Bakımveren anlatısına/g, "Aileden gelen bilgiye")
    .replace(/aileden gelen bilgina/gi, "aileden gelen bilgiye")
    .replace(/(^|\n)aileden gelen bilgiye\s+terapist/gi, "$1Aileden gelen bilgiye, terapist")
    .replace(/Aile tarafından Bakımveren,\s*/g, "Aile tarafından ")
    .replace(/İlişki:\s*dilsel iletişim ve dilsel-sosyal pragmatik talep mekanizmalarını destekler\./g, "İlişki: Dilsel ve sosyal-pragmatik talebin birlikte arttığı durumları destekler.")
    .replace(/İlişki:\s*sosyal-pragmatik talep ve dilsel-sosyal pragmatik talep mekanizmalarını destekler\./g, "İlişki: Sosyal-pragmatik talep ile dilsel yükün birlikte ele alınmasını destekler.")
    .replace(/İlişki:\s*günlük yaşam ve öz bakım mekanizmasını ve korunmuş profil varsa işlevsel denge yorumunu destekler\./g, "İlişki: Günlük yaşam ve öz bakım akışındaki işlevsel dengeyi yorumlamaya katkı sağlar.")
    .replace(/İlişki:\s*günlük yaşam ve öz bakım, sosyal-pragmatik ve korunmuş profil yorumunu destekler\./g, "İlişki: Günlük yaşam becerileri ve korunmuş işlev alanlarını birlikte yorumlamaya katkı sağlar.")
    .replace(/İlişki:\s*motor planlama ve praksi mekanizmasını ve yürütücü\/bilişsel yayılımı destekler\./g, "İlişki: Motor planlama yükünün yürütücü ve bilişsel organizasyona yayılımını destekler.")
    .replace(/İlişki:\s*motor planlama ve praksi mekanizması için yüksek değerli destekleyici testtir\./g, "İlişki: Motor planlama ve praksi eksenini güçlü biçimde destekler.");
}

function splitOverloadedClinicalSentences(text: string): string {
  return text
    .replace(
      /,\s*regülasyon örüntüsünün yalnız bireysel performans değil etkileşimsel talep altında da değerlendirilmesi gerektiğini/gi,
      ". Bu bulgular, regülasyon örüntüsünün yalnız bireysel performans değil etkileşimsel talep altında da değerlendirilmesi gerektiğini"
    )
    .replace(
      /bulguları,\s*zorlanmanın yalnız dikkat ya da genel davranış kontrolünde değil;/gi,
      "bulguları klinik açıdan önemlidir. Zorlanma yalnız dikkat ya da genel davranış kontrolünde değil;"
    )
    .replace(
      /gibi kaynaklardan gelen işlevsel veri,\s*regülasyon yükünün yalnız kapasite düzeyinde değil/gi,
      "gibi kaynaklardan gelen işlevsel veri klinik açıdan tamamlayıcıdır. Regülasyon yükü yalnız kapasite düzeyinde değil"
    )
    .replace(/;\s*bu tür\s+/gi, ". Bu tür ")
    .replace(/;\s*bu durum\s+/gi, ". Bu durum ")
    .replace(/;\s*bu bulgu\s+/gi, ". Bu bulgu ")
    .replace(/;\s*bu ilişki\s+/gi, ". Bu ilişki ")
    .replace(/;\s*erken çocuklukta\s+/gi, ". Erken çocuklukta ")
    .replace(/;\s*duygu ilişkili\s+/gi, ". Duygu ilişkili ")
    .replace(/;\s*vagal kontrol\s+/gi, ". Vagal kontrol ")
    .replace(/;\s*dış test kanıtı\s+/gi, ". Dış test kanıtı ")
    .replace(/;\s*bu nedenle\s+/gi, ". Bu nedenle ");
}

function removeRepeatedLongSentences(text: string): string {
  const seen = new Set<string>();
  const cleaned = text.replace(/[^.!?\n]+[.!?]/g, (sentence) => {
    const normalized = normalizeSentence(sentence);
    if (normalized.length < 80) return sentence;
    if (seen.has(normalized)) return "";
    seen.add(normalized);
    return sentence;
  });

  return cleaned
    .split("\n")
    .map((line) => line.replace(/[ \t]{2,}/g, " ").trimEnd())
    .filter((line) => !/^-\s*$/.test(line.trim()))
    .join("\n");
}

function removeTreatmentFocusedVocabulary(text: string): string {
  const cleaned = text
    .replace(/tedavi protokolü çıkarımı sağlamaz/gi, "uygulama planı çıkarımı sağlamaz")
    .replace(/müdahale önerisi veya protokol çıkarımı sağlamaz/gi, "uygulama önerisi çıkarımı sağlamaz")
    .replace(/müdahale protokolü üretmez/gi, "uygulama planı üretmez")
    .replace(/müdahale protokolü/gi, "uygulama planı")
    .replace(/tedavi protokolü/gi, "uygulama planı")
    .replace(/protokolü/gi, "uygulama planı")
    .replace(/\byapılmalıdır\b/gi, "klinik olarak ele alınır")
    .replace(/\buygulanmalıdır\b/gi, "vaka dışı yönergeye dönüştürülmez")
    .replace(/\bbaşlanmalıdır\b/gi, "başlangıç kararı üretmez")
    .replace(/\bbaslanmalidir\b/gi, "başlangıç kararı üretmez")
    .replace(/\bgerekir\b/gi, "uygundur")
    .replace(/\bprogram\b/gi, "klinik yapı")
    .replace(/\bprotokol\b/gi, "vaka dışı yapı")
    .replace(/\begzersiz listesi\b/gi, "vaka dışı liste")
    .replace(/\bseans akışı\b/gi, "oturum akışı")
    .replace(/\bseans akisi\b/gi, "oturum akışı")
    .replace(/\btanı ile uyumlu\b/gi, "tanısal sonuç olarak kullanılmaz")
    .replace(/\btani ile uyumlu\b/gi, "tanısal sonuç olarak kullanılmaz")
    .replace(/\bbelirtisidir\b/gi, "klinik yorum için tek başına yeterli değildir")
    .replace(/\bsemptom\b/gi, "klinik bulgu")
    .replace(/\bbozukluk\b/gi, "klinik zorlanma")
    .replace(/\bpatoloji\b/gi, "klinik risk")
    .replace(/tedavi gerekliliği göstermez/gi, "klinik gereklilik göstermez")
    .replace(/tedavi hükmü değildir/gi, "vaka dışı karar niteliği taşımaz")
    .replace(/tedavi reçetesi değildir/gi, "vaka dışı karar değildir")
    .replace(/tedavi reçetesi/gi, "vaka dışı karar")
    .replace(/tedavi kararı üretmez/gi, "vaka dışı karar üretmez")
    .replace(/tedavi önerisi üretmez/gi, "vaka dışı öneri üretmez")
    .replace(/tedavi çıkarımı sağlamaz/gi, "vaka dışı çıkarım sağlamaz")
    .replace(/\btedavi\b/gi, "klinik uygulama")
    .replace(/müdahale reçetesi olarak kullanılmaz/gi, "vaka dışı karar olarak kullanılmaz")
    .replace(/müdahale reçetesi üretmez/gi, "vaka dışı karar üretmez")
    .replace(/müdahale reçetesi/gi, "vaka dışı karar")
    .replace(/müdahale kararı üretmez/gi, "vaka dışı karar üretmez")
    .replace(/müdahale öneren dil/gi, "vaka dışı öneri dili")
    .replace(/müdahale önermeyen/gi, "vaka dışı öneri üretmeyen")
    .replace(/\bmüdahale\b/gi, "vaka dışı uygulama")
    .replace(/\bterapi planı\b/gi, "vaka dışı plan")
    .replace(/\bterapi bağlamıyla\b/gi, "klinik bağlamla")
    .replace(/\bterapi\b/gi, "klinik uygulama")
    .replace(/\bergoterapi\b/gi, "pediatrik klinik")
    .replace(/\bseans sıklığı\b/gi, "oturum sıklığı")
    .replace(/\bseans\b/gi, "oturum")
    .replace(/\bilaç\/medikal yorum\b/gi, "medikal karar")
    .replace(/\bilaç\b/gi, "medikal karar")
    .replace(/\bdanışmanlık\b/gi, "klinik görüşme")
    .replace(/\bdestek planı\b/gi, "vaka dışı plan")
    .replace(/\buygulama yönergesi\b/gi, "vaka dışı yönlendirme")
    .replace(/Görünür rapor tanı önerisi, vaka dışı plan, oturum sıklığı, medikal karar, aileye direkt tavsiye listesi veya kesin neden-sonuç açıklaması üretmez\./gi, "Görünür rapor yalnız değerlendirme ve klinik hipotez düzeyinde kalır.")
    .replace(/Bu rapor tanısal hüküm veya vaka dışı yönlendirme üretmez;/gi, "Bu rapor tanısal hüküm üretmez;")
    .replace(/Bu rapor tanısal hüküm veya vaka dışı yönlendirme üretmez\./gi, "Bu rapor tanısal hüküm üretmez.");

  return cleaned
    .replace(/vaka dışı yapıü/gi, "uygulama planı")
    .replace(/protokolü/gi, "uygulama planı")
    .replace(/\bgerekir\b/gi, "uygundur")
    .replace(/\bprogram\b/gi, "klinik yapı")
    .replace(/\bprotokol\b/gi, "vaka dışı yapı")
    .replace(/\begzersiz listesi\b/gi, "vaka dışı liste")
    .replace(/\bseans akışı\b/gi, "oturum akışı")
    .replace(/\bseans akisi\b/gi, "oturum akışı")
    .replace(/\bbozukluk\b/gi, "klinik zorlanma")
    .replace(/\bpatoloji\b/gi, "klinik risk")
    .replace(/\bpatolojik\b/gi, "klinik açıdan dikkat gerektiren")
    .replace(/\btedavi\b/gi, "klinik uygulama")
    .replace(/\bmüdahale\b/gi, "vaka dışı uygulama")
    .replace(/\bterapi\b/gi, "klinik uygulama")
    .replace(/\bseans\b/gi, "oturum")
    .replace(/\bilaç\b/gi, "medikal karar")
    .replace(/\bdanışmanlık\b/gi, "klinik görüşme")
    .replace(/\bdestek planı\b/gi, "vaka dışı plan")
    .replace(/\buygulama yönergesi\b/gi, "vaka dışı yönlendirme");
}

function capitalizeSentenceStarts(text: string): string {
  return text.replace(/(^|[.!?]\s+)(?!https?:\/\/)([a-zçğıöşü])/g, (_match, prefix: string, initial: string) =>
    `${prefix}${initial.toLocaleUpperCase("tr-TR")}`
  );
}

const INTERNAL_NORMATIVE_DISCLOSURE_PATTERN =
  /\b(?:normatif|standardize edilmiş norm(?:atif)?|tanı eşiği|yaş-duyarlı yorum|sistem içi (?:sabit )?eşik|sistem içi yorum bandı)\b/i;

function removeInternalNormativeDisclosure(text: string): string {
  return String(text || "")
    .split("\n")
    .map((line) =>
      line
        .split(/(?<=[.!?])\s+/)
        .filter((sentence) => !INTERNAL_NORMATIVE_DISCLOSURE_PATTERN.test(sentence))
        .join(" ")
        .trim()
    )
    .join("\n")
    .replace(/\n{3,}/g, "\n\n");
}

export function sanitizeFinalReportLanguage(text: string): string {
  let sanitized = removeInternalNormativeDisclosure(text);
  sanitized = applyReplacements(sanitized, INTERNAL_INSTRUCTION_REPLACEMENTS);
  sanitized = normalizeRepeatedMechanismLabels(sanitized);
  sanitized = replaceInternalMechanismIds(sanitized);
  sanitized = normalizeTurkishClinicalText(sanitized);
  sanitized = splitOverloadedClinicalSentences(sanitized);
  sanitized = removeRepeatedLongSentences(sanitized);
  sanitized = removeTreatmentFocusedVocabulary(sanitized);
  sanitized = sanitized
    .replace(/\böz-düzenlemenin\b/gi, "self-regülasyonun")
    .replace(/\böz-düzenlemeyi\b/gi, "self-regülasyonu")
    .replace(/\böz-düzenleme\b/gi, "self-regülasyon")
    .replace(/kanıt-sınırlı/gi, "kanıtı sınırlı")
    .replace(/\bscaled score\b/gi, "ölçek puanı")
    .replace(/\bemotional yayılım\b/gi, "duygusal yansımalar")
    .replace(/\bcognitive\/executive yayılım\b/gi, "bilişsel ve yürütücü yansımalar")
    .replace(/\bexecutive\/cognitive yayılım\b/gi, "yürütücü ve bilişsel yansımalar")
    .replace(/\bmotor\/praxis\b/gi, "motor planlama ve praksi")
    .replace(/self-regülasyon probleminin/gi, "self-regülasyon güçlüğünün")
    .replace(/self-regülasyon problemine/gi, "self-regülasyon güçlüğüne")
    .replace(/self-regülasyon problemleri/gi, "self-regülasyon güçlükleri")
    .replace(/self-regülasyon problemini/gi, "self-regülasyon güçlüğünü")
    .replace(/self-regülasyon problemi/gi, "self-regülasyon güçlüğü")
    .replace(/self-regülasyon güçlüğünin/gi, "self-regülasyon güçlüğünün")
    .replace(/regülasyon kırılganlığının/gi, "regülasyon güçlüğünün")
    .replace(/self-regülasyon kırılganlığından/gi, "self-regülasyon güçlüğünden")
    .replace(/alan bazlı kırılganlığı/gi, "alanlar arasındaki güçlük dağılımını")
    .replace(/kırılganlıkların/gi, "güçlüklerin")
    .replace(/kırılganlığın/gi, "güçlüğün")
    .replace(/kırılganlığı/gi, "güçlüğü")
    .replace(/kırılganlık/gi, "güçlük")
    .replace(/kırılganlaştığını/gi, "zorlandığını")
    .replace(/kırılganlaşabileceğini/gi, "zorlanabileceğini")
    .replace(/kırılganlaşabilir/gi, "zorlanabilir")
    .replace(/işlevsel sürtünme/gi, "işlevsel zorlanma")
    .replace(/\bGlobal sınıflama\b/gi, "Genel sınıflama")
    .replace(/güvence gibi yazılmamalıdır/gi, "diğer alanlardaki zorlanmaları dışlamaz")
    .replace(/ana sorunun günlük işlevdeki görünümünü/gi, "temel güçlüğün günlük işlevdeki görünümünü")
    .replace(/Yorum tek bir yüzeysel açıklamaya indirgenmeden bağlamsal kanıtla sınırlı tutulur\./gi, "Klinik yorum tek bir nedene indirgenmez; skorlar, anamnez, gözlem ve dış test bilgileri birlikte değerlendirilir.")
    .replace(/Korunmuş ya da çelişkili bulgular risk iddiasını genişletmek için değil, kararın sınırını belirlemek için kullanılmıştır\./gi, "Korunmuş veya çelişkili bulgular, klinik yorumun hangi görev ve koşullarda geçerli olduğunu belirler.")
    .replace(/mevcut veriler öncelikli karar ekseni, görev sürdürme ve toparlanma süreçlerinin birlikte okunması gerektiğini gösterir/gi, "mevcut veriler temel klinik güçlük ile görev sürdürme ve toparlanma süreçlerinin birlikte değerlendirilmesi gerektiğini gösterir")
    .replace(/gösterebilme performansıdır/gi, "gösterebilme becerilerini kapsar")
    .replace(/Klinik karar cümlesi:\s*/gi, "")
    .replace(/Klinik formülasyon:\s*/gi, "")
    .replace(/Bağlam notu:\s*bire bir ve düşük uyaranlı yapı risk yorumunu sınırlayan korunmuş kapasite bilgisi sağlar\./gi, "Yapılandırılmış bire bir ortamda daha iyi organize olması, güçlüğün her bağlamda aynı şiddette görünmediğini düşündürür.")
    .replace(/Bağlam notu:\s*/gi, "")
    .replace(/Kanıt entegrasyonu:\s*/gi, "Bu sonuca nasıl ulaşıldı: ")
    .replace(/Kalibrasyon:\s*/gi, "Yorumu temkinli tutan bilgi: ")
    .replace(/Yorumu temkinli tutan bilgi:/gi, "Dengeleyici bilgi:")
    .replace(/Ayırıcı sınır:\s*/gi, "Klinik yorum sınırı: ")
    .replace(/İkincil izlem alanları\s+([^.\n]+?)\s+olarak ayrışmaktadır\./gi, "$1 aynı işlevsel güçlük kümesi içinde değerlendirilir.")
    .replace(/Klinik öncelik sırası:/gi, "Öncelik sırası:")
    .replace(/Vaka içi karar kanıtları:/gi, "Bu sonuca nasıl ulaşıldı:")
    .replace(/Birincil mekanizma\s+([^.\n]+?)\s+hattında toplanmaktadır\./gi, "Ana klinik odak $1 hattında belirginleşmektedir.")
    .replace(/İkincil yayılım\s+([^.\n]+?)\s+alanlarında görünürleşmektedir\./gi, "Günlük yaşama yansıyan alanlar $1 olarak görünürleşmektedir.")
    .replace(/Praksi ve Motor Planlama ile İlişkili/gi, "Motor Planlama ve Beden Organizasyonu ile İlişkili")
    .replace(/Praksi ve Motor Planlama İçeren/gi, "Motor Planlama ve Beden Organizasyonu İçeren")
    .replace(/praksi ve motor planlama gerektiren durumlarda/gi, "motor planlama ve beden organizasyonu gerektiren durumlarda")
    .replace(/vaka dışı yapıü/gi, "uygulama planı")
    .replace(/uygulama planı/gi, "klinik karar")
    .replace(/vaka dışı karar/gi, "klinik karar")
    .replace(/vaka dışı yönlendirme/gi, "klinik yönlendirme")
    .replace(/klinik klinik karar/gi, "klinik karar")
    .replace(/Görünür rapor tanı önerisi,[^.]+üretmez\./gi, "Rapor yalnız değerlendirme ve klinik hipotez düzeyinde kalır.")
    .replace(/Regülasyon skoru tek başına klinik zorlanma, tanı, neden veya klinik gereklilik göstermez; rapor betimleyici, bağlamsal ve klinik hipotez düzeyinde kalır\./gi, "Skor tek başına tanısal sonuç veya neden açıklaması üretmez; rapor klinik hipotez düzeyinde kalır.")
    .replace(/Tek başına tanı veya klinik karar üretmez/gi, "Klinik yorum yalnız bu bilgiden çıkarılmaz")
    .replace(/tek başına praksi tanısı veya klinik karar üretmez/gi, "klinik yorum yalnız bu bilgiden çıkarılmaz")
    .replace(/Terapist gözleminde\s+Motor/gi, "Terapist gözleminde motor")
    .replace(/\bodev\b/gi, "ödev")
    .replace(/frustrasyon toleransını/gi, "engellenmeye dayanma kapasitesini")
    .replace(/frustrasyon toleransının/gi, "engellenmeye dayanma kapasitesinin")
    .replace(/frustrasyon toleransı/gi, "engellenmeye dayanma kapasitesi")
    .replace(/frustrasyon artıyor/gi, "engellenme karşısındaki zorlanma artıyor")
    .replace(/\bfrustrasyon\b/gi, "engellenme karşısındaki zorlanma")
    .replace(/engellenme karşısındaki zorlanma sonrasında/gi, "engellendiği durumların ardından")
    .replace(/engellenme karşısındaki zorlanma toleransının/gi, "engellenmeye dayanma kapasitesinin")
    .replace(/([^\.\n]+?) ile elde edilen ([^.\n]+?) bulgularının yorum içine alınması\./gi, "$1 ile elde edilen $2 bulguları klinik yoruma dahil edilmiştir.")
    .replace(/\bpercentil\b/gi, "persentil")
    .replace(/bu yaş grubunda profil daha exploratuvar yorumlanmalı/gi, "bu yaş grubunda profil gelişimsel değişkenlik göz önünde tutularak temkinli yorumlanmalıdır")
    .replace(/model ile gösterdiğin etkinliği tekrar etmeye açık/gi, "modelle gösterilen etkinliği tekrar etmeye açık")
    .replace(/başardığı rutin oyunda devam ediyor/gi, "başardığı rutin oyunda devam edebiliyor")
    .replace(/görevde kalış, dikkat ve davranışsal düzenleme de bozuluyor/gi, "görevde kalma, dikkat ve davranışsal düzenleme de zayıflayabiliyor")
    .replace(/duygusal eşik hızla düşebiliyor/gi, "duygusal toparlanma kapasitesi hızla azalabiliyor")
    .replace(/bir profile yaklaşmak hedeflenmektedir/gi, "bu yönde desteklenmesi beklenmektedir")
    .replace(/daha az çekinme, yeni hareketlere girişte daha az model ihtiyacı/gi, "yeni hareketlere daha rahat girişebilme ve daha az model desteğiyle ilerleyebilme")
    .replace(/motor planlama gerektiren oyunda yeni hareketlere daha rahat girişebilme ve daha az model desteğiyle ilerleyebilme ve beden organizasyonunun duygusal zorlanmayı ikincil olarak tetiklemeyeceği bu yönde desteklenmesi beklenmektedir/gi, "motor planlama gerektiren oyunlarda yeni hareketlere daha rahat başlayabilmesi, daha az model desteğiyle ilerleyebilmesi ve beden organizasyonu zorlandığında duygusal toparlanmasının daha az etkilenmesi beklenmektedir")
    .replace(/görevde kalma, dikkat ve davranışsal düzenleme de zayıflayabiliyor/gi, "görevde kalma, dikkat ve davranışsal düzenlemenin zayıflayabildiği gözlenmektedir")
    .replace(/Başaramadığını hissettiği anda duygusal toparlanma kapasitesi hızla azalabiliyor\./gi, "Başaramadığını hissettiği anlarda duygusal toparlanma kapasitesinin hızla azalabildiği izlenmektedir.")
    .replace(/Sınır:\s*Motor test sonucu DNA skorunu değiştirmez; tek başına sonuç üretmez\./gi, "Sınır: DNA skorunu değiştirmez; klinik bağlamı destekler.")
    .replace(/Sınır:\s*Tek başına sonuç üretmez; yaş uyumu zorunlu kontrol edilir\./gi, "Sınır: Klinik yorum yalnız bu testten çıkarılmaz.")
    .replace(/Yorumda\s*Klinik yorum yalnız bu bilgiden çıkarılmaz\.?/gi, "Sınır: Klinik yorum yalnız bu testten çıkarılmaz.")
    .replace(/Yorumda\s*DNA skorunu değiştirmez; klinik bağlamı destekler\.?/gi, "Sınır: DNA skorunu değiştirmez; klinik bağlamı destekler.")
    .replace(/\.\s+başaramadığını/gi, ". Başaramadığını")
    .replace(/Korunmuş işlev alanları açısından\s+Dilsel/gi, "Korunmuş işlev alanları açısından dilsel")
    .replace(/olarak yazılabilir/gi, "olarak değerlendirilir")
    .replace(/Skor tek başına tanısal sonuç veya neden açıklaması üretmez; rapor klinik hipotez düzeyinde kalır\.\s*Rapor yalnız değerlendirme ve klinik hipotez düzeyinde kalır\./gi, "Skor tek başına tanısal sonuç veya neden açıklaması üretmez; rapor klinik hipotez düzeyinde kalır.")
    .replace(/risk dilini kalibre eder/gi, "yorumun bağlama göre yapılmasını gerektirir")
    .replace(/risk dilini sınırlar/gi, "yorumun bağlama göre yapılmasını gerektirir")
    .replace(/risk dilinin genellenmesini sınırlar/gi, "yorumun bağlama göre yapılmasını gerektirir")
    .replace(/kalibre edilmiştir/gi, "sınırlandırılmıştır")
    .replace(/duyusal modülasyon belirtilerinin/gi, "duyusal regülasyon sorunlarının")
    .replace(/duyusal modülasyon belirtileri/gi, "duyusal regülasyon sorunları")
    .replace(/duyusal modülasyon/gi, "duyusal regülasyon")
    .replace(/duyusal modulasyon/gi, "duyusal regülasyon")
    .replace(/\bRegülasyon Yükü\b/g, "Regülasyon Güçlüğü")
    .replace(/zorluğunün/gi, "zorluğunun")
    .replace(/zorluklarınün/gi, "zorluklarının")
    .replace(/talebinün/gi, "talebinin")
    .replace(/Anamnezdeki bağlamsal yük/gi, "Anamnezdeki bağlamsal bilgi")
    .replace(/Anamnezde\s+(Sözel|Görsel|Duyusal|Bilişsel|Yürütücü|Çevresel|Dokunsal|Geçiş|Sosyal|Öz)(?![\p{L}\p{N}_])/gu, (_match, word: string) => `Anamnezde ${word.toLocaleLowerCase("tr-TR")}`)
    .replace(/Aileden gelen bilgiye göre\s+bakımveren,?\s*/gi, "Aileden gelen bilgiye göre ")
    .replace(/bakımveren eş-regülasyonu/gi, "aileden gelen düzenleyici destek")
    .replace(/Bakımveren veya terapist/gi, "Aile veya terapist")
    .replace(/Anamnez skoru açıklayan neden gibi değil, skorun günlük yaşamdaki görünümünü bağlamsallaştıran veri olarak kullanılmalıdır\./gi, "Anamnez, skorun nedeni olarak değil, günlük yaşamdaki görünümünü açıklayan bağlamsal veri olarak değerlendirilir.")
    .replace(/yürütücü yük tarif edilmektedir/gi, "yürütücü işlev güçlüğü tarif edilmektedir")
    .replace(/düzenleyici yükün belirginleştiği/gi, "self-regülasyon güçlüğünün belirginleştiği")
    .replace(/Kaynaklar Arasında Sınırlı Uyum Gösteren Klinik Örüntü/gi, "Bağlama Göre Değişen Klinik Örüntü")
    .replace(/Kaynaklar arasında sınırlı uyum gösteren,? bağlama göre değişen self-regülasyon güçlüğü/gi, "Bağlama göre değişen self-regülasyon güçlüğü")
    .replace(/Kaynaklar arasında sınırlı uyum gösteren bağlama duyarlı regülasyon güçlüğü/gi, "Bağlama göre değişen self-regülasyon güçlüğü")
    .replace(/Kaynaklar arasında tam uyum göstermeyen,? bağlama göre değişen self-regülasyon güçlüğü/gi, "Bağlama göre değişen self-regülasyon güçlüğü")
    .replace(/Bu bulgu ana klinik yorumu güçlendirmez; yalnız temkinli yan bilgi olarak tutulur\./gi, "Bu bulgu ana klinik değerlendirmeyi desteklemez; yalnız temkinli yan bilgi olarak kayda geçirilir.")
    .replace(/Ham puan tek başına yorum gücünü sınırlar; resmi yorum düzeyi olmadan ana klinik yorumu güçlendirmez\./gi, "Ham puan tek başına yorum gücünü sınırlar; resmi yorum düzeyi olmadan ana klinik değerlendirmeyi destekleyen veri sayılmaz.")
    .replace(/ana klinik karar mekanizmasına dahil edilmemeli,? en fazla temkinli yan bilgi olarak ele alınmalıdır/gi, "ana klinik değerlendirmeyi desteklemez; yalnız temkinli yan bilgi olarak kayda geçirilmiştir")
    .replace(/Ölçek yanıt örüntüsü şu klinik ayrıntıyı desteklemektedir:\s*Bakımveren veya terapist ses, gürültü ya da kalabalık ortamla zorlanma tarif ediyorsa işitsel reaktivite örüntüsü bu anlatımla doğrudan yakınsar\./gi, "İşitsel hassasiyet öne çıktığında ses, gürültü veya kalabalık ortamla ilgili günlük zorlanma bu bulguyla birlikte yorumlanır.")
    .replace(/İnteroseptif yük/g, "İnteroseptif zorluk")
    .replace(/interoseptif yük/gi, "interoseptif zorluk")
    .replace(/işitsel uyaran yükü/gi, "işitsel uyaran yoğunluğu")
    .replace(/çevresel uyaran yükünün/gi, "çevresel uyaran yoğunluğunun")
    .replace(/çevresel uyaran yükü/gi, "çevresel uyaran yoğunluğu")
    .replace(/yüksek uyaranlı/gi, "yoğun uyaranlı")
    .replace(/praksi ve motor planlama yükü arttığında/gi, "motor planlama ve beden organizasyonu talebi arttığında")
    .replace(/praksi ve motor planlama yükü/gi, "motor planlama ve beden organizasyonu gerektiren durumlarda belirginleşen self-regülasyon zorluğu")
    .replace(/Yürütücü işlev yükü/g, "Yürütücü işlev zorlukları")
    .replace(/yürütücü işlev yükü/gi, "yürütücü işlev zorlukları")
    .replace(/Bilişsel regülasyon yükü/g, "Bilişsel regülasyon zorlukları")
    .replace(/bilişsel regülasyon yükü/gi, "bilişsel regülasyon zorlukları")
    .replace(/praksi ve sekanslama yükünün/gi, "praksi ve sekanslama talebinin")
    .replace(/hareketi sıralama, motor planı uygulama ve davranışı organize etme yüküyle/gi, "hareketi sıralama, motor planı uygulama ve davranışı organize etme talebiyle")
    .replace(/Duygusal regülasyon yükü/g, "Duygusal regülasyon zorlukları")
    .replace(/duygusal regülasyon yükü/gi, "duygusal regülasyon zorlukları")
    .replace(/Duyusal regülasyon yükü/g, "Duyusal regülasyon zorlukları")
    .replace(/duyusal regülasyon yükü/gi, "duyusal regülasyon zorlukları")
    .replace(/Fizyolojik regülasyon yükü/g, "Fizyolojik regülasyon zorlukları")
    .replace(/fizyolojik regülasyon yükü/gi, "fizyolojik regülasyon zorlukları")
    .replace(/\bregülasyon yükü\b/gi, "self-regülasyon zorluğu")
    .replace(/\bregülasyon yükünün\b/gi, "self-regülasyon zorluğunun")
    .replace(/\bregülasyon yüküne\b/gi, "self-regülasyon zorluğuna")
    .replace(/\bdüzenleme yükü\b/gi, "self-regülasyon zorluğu")
    .replace(/\bdüzenleme yükünü\b/gi, "self-regülasyon zorluğunu")
    .replace(/\bdüzenleme yükünün\b/gi, "self-regülasyon zorluğunun")
    .replace(/\bbeden organizasyonu yükünün\b/gi, "beden organizasyonu zorluğunun")
    .replace(/\bpraksi ve motor planlama yükünün\b/gi, "motor planlama ve beden organizasyonu gerektiren durumlarda belirginleşen zorlanmanın")
    .replace(/\bmotor planlama yükü\b/gi, "motor planlama talebi")
    .replace(/\bduyusal yük\b/gi, "uyaran yoğunluğu")
    .replace(/\bçevresel uyaran yükü\b/gi, "çevresel uyaran yoğunluğu")
    .replace(/\bsözel yük\b/gi, "sözel talep")
    .replace(/\bzihinsel yük\b/gi, "zihinsel talep")
    .replace(/\bgörev yükü\b/gi, "görev talebi")
    .replace(/motor görev yükü/gi, "motor görev talebi")
    .replace(/motor planlama yükü/gi, "motor planlama talebi")
    .replace(/\bçok alanlı ve belirgin klinik yük taşımaktadır\b/gi, "birden fazla alana yayılan belirgin self-regülasyon zorlukları göstermektedir")
    .replace(/\byaygın yük örüntüsü\b/gi, "yaygın self-regülasyon problemi")
    .replace(/\byaygın klinik yük\b/gi, "yaygın self-regülasyon problemi")
    .replace(/\byüksek klinik yük\b/gi, "belirgin self-regülasyon problemi")
    .replace(/\bklinik yük\b/gi, "klinik zorlanma")
    .replace(/\byüklenme sonrası\b/gi, "yoğunluk sonrası")
    .replace(/\bduyusal yüklenme\b/gi, "duyusal yoğunluk")
    .replace(/\bduygusal yüklenme\b/gi, "duygusal yoğunluk")
    .replace(/\bsosyal yüklenme\b/gi, "sosyal talep")
    .replace(/\byüklenme\b/gi, "yoğunluk")
    .replace(/\bgünlük işlevi etkileyebilecek belirgin bir yük\b/gi, "günlük işlevde belirginleşebilen bir self-regülasyon problemi")
    .replace(/\bgünlük işlevi etkileyebilecek belirgin bir self-regülasyon zorluğu göstermektedir\b/gi, "günlük işlevde belirginleşebilen bir self-regülasyon problemi göstermektedir")
    .replace(/\bBu yük\b/g, "Bu zorlanma")
    .replace(/\bbu yük\b/g, "bu zorlanma")
    .replace(/\bokunmalıdır\b/gi, "okunur")
    .replace(/\baçıklanmalıdır\b/gi, "açıklanır")
    .replace(/\bkurulmalıdır\b/gi, "kurulur")
    .replace(/\bizlenmelidir\b/gi, "izlenir")
    .replace(/\byorumlanmalıdır\b/gi, "yorumlanır")
    .replace(/\bkalmalıdır\b/gi, "kalır")
    .replace(/Aile tarafından\s+evde\b/gi, "Aileden gelen bilgiye göre evde")
    .replace(/Aile tarafından\s+Evde\b/g, "Aileden gelen bilgiye göre evde")
    .replace(/Aile tarafından\s+bakımveren,\s*/gi, "Aile tarafından ")
    .replace(/Aile tarafından\s+Aile\b/g, "Aile")
    .replace(/\bBakımveren ve gözlem verileri\b/g, "Aile ve gözlem verileri")
    .replace(/Terapist gözleminde\s+Terapist gözleminde\b/gi, "Terapist gözleminde")
    .replace(/Terapist gözleminde\s+Terapist,\s*/gi, "Terapist gözleminde ")
    .replace(/Terapist gözleminde\s+Gözlemde\s+/gi, "Terapist gözleminde ")
    .replace(/Terapist gözleminde\s+gözlemde\s+/gi, "Terapist gözleminde ")
    .replace(/Korunmuş işlev alanları açısından\s+Net bilgi verilmedi\.?/gi, "Korunmuş alanlara ilişkin yeterli bilgi verilmemiştir.")
    .replace(/Korunmuş işlev alanlarına ilişkin bilgi:\s+Net bilgi verilmedi\.?/gi, "Korunmuş alanlara ilişkin yeterli bilgi verilmemiştir.")
    .replace(/Anamnezde korunmuş kapasite veya güçlü alan bildirilmesi, yorumun her bağlama genellenmemesi gerektiğini gösterir/gi, "Korunmuş alan bilgisi, yorumun bağlama göre yapılmasını gerektirir")
    .replace(/Anamnez teması:\s*Anamnezde korunmuş\/güçlü işlev alanları tarif edilmektedir\./gi, "Anamnez teması: Korunmuş işlev alanları bildirilmektedir.")
    .replace(/Anamnezde korunmuş veya destekleyici olabilecek güçlü yönler tarif edilmektedir; bunlar test sonuçlarıyla birlikte yorumlandığında profile denge kazandırabilir\./gi, "Korunmuş veya destekleyici alanlara ilişkin bilgiler, yeterli ayrıntı içerdiğinde profilin her bağlama genellenmemesi için dengeleyici veri sağlar.")
    .replace(/Başvuru nedeni ve birincil ebeveyn endişeleri, testte öne çıkan alanların günlük yaşam karşılığını anlamlandırmak açısından yüksek değerli klinik veri sunmaktadır\./gi, "Başvuru nedeni ve aile endişeleri, yeterli ayrıntı içerdiği ölçüde testte öne çıkan alanların günlük yaşam karşılığını anlamlandırmaya katkı sağlar.")
    .replace(/Anamnezde çevresel veya dokunsal uyaran altında belirgin duyusal hassasiyet\/arayış örüntüsü tarif edilmektedir\./gi, "Anamnezde çevresel veya dokunsal uyaranlara verilen yanıtta belirgin duyusal reaktivite örüntüsü tarif edilmektedir.")
    .replace(/bağlamında hem yük hem de korunmuş kapasite bilgisi vardır/gi, "bağlamında hem zorlanma hem de korunmuş kapasite bilgisi vardır")
    .replace(/(^|\n)(grup, kalabalık ve yoğun uyaran bağlamında)/g, "$1Grup, kalabalık ve yoğun uyaran bağlamında")
    .replace(/\.\s+aynı zamanda/gi, ". Aynı zamanda")
    .replace(/\buyaran yükü\b/gi, "uyaran yoğunluğu")
    .replace(/\bgeçiş yükü\b/gi, "geçişlerdeki zorlanma")
    .replace(/Bu nedenle ana klinik yorum skor örüntüsü ve anamnez üzerine kurulmuştur\. Bu bulgu formülasyonu destekleyen ek klinik kanıtlar arasında yer alır\./gi, "Bu nedenle ana klinik yorum skor örüntüsü, anamnez ve terapist gözlemiyle sınırlı tutulmuştur.")
    .replace(/Bildirilen dış testlerin tümü yaş aralığıyla uyumsuz görünmektedir\. Bu nedenle ana klinik yorum skor örüntüsü ve anamnez üzerine kurulmuştur\./gi, "Bildirilen dış testlerin tümü yaş aralığıyla uyumsuz görünmektedir. Bu nedenle ana klinik yorum skor örüntüsü, anamnez ve terapist gözlemiyle sınırlı tutulmuştur.")
    .replace(/Başvuru \/ izlem gerekçesi:\s*Klinik izlem ve işlevsel değerlendirme/gi, "Başvuru / izlem gerekçesi: Klinik izlem ve işlevsel değerlendirme")
    .replace(/Başvuru \/ izlem gerekçesi:[^\n]*(?:bozukluk|bozukluğu|otizm|tanı|tanılanmış)[^\n]*/gi, "Başvuru / izlem gerekçesi: Klinik izlem ve işlevsel değerlendirme")
    .replace(/tanı ya da destek planı yerine geçmez/gi, "tanısal sonuç olarak kullanılmaz")
    .replace(/tanı veya müdahale reçetesi olarak kullanılmaz/gi, "tanısal sonuç olarak kullanılmaz")
    .replace(/\btedavi\b/gi, "klinik süreç")
    .replace(/\bmüdahale\b/gi, "klinik süreç")
    .replace(/\bterapi\b/gi, "destek süreci")
    .replace(/\bseans\b/gi, "görüşme")
    .replace(/\bdanışmanlık\b/gi, "aile görüşmesi")
    .replace(/\bilaç\b/gi, "medikal bilgi")
    .replace(/\bprotokol\b/gi, "klinik akış")
    .replace(/\begzersiz\b/gi, "etkinlik")
    .replace(/Dikkat bozukluğu veya yürütücü işlev hakkında tanısal hüküm üretmez/gi, "Dikkat alanı veya yürütücü işlev hakkında tanısal hüküm üretmez")
    .replace(/madde, norm tablosu veya manuel içeriği/gi, "test içeriği, norm tablosu veya manuel bilgisi")
    .replace(/yürütücü davranış düzenleme ve duygusal ve bilişsel yansımalar yorumunu destekler/gi, "yürütücü davranış düzenleme ile duygusal ve bilişsel yansımaların birlikte yorumlanmasını destekler")
    .replace(/emotional\/cognitive yayılım/gi, "duygusal ve bilişsel yansımalar")
    .replace(/nasıl belirginleştiğine\./gi, "nasıl belirginleştiğine ilişkin destekleyici bilgi sunmaktadır.")
    .replace(/\bilişkin\./gi, "ilişkin destekleyici bilgi sunmaktadır.")
    .replace(/\buyaran yükü\b/gi, "uyaran yoğunluğu")
    .replace(/\bİşitsel uyaran yükü\b/g, "İşitsel uyaran yoğunluğu")
    .replace(/\bişitsel uyaran yükü\b/gi, "işitsel uyaran yoğunluğu")
    .replace(/\bgörsel uyaran yükünün\b/gi, "görsel uyaran yoğunluğunun")
    .replace(/\bçevresel uyaran yükünün\b/gi, "çevresel uyaran yoğunluğunun")
    .replace(/\bçevresel uyaran yükü\b/gi, "çevresel uyaran yoğunluğu")
    .replace(/\bgeçiş yükü\b/gi, "geçişlerdeki zorlanma")
    .replace(/\bYenilik ve geçiş yükü\b/g, "Yenilik ve geçişlerdeki zorlanma")
    .replace(/\bYorum sınırı:\s*/g, "Sınır: ")
    .replace(/Bu nedenle ana klinik karar ağırlığını artırmaz/gi, "Bu bulgu ana klinik değerlendirmeyi tek başına desteklemez")
    .replace(/karar ağırlığını artırmaz/gi, "ana klinik değerlendirmeyi tek başına desteklemez")
    .replace(/karar ağırlığını artırmak için kullanılmadı/gi, "ana klinik değerlendirmeyi destekleyen veri olarak kullanılmadı")
    .replace(/yorum ağırlığını değiştiren bağlamlardır/gi, "klinik yorumu değiştirebilecek bağlamlardır")
    .replace(/yorumun ağırlığı\s+([^.;]+?)\s+alanına verilmiş/gi, "klinik yorum $1 alanında yoğunlaşmış")
    .replace(/Klinik yorumun ağırlığı bu eksende toplanmaktadır/gi, "Klinik yorum bu eksende yoğunlaşmaktadır")
    .replace(/klinik ağırlık/gi, "klinik odak")
    .replace(/diğer regülasyon yüklerini/gi, "diğer self-regülasyon zorluklarını")
    .replace(/regülasyon yükleri/gi, "self-regülasyon zorlukları")
    .replace(/beceri veya algı sorunu anlatmıyor/gi, "duyusal reaktivite dışında ayrı bir güçlük anlatmıyor")
    .replace(/algı sorunu anlatmıyor/gi, "ayrı bir algısal güçlük anlatmıyor")
    .replace(/skor ve ek test ağırlıklı klinik hipotez/gi, "skor ve ek testle sınırlı klinik hipotez")
    .replace(/klinik yorum ağırlıklı olarak/gi, "klinik yorum daha çok")
    .replace(/\bPediatrik\s+pediatrik\b/gi, "Pediatrik")
    .replace(/\bBu bulgular\.\s+Bu bulgular,/g, "Bu bulgular,")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  let briefPNameSeen = false;
  sanitized = sanitized.replace(
    /Behavior Rating Inventory of Executive Function - Preschool Version \(BRIEF-P\)/gi,
    (match) => {
      if (briefPNameSeen) return "BRIEF-P";
      briefPNameSeen = true;
      return match;
    }
  );
  return capitalizeSentenceStarts(sanitized);
}

function splitSentences(text: string): string[] {
  return String(text || "")
    .split(/(?<=[.!?])\s+|\n+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 0);
}

function normalizeSentence(sentence: string): string {
  return sentence
    .toLocaleLowerCase("tr-TR")
    .replace(/[“”"()]/g, "")
    .replace(/\d+\/\d+/g, "SCORE")
    .replace(/\s+/g, " ")
    .trim();
}

function findRepeatedSentences(sentences: string[]): string[] {
  const seen = new Map<string, number>();
  const repeated: string[] = [];
  for (const sentence of sentences) {
    const normalized = normalizeSentence(sentence);
    if (normalized.length < 70) continue;
    const count = seen.get(normalized) || 0;
    seen.set(normalized, count + 1);
    if (count === 1) repeated.push(sentence);
  }
  return repeated;
}

export function analyzeReportLanguageQuality(text: string): ReportLanguageQualityResult {
  const value = String(text || "");
  const issues: ReportLanguageIssue[] = [];

  for (const rule of FORBIDDEN_LANGUAGE_PATTERNS) {
    const match = value.match(rule.pattern);
    if (match) {
      issues.push({ code: rule.code, severity: rule.severity, message: rule.message, evidence: match[0] });
    }
  }

  const asciiMatches = ASCII_TURKISH_PATTERNS.filter((pattern) => pattern.test(value));
  if (asciiMatches.length > 0) {
    issues.push({
      code: "ascii_turkish_leak",
      severity: "high",
      message: "Türkçe karakteri bozuk klinik metin final raporda görünüyor.",
      evidence: String(asciiMatches.length),
    });
  }

  const sentences = splitSentences(value);
  const sentenceWordCounts = sentences.map((sentence) => sentence.split(/\s+/).filter(Boolean).length);
  const averageSentenceWords = sentenceWordCounts.length
    ? Math.round((sentenceWordCounts.reduce((sum, count) => sum + count, 0) / sentenceWordCounts.length) * 10) / 10
    : 0;
  const longSentences = sentences.filter((sentence) => sentence.split(/\s+/).length > 42);
  if (longSentences.length > 0) {
    issues.push({
      code: "long_sentence",
      severity: "low",
      message: "Bazı cümleler lisans düzeyi okuyucu için gereğinden uzun.",
      evidence: longSentences[0],
    });
  }

  const repeated = findRepeatedSentences(sentences);
  if (repeated.length > 0) {
    issues.push({
      code: "repeated_sentence",
      severity: "medium",
      message: "Aynı veya çok benzer uzun cümle tekrar ediyor.",
      evidence: repeated[0],
    });
  }

  let score = 100;
  for (const issue of issues) {
    score -= issue.severity === "high" ? 18 : issue.severity === "medium" ? 8 : 3;
  }
  score = Math.max(0, Math.min(100, score));

  return {
    score,
    classification: score >= 92 && !issues.some((issue) => issue.severity === "high") ? "strong" : score >= 80 ? "needs_review" : "problem",
    issues,
    metrics: {
      sentenceCount: sentences.length,
      averageSentenceWords,
      longSentenceCount: longSentences.length,
      repeatedSentenceCount: repeated.length,
    },
  };
}
