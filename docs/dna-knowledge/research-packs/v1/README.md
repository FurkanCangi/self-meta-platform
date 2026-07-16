# DNA bilgi kataloğu araştırma paketleri — V1

Bu dizin, DNA Asistanı katalog sürümü `dna-chat-catalog@2` için kullanılan dört bağımsız araştırma paketinin kanonik denetim kopyalarını içerir.

## Kanonik dosyalar

| Kategori | Kanonik Markdown | Ham iddia | Kavram kartı | Soru | Kaynak |
|---|---|---:|---:|---:|---:|
| Self-regülasyon | `self-regulation.md` | 28 | 26 | 84 | 45 |
| Merkezi sinir sistemi | `central-nervous-system.md` | 16 | 22 | 60 | 33 |
| Otonom sinir sistemi | `autonomic-nervous-system.md` | 22 | 20 | 70 | 31 |
| Sempatik–parasempatik süreçler | `sympathetic-parasympathetic-processes.md` | 36 | 46 | 100 | 42 |
| **Toplam** |  | **102** | **114** | **314** | **151** |

`SHA256SUMS` dosyası kanonik dosyaların değişmezlik kontrolünü sağlar. Otonom Sinir Sistemi DOCX dosyası Markdown ile aynı içeriğin sunum kopyası olduğu için ikinci bir kanonik kayıt oluşturulmamıştır. ZIP paketlerindeki DOCX ve HTML sunum kopyaları da bu dizine alınmamıştır.

## Yayın politikası

Araştırma paketleri doğrudan runtime bilgi tabanı değildir. Runtime yalnız `src/lib/dna/chat/catalog` altında açık kaynak kimliği bulunan, kaynak kaydı doğrulanan, iddia sınırı tanımlanan ve `safe` işaretli dar alt kümeyi kullanır.

Kanonik tablolardaki 102 iddia, 114 kavram kartı, 314 soru ve 151 kaynak adayı kimlik desenleriyle denetlenmiş ham envanterdir. Canlı katalog bu adayların bire bir kopyası değildir: tekrarlar, çakışan kavramlar ve dayanağı yetersiz kayıtlar birleştirilmiş veya uzman incelemesine bırakılmıştır. `dna-chat-catalog@2` şu anda 24 konu, 35 güvenli iddia, 20 açık tek-adımlı ilişki ve DOI/PMID ile tekilleştirilmiş 39 kaynak yayımlar. Bu ayrım, ham aday sayılarının “tamamı canlıya alındı” biçiminde yorumlanmasını önler.

Ham iddia, kavram kartı ve kaynak adaylarının tamamı `rawReviewManifest.ts` içinde 367 ayrı kayıt olarak kategori, kayıt türü, kanonik kod ve dosya bağlantısıyla izlenir. Bu kayıtlar `expert_pending / cataloged_for_review` durumundadır; bu durum canlı yayımlandıkları veya kaynaklarının doğrulandığı anlamına gelmez. Dört tablodaki 314 gerçek soru ise kaynak kategori/kodları korunarak ayrı benchmark kayıtlarına dönüştürülür; paketler arası aynı soru metinleri tek bir semantik ailede tutulur.

Kaynak paketlerdeki `sandbox:` bağlantıları, araştırma oturumu atıf tokenları, takip parametreleri ve doğrulanamayan bibliyografik kayıtlar runtime kataloğuna taşınmaz. Uzman incelemesi henüz tamamlanmadığı için canlı kayıtların durumu `source_verified_expert_pending` olarak tutulur.

## Uygulanan bibliyografik düzeltmeler

- Sempatik–parasempatik: K03, K05, K31 ve K40 kayıtları doğrulanmış bibliyografik karşılıklarıyla düzeltildi; K31 mevcut `GRAZIANO_DEREFINKO_2013` kaydıyla tekilleştirildi.
- Otonom sinir sistemi: S09 ve S12 PMID’leri; S18, S21 ve S27 eksik kayıtları düzeltildi. S25, otizme özgü olmayan doğrulanmış Christensen ve ark. çalışmasıyla değiştirildi.
- Merkezi sinir sistemi: HRV’nin kardiyak zaman serisinden doğrudan hesaplandığı fakat ANS/self-regülasyon için dolaylı ve özgül olmayan gösterge olduğu açıklaştırıldı. Ko-regülasyon nedensel ifade edilmedi; S29/S30 temel homeostaz/allostaz veya duyusal işleme kanıtı olarak kullanılmadı.
- Self-regülasyon: K03 DNA geçerliği iddiasına bağlanmadı; K17/K18 uygun olmayan yürütücü işlev eşlemesinden çıkarıldı; K38 yalnız tersine çıkarım sınırı için kullanıldı.
