# DNA Intelligence V3 — Faz 14–19 Kanıt Çıkarım Sözleşmesi

Bu sözleşme bilimsel artefakttan çalışma zamanı iddiasına giden hattın ayrıştırma, pasaj, atomik iddia, kör çift geçiş ve uzlaştırma sınırlarını tanımlar. Bu fazların çıktısı **yalnız `candidate_only`** durumundadır. Bilimsel kabul, lifecycle `accepted/released` durumu veya canlı kullanım hakkı üretmez.

## Faz 14 — Deterministik metin ayrıştırma

Parser sırası sabittir:

1. JATS XML
2. EPUB/Pressbooks XML
3. Yapısal HTML
4. Elle onaylanmış PDF sayfa aralıkları
5. OCR

Aynı kaynak için en yüksek öncelikli mevcut artefakt seçilir. Yüksek öncelikli artefaktın hash veya yapı doğrulaması başarısızsa düşük öncelikli kopyaya sessiz geçiş yapılmaz.

Her çıktı ham artefakt SHA-256 değeri, ayrıştırılmış konumların hash’i ve ikisini birleştiren bağ hash’i taşır. Artefakt baytları değiştiğinde eski ayrıştırma ve ona bağlı pasajlar geçersiz olur. Aynı başlığı taşıyan farklı XML/HTML bölümleri, görünür başlıktan ayrı iç bölüm kimliğiyle tutulur; bu nedenle iki ayrı “Results” bölümü tek pasaj gibi birleştirilemez.

Şunlar bilimsel anlatı pasajı olamaz:

- kaynakça ve bibliyografya;
- tablo, şekil ve caption;
- ek materyal;
- ölçek, anket ve test maddeleri;
- üçüncü taraf bileşenler;
- script, navigasyon ve benzeri yapısal olmayan HTML;
- bozuk OCR veya doğrulanmamış sütun sırası.

`Supplementary Information`, `Electronic supplementary material`, `Online supplement`, `Supporting information` ve benzeri başlık önekleri de ek materyal sayılır. PDF yalnız onay kimliği, kesin sayfa aralığı, çıkarılan gerçek metin, doğrulanmış sütun sırası ve kısıtlı bileşen kararının tamamı aynı güven kaydına hash ile bağlanmışsa ayrıştırılır. OCR bunlara ek olarak insan aralık onayı, en az `0.98` ortalama karakter güveni ve en çok `0.005` replacement-character oranı ister.

Onay alanlarının kendi kendine `approved` yazması güven oluşturmaz. Üretimde yalnız kod incelemesiyle digest allowlist’ine alınmış `governance_audit` kayıtları yetkilidir. Bu allowlist şu anda bilerek boştur. `test_fixture` kayıtları yalnız üretim dışı test sürecinde ve açık test bayrağıyla kullanılabilir; üretim yolunda reddedilir.

## Faz 15 — Kaynak pasajı

Bir pasaj:

- aynı bölümdeki 1–3 bitişik paragraftan oluşur;
- XML kimliği/paragraf sırası veya onaylı PDF sayfa aralığı taşır;
- kaynak, artefakt, orijinal metin ve içerik hash’lerini taşır;
- yaş kapsamı, kanıt türü ve iddia sınırı için ayrı inceleme kanıtı ister;
- yalnız `passage` bileşeni için kaynak ve artefakt hash’ine bağlı lisans onayıyla oluşturulur;
- başka pasajla keyfî paragraf overlap’i bulunduğunda kör kayıt hattı tarafından reddedilir;
- her durumda `candidate_only` ve `runtimeEligible: false` kalır.

Pasaj desteği iddianın tekrarından üretilmez; doğrudan uygun artefakttaki gerçek paragraf metnidir. Lisans, metadata ve daha sonraki pasaj güven kayıtları, ayrı güven registry’sindeki tam içerik commitment’larıyla eşleşmeden aday pasaj veya kör-run kaydı oluşmaz.

## Faz 16 — Atomik iddia

İddia şeması kontrollü `claimType`, popülasyon, yaş, ortam, ölçüm, karşılaştırıcı, sonuç, yön, etki büyüklüğü, belirsizlik, çalışma tasarımı, kanıt düzeyi, pasaj, nedensellik ve sınır alanları taşır. Sayısal/nitel etki büyüklüğü gerçek pasajdaki locator metnine; `not_assessed` dışındaki kanıt düzeyi ise güven registry’sine alınmış yöntem değerlendirmesine bağlanmak zorundadır. Bu bağ yoksa alan sırasıyla `not_reported`/`null` ve `not_assessed` kalır; caller beyanı kabul edilmez.

Fail-closed V1 kuralı gereği önerme, bağlı pasajlardan birinde birebir bulunmalıdır. Noktalı virgül, birden fazla cümle veya bağlaç sonrasında ikinci bir yüklem taşıyan bileşik önerme reddedilir. “Çocuklar ve ergenler” gibi tek isim grubundaki bağlaç reddedilmez; ikinci bağımsız yüklem aranır.

Otomatik geçiş hiçbir iddiayı `causal_supported` ilan edemez. Kaynakta açık nedensel dil varsa kayıt `source_causal_claim_unverified` olarak sınıflanır ve karantinaya alınır. Kör çıkarımda `dnaRelationship` yalnız `none` olabilir; dış bilimden DNA ürün bağlantısı üretilemez.

## Faz 17–18 — Kör A/B kayıt ve doğrulama hattı

