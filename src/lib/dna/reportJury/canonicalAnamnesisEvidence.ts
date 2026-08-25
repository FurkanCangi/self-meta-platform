import type { DomainKey, ReportInput } from "../reportEngine"
import { normalizeTurkishClinicalText } from "../reportLanguageQuality"
import type {
  AnamnesisDomainSupport,
  AnamnesisEvidenceDirection,
  AnamnesisEvidenceStatus,
  AnamnesisFunctionalContext,
  CanonicalAnamnesisEvidenceFact,
} from "./contracts"
import {
  factEligibleForPreservedCapacity,
  factSupportsDifficultyDirection,
  inferEvidenceDirection,
  inferEvidenceEpistemicStatus,
  inferSemanticContext,
} from "./evidenceSemantics"

const THERAPIST_OR_EXTERNAL_MARKER = /(?:terap[ıi]st\s+(?:yorumlar[ıi]?|yorumlari?|gözlemi?)|therapist_comments|clinical_observation|ek\s+klinik\s+test(?:\s*\/\s*bulgular)?|dış\s+test|external_clinical_findings)\s*[:=]?/iu
const CAREGIVER_STRENGTH_MARKER = /(?:çocuğun\s+)?güçlü\s+yan(?:lar[ıi]?|[ıi])?\s*[:=]/giu

const DOMAIN_PATTERNS: Readonly<Record<DomainKey, RegExp>> = Object.freeze({
  physiological: /(?:\buyku|uykusuz|uyuduğ|uyand|uyuma|biriken\s+yorgunluk|dinlenmiş\s+gün|dinlenmis\s+gun|dinlenme(?:den|nin)?\s+(?:sonra|ardından)|dinlenme\s+sonrası|fizyolojik\s+regülasyon|sabah\s+kalk|nefes(?:i)?\s+hızlan|nefes(?:i)?\s+hizlan|başını\s+masaya|basini\s+masaya)/iu,
  sensory: /(?:\bses(?:ler|i)?\b|gürült|gurult|işitsel|isitsel|duyusal\s+regülasyon|dokunsal|\bışık|\bisik|floresan|su\s+temas|duş\s+başlığ|dus\s+baslig|banyo|saç\s+yıka|sac\s+yika|küçük\s+çalışma\s+odası|kucuk\s+calisma\s+odasi|blender|korna|\bzil\b|hoparlör|süpürge|supurge|kulaklarını\s+kapat|kulaklarini\s+kapat|kulak\s+tıkac|kulak\s+tikac|uyaran|tepsi\s+düşt|balon\s+patla|saç\s+kes|hamur[^.!?]{0,60}parmak|metal\s+tabak|spatula)/iu,
  emotional: /(?:(?:^|[\s,.;])(?:ağla|agla|bağır|bagir)|çığlık|ciglik|öfke|ofke|duygusal\s+regülasyon|beklenmedik\s+bitiş|beklenmeyen\s+kural\s+değiş|beklenmeyen\s+kural\s+degis|oyun[^.!?]{0,50}kural[^.!?]{0,60}değiş|oyun[^.!?]{0,50}kural[^.!?]{0,60}degis|geçiş\s+sırasında|gecis\s+sirasinda|plan\s+değiş|plan\s+degis|değişiklik[^.!?]{0,60}haber\s+ver|degisiklik[^.!?]{0,60}haber\s+ver|oyun\s+bit|oyun\s+kayb|kaybed)/iu,
  cognitive: /(?:bilişsel\s+regülasyon|bilissel\s+regulasyon|yönerge|yonerge|çalışma\s+belle|calisma\s+belle|akılda\s+tut|akilda\s+tut|birden\s+fazla\s+malzeme|iki\s+kural|\bkural(?:lar)?\b|\beşle|\besle|özelliğe\s+göre|ozellige\s+gore|çamaşır\s+ayır|camasir\s+ayir|çanta\s+hazırla|canta\s+hazirla|resimli\s+(?:kontrol\s+)?liste|tek\s+eşya|tek\s+esya|resimler\s+kaldır|resimler\s+kaldir|hikâye(?:deki)?[^.!?]{0,45}(?:olay|sırala)|hikaye(?:deki)?[^.!?]{0,45}(?:olay|sirala)|iki\s+bilgi\s+peş\s+peşe|iki\s+bilgi\s+pes\s+pese|yanlış\s+kut|yanlis\s+kut|üç\s+adımı\s+doğru|uc\s+adimi\s+dogru)/iu,
  executive: /(?:yürütücü\s+işlev|yurutucu\s+islev|birden\s+fazla\s+adımı\s+plan|birden\s+fazla\s+adimi\s+plan|çok\s+adımlı\s+(?:görev|proje)\s+organizasyonu|cok\s+adimli\s+(?:gorev|proje)\s+organizasyonu|üç\s+basamak|uc\s+basamak|çok\s+basamak|cok\s+basamak|işlem\s+sırası|islem\s+sirasi|kes-yapıştır|kes-yapistir|malzeme(?:leri)?[^.!?]{0,50}(?:seçme|secme|çekmece)|giyinme\s+sırası|giyinme\s+sirasi|araçlar[ıi]\s+topla|araclar[ıi]\s+topla|çanta(?:sını|sini)?\s+hazırla|canta(?:sini)?\s+hazirla|kalem\s+kutusunu[^.!?]{0,40}unut|göreve\s+dön|goreve\s+don|kalan\s+bölümü\s+tamamla|kalan\s+bolumu\s+tamamla)/iu,
  interoception: /(?:interosepsiyon|açlık|açlığ|aclik|aclig|açken|acken|susuz|susad|ara\s+öğün|ara\s+ogun|ısıya\s+yanıt|isiya\s+yanit|ısınma|isinma|üşüdüğ|usudug|hırka|hirka|tuvalet|ağrı|agri|baş\s+ağr|bas\s+agr|beden\s+sinyal)/iu,
})

