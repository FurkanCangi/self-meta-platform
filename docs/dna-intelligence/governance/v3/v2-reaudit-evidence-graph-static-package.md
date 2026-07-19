# DNA Intelligence V3 — Faz 28–30

Bu kayıt, V2 kataloğunun V3 açısından yeniden denetlenmesini, kanıt grafı
sözleşmesini ve statik çalışma paketi kapısını belgeler. V2 dosyaları veya
çalışma zamanı değiştirilmemiştir.

## Faz 28 — V2 kataloğunun yeniden denetlenmesi

19 Temmuz 2026 kesiminde V2 içindeki 239 canlı iddianın tamamı deterministik
olarak yeniden denetlendi.

| Sonuç | Sayı |
| --- | ---: |
| Denetlenen V2 iddiası | 239 |
| Gerçek pasaj bağlantısı olan | 0 |
| V3 `release_eligible` | 0 |
| V3 `quarantined` | 239 |
| Eski `expert_pending` durumu taşıyan | 239 |

Eski bir `sourceId`, kaynak özeti veya başlık bağlantısı gerçek pasaj kanıtı
sayılmadı. Bu nedenle her kayıt `missing_real_passage`,
`legacy_source_id_is_not_passage_evidence` ve `legacy_expert_pending`
nedenleriyle V3'ten çıkarıldı. Bu karar iddiaların bilimsel olarak yanlış
olduğunu söylemez; V3 yayın zincirinin zorunlu kanıtlarını henüz taşımadıklarını
söyler.

160 eski kaynak kaydının 151'i en az bir iddiada kullanılıyor. Dokuz kayıt bir
iddiada kullanılmıyor; bunların yedisi konu veya ilişki tarafından da
kullanılmadığı için yetim kaynaktır. Kimlikler denetim snapshot'ında açıkça
listelenmiştir. V2 katalog ve motor davranışı korunmuştur.

Yeni V3 durum sözlüğü `owner_approved`, `codex_audited_multi_pass`,
`contested`, `quarantined`, `release_eligible` ve `withdrawn` ile sınırlıdır.
`expert_approved` V3 yayın otoritesi olarak kullanılmaz.

## Faz 29 — Kanıt grafı

Grafın zorunlu zinciri şöyledir:

```text
source → artifact → passage → claim → relation → topic → answer unit
```

Her okun ayrı kimliği, destek kayıt kimliği, destek kayıt hash'i ve kanıt hash'i
vardır. Bir ilişki yalnız kendi ilişki iddiasına ve bu iddianın gerçek pasaj
bağlantısına dayanabilir. A ve B uç noktalarına ayrı ayrı kaynak bulunması A–B
ilişkisinin kanıtı kabul edilmez.

İlişkilerde `maxHops` yalnız `1` olabilir. Doğrudan ilişki seçici, verilen konuya
komşu kayıtları döndürür; ikinci komşuya geçmez. Yetim kaynak, artefakt, pasaj,
pasaj–iddia bağlantısı, iddia veya ilişki grafı geçersiz kılar.

## Faz 30 — Statik çalışma paketi

Paket `src/lib/dna/chat/catalog/generated/v3/` altında deterministik olarak
üretilir. Paket bileşenleri sabit kimliğe göre sıralanır. Manifest şunları
taşır:

- girdi manifest hash'i;
- bileşen dosyalarının SHA-256 değerleri;
- bütün paket hash'i;
- kaynak kesme tarihi;
- dahil edilen ve dışlanan kayıt sayıları;
- kabul edilmiş yayın kayıt sayısı ve çalışma zamanı uygunluğu.

Mevcut gerçek pasaj/iddia kabul sicili boş olduğu için paket yapısal olarak
geçerli fakat içerik olarak boştur: 0 kaynak, 0 pasaj, 0 iddia, 0 ilişki ve 0
lexical kayıt. Manifest 239 V2 iddiasının dışlandığını kaydeder. Boş paket V3
yanıt üretmeye yetkili değildir.

Üretim derleyicisi kabul sicilini çağırandan almaz. Yetki kayıtları ayrı bir
sicilden değil, kanonik Faz 27 release paketinden türetilir. Candidate, iddia,
pasaj, yayın ve dış bilim kaynağı kimlik/hash tuple'larının tamamı bağlanır.
Aynı iddiayı destekleyen birden çok kanonik pasaj korunur; eksik veya fazla
claim–passage–source bağlantısı reddedilir. Sentetik pozitif test sicili yalnız
özel fixture ortamında ve production dışında açılan ayrı bir test seam'idir.
Bu nedenle bir runtime çağıran kendi iddiasını listeye ekleyerek yayın yetkisi
kazanamaz.

Manifest ayrıca kanonik release paketinin input hash'ini ve yetki tuple kümesi
hash'ini taşır. Committed JSON yüklenirken içerik hash'leri ile bu tuple'lar
yeniden karşılaştırılır. Paket mutlak disk yolu, `file://` URI'si, ham PDF imzası veya ham XML/JATS
gövdesi içeremez. Yükleyici `server-only` işaretlidir; genel chat ve katalog
barrel export'larına bağlanmamıştır. Büyük/ham araştırma artefaktları
ResearchSSD üzerinde kalır.

## Yeniden üretim ve doğrulama

```bash
npx tsc -p tsconfig.report-runner.json --outDir .tmp/dna-v3-audit-graph-package
node .tmp/dna-v3-audit-graph-package/scripts/run-dna-v3-audit-graph-package-tests.js
```

Snapshot veya paket bilinçli olarak yeniden üretilecekse ikinci komut
`DNA_WRITE_V3_PHASE_28_30=1` ile çalıştırılır. Test; 20 deterministik derlemeyi,
tam sentetik yedi aşamalı grafı, yanlış parent hash'ini, zincirleme ilişkiyi,
uç-kaynak birleştirmesini, mutlak yolu, ham XML'i ve istemci import sınırını
kontrol eder.

Denetim kanıtları:

- `v2-catalog-reaudit-snapshot.json`
- `catalog/generated/v3/manifest.json`
- `scripts/run-dna-v3-audit-graph-package-tests.ts`

## Açık sınır

Bu fazlar V2 içeriklerini V3'e taşımamıştır. Gerçek kaynak pasajları sonraki
bilimsel denetim ve yayın kapılarını tamamlamadan pakete hiçbir kayıt giremez.