A ve B ayrı, sabit protokol kimliği ve ayrı run kimliği taşır. Bu modül otonom bir metin üreticisi değildir: kontrollü iki ayrı okuma bağlamında hazırlanmış atomik claim taslaklarını kaydeder ve doğrular. Girdi; hash-doğrulanmış ayrıştırılmış artefaktı, güven registry’sindeki uygun pasajları, kaynak yönetişim metadata commitment’ını, bağlam commitment’ını, claim taslaklarını ve claim başına ayrı gerekçe/belirsizlik kanıtını kabul eder. Karşı kör run, DNA kitabı, DNA bağlantıları veya uzlaştırma çıktısı gibi ek alanlar strict-shape kontrolünde reddedilir.

Çıktılar derin dondurulur ve bütün içerikleri hash’e bağlanır. A ve B’nin yalnız run/protokol kimliklerinin farklı olması yeterli değildir; ayrı instruction commitment’ları zorunludur ve kopyalanmış bağlam uzlaştırmada reddedilir. `peerOutputExcluded` yürütme beyanı commitment’a alınır. Bu mekanizma körlüğün kriptografik kanıtı veya bağımsız uzman incelemesi değildir; yürütmenin ayrı bağlamlarda yapılması üst süreç tarafından sağlanmalı ve denetlenmelidir.

## Faz 19 — Uzlaştırma

Uzlaştırma şu altı alanı ayrı ayrı karşılaştırır:

- pasaj;
- önerme;
- yaş kapsamı;
- nedensellik;
- kanıt düzeyi;
- iddia sınırı.

Çoğunluk oylaması yoktur. Altı alanın tamamı aynı; run/claim/rationale hash’leri, ayrı bağlam commitment’ları, kaynak/artefakt ve güvenilir pasaj bağları geçerliyse sonuç `exact_consensus_candidate` olur. Tek bir fark `contested`; bozuk provenance veya karantinadaki nedensel iddia `quarantined` üretir.

Yeniden inceleme yalnız tartışmalı kaydı, yeniden okunan güncel ve güven registry’sinde bulunan pasajları ve çözüm içeriğinden türetilen kanıt commitment’ını bağlayarak `rereview_consensus_candidate` oluşturabilir. Çözülen önerme yeniden okunan gerçek pasajda bulunmalı; yaş ve sınır pasajla aynı olmalı; kanıt düzeyi değişiyorsa güvenilir yöntem değerlendirmesine bağlanmalıdır. Bu durum da kabul veya runtime release değildir.

## Kabul ve çalışma zamanı sınırı

`DNA_CURRENT_ACCEPTED_ATOMIC_CLAIM_REGISTRY` bilerek boştur. Sentetik exact consensus ve yeniden inceleme örnekleri yalnız boru hattı sözleşmesini test eder; gerçek kabul edilmiş bilimsel iddia oluşturmaz. Daha sonraki yöntem, karşı kanıt, dil, güvenlik, lifecycle, katalog ve release kapıları tamamlanmadan hiçbir kayıt canlı cevapta kullanılamaz.

Hat çalışma zamanında internet, haricî LLM, embedding, vektör veritabanı veya yeni bağımlılık kullanmaz.

## Doğrulama kanıtı

Sentetik test kapsamı:

- JATS/HTML yapısı, ek materyal başlık varyantları ve bütün yasak bileşenlerin dışlanması;
- manuel PDF/OCR metninin trusted commitment’a bağlanması ve caller-self-approval reddi;
- parser önceliği ve artefakt değişikliğiyle otomatik geçersizleşme;
- 1–3 bitişik paragraf, tekrarlanan bölüm başlığında kimlik ayrımı ve zorunlu overlap kapısı;
- bileşik önerme, genişletilmiş nedensellik, kaynaksız etki/kanıt düzeyi ve DNA bağlantısı reddi;
- kör A/B şema izolasyonu, ayrı instruction/context commitment’ı, gerekçe kaydı, bütünlük hash’i ve değişmezlik;
- sahte pasaj, caller-üretilmiş governance trust registry ve production `test_fixture` reddi;
- exact consensus, anlaşmazlık ve kaynak yeniden okuma uzlaştırması;
- kabul registry’sinin sıfır kalması.

Lisans denetiminde `passage: cleared` ve `verified_in_artifact` olan gerçek `cosmin-prom-systematic-reviews-v2-2024` JATS artefaktı yalnız yapısal pilot olarak ayrıştırıldı:

- SSD-relative artefakt: `evidence/cognition-development/cosmin-prom-systematic-reviews-v2-2024/raw/mokkink-2024.jats.xml`
- artefakt SHA-256: `49150ead3ac7dfb2c1ffa7faeff61b4884eb8c6418888ed3289c006fbfdb0ff8`
- uygun anlatı paragrafı: `40`
- dışlanan yapı: `56`
- yasak bölümden kalan paragraf: `0`
- artefakt hash/byte doğrulaması: SSD `source.json` manifestine bağlı
- çıktı: `candidate_only`
- runtime uygunluğu: `false`

Pilot ham metni, pasajı veya iddiayı repo snapshot’ına taşımamıştır.

Gerçek SSD pilotu yalnız Faz 14 ayrıştırma kanıtıdır. Gerçek kaynak için Faz 15 pasaj onayı veya Faz 17–19 A/B iddia uzlaştırması yapılmış değildir. Bu katmanların testleri sentetiktir; gerçek corpus üzerinde tamamlandıkları veya bilimsel claim üretildiği ileri sürülmez.

Doğrulama komutları:

```bash
npx tsc -p tsconfig.report-runner.json --noEmit
npm run chat:evidence-extraction
RESEARCH_SSD_ROOT="$RESEARCH_SSD_ROOT" npm run chat:evidence-extraction:ssd
```