const DOMAIN_SUPPLEMENTAL_PATTERNS: Readonly<Partial<Record<DomainKey, RegExp>>> = Object.freeze({
  physiological: /(?:öğleden\s+sonra\s+yorgunlu|ogleden\s+sonra\s+yorgunlu|gece[^.!?]{0,45}uyan|dinlenmiş[^.!?]{0,35}sabah|dinlenmis[^.!?]{0,35}sabah|kahvalt[ıi][^.!?]{0,40}servis)/iu,
  sensory: /(?:mikser|metal\s+kutu[^.!?]{0,30}düş|metal\s+kutu[^.!?]{0,30}dus|sandalyenin\s+arkas[ıi]na\s+çekil|sandalyenin\s+arkasina\s+cekil)/iu,
  cognitive: /(?:iki\s+özellik|iki\s+ozellik|üç\s+nesnenin\s+yeri|uc\s+nesnenin\s+yeri|nesneler\s+tek\s+tek|doğru\s+sıraya|dogru\s+siraya|kartlar[ıi][^.!?]{0,35}(?:kutu|yerleştir|yerlestir))/iu,
  executive: /(?:sanat\s+çalışmas[ıi]|sanat\s+calismasi|araçlar[ıi]\s+seçerken|araclari\s+secerken|iki\s+malzemeyi\s+unut|resimli\s+kontrol\s+listesi|sabah\s+rutinini|sabah\s+işleri|sabah\s+isleri)/iu,
  emotional: /(?:kural\s+değişikliğ|kural\s+degisiklig)/iu,
})

