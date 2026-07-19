# DNA Intelligence V3 boşluk odaklı arama protokolleri

Sürüm: `dna-gap-protocols@1`
Kesme tarihi: 2026-07-19
Şablon durumu: `planned`
Dondurulmuş çevrimiçi koşu: `identification_and_title_abstract_screening_executed_full_text_pending` (`gap-search-execution-2026-07-19.json`)

Kapsam matrisindeki 120 `bounded_partial` ve 10 `not_available` hücrenin tamamı, kendi alanındaki bir protokole benzersiz biçimde bağlanmıştır. `prohibited` hücreler araştırmayla kaldırılacak boşluklar değildir; amaçlanan kullanım sınırlarıdır.

## Planlanan on protokol

1. İyon kanalları, sinaptik plastisite, glia ve nöromodülatörler
2. Beyin sapı, talamus, bazal gangliyonlar ve serebellum
3. Merkezi otonom ağ, barorefleks, solunum ve postür etkileri
4. HPA/SAM sistemleri ve çocuk-ergen stres gelişimi
5. Vestibüler, proprioseptif, dokunsal ve işitsel modülasyon
6. Eş-regülasyonun gelişimsel ve kültürel sınırları
7. Yürütücü işlevlerde görev saflığı problemi
8. Pediatrik uyku ve sirkadiyen gelişim
9. ADHD, DCD, disleksi, dil bozuklukları, Tourette ve yetişkin nöroçeşitliliği
10. DNA'ya özgü psikometri ve bireysel belirsizlik

Her protokol araştırma sorusu, dahil etme ve dışlama koşulları, yaş kapsamı, çalışma türleri, tarih kesme noktası, veri tabanları ve veri tabanına özgü tam arama ifadelerini taşır. Kanonik kayıt `src/lib/dna/chat/governance/gapProtocols.ts` dosyasındadır.

## 2026-07-19 dondurulmuş koşusu

On protokol PubMed E-utilities, Crossref REST ve OpenAlex REST üzerinden gerçekten çalıştırıldı. Otuz protokol/API yürütmesinin tamamı başarılı HTTP cevapları aldı. Ham yanıt, normalize metadata, DOI/PMID/başlık-yıl tekilleştirme defteri ve deterministik başlık-özet eleme defteri ResearchSSD üzerinde 100 dosya ve 67 MB olarak tutulur.

| Ölçüm | Gerçek sayı |
|---|---:|
| API'lerin bildirdiği toplam sonuç — API'ler arası tekilleştirilmemiş | 64.239.324 |
| İndirilen metadata | 2.824 |
| Tekilleştirilmiş metadata | 2.730 |
| Çıkarılan yinelenen kayıt | 94 |
| Başlık/özet düzeyinde dışlanan | 1.085 |
| Yalnız manuel tam metin incelemesine aday | 1.645 |
| Tam metni incelenen | `null` |
| Kanıt tabanına dahil edilen | `null` |
| V3 `release_ready` iddia | 0 |

**Cap sınırı:** Her protokol ve API'den yalnız ilk 100 metadata kaydı indirildi. 64.239.324 sayısı özellikle geniş Crossref eşleşmelerini de içeren, API'lerin bildirdiği ve API'ler arası tekilleştirilmemiş toplamdır; incelenmiş, uygun veya kullanılabilir kaynak sayısı değildir. Tekilleştirme ve başlık/özet eleme sayıları yalnız indirilen 2.824 kayıt için geçerlidir.

“Manuel tam metin incelemesine aday” kararı dahil edilme değildir. Bu koşuda tam metin incelemesi, kalite değerlendirmesi, bağımsız tekrar kontrolü veya release yapılmadı. DNA'ya özgü aramada 20 metadata kaydının başlık/özet sinyali eşiğini geçmesi de bunların DNA ürününe ait olduğunu veya psikometrik kanıt sunduğunu göstermez.

Depolama politikası: `research_ssd_required_no_local_fallback`
SSD-göreli ham kök: `Datasets/DNA-Intelligence/source-searches/v3/2026-07-19/dna-gap-search-20260719-7cdbe80cbc0b-20260719115132792`
Ham manifest SHA-256: `2b3144aed93d7854f181fa33c416bdbdf66f91d12d92509d6f08191aa09a40de`
Snapshot SHA-256: `654305850fa3111d126bc637c596bc9559b8bd3da3d34b4c494e002c99f64c71`

`npm run chat:gap-search:online` yeni ve ayrı bir SSD koşusu üretir; `npm run chat:gap-search:verify` dondurulmuş repo özetini 100 ham dosyanın byte ve SHA-256 değerlerine karşı doğrular.

## Sayıların dürüstlüğü

Kanonik protokol şablonları değişmez ve `planned` kalır; her gerçek koşu ayrı, hash'li bir execution snapshot üretir. Yeni veya başarısız bir koşuda sayı bilinmiyorsa **0 değil `null`** tutulur. Bir API erişilemezse protokol ve toplam koşu `partial` veya `failed` olarak kaydedilir. Bir execution snapshot ancak şunların tümü olduğunda `executed` olabilir:

- benzersiz çalışma kimliği ve zaman damgası,
- protokol SHA-256 özeti,
- ham sonuç defteri SHA-256 özeti,
- tarama/dışlama defteri SHA-256 özeti,
- birbirleriyle tutarlı tanımlanan, tekilleştirilen, taranan, tam metni değerlendirilen ve dahil edilen kayıt sayıları,
- gerekçeye göre dışlama sayıları.

Bu kanıtlar olmadan sayı eklemek sahte yürütme kabul edilir ve test kapısını geçemez.

## PRISMA sınırı

PRISMA, arama ve seçim sürecinin yeniden üretilebilir raporlanmasına yardım eder; ürün doğruluğu, kaynak kalitesi, DNA geçerliği veya klinik güvenlik sertifikası değildir.
