# DNA Intelligence operasyon ve pazarlama yönetişimi

Bu belge Faz 54–60 mühendislik sözleşmesini açıklar. Gerçek kaynak denetimi,
benchmark sonucu, kullanıcı çalışması veya klinik validasyon sonucu üretmez.
V3 yayın durumu **no-go** olarak kalır.

## Mahremiyet korumalı telemetry

`dna-chat-telemetry@1` yalnız request ID, motor/paket sürümü, konu kimliği,
sınıflandırma, sonuç, cevap derinliği, kaynak kimlikleri, atıf sayısı, gecikme
kategorisi, HTTP sonucu, audit durumu ve kategorik kullanıcı sorununu kabul
eder. Soru, cevap, rapor, danışan kodu, passage, vaka bulgusu, önceki sohbet,
kimlik ve ağ bilgileri strict allowlist dışında kalır.

## Kaynak bütünlüğü olayı

Geri çekme, düzeltme, endişe bildirimi, lisans değişikliği, yeni konsensüs veya
supersession olayında kaynak → pasaj → claim → relation → cevap bağı yeniden
hesaplanır. İş akışı yalnız `actions_pending` üretebilir: kaynağı karantinaya
alma, paketten çıkarma, güvenli alternatif yoksa `not_available`, etkilenen
benchmarkın tekrarı, pazarlama iddiasının askıya alınması ve yeni release
paketi zorunludur. Ayrı kanıt olmadan hiçbir adım tamamlandı sayılmaz.

## Kategorik geri bildirim

Arayüz sekiz kontrollü kategori gönderir. Serbest metin, soru/cevap, rapor ID,
danışan içeriği veya ek dosya kabul edilmez. Bildirim otomatik eğitim verisi
olamaz. Mevcut audit tablosu kullanılır; yeni tablo veya migration yoktur.

## Olay yönetimi

Kritik olay planı etkilenen route/paketi kapatmayı, yeni klinik veri toplamadan
mevcut operasyon loglarını korumayı, sürüm-kaynak-claim zincirini izlemeyi,
çapraz hesap olasılığını ayrıca incelemeyi, sealed/adversarial testleri ve
kanıt hash’i bulunan bilinen-iyi deployment rollback hedefini zorunlu kılar.
Plan üretmek bir olayın çözüldüğü anlamına gelmez.

## Sayılabilir birimler

Benzersiz kaynak, doğrulanmış passage, atomik claim, açık relation, topic,
güvenlik kuralı, benchmark sorusu ve test varyasyonu ayrı sayılır. Pazarlamada
"bilgi birimi" yalnız passage-bağlı atomik claim sayısını ifade eder. Test
varyasyonu bilgi değildir. 250–400 kaynak, 8.000–15.000 passage-bağlı atomik
claim, 2.400 kilitli benchmark ve 10.000 sağlamlık dönüşümü yalnız hedef zarfıdır.

## Kanıt manifesti ve ürün dili

Her nesnel dış iddia; metin, sınıf, motor/katalog sürümü, değerlendirme sınıfı,
artefakt yolu ve hash’i, pay/payda, güven aralığı, koşullar, sınırlılıklar,
geçerlilik tarihi ve durum taşımadan aktif olamaz. Mevcut manifestte aktif V3
iddiası yoktur. Self-authored claim/metric JSONL'i açıkça reddedilir. Bunun
yerine immutable release bundle'ın `marketing_evidence` satırı, iddiayı aynı
bundle içindeki sealed satır/kategori/güvenlik/çapraz-hesap/performans
artefaktındaki tek bir kayıt kimliğine bağlar. Hedef artefakt yolu ve byte
SHA'sı, release/run, Git SHA, engine kod hash'i ve pack SHA yeniden doğrulanır;
pay, payda, değer ve metric kimliği hedef satırdan kanonik olarak türetilip
manifestle karşılaştırılır. Caller tarafından hazırlanmış verification nesnesi
ürün dilini açamaz. Action-facing ürün dili kararı yalnız metni kabul eder;
manifest, bundle ve evidence root yalnız committed current otoritelerden gelir.
Sentetik bundle olumlu yolu sadece açıkça offline verifier olarak adlandırılmış
test fonksiyonunda çalışır ve public iddiayı yetkilendirmez. Doğrulanmış release
kanıtı olmadan sayısal veya ölçülmüş ürün dili kullanılamaz. Yasak mutlaklık ve
üstünlük ifadeleri otomatik testte taranır.

Aktif iddialarda semantik kanıt sınıfı da zorunludur: performans yalnız sealed
kategori sonucu, güvenlik yalnız security sonucu, mahremiyet yalnız
cross-account sonucu kullanabilir. Mimari, envanter, hız, maliyet, klinik fayda
ve karşılaştırmalı üstünlük için dedicated exact-row şeması henüz yoktur; bu
sınıflar aktif olamaz. Özellikle genel benchmark satırı klinik fayda veya
üstünlük kanıtı sayılmaz. Güven aralığı da current şemada canonical olarak
türetilmediği için yalnız `null` olabilir; caller-authored aralık yayınlanamaz.
