# External Science Offline QA

Bu kapı, DNA kitabından bağımsız dış bilim aday paketini **yalnız çevrimdışı geliştirme verisi** olarak denetler. Üretim motoruna veri bağlamaz, V3'ü aktive etmez, kaynağı yayınlamaz ve yerel ya da haricî LLM çalıştırmaz.

## Denetlenen veri

- Girdi: `ResearchSSD/Datasets/DNA-Intelligence/work/v3/prebook-closure/v1/external-science-candidate-package.json`
- Paket SHA-256: `1efe414cd6fecad250a3bf9cdbb963a51e872f1d13f2041676b5abde1ede20bd`
- Kapsam: 14 konu, 14 kaynak, 166 pasaj, 220 iddia ve 220 cevap birimi
- Ham sonuç: `ResearchSSD/Outputs/SelfMetaAI/dna-intelligence/external-science-qa/prebook-science-qa-v1/raw-result.json`
- Küçük repo özeti: `docs/dna-intelligence/program/evidence/external-science-qa-current.json`

Çalıştırma:

```bash
npm run chat:external-science-qa:ssd
```

Bu komut önce temp-root hardening testini çalıştırır. Ayrı çalıştırmak için:

```bash
npm run chat:external-science-qa:test
```

Kaynak paket değiştiğinde, sonuçlar incelendikten sonra özet manifest bilinçli olarak yenilenir:

```bash
npm run chat:external-science-qa:write:ssd
```

## Fail-closed çıktı zinciri

- ResearchSSD root'u ve mevcut bütün çıktı üst dizinleri `lstat` ve `realpath` ile doğrulanır; symlink ve path escape reddedilir.
- Mevcut raw çıktı veya repo manifest symlink ise üzerine yazılmaz.
- İçerik aynı dizinde `O_EXCL | O_NOFOLLOW` ile açılan geçici dosyaya yazılır.
- Dosya tamamen yazıldıktan sonra dosya `fsync`, atomik `rename` ve üst dizin `fsync` uygulanır.
- Raw çıktı ve manifest modu `0600` olarak zorlanır.
- Yazma sonrasında dosya yeniden okunur; beklenen içerik ile hem exact byte hem SHA-256 eşitliği doğrulanır.
- Normal doğrulama koşusunda repo manifest drift kontrolü raw çıktı yazılmadan önce yapılır.
- Temp-root testleri path escape, root/parent/leaf symlink, içerik tamperi, mode tamperi ve manifest drift vakalarını negatif olarak doğrular; aynı içerik 20 atomik yazımda tek hash üretmelidir.

## İlk gerçek-korpus sonucu

| Kapı | Ham sonuç | Durum |
|---|---:|---|
| Claim-passage-source-answer-unit bağlama | 220/220 | Geçti |
| Konu kapsamı | 14/14 | Geçti |
| Katalog ankrajı | 53/56 (%94,64) | Hedefin altında |
| Doğal Türkçe paraphrase | 2/28 (%7,14) | Başarısız |
| Hard-neighbor minimal pair | 22/24 (%91,67) | Sınırlı geçti |
| Katalog dışı soruda abstention | 28/30 (%93,33) | Sınırlı geçti |
| Belirsiz soruda abstention | 6/10 (%60) | Başarısız |
| Güvenli teori sorusunda non-refusal | 147/148 (%99,32) | Geçti; 1 yanlış ret var |
| Aynı değerlendirme hash'i | 20/20, 1 benzersiz hash | Geçti |

Son karar `partial_development_only`'dir. Yapısal paket bütünlüğü doğrulandı; doğal Türkçe esneklik ve belirsizlik kalibrasyonu yeterli değildir. Bu sonuç bir yayın, klinik doğruluk, bağımsız validasyon veya V3 canlıya alma kanıtı değildir.

## Görülen somut açıklar

- PRISMA-COSMIN raporlama ile genel COSMIN ölçüm niteliği soruları eşit skora bağlanabiliyor.
- “Kalp hızı değişkenliği biofeedback” ifadesi HRV bağlam konusuyla çakışabiliyor.
- Alias içermeyen doğal Türkçe sorular çoğunlukla doğru konuya ulaşamıyor; mevcut indeks kavramı değil, ağırlıklı olarak yüzey sözcüklerini tanıyor.
- Genel COSMIN, ölçüm/raporlama, duygu düzenleme ve uyku sorularında yeterli belirsizlik payı oluşmadığı için gereksiz kesin yönlendirme görülebiliyor.
- “Ventral ve dorsal vagal açıklamaların ampirik sınırları” güvenli bir teori sorusu olmasına rağmen biyolojik çıkarım olarak reddedildi.
- Uyku iğcikleri ve aktigrafi gibi katalogda olmayan ama “uyku” sözcüğü taşıyan sorular yanlış biçimde uyku-duygusal reaktivite konusuna gidebiliyor.

## Sınırlar

- Her konuda yalnız bir kaynak bulunduğu için kaynaklar arası sentez ve çelişki denetlenemez.
- 220 iddianın kanıt düzeyi `not_assessed`; güçlü/zayıf kanıt dili yetkilendirilemez.
- Graf ilişkisi yoktur; çok adımlı reasoning ölçülmez.
- İddia ve pasajlar İngilizcedir; Türkçe nihai yanıt kalitesi bu koşunun kapsamında değildir.
- Katalog ankrajları ve hard-neighbor soruları konu etiketlerinden türetilmiş geliştirme tanılarıdır; kör ve bağımsız holdout değildir.
- Safety katmanı yalnız güvenli sorulardaki fazla ret açısından gözlendi; bu koşu riskli isteklerde doğru ret oranı iddiasında bulunmaz.

## Kitap gelmeden sonraki doğru kullanım

Bu paket, yeni Türkçe eş anlamlı ve ayırt edici negatif terim önerilerini geliştirme setinde sınamak; ardından motor değişikliklerinden önce mühürlenmiş, semantik aileleri ayrılmış yeni bir holdout hazırlamak için kullanılabilir. Kaynak çeşitliliği, kanıt düzeyi ve bağımsız değerlendirme tamamlanmadan runtime/release bayrakları kapalı kalmalıdır.
