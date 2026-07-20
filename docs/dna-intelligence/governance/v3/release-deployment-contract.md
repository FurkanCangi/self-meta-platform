# DNA Intelligence V3 release ve deployment sözleşmesi

Sürüm ailesi: Faz 48–53 mühendislik kapıları
Test komutu: `npm run chat:release-deployment`

Bu sözleşme bir V3 yayın onayı değildir. Mevcut V3 paketi boş, gerçek release
evidence bundle yok, evaluation attestation yok ve doğrulanmış preview yoktur.
Bu nedenle V3 ve hybrid-v3 seçimleri fail-closed `NO-GO`; eksik ortam
değişkeninde çalışma zamanı açıkça V2'dir. Bu durum testte zorunlu olarak
doğrulanır. Preview oluşturma, production promotion veya canlı yüzde açılımı bu
fazda yapılmaz.

## Faz 48 — Değişmez evidence bundle

`dna-release-evidence-bundle@1` exact-schema bir kayıt üretir. Kayıt; engine,
katalog ve runtime pack sürümlerini, Git SHA'yı, kaynak kesme tarihini, dahil ve
dışlanan sayıları, DNA kitap onay durumunu, test manifesti ile satır/kategori/
güvenlik/çapraz-hesap/performans sonuçlarının hash'lerini, sınırlılıkları,
çatışmaları, karantinayı, marketing evidence hash'ini ve sabit rollback hedefini
tek bir `bundleSha256` altında bağlar. Şemada soru, cevap, danışan, rapor veya
passage metni alanı yoktur. Payload veya tek bir sonuç değişirse bundle hash'i
geçersiz olur. Descriptor hash'i tek başına yeterli değildir: her test
artefaktı izin verilen evidence root'u altındaki normal bir JSONL dosyasına
yeniden bağlanır; gerçek dosya SHA-256'sı ve satır sayısı eşleşmeden hard
NO-GO açılmaz. Yedi artefakt türünün her biri ayrı exact-row şemasına sahiptir;
her satır aynı release/run, Git SHA, engine kod hash'i ve runtime pack hash'ine
bağlanır. Hard NO-GO sinyalleri bu satırlardan yeniden türetilir. Descriptor
üzerindeki `pass` veya çağıranın verdiği yeşil sayaç, kırmızı artefakt sonucunu
örtemez. Current action guard önceden hesaplanmış bir verification nesnesine
güvenmez; committed evidence root altındaki dosyaları karar anında yeniden açar.

Gerçek Faz 38–47 artefaktları bulunmadan
`DNA_CURRENT_V3_RELEASE_EVIDENCE_BUNDLE` bilinçli olarak `null` kalır; sentetik
test fixture'ı current release kanıtı yerine geçmez.

## Faz 49 — Hard NO-GO

Tek karar verici aşağıdaki koşullardan herhangi birini gördüğünde yayın,
preview promotion ve V3 çalışma zamanı açılımını kapatır:

- çapraz hesap/PII sızıntısı;
- kritik güvenlik sorusuna klinik cevap;
- raporda olmayan vaka bulgusu;
- kaynaksız iddia, yanlış kaynak veya passage'sız claim;
- metadata-only, geri çekilmiş veya lisans dışı kaynak;
- audit fail-open veya pending içerik yayını;
- kilitli benchmark bütünlük hatası;
- kritik UX uyarısının görünmemesi;
- rollback/kill-switch eksikliği;
- kanıtsız pazarlama iddiası;
- eksik veya eşik dışı determinism/performans kanıtı;
- boş V3 paketi, eksik evaluation attestation veya eksik evidence artefaktı.

Eksik sinyal `0` sayılmaz; `release_signal_missing_or_invalid` olarak NO-GO'dur.

## Faz 50 — Sunucu tarafı runtime seçimi

`DNA_CHAT_RUNTIME_RELEASE` yalnız şu değerleri kabul eder:

- `v2`: sabit V2 rollback nesli;
- `hybrid-v3`: sadece released, passage-backed V3 yüzeyi; desteklenmeyen soruda
  bounded `not_available`; cevap içinde V2/V3 claim karışımı yok;
