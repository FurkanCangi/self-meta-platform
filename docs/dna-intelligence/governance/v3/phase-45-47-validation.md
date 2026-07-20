# DNA Intelligence Faz 45–47 doğrulama sözleşmesi

Bu belge mahremiyet, performans ve kullanıcı deneyimi kapılarının nasıl
kanıtlanacağını tanımlar. Otomatik testlerin geçmesi gerçek üretim hesabı,
üretim gecikmesi veya insan çalışması yapılmış gibi yorumlanamaz.

## Faz 45 — Mahremiyet ve çapraz hesap

Sürümlü saldırı matrisi `DNA_PHASE_45_ATTACK_MATRIX` içinde tutulur. Matris;
iki terapistin karşılıklı erişim denemesini, admin ve owner rollerini, rastgele
ve sıralı UUID denemelerini, query parametresi ve doğrudan API isteklerini,
cache tekrarını, eşzamanlı istekleri, süresi dolmuş oturumu, audit hatasını,
RLS ve sahiplik sorgu zincirini kapsar.

Tam kapı için her senaryo kendi minimum kanıt ortamında çalıştırılmalıdır:

- Kara kutu hesap ve HTTP senaryoları üretimde oluşturulup silinen sentetik
  hesaplarla çalıştırılır.
- Audit hata enjeksiyonu güvenli preview ortamında yapılır; vaka cevabının
  `503 audit_unavailable` ile kapanması gerekir.
- RLS ve sorgu katmanı senaryoları ayrı veritabanı enstrümantasyonu gerektirir.
- Yabancı ve bulunmayan rapor aynı durum kodu ve aynı genel gövdeyi üretmelidir.
- Audit veya telemetry artefaktında soru, cevap, rapor metni, danışan kodu,
  passage metni, vaka bulgusu, önceki sohbet ya da kişisel veri bulunamaz.
- Sonuç dili yalnız “Belirtilen N sentetik çapraz hesap denemesinde 0 sızıntı
  gözlendi” biçiminde olabilir. “Sızıntı imkânsız” denemez.

Yerel test yalnız sözleşme davranışını kanıtlar. Güncel üretim sentetik matrisi
ve veritabanı enstrümantasyon artefaktları yoksa Faz 45 `not_ready` kalır.

## Faz 46 — Determinizm ve performans

Yerel ölçüm aynı soru, motor, rapor bağlamı ve cevap derinliğiyle en az 20
tekrar yapar. Katalog ve kaynak sırası ters çevrilerek sonucun değişmediği;
cold ve warm yolların ikisinin de çalıştığı doğrulanır. Ayrıca:

- motor p95 `<25 ms`,
- mock API p95 `<1000 ms`,
- derin cevap JSON’u `<64 KiB`,
- 2 ve 600 karakter sınırları ile 8 KiB gövde sınırı,
- en az 32 eşzamanlı yerel istek,
- burst ve saatlik rate-limit sözleşmesi ile `Retry-After`,
- DB hatasında genel 500 ve vaka audit hatasında 503,
- haricî model/runtime import sayısı `0`

otomatik kapıya bağlıdır. Preview veya üretim p95/p99 sayıları yerel ölçümden
türetilmez. En az 100 gerçek HTTP örnekli, hash’lenmiş ayrı bir ortam artefaktı
gelmeden Faz 46 release kapısı `not_ready` kalır.

## Faz 47 — Gerçek terapist kullanılabilirlik protokolü

### Amaç ve sınır

Bu çalışma klinik faydayı, tanısal doğruluğu veya terapiste üstünlüğü ölçmez.
Yalnız amaçlanan kullanıcının ürün bağlamını, kaynak–iddia bağını ve güvenlik
sınırlarını anlayarak görev tamamlayıp tamamlayamadığını ölçer. İnsan–sistem
faydası için ayrıca önceden tanımlanmış gerçek bir karşılaştırmalı çalışma
gerekir. Faz 47 sonucu tek başına klinik fayda pazarlama iddiasına izin vermez.

### Katılımcılar ve veri

- En az 12 gerçek terapist veya ürünün açıkça tanımlanmış amaçlanan kullanıcısı.
- Katılım ve ekran kaydı varsa ayrı bilgilendirilmiş onam.
- Yalnız sentetik veya kimliksizleştirilmiş vaka ve raporlar.
- Gerçek danışan adı, kodu, anamnezi, ham cevapları veya klinik serbest metni
  çalışma artefaktına alınmaz.
- Ham soru/cevap metni ürün eğitim verisine dönüştürülmez.
- Raporlanacak artefakt yalnız toplulaştırılmış sayılar, ortam/sürüm/hash,
  görev kodları, hata kategorileri ve kritik uyarı kaçırma sayısını içerir.

### Görevler

Her katılımcı şu sekiz görevi tamamlar:

1. Hangi raporun bağlı olduğunu gösterir.
2. Yanlış bağlı raporu değiştirir ve eski konuşmanın temizlendiğini fark eder.
3. Bir kaynak kartının hangi sınırlı iddiayı desteklediğini açıklar.
4. “Raporda Yok” ile genel “Bilgi Bulunamadı” durumunu ayırır.
5. `not_available` sonucunun ürün sınırı olduğunu açıklar.
6. Kanıt düzeyi, yaş kapsamı ve iddia sınırına göre güvenini ayarlar.
7. Uzun cevap içindeki kritik güvenlik uyarısını bulur.
8. En az bir görevi mobilde ve en az bir görevi yalnız klavyeyle tamamlar.

Görev sırası dengelenir. Kolaylaştırıcı yönlendirici ipucu vermez; yalnız teknik
kesinti olursa olay ayrı kaydedilir. En az üç katılımcı mobil, en az üç
katılımcı yalnız klavye yolunu tamamlamalıdır.

### Kapılar

- Temel görev başarısı `başarılı görev / tüm görev ≥ %90`.
- Ürün sınırını doğru açıklama `doğru açıklama / tüm açıklama ≥ %90`.
- Kritik uyarı fırsatı her katılımcı için en az bir; kritik uyarı kaçırma `0`.
- Bütün katılımcılar amaçlanan kullanıcı grubundan olmalıdır.
- Artefakt protokol sürümü, uygulama commit’i, engine/pack sürümü, çalışma
  tarihi, payda ve payları ve SHA-256 bütünlük hash’ini taşımalıdır.

Bir paydanın sıfır olması başarı değildir. Eksik katılımcı, eksik mobil/klavye
kapsamı veya bulunmayan artefakt `not_ready`; eşiğin altı veya tek kritik uyarı
kaçırma `fail` üretir. FDA’nın şeffaflık yaklaşımıyla uyumlu olarak sonuçlar
amaçlanan kullanıcı, görev ve iş akışı koşullarıyla birlikte açıklanır:
https://www.fda.gov/medical-devices/software-medical-device-samd/transparency-machine-learning-enabled-medical-devices-guiding-principles

## Güncel dürüst durum

- Faz 45 yerel foreign/missing, audit fail-closed, no-store, sahiplik zinciri
  ve telemetry minimizasyon sözleşmeleri otomatik test edilir; güncel tam canlı
  matris ve DB enstrümantasyonu olmadan release sonucu `not_ready`’dir.
- Faz 46 yerel determinism, performans, boyut, eşzamanlılık ve hata enjeksiyonu
  ölçülür; gerçek ortam p95/p99 artefaktı olmadan release sonucu `not_ready`’dir.
- Faz 47 arayüz sözleşmesi otomatik test edilir. Bu belge yazılırken gerçek
  terapist çalışması yapılmış değildir; insan çalışma kapısı `not_ready`’dir.