const PLACEHOLDER_OR_NOISE = /(?:^DNA puanlar[ıi]|rutin (?:tarama|değerlendirme)|genel (?:bakılsın|değerlendirme notu)|neden\s*:\s*net değil|günlük yaşam örneği (?:yok|verilmedi)|günlük işlev örneği (?:yok|verilmedi|yazılmamış|yazilmamis)|işlev örneği (?:yok|eklenmemiş|eklenmemis|yazılmamış|yazilmamis)|örnek yok|bilgi verilmedi|kaydedilmemiş|^okul bilgisi yok|^başka bilgi yok|sonra bilgi|daha sonra bilgi|emin\s+(?:değ|deg)[ıi]l[\s\S]{0,50}örnekler|form\s+kenarında\s+yalnız[^.!?]{0,100}başlığı\s+yazıyor|form\s+kenarinda\s+yalniz[^.!?]{0,100}basligi\s+yaziyor|sayfa\s+kenarında\s+yalnız[^.!?]{0,120}ifadesi\s+yer\s+alıyor|sayfa\s+kenarinda\s+yalniz[^.!?]{0,120}ifadesi\s+yer\s+aliyor|aaa\s+\d+|\bxx\b|\bqqq\b|\bqz\b|masa sandalye bulut|ne olduğu sonra|bilmiyom değerlendirme olsun)/iu
const SUPPLEMENTAL_PLACEHOLDER_OR_NOISE = /(?:(?:form|sayfa|taslak|arşiv|arsiv|kağıt|kagit|not|dosya)[^.!?]{0,80}yalnız[^.!?]{0,100}(?:başlık|başlığ|baslik|baslig|etiket|ifade)[^.!?]{0,40}(?:bulunuyor|yazıyor|yaziyor|yer\s+alıyor|yer\s+aliyor)|gözlenebilir[^.!?]{0,80}örneği\s+(?:eklenmemiş|yok)|gozlenebilir[^.!?]{0,80}ornegi\s+(?:eklenmemis|yok))/iu
const DOMAIN_LABEL_ONLY = /^(?:(?:başvuru\s+sebeb[ıi]|başvuru|başvuru\s+notu)\s*:\s*)?(?:fizyolojik\s+regülasyon|duyusal\s+regülasyon|duygusal\s+regülasyon|bilişsel\s+regülasyon|yürütücü\s+işlev|interosepsiyon)\s*[.!?]?$/iu
const HYPOTHETICAL_ONLY = /(?:\beğer\b|\beger\b|olursa|olabilir\s+diye|varsayalım|varsayalim|ihtimaline\s+karşı|ihtimaline\s+karsi)/iu
const NON_INDEPENDENT_LIMITATION = /^(?:ama|fakat|ancak|buna\s+karşın|buna\s+rağmen)\b[^.!?]{0,140}(?:son\s+olayı\s+tarif\s+edemedi|başarılı\s+olduğu\s+veya\s+bıraktığı\s+görevi\s+söylemedi|hangi\s+günlük\s+görevde[^.!?]{0,40}örnek\s+vermedi|gözlenebilir\s+davranış\s+örneği\s+sunmadı|görev,?\s+destek\s+ve\s+sonuç\s+bilgisi\s+paylaşmadı|süre\s+her\s+seferinde\s+aynı\s+değil)/iu
const GENERIC_CONCERN_WITHOUT_FUNCTION = /(?:(?:alan\s+adını\s+söyledi|alan\s+ismini\s+söyledi|bu\s+alanın\s+zor\s+olduğunu\s+söylüyor|bu\s+alanin\s+zor\s+oldugunu\s+soyluyor|başvuruda\s+bu\s+alan\s+işaretlenmiş|basvuruda\s+bu\s+alan\s+isaretlenmis|kısa\s+bir\s+şikâyet\s+var|kisa\s+bir\s+sikayet\s+var|yakınma\s+tek\s+cümleyle\s+kaydedilmiş|yakinma\s+tek\s+cumleyle\s+kaydedilmis)[^.!?]{0,180}(?:örnek|bilgi|görev|davranış|ne\s+zaman)|başvuru\s+notunda[^.!?]{0,100}yalnız[^.!?]{0,40}zorlanıyor)/iu
const ABSENCE_PATTERN = /(?:güçlük|sorun|şikâyet|şikayet|tepki|örnek|bildirim)[^.]{0,80}(?:yok|yoktur|olmad|görmed|bildirilmed|verilmed)|(?:hiç|belirgin)[^.]{0,80}(?:güçlük|sorun|zorlan)[^.]{0,40}(?:yok|olmad|görmed|bildirilmed|mıyor|miyor)|(?:zorlanmıyor|zorlanmadi|zorlanmadı)|(?:hakkında\s+)?bilgi\s+(?:yok|bulunmuyor)|yaşına uygun|beklenen aralık/iu
const PRESERVED_PATTERN = /(?:bağımsız|bagimsiz|\btamam\b|tamamlıyor|tamamladı|tamamlanıyor|tamamlayabiliyor|bitiriyor|bitirdi|sürdürüyor|sürdürdü|sürdürebiliyor|yerleştiriyor|yerleştirdi|koyuyor|koydu|dolduruyor|doldurdu|eşliyor|esliyor|eşleme yapıyor|esleme yapiyor|doğru\s+yapıyor|dogru\s+yapiyor|doğru(?:\s+biçimde|\s+sırayla)?\s+uyguluyor|dogru(?:\s+bicimde|\s+sirayla)?\s+uyguluyor|yapabiliyor|katılıyor|katılabiliyor|katilabiliyor|katılımı daha iyi|geçebiliyor|giyiyor|fermuar(?:ını|ini)?\s+çekiyor|inceliyor|kurabiliyor|çalışabiliyor|calisabiliyor|başlatıyor|baslatiyor|ihtiyac[ıi]n[ıi]\s+(?:adlandır|söyleyip[^.!?]{0,45}(?:gidiyor|geçiyor))|ihtiyacini\s+(?:adlandir|soyleyip[^.!?]{0,45}(?:gidiyor|geciyor))|mola\s+istiyor|(?:yemeğe|göreve|goreve|işe|ise)\s+başlıyor|başladı|başlattı|getiriyor|getirdi|topluyor|belirtiyor|yapabildi|sakinleşiyor|sakinleşti|geri\s+(?:dönüyor|döndü|dönmüş)|geri\s+(?:donuyor|dondu|donmus)|oyuna\s+(?:dönüyor|döndü)|sözel\s+olarak\s+ifade\s+ediyor|sakin\s+yerde\s+bekliyor|sırasını\s+bekliyor|sirasini\s+bekliyor|(?:sofraya|masaya|kapıya|kapiya|kahvaltıya|kahvaltiya)\s+(?:zamanında\s+)?geliyor|zamanında\s+(?:bildiriyor|söylüyor|geliyor|geçiyor|geciyor)|(?:\bhırka\b|\bsu\b|\bmola\b|\btuvalet\b)[^.]{0,35}(?:istediğini\s+)?söylüyor|seçtiği[^.]{0,40}dokunuyor|sorun\s+yaşamıyor|yaşına uygun|korunmuş|sorun bildirilmiyor|güçlük bildirilmiyor|güçlük görmedi|güçlük olmad|aynı yönergeyi yapabiliyor|rutini sürdürüyor)/iu
const PRESERVED_SUPPLEMENTAL_PATTERN = /(?:tamamlayıp|tamamlayarak|servise\s+yetişiyor|servise\s+yetisiyor|(?:su|mola|tuvalet)\s+istiyor|sırayı\s+bekliyor|sirayi\s+bekliyor)/iu
const FAILED_OUTCOME_PATTERN = /(?:yanlış|yanlis|ters|eksik|hatalı|hatali)[^.!?]{0,45}(?:koyuyor|koydu|yerleştiriyor|yerlestiriyor|eşliyor|esliyor|yapıyor|yapiyor|uyguluyor)/iu
const NON_OUTCOME_BODY_PLACEMENT_PATTERN = /(?:başını|basini)[^.!?]{0,35}(?:masaya|sıraya|siraya|zemine)[^.!?]{0,20}koyuyor/iu
const DIFFICULTY_PATTERN = /(?:zorlan|\bzor\b|güçlük|yapam|başlayam|baslayam|etmiyo|giyem|bitirem|tamamlamıyor|sürdüremedi|surduremedi|devam\s+edemiyor|yalnız\s+(?:ilkini|birini)\s+yanıtlıyor|yalniz\s+(?:ilkini|birini)\s+yanitliyor|fark\s+etmeden|iki\s+eşyadan\s+sonra\s+duruyor|iki\s+esyadan\s+sonra\s+duruyor|\btask\b[^.!?]{0,60}\bortasında\s+duruyor|\btask\b[^.!?]{0,60}\bortasinda\s+duruyor|yarım(?:\s+kal)?|yarıda|yarida|bırak(?![ıi]ld[ıi]ğ[ıi]nda|ildiginda)|\bkaç(?:ıyor|tı|ıp|arken|maya|mak)\b|\bkac(?:iyor|ti|ip|arken|maya|mak)\b|\bkaçın(?:ıyor|dı|maya)\b|\bkacin(?:iyor|di|maya)\b|ayrıl|ayril|uzaklaş|uzaklas|başını\s+çek|basini\s+cek|çekil|cekil|kulaklarını kapat|kulak kapat|(?:^|[\s,.;])(?:eğil|egil)|\bağl|\bagla|\bbağır|\bbagir|\bçığlık|\bciglik|unut|\batla|\batl[ıi]|karıştır|karistir|dağıl|dagil|çok\s+yorgun|gecik|geç\s+(?:fark|söyl)|(?:yanlış|yanlis|ters|eksik|hatalı|hatali)[^.!?]{0,45}(?:koy|yerleştir|yerlestir|eşle|esle|seç|sec|yap|uygula)|(?:sonraki\s+)?adıma\s+geçmiyor|(?:sonraki\s+)?adima\s+gecmiyor|sıradan\s+çık|redded|son\s+ana|son anda|son dakka|belirtmeyip|oyunu\s+aniden\s+kes|geç bildir|gec bildir|ancak[^.]{0,60}sonra bildir|demiyo|uzun hatırlatma|hatırlatma gerek|hatirlatma gerek|yere\s+(?:otur|yat|uzan)|uzanıyor|masadan\s+(?:sık\s+)?kalk(?!madan\b)|yavaş tamam|yavas tamam|çıkmak ist|cikmak ist|çıkmaya çalış|cikmaya calis|geri\s+dön(?:müyor|medi|emiyor)|geri\s+don(?:muyor|medi|emiyor)|oyuna\s+dön(?:müyor|medi|emiyor)|oyuna\s+don(?:muyor|medi|emiyor)|masan[ıi]n\s+alt[ıi]na|masa altı)/iu
const DIFFICULTY_SUPPLEMENTAL_PATTERN = /(?:(?:ikinci|üçüncü|ucuncu|sonraki)\s+adım(?:dan)?\s+sonra\s+duruyor)/iu
const SUPPORT_PATTERN = /(?:görsel|resimli|yazılı|\bvisual\s+cue\b|kontrol list|model|ipucu|hatırlatma|hatirlatma|hatırlatıldığında|hatirlatildiginda|iki seçenek|\bseçenek\b|\bsecenek\b|seçim hakkı|secim hakki|küçük kap|kucuk kap|kurallar?\s+sıraya\s+kon|kurallar?\s+siraya\s+kon|işlem\s+sırası|islem\s+sirasi|kenara\s+alındığında|kenara\s+alindiginda|kısa bekleme|kisa bekleme|kısa bir dinlenme|kisa bir dinlenme|mola|sakin|sessiz|destek|azaltıldığında|azaltildiginda|tek tek|kendi(?:si)? döktüğünde|kendisi dokutugunde)/iu
const OUTCOME_PATTERN = /(?:tamaml[ıi]|bitir|yerleştir|yerlestir|koyuyor|koydu|doldur|eşl|esl|doğru(?:\s+biçimde|\s+sırayla)?\s+(?:yap|uygul)|dogru(?:\s+bicimde|\s+sirayla)?\s+(?:yap|uygul)|yapabiliyor|geçebiliyor|gecebiliyor|giyiyor|fermuar(?:ını|ini)?\s+çekiyor|başlatıyor|baslatiyor|ihtiyac[ıi]n[ıi]\s+(?:adlandır|söyleyip[^.!?]{0,45}(?:gidiyor|geçiyor))|ihtiyacini\s+(?:adlandir|soyleyip[^.!?]{0,45}(?:gidiyor|geciyor))|mola\s+istiyor|geri\s+dön|geri\s+don|oyuna\s+dön|oyuna\s+don|katıl|katil|sürdür|surdur|sakinleş|sakinles|bağımsız|bagimsiz|ifade\s+ediyor|belirtiyor|topluyor|sırasını\s+bekliyor|sirasini\s+bekliyor|(?:sofraya|masaya|kapıya|kapiya|kahvaltıya|kahvaltiya)\s+geliyor|(?:yemeğe|göreve|goreve|işe|ise)\s+başlıyor|zamanında\s+(?:söyl|bildir|gel|geç|gec)|düzelt|duzelt|ayrıl|ayril|bırak(?![ıi]ld[ıi]ğ[ıi]nda|ildiginda)|birak(?!ildiginda)|\bkaç(?:ıyor|tı|ıp|arken|maya|mak)\b|\bkac(?:iyor|ti|ip|arken|maya|mak)\b|ağl|agla|bağır|bagir)/iu
const PERFORMANCE_BREAKDOWN_PATTERN = /(?:tamamlamıyor|tamamlamadi|sürdüremedi|surduremedi|devam\s+edemiyor|başlayamıyor|baslayamiyor|sonraki\s+işi\s+tamamlamıyor|sonraki\s+isi\s+tamamlamiyor)/iu
const TASK_PATTERN = /(?:\btask\b|giyinme|ayakkabı|ayakkabi|çanta hazırlama|canta hazirlama|spor çantası|spor cantasi|okul hazırlığı|okul hazirligi|ödev|odev|yemek|kahvaltı|kahvalti|tuvalet|oyun|geçiş|gecis|yönerge|yonerge|masa görev|masa gorev|sıra bekleme|sira bekleme|proje|robot set|malzeme|alışveriş|alisveris|kantin|servis oyunu|saç kesimi|sac kesimi|saç yıkama|sac yikama|çamaşır ayırma|camasir ayirma|ara öğün|ara ogun)/iu
const ENVIRONMENT_PATTERN = /(?:\bevde\b|\bokulda\b|\bsınıfta\b|\bsinifta\b|\bserviste\b|\botobüste\b|\botobuste\b|\bkoridorda\b|\bkantinde\b|\byemekhanede\b|\bmutfakta\b|soyunma\s+odasında|soyunma\s+odasinda|\bparkta\b|doğum\s+gününde|dogum\s+gununde|\bdüğünde\b|\bdugunde\b|alışveriş\s+merkezinde|alisveris\s+merkezinde|avm(?:'de|de)?|\bmarkette\b|\bklinikte\b|\bseansta\b|sakin\s+odada|sessiz\s+odada|kalabalık[^,.;]*)/iu
const TRIGGER_PATTERN = /(?:[^,.;]{0,70}(?:olduğunda|oldugunda|açılınca|acilinca|duyunca|arttığında|arttiginda|sonrası|sonrasinda|ardından|ardindan|bitince|değiştiğinde|degistiginde|kaybedince|patlayınca|patlayinca|düştüğünde|dustugunde))/iu
const VARIABILITY_PATTERN = /(?:bazen|bazı|bazi|her zaman değil|her ses değil|günlerin çoğunda|gunlerin cogunda|daha iyi|daha kısa sürd|daha kisa surd|sonucun\s+ise\s+değiş|sonucun\s+ise\s+degis|karşılaştırıldığında|karsilastirildiginda|aynı formda|ayni formda|bir sonraki satır|bir sonraki satir|\bsonra\b|\bancak\b|\bama\b|karşın|karsin|hafta sonu|sağlıklı gün|saglikli gun|iyi uyudu|dinlenmiş|dinlenmis|yorgun gün|yorgun gun|farklı koşul|farkli kosul|bir kez|çoğunlukla|cogunlukla)/iu
const UNCERTAINTY_PATTERN = /(?:bilgi (?:yok|bulunmuyor|alınmadı)|bilinmiyor|doğrulanmamış|doğrulanmadı|doğrulanmış bilgi bulunmuyor|emin değil|emin deg[ıi]l|emin\s+olmadığ|emin\s+olmadig|kesin\s+(?:değil|degil|olmadığ|olmadig)|olup olmadığ|olup olmadig|olabileceğ|olabileceg|\bgaliba\b|\bsanırım\b|\bsanirim\b|\bolabilir\b|henüz[^.!?]{0,55}(?:alınmadı|karşılaştırılmadı|bilinmiyor|doğrulanmadı|açıklanamıyor|aciklanamiyor|belirlenemiyor|netleştirilemedi|netlestirilemedi)|karşılaştırmalı bilgi (?:yok|olmad)|neden(?:i|ine)? ilişkin[^.]{0,60}(?:bilgi yok|bilinmiyor|bulunmuyor|açıklanamıyor|aciklanamiyor|belirlenemiyor))/iu
const EVIDENCE_EXISTENCE_UNCERTAIN_PATTERN = /(?:olup olmadığından\s+emin\s+değil|olup olmadigindan\s+emin\s+degil|gerçekten[^.!?]{0,60}emin\s+değil|gercekten[^.!?]{0,60}emin\s+degil|emin\s+olmadığ|emin\s+olmadig|olabileceğ|olabileceg|\bgaliba\b|\bsanırım\b|\bsanirim\b|\bolabilir\b)/iu
const META_LABEL_UNCERTAINTY = /(?:aile|bakım veren)[^.!?]{0,100}\b(?:mı|mi|mu|mü)\b[^.!?]{0,100}(?:emin değil|emin deg[ıi]l)/iu
const TEMPORAL_CONTEXT_PATTERN = /(?:hafta sonu|okul gün|tatil gün|geçen hafta|sonraki hafta|son ay|ilk başvuru|önceki örnek|günlerin çoğunda|haftadan haftaya|her gün|bir kez|çoğunlukla)/iu
const CONTEXT_COMPARISON_PATTERN = /(?:(?:\bile\b|\bve\b)[^.!?]{0,100}(?:aynı\s+görevin|ayni\s+gorevin|karşılaştırılmadı|karsilastirilmadi|karşılaştırıldığında|karsilastirildiginda)|bu\s+fark[^.!?]{0,120}karşılaştır|bu\s+fark[^.!?]{0,120}karsilastir|öğretmen\s+gözlemi\s+henüz|ogretmen\s+gozlemi\s+henuz)/iu
const STRONG_CONTEXT_VARIABILITY = /(?:daha\s+kısa(?:\s+sürd)?|daha\s+kisa(?:\s+surd)?|daha\s+uzun|sonucun\s+ise\s+değiş|sonucun\s+ise\s+degis|performans(?:ın|in)\s+değiş|performansin\s+degis|belirgin\s+fark|haftadan\s+haftaya|karşılaştır|karsilastir|farklı\s+koşul|farkli\s+kosul|ilk\s+başvurudan\s+önce|ilk\s+basvurudan\s+once|sonraki\s+hafta)/iu
const NEGATED_DIFFICULTY_PATTERN = /(?:sorun\s+yaşamıyor|sorun\s+yasamiyor|zorlanmıyor|zorlanmadi|zorlanmadı|kaçınma(?:\s+davranış[ıi])?\s+göstermiyor|kacinma(?:\s+davranisi)?\s+gostermiyor|kaçınmıyor|kacinmiyor|güçlük\s+(?:yok|bildirilmedi|görülmedi|görmediğini)|gucluk\s+(?:yok|bildirilmedi|gorulmedi|gormedigini))/iu
const ANAPHORIC_CONTEXT_PATTERN = /(?:(?:aynı|bu|burada|orada|söz\s+konusu)\s+(?:ortam|görev|rutin|durum|alan|etkinli[kğ]|çalışma|calisma|faaliyet|oyun|iş|is)|\bbu\s+sırada\b|\bbu\s+koşulda\b)/iu
const REPORTED_DIFFICULTY_MARKER = /(?:günlük\s+yaşam\s+güçlüğü\s+bildirildi|gunluk\s+yasam\s+guclugu\s+bildirildi)/iu
const CONCRETE_CONTEXT_BEHAVIOR = /(?:tamamla|bitir|sürdür|surdur|doldur|eşle|esle|yapab|bağımsız|bagimsiz|geri\s+dön|geri\s+don|bekliyor|geliyor|istediğini\s+söylüyor|istedigini\s+soyluyor|fermuar(?:ını|ini)?\s+çekiyor|bırak|birak|kaç|kac|çıkmaya\s+çalış|cikmaya\s+calis|başını\s+çek|basini\s+cek|zorlan|güçlük|gucluk)/iu

function clean(value: string): string {
  return value.replace(/\s+/gu, " ").replace(/^[\s:;|/=-]+|[\s;|/=-]+$/gu, "").trim()
}

function sourceSegments(input: ReportInput): string[] {
  if (!input.anamnez) return []
  if (typeof input.anamnez !== "string") {
    return Object.entries(input.anamnez)
      .filter(([key, value]) => value != null && String(value).trim() && !/(?:therapist|terapist|external|test|klinik_bulgu)/iu.test(key))
      .map(([key, value]) => `${key}: ${String(value).trim()}`)
  }
  const raw = input.anamnez
  const marker = THERAPIST_OR_EXTERNAL_MARKER.exec(raw)
  const primary = clean(marker ? raw.slice(0, marker.index) : raw)
  const strengths: string[] = []
  for (const match of raw.matchAll(CAREGIVER_STRENGTH_MARKER)) {
    const start = (match.index ?? 0) + match[0].length
    const remainder = raw.slice(start)
    const end = THERAPIST_OR_EXTERNAL_MARKER.exec(remainder)?.index ?? remainder.length
    const value = clean(remainder.slice(0, end))
    if (value) strengths.push(value)
  }
  return [primary, ...strengths].filter(Boolean)
}

function splitClauses(segment: string): string[] {
  const pieces = segment
    .replace(/\r?\n/gu, ". ")
    .replace(/\s+sonra\s+(?=(?:ipucu|görsel|resimli|hatırlatma|hatirlatma|destek)\b)/giu, ". ")
    .split(/(?<=[.!?])\s+|;+\s*|[,]\s*(?=(?:ancak|ama|fakat|buna\s+karşın|buna\s+rağmen|diğer|öte\s+yandan|bunun\s+neden(?:i|ine)?|ne\s+zaman|tetikleyici\s+ya\s+da))|\s+(?=(?:ama|fakat|buna\s+karşın|buna\s+rağmen)\b)/u)
    .map((piece) => clean(piece.replace(/^Bakım veren önce (?:bunun|güçlüğün)[^,]{0,100}söyledi,\s*sonra\s+/iu, "")))
    .filter(Boolean)
  const merged: string[] = []
  for (const piece of pieces) {
    const wordCount = piece.match(/[a-zçğıöşü0-9]+/giu)?.length ?? 0
    if (NON_INDEPENDENT_LIMITATION.test(piece) && merged.length) merged[merged.length - 1] = clean(`${merged[merged.length - 1]}, ${piece}`)
    else if (wordCount <= 2 && merged.length && !PLACEHOLDER_OR_NOISE.test(piece) && !SUPPLEMENTAL_PLACEHOLDER_OR_NOISE.test(piece)) merged[merged.length - 1] = clean(`${merged[merged.length - 1]} ${piece}`)
    else merged.push(piece)
  }
  return merged.flatMap((piece) => {
    const conditional = piece.match(/^(.{3,180}?(?:dığında|diğinde|duğunda|düğünde|tığında|tiğinde|tuğunda|tüğünde|ınca|ince|unca|ünce))\s+(.+)$/iu)
    if (!conditional) return [piece]
    const support = clean(conditional[1])
    const outcome = clean(conditional[2])
    const hasSupport = SUPPORT_PATTERN.test(support)
    const hasIndependentOutcome = PRESERVED_PATTERN.test(outcome) || PRESERVED_SUPPLEMENTAL_PATTERN.test(outcome) || DIFFICULTY_PATTERN.test(outcome) || DIFFICULTY_SUPPLEMENTAL_PATTERN.test(outcome) || ABSENCE_PATTERN.test(outcome)
    return hasSupport && hasIndependentOutcome ? [support, outcome] : [piece]
  })
}

function directionFor(clause: string): AnamnesisEvidenceDirection {
  const absence = ABSENCE_PATTERN.test(clause)
  const preserved = (PRESERVED_PATTERN.test(clause) || PRESERVED_SUPPLEMENTAL_PATTERN.test(clause)) && !FAILED_OUTCOME_PATTERN.test(clause) && !NON_OUTCOME_BODY_PLACEMENT_PATTERN.test(clause)
  const difficulty = DIFFICULTY_PATTERN.test(clause) || DIFFICULTY_SUPPLEMENTAL_PATTERN.test(clause)
  const explicitContrast = /(?:ama|ancak|karşın|karsin|sonra|aynı formda|ayni formda|bir sonraki satır|bir sonraki satir)/iu.test(clause)
  const contextualComparison = CONTEXT_COMPARISON_PATTERN.test(clause)
  if (EVIDENCE_EXISTENCE_UNCERTAIN_PATTERN.test(clause)) return "VAGUE"
  if (UNCERTAINTY_PATTERN.test(clause) && !difficulty && !absence) return "VAGUE"
  if (NEGATED_DIFFICULTY_PATTERN.test(clause)) return "ABSENCE"
  if (GENERIC_CONCERN_WITHOUT_FUNCTION.test(clause)) return "VAGUE"
  if (REPORTED_DIFFICULTY_MARKER.test(clause)) return "DIFFICULTY"
  if (SUPPORT_PATTERN.test(clause) && !preserved && !difficulty && !absence && !OUTCOME_PATTERN.test(clause)) return "CONTEXTUAL"
  if (absence && difficulty) return explicitContrast ? "MIXED" : "ABSENCE"
  if (difficulty && PERFORMANCE_BREAKDOWN_PATTERN.test(clause)) return "DIFFICULTY"
  if (preserved && difficulty) return "MIXED"
  if (contextualComparison) return "CONTEXTUAL"
  if (TEMPORAL_CONTEXT_PATTERN.test(clause) && VARIABILITY_PATTERN.test(clause) && !CONCRETE_CONTEXT_BEHAVIOR.test(clause)) return "CONTEXTUAL"
  if (STRONG_CONTEXT_VARIABILITY.test(clause) && !CONCRETE_CONTEXT_BEHAVIOR.test(clause)) return "CONTEXTUAL"
  if (absence) return "ABSENCE"
  if (preserved) return "PRESERVED"
  if (difficulty) return "DIFFICULTY"
  if (VARIABILITY_PATTERN.test(clause) && (TASK_PATTERN.test(clause) || ENVIRONMENT_PATTERN.test(clause))) return "CONTEXTUAL"
  return "VAGUE"
}

function domainsFor(clause: string): AnamnesisDomainSupport[] {
  let direct = (Object.keys(DOMAIN_PATTERNS) as DomainKey[]).filter((domain) => DOMAIN_PATTERNS[domain].test(clause) || Boolean(DOMAIN_SUPPLEMENTAL_PATTERNS[domain]?.test(clause)))
  if (direct.includes("emotional") && direct.includes("cognitive")) direct = direct.filter((domain) => domain !== "cognitive")
  return direct.map((domain) => Object.freeze({ domain, support_level: "DIRECT" as const }))
}

export function inferEvidenceDomains(text: string): DomainKey[] {
  return domainsFor(text).map((entry) => entry.domain)
}

function matchedText(clause: string, pattern: RegExp): string | null {
  return clean(clause.match(pattern)?.[0] ?? "") || null
}

function functionalContext(clause: string): AnamnesisFunctionalContext {
  const task = matchedText(clause, TASK_PATTERN)
  const environment = matchedText(clause, ENVIRONMENT_PATTERN)
  const trigger = matchedText(clause, TRIGGER_PATTERN)
  const support = matchedText(clause, SUPPORT_PATTERN)
  const outcome = matchedText(clause, OUTCOME_PATTERN) ?? matchedText(clause, PRESERVED_SUPPLEMENTAL_PATTERN)
  const variability = matchedText(clause, VARIABILITY_PATTERN)
  const behavior = DIFFICULTY_PATTERN.test(clause) || DIFFICULTY_SUPPLEMENTAL_PATTERN.test(clause) || PRESERVED_PATTERN.test(clause) || PRESERVED_SUPPLEMENTAL_PATTERN.test(clause) || ABSENCE_PATTERN.test(clause) ? clause : null
  return Object.freeze({ task, environment, trigger, behavior, support, outcome, variability })
}

function evidenceStatus(clause: string, direction: AnamnesisEvidenceDirection, context: AnamnesisFunctionalContext, domains: readonly AnamnesisDomainSupport[]): AnamnesisEvidenceStatus {
  if (!clause || PLACEHOLDER_OR_NOISE.test(clause) || SUPPLEMENTAL_PLACEHOLDER_OR_NOISE.test(clause) || DOMAIN_LABEL_ONLY.test(clause) || HYPOTHETICAL_ONLY.test(clause)) return "UNUSABLE"
  const wordCount = clause.match(/[a-zçğıöşü]{2,}/giu)?.length ?? 0
  if (wordCount < 2 && !(direction === "PRESERVED" && domains.length > 0 && Boolean(context.behavior || context.outcome))) return "UNUSABLE"
  if (wordCount < 3 && !(direction !== "VAGUE" && domains.length > 0 && Boolean(context.behavior || context.outcome))) return "UNUSABLE"
  if (direction === "VAGUE") {
    if (META_LABEL_UNCERTAINTY.test(clause) && !domains.length && !context.task && !context.environment && !context.support && !context.outcome) return "UNUSABLE"
    if (EVIDENCE_EXISTENCE_UNCERTAIN_PATTERN.test(clause) && !domains.length && !context.task && !context.environment && !context.trigger && !context.outcome) return "UNUSABLE"
    if (context.support && !context.outcome && !context.task && !context.environment && !context.trigger && !domains.length) return "UNUSABLE"
    return (domains.length || context.task || context.environment || context.trigger || context.support || context.outcome || UNCERTAINTY_PATTERN.test(clause) || TEMPORAL_CONTEXT_PATTERN.test(clause) || VARIABILITY_PATTERN.test(clause)) && wordCount >= 4 ? "LIMITED" : "UNUSABLE"
  }
  if (domains.length || context.task || context.environment || context.behavior) return "USABLE"
  return "LIMITED"
}

function functionalRoles(
  clause: string,
  direction: AnamnesisEvidenceDirection,
  context: AnamnesisFunctionalContext,
  epistemicStatus: ReturnType<typeof inferEvidenceEpistemicStatus>,
): readonly string[] {
  const roles: string[] = []
  if (context.task) roles.push("TASK")
  if (context.trigger) roles.push("TRIGGER")
  if (["DIFFICULTY", "MIXED"].includes(direction)) roles.push("BEHAVIOR", "COMPLAINT")
  else if (/(?:şikâyet|şikayet|yakınma|alan\s+işaretlenmiş|alan\s+isaretlenmis|alan\s+adını|alan\s+adini|alan(?:ın|in)\s+zor|zorlan(?:ıyor|iyor|dığını|digini)|güçlük|gucluk)/iu.test(clause)) roles.push("COMPLAINT")
  if (context.support) roles.push("SUPPORT")
  if (["PRESERVED", "MIXED"].includes(direction) && context.outcome) roles.push("OUTCOME")
  if (["PRESERVED", "MIXED"].includes(direction)) roles.push("PRESERVED_CAPACITY")
  if (direction === "CONTEXTUAL" || context.environment || context.variability || TEMPORAL_CONTEXT_PATTERN.test(clause) || (direction === "ABSENCE" && ANAPHORIC_CONTEXT_PATTERN.test(clause))) roles.push("CONTEXT")
  if (epistemicStatus !== "OBSERVED_OR_REPORTED" || UNCERTAINTY_PATTERN.test(clause)) roles.push("UNCERTAINTY")
  return Object.freeze(Array.from(new Set(roles)))
}

function normalizedFact(clause: string): string {
  const withoutLabel = clean(clause.replace(
    /^(?:başvuru sebeb[ıi]|başvuru|başvuru notu|reason for referral|referral_reason|parent_concerns_goals|parent concerns goals|strengths?|diagnosis|tan[ıi]|ad_soyad|client_code|age)\s*:\s*/iu,
    "",
  ))
  if (!withoutLabel) return ""
  const normalized = normalizeTurkishClinicalText(withoutLabel)
    .replace(/\bkapasite korunurken\b/iu, "performans korunurken")
  return /[.!?]$/u.test(normalized) ? normalized : `${normalized}.`
}

function stableFactKey(clause: string, index: number): string {
  let hash = 2166136261
  for (const char of clause) {
    hash ^= char.charCodeAt(0)
    hash = Math.imul(hash, 16777619)
  }
  return `${String(index + 1).padStart(3, "0")}-${(hash >>> 0).toString(16).padStart(8, "0")}`
}

export function extractCanonicalAnamnesisEvidence(input: ReportInput): CanonicalAnamnesisEvidenceFact[] {
  const caseId = input.clientCode?.trim() || "jury-case"
  const rawClauses = sourceSegments(input).flatMap((segment, segmentIndex) => splitClauses(segment).map((rawSpan) => ({ rawSpan, segmentIndex })))
  const facts: CanonicalAnamnesisEvidenceFact[] = []
  const previousDomains = new Map<number, AnamnesisDomainSupport[]>()
  let previousGlobalDomains: AnamnesisDomainSupport[] = []
  rawClauses.forEach(({ rawSpan, segmentIndex }, index) => {
    const direction = directionFor(rawSpan)
    const directDomainSupport = domainsFor(rawSpan)
    const context = functionalContext(rawSpan)
    const contextOnly = UNCERTAINTY_PATTERN.test(rawSpan)
      || TEMPORAL_CONTEXT_PATTERN.test(rawSpan)
      || VARIABILITY_PATTERN.test(rawSpan)
      || ["PRESERVED", "MIXED", "CONTEXTUAL"].includes(direction)
      || (direction === "ABSENCE" && ANAPHORIC_CONTEXT_PATTERN.test(rawSpan))
    const domainSupport = directDomainSupport.length
      ? directDomainSupport
      : contextOnly
      ? previousDomains.get(segmentIndex) ?? previousGlobalDomains
      : []
    if (directDomainSupport.length) {
      previousDomains.set(segmentIndex, directDomainSupport)
      previousGlobalDomains = directDomainSupport
    }
    const status = evidenceStatus(rawSpan, direction, context, domainSupport)
    if (status === "UNUSABLE") return
    const proposition = normalizedFact(rawSpan)
    if (!proposition) return
    const domains = domainSupport.map((entry) => entry.domain)
    const inferredEpistemicStatus = inferEvidenceEpistemicStatus(rawSpan)
    const epistemicStatus = EVIDENCE_EXISTENCE_UNCERTAIN_PATTERN.test(rawSpan)
      ? "UNKNOWN" as const
      : inferredEpistemicStatus !== "OBSERVED_OR_REPORTED"
      && ["DIFFICULTY", "PRESERVED", "MIXED", "CONTEXTUAL"].includes(direction)
      && (CONCRETE_CONTEXT_BEHAVIOR.test(rawSpan) || REPORTED_DIFFICULTY_MARKER.test(rawSpan))
      ? "OBSERVED_OR_REPORTED"
      : inferredEpistemicStatus
    const inferredSemanticDirection = inferEvidenceDirection(rawSpan, epistemicStatus)
    const semanticDirection: ReturnType<typeof inferEvidenceDirection> = direction === "ABSENCE"
      ? "NEUTRAL"
      : epistemicStatus === "OBSERVED_OR_REPORTED" && ["DIFFICULTY", "PRESERVED", "MIXED"].includes(direction)
      ? direction as ReturnType<typeof inferEvidenceDirection>
      : inferredSemanticDirection
    const roles = functionalRoles(rawSpan, direction, context, epistemicStatus)
    facts.push(Object.freeze({
      id: `${caseId}.fact.anamnesis.${stableFactKey(rawSpan, index)}`,
      case_id: caseId,
      source_type: "CAREGIVER_ANAMNESIS",
      source_field: "anamnez",
      statement: proposition,
      source_excerpt: rawSpan,
      raw_span: rawSpan,
      normalized_fact: proposition,
      domains: Object.freeze(domains),
      domain_support: Object.freeze(domainSupport),
      functional_context: context,
      evidence_status: status,
      direction,
      semantic_direction: semanticDirection,
      epistemic_status: epistemicStatus,
      semantic_validity: status === "USABLE" ? "USABLE" : "PARTIALLY_INTERPRETABLE",
      semantic_context: inferSemanticContext(rawSpan),
      preserved_subcomponent: null,
      functional_roles: roles,
    }))
  })
  return facts
}

export function factSupportsDomain(fact: CanonicalAnamnesisEvidenceFact, domain: DomainKey): boolean {
  return fact.domain_support.some((entry) => entry.domain === domain)
}

export function factSupportsDifficulty(fact: CanonicalAnamnesisEvidenceFact): boolean {
  return factSupportsDifficultyDirection(fact)
}

export function factSupportsPreservedCapacity(fact: CanonicalAnamnesisEvidenceFact): boolean {
  if (!factEligibleForPreservedCapacity(fact)) return false
  return fact.functional_roles.includes("OUTCOME") && Boolean(fact.functional_context.outcome)
}