- `v3`: tam V3.

Eksik değer güvenli varsayılan `v2` olur. Yazım hatalı bir değer blocked olur.
`hybrid-v3` ve `v3`; committed V3 package, release authorization,
evaluation attestation, evidence bundle ve hard NO-GO kararını geçmeden
çalışamaz. `DNA_CHAT_V3_ROLLOUT_PERCENT` 0–100 tam sayı olmalıdır; varsayılan
0'dır. `DNA_CHAT_V3_KILL_SWITCH=1`, diğer bütün sinyallerden önce V2 rollback
yolunu seçer.

Bunlara ek olarak runtime deployment yetkisi gerekir. Exact Vercel Preview,
yalnız `VERCEL_ENV=preview`, `VERCEL_GIT_COMMIT_SHA` ve `VERCEL_URL` bağları
geçtiğinde aday V3'ü test için çalıştırabilir. Preview dışındaki her ortam
production kabul edilir ve `DNA_CHAT_PRODUCTION_PROMOTION_RECEIPT_BASE64`
içinde exact production origin, Git/pack'e bağlı, en fazla 24 saat geçerli,
committed bağımsız release-observer anahtarıyla imzalı **production** gözlem
receipt'i olmadan V3 runtime seçilemez. Preview gözlem imzası production runtime
yetkisi değildir. Böylece environment flag tek başına production V3'ü açamaz.
Receipt yoksa/sona ererse V3 blocked olur; kill-switch V2'ye döner. İlk
production V3 canary'sini therapist trafiğine açmadan çalıştıracak ayrı bootstrap
yetkisi bu sürümde bulunmadığından canlı V3 rollout current durumda ayrıca
NO-GO'dur.

Runtime, production observation receipt'i doğrularken imzalayan bağımsız
release-observer'ı production manifest/deployment/aggregate zincirinin dış
otoritesi kabul eder; bu dosyaları runtime container içinde yeniden açmaz.
İkinci, ayrı amaçlı runtime-activation imzası henüz yoktur ve canlı rollout
blokörüdür.

## Faz 51 — Exact preview manifesti

`dna-preview-verification@1`; preview deployment/artifact kimliği, exact Git
SHA, yerel ve preview pack hash'i, evidence bundle ve evaluation attestation
hash'i ile aşağıdaki kontrolleri tek manifestte bağlar: login/session, üç cevap
derinliği, yazım hatası, takip sorusu, locator, rapor istemi, owned ve
foreign/missing rapor, audit hatası, 390/768/1440 px, iki tema, console/function
logları, SSD/debug sızıntısı ve sentetik çapraz hesap.

Manifest `READY`, bütün kontroller `pass` ve yerel/preview hash'leri birebir aynı
olmadan promotion kararı verilemez. Manifest alanları tek başına kanıt değildir:
deployment özeti ve her kontrol, izin verilen root altındaki normal JSON
dosyasından yeniden okunur; byte SHA, run ID, deployment ID, origin, exact Git
SHA, pack SHA ve doğrulama zamanı uyuşmalıdır. Symlink/traversal reddedilir.

Dosya düzeyi doğrulama da tek başına canlı gözlem kanıtı değildir. Preview ve
production için browser, function-log ve çapraz-hesap kontrollerinin toplu
hash'leri; deployment/origin, Git SHA, pack SHA, verification manifest hash'i,
deployment artefakt hash'i, run ID ve kısa geçerlilik süresiyle birlikte bir
haricî release-observer tarafından Ed25519 ile imzalanır. Action-facing guard
yalnız repoya önceden commit edilmiş, ortam ve zaman kapsamı geçerli public
trust root'larını kabul eder. Çağıranın verdiği public key, `valid=true` veya
kendi kendine yazılmış pass JSON'u promotion yetkisi değildir. Kurumsal
release-observer trust root'u henüz onaylanmadığı için current trust-root listesi
boştur ve promotion fail-closed kalır.

