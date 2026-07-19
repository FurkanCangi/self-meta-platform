# Faz 3–4 yönetişim durumu

## Faz 3 — DNA kitabı kilidi

DNA kitabı henüz teslim edilmediği için durum `deferred_owner_book` olarak kilitlidir. Mevcut sahip onayı sayısı sıfırdır; bu durum bir Faz 3 başarı kaydı veya boş bir onay değildir. DNA ürün iddiaları kitap gelene kadar V3 çalışma paketine giremez.

Kitap geldiğinde kilit; kitabın birebir baytları, sürümü, SHA-256 değeri ve bayt uzunluğunu birlikte doğrular. Her bölüm ve pasaj benzersiz kimlik, kesin `[startByte, endByteExclusive)` aralığı ve kendi SHA-256 değeriyle kaydedilir. Sahip beyanı onayladığı bölüm ve pasaj aralıklarını ayrı ayrı listeler. Her canlı DNA ürün iddiası onaylanmış tek bir pasaja bağlanmadan derleme tamamlanmaz. Kitabın tek baytı, sürümü, aralığı veya pasaj içeriği değiştiğinde önceki onay eşleşmez ve kilit kapanır. Yalnız gerçek artefakt ve owner beyanını doğrulayan kilit derleyicisinin aynı işlem içinde ürettiği kayıt otorite taşır; dışarıdan hazırlanmış veya serialize edilip geri verilmiş benzer şekilli bir nesne owner onayı sayılmaz.

`owner_approved` yalnız DNA ürün tanımını destekler. Kitap onayı; dış bilimsel kanıt, psikometrik geçerlik, güvenirlik, faktör yapısı, ölçüm değişmezliği veya dış ölçüt geçerliği oluşturmaz. Bu sonuçlar yalnız DNA üzerinde yapılmış uygun araştırmalarla ayrı otorite ve ayrı yaşam döngüsü altında desteklenebilir.

## Faz 4 — İçerik yaşam döngüsü

V3 kaynak, iddia, pasaj ve bileşenleri kontrollü durum makinesinden geçer. Her geçiş benzersiz olay kimliği, içerik hash'i, kanıt hash'i, aktör, zaman ve gerekçe taşır. Olaylar önceki olayın SHA-256 hash'ine bağlanır; güncelleme eski diziyi değiştirmez, yeni ve dondurulmuş bir dizi üretir. Sıra, zaman, içerik veya tek bir eski olay değişirse zincir doğrulaması başarısız olur.

Yalnız mevcut durumu tam olarak `released` olan, bütün zorunlu aşamaları sırasıyla geçmiş ve olay zinciri doğrulanan V3 kayıtları kullanıcı cevabını destekleyebilir. Release derleyicisi ayrıca claim, kaynak, pasaj ve bileşenin kanonik payload'ını yeniden hash'leyerek yaşam döngüsündeki `contentSha256` ile karşılaştırır; caller tarafından yazılmış bir hash tek başına kanıt değildir. `pending`, `contested`, `quarantined`, `reference_only`, `metadata_only`, `restricted`, `deprecated` ve `withdrawn` kayıtlar açıkça engellenir. `accepted`, `compiled` veya `monitored` olmak da tek başına yayın uygunluğu değildir.

V2 kayıtları `legacy_not_v3_release` olarak tanımlanır. Eski sistemdeki `approved`, `sourceVerified`, `live` veya benzeri bir etiket V3 `released` kanıtı değildir ve V3 yayın kapısını açamaz.
