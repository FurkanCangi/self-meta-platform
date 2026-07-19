# DNA Intelligence bilgi otoriteleri

Sözleşme sürümü: `dna-knowledge-authority@1`

DNA Intelligence aynı yanıtta birden fazla bilgi türü kullanabilir; fakat bu bilgi türleri birbirinin kanıtı veya yerine geçen otorite olarak kullanılamaz. Her görünür cevap birimi ve kaynak kaydı tek bir bilgi otoritesi taşır.

| Katman | Tek otorite | Gerekli onay | V3 sınırı |
|---|---|---|---|
| DNA ürün bilgisi | Sahip onaylı DNA kitabı | `owner_approved` | Kitap sürümü, SHA-256, bölüm ve pasaj olmadan V3 yayın uygunluğu yoktur. |
| Dış bilimsel bilgi | Hakemli yayın, kılavuz veya kitap | `codex_multi_pass_audited` | Gerçek pasaj ve en az iki bağımsız denetim geçişi olmadan V3 yayın uygunluğu yoktur. |
| Vaka bilgisi | Sahipliği doğrulanmış güvenli rapor bağlamı | `report_derived` | Sentetik veya doğrudan gönderilmiş bağlam üretim raporu sayılamaz. |
| Güvenlik ve ürün sınırı | Sürümlü kullanım sözleşmesi | `policy_enforced` | Diğer üç katman bu sınırı gevşetemez. |

## Geçiş gerçeği

V2 kataloğundaki `dna_contract`, `sourceVerified` ve `approvedEntry` etiketleri yukarıdaki onayların kanıtı değildir. Faz 2 bu kayıtları dürüstçe `pending` durumunda tutar. Bunlar sırasıyla Faz 3 ve Faz 28 kapılarından geçmeden V3 için `releaseEligible` olamaz.

`releaseEligible` yalnız nesnenin alanlarına bakılarak verilmez. Ürün ve bilim otoriteleri hash-kilitli kayıt deposunda birebir eşleşmeli; seri hale getirilmiş veya elle oluşturulmuş bir proof nesnesi yayın otoritesi kazanamaz. Faz 2 sonunda ürün onayı ve V3 bilim denetimi kayıt depoları bilerek boştur: gerçek kitap onayı Faz 3'te, bilimsel çok geçişli denetim sonraki denetim fazlarında doldurulacaktır.

Mevcut motor `dna-chat-engine@2` rollback ve regresyon yüzeyi olarak çalışmaya devam eder. V3 yayın derlemesi yalnız tam kanıt nesnesi taşıyan kayıtları kabul edecektir. Bu ayrım, geçiş sırasında eski davranışı sahte bir V3 onayıyla etiketlemeyi önler.

## Beş ikame yasağı

1. DNA kitabı bilimsel kanıt yuvasını dolduramaz.
2. Genel literatür DNA ürününün geçerlik, güvenirlik veya faktör yapısını otomatik olarak doğrulayamaz.
3. Rapor bulgusu biyolojik ölçüm, mekanizma veya neden olarak sunulamaz.
4. Kaynak veya kitap metni sürümlü güvenlik politikasını aşamaz.
5. Dış bilim DNA ürün tanımını `defines`, `redefines`, `overrides` veya `validates` ilişkisiyle değiştiremez.

Bu kurallar yalnız dokümantasyon değildir. Her cevap birimi `product_definition`, `scientific_evidence`, `dna_specific_validation`, `case_finding` veya `safety_boundary` rolü taşır. Çalışma zamanı kapısı rol–otorite ve kaynak–otorite eşleşmesini doğrular; kayıtlı tek-adımlı graf ilişkileri de aynı ikame kapısından geçer. Eşleşmeyen yanıt `not_available` olarak kapatılır.

## Vaka kökeni

`report_derived` yalnız `server-only` sahiplik sınırında report → aktif assessment → aktif client → `owner_id=user.id` zinciri yeniden okunduktan sonra oluşturulur. İstenen ve yüklenen report/assessment/client kimliklerinin birebir eşleşmesi ile oturum sahibi eşitliği zorunludur. Release-capable vaka otoritesi kimlik tabanlı kapalı kayıt deposuna alınır; aynı alanları taşıyan seri hale getirilmiş bir nesne veya çağıranın verdiği bir `ownershipVerified` alanı otorite kazanamaz. Düşük seviyeli üretici ve bağlayıcı genel chat barrel export'unda bulunmaz; statik kapı bunların tek üretim tüketicisinin sahiplik sınırı olduğunu doğrular.

Üretim vaka bağlamı serbest rapor metnini filtreleyerek kullanmaz; serbest metni hiç kabul etmeyen bir allowlist ile yeniden kurulur. Kanonik üretici yalnız altı DNA alanının yapılandırılmış skor/düzey kayıtlarını ve güvenli yaş bilgisini okur. `chat_context`, rapor anlatısı, anamnez, terapist notu, ham yanıtlar, evidence atomları, trace ve dahili kural alanları girişte bulunsa bile okunmaz. Böylece “düşük vagal ton”, “sempatik baskınlık”, “insula aktivitesi düşüktür” veya “kortizol düzeyi yüksektir” gibi açık uçlu biyolojik çıkarımlar üretim vaka cevabına taşınamaz.

Köken denetimi üç ayrı SHA-256 değeri üretir: kabul edilen yapılandırılmış kaynak payload, son güvenli bağlam ve report/assessment/client/owner kimlikleriyle alan-ayrımlı lineage bağı. Bu özel hash'ler ile kimlikler kullanıcı cevabına veya audit klinik içeriğine açılmaz. Sentetik ve legacy/de-identified bağlamlar yalnız test veya geçiş içindir; `releaseEligible` olamaz.

## Kullanıcı yüzeyi

API her görünür cümleyi tek otorite ve tek rolle `answerUnits` içinde döndürür. Terapist arayüzü bu birimleri ayrı kartlarda gösterir; toplu rozetle yetinmez. Her kart ve kaynak, `Yayın uygun`, `Denetim bekliyor` veya `Yalnız test` durumunu ve uygun olduğunda iddia sınırını görünür kılar. Böylece vaka bulgusu, dış bilim, DNA ürün bilgisi ve politika cümleleri aynı yanıtta bulunsa bile görsel olarak birbirine karışmaz.

## Terminoloji kararı

Faz 2'deki `codex_multi_pass_audited`, dış bilim otoritesinin onay gereksinimidir. Faz 28'deki `codex_audited_multi_pass` ise kaydın yaşam döngüsü statüsüdür. İki ad farklı alanlarda kullanılacak ve birbirinin alias'ı sayılmayacaktır.