## Faz 52 — Yalnız doğrulanmış preview promotion

Guard yalnız `promote_existing_preview` yöntemini kabul eder. `new_build`
explicit olarak reddedilir. Production tamamlanmış sayılmadan ayrıca exact
production manifestinde commit/pack eşleşmesi, 401, private no-store, standart
ve derin teori, owned case, foreign/missing 404, audit minimizasyonu, rate-limit,
production log ve sentetik çapraz-hesap smoke kontrolleri geçmelidir.
Production manifesti ve her kontrolü de promoted preview kimliği/artifact
hash'i, production origin, commit, pack ve production deployment artifact
hash'iyle aynı dosya düzeyi doğrulamadan geçer.

Unit test veya yerel build tek başına canlı kanıt değildir.

Action-facing karar `evaluateCurrentDnaPreviewPromotion()` üzerinden alınır.
Bu fonksiyon parametre kabul etmez: dışarıdan `allowed=true`, deployment kimliği,
evidence veya attestation verilemez. Exact repository HEAD ve temiz çalışma
ağacı; committed current preview, evidence bundle, evaluation attestation,
runtime package, imzalı dış canlı gözlem attestation'ı ve hard NO-GO
otoriteleriyle birlikte doğrulanır. Üretilen tek yöntem
`promote_existing_preview` olabilir.

Production için tek action-facing karar
`evaluateCurrentDnaProductionRelease()` fonksiyonudur ve o da parametre kabul
etmez. Low-level deployment doğrulayıcısı yalnız `verified` sonucu üretir;
release yetkisi sayılmaz. Current production kararı, aynı committed preview
promotion otoritesi, fresh hard NO-GO, current production manifest/artefakt ve
preview ile production için iki ayrı imzalı canlı gözlem attestation'ı olmadan
`released=true` üretemez.

`npm run chat:preview-promotion:check` yalnız okuma yapan bir release kapısıdır.
Vercel çağrısı yapmaz ve mevcut NO-GO durumunda non-zero çıkar. Bilinmeyen argüman
veya `--promote` kabul edilmez; promotion yürütücüsü bu sürümde kasıtlı olarak
yoktur. Böylece kontrol komutunun yanlışlıkla yeni build/deploy üretmesi mümkün
değildir.

## Faz 53 — Kontrollü açılım ve geri dönüş

Sabit açılım basamakları preview `%0`, internal `%5`, limited `%25`, broad
`%50` ve full `%100`'dür. Kullanıcı seçimi paket hash'i ile deterministik
bucket'a bağlanır; raw kullanıcı kimliği evidence artefaktına yazılmaz. Canary
soruları, V2/V3 farkları ve asgari gözlem sayısı sağlanmadan bir sonraki basamak
açılmaz. Her önceki aşamanın toplulaştırılmış sağlık sinyalleri izin verilen
root altındaki normal JSON/JSONL dosyasından okunur; release, paket, policy,
aşama, gözlem sayısı, tamamlanma zamanı ve byte hash'i sealed yetkiyle birebir
eşleşmeden rollout yetkisi geçersizdir. Current action kararı önceden hesaplanmış
rollout verification nesnesine güvenmez; committed root ve dosya descriptor'ları
üzerinden sağlık artefaktlarını yeniden açar.

Citation ihlali, pending/restricted kaynak, güvenlik regresyonu, çapraz hesap,
case audit fail-open, pack şema/hash hatası, desteklenmeyen klinik iddia veya
tanımlanmış belirgin 5xx artışı anında `rollback_v2` üretir. Tek environment
geri dönüşü `DNA_CHAT_RUNTIME_RELEASE=v2`'dir. Sabit geri dönüş hedefi:

- tag: `dna-chat-v2-baseline-20260719`
- commit: `5ed87217280a40e4566a04289d4c98b1f3883494`
- engine: `dna-chat-engine@2`
- catalog: `dna-chat-catalog@2`

Test, tag'in halen exact commit'e çözüldüğünü doğrular. Kod rollback'inin veri
tabanı migration rollback'i olmadığı sınırı korunur.
