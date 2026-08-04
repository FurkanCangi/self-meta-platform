# DNA Asistanı kapasite kaydı

Tarih: **2026-08-04**
Kayıt kimliği: `2026-08-04-4892dd9f4a15`

Bu kayıt, chat boxın bilgi miktarını şişirmeden izlemek için oluşturuldu. Bilgi birimi,
soru yüzeyi, kaynak, konu, ilişki ve test sorusu ayrı ölçülür.

## Kısa sonuç

| Ölçü | Mevcut sayı | Anlamı |
|---|---:|---|
| Kitaptan canlı atomik bilgi | 4.008 | Her biri tek kitap pasajına bağlı cevap atomu |
| Kaynak bağlantılı canlı katalog iddiası | 276 | Sürümlü araştırma kataloğundan seçilen doğrulanmış güvenli alt küme |
| Birebir pasaj bağlı bilimsel iddia | 37 | Kaynak kimliği ve tam passage hash'i birlikte denetlenmiş yeni alt küme |
| Canlı bilgi kaydı toplamı | 4.284 | İki katmanın aritmetik toplamı; küresel benzersizlik iddiası değildir |
| Farklı soru yüzeyi | 52.106 | Aynı bilginin akademik, gündelik, hatalı ve bağlamsal sorulma biçimleri |
| Kanonik konu | 136 | Kaynaklı klasik katalogdaki yönlendirme başlıkları |
| Kitap konu bölümü | 759 | Kitap içindeki ayrı başlık/bağlam düğümleri |
| Açık tek-adımlı ilişki | 183 | Zincirleme mekanizma üretmeden kullanılabilen graf kenarı |
| Doğrulanmış kaynak kaydı | 164 | Canlı klasik katalog kaynakları |
| Güvenlik kuralı | 43 | Tanı, tedavi, nedensellik ve veri sınırları |

## Matematiksel görünüm

Canlı envanter vektörü:

`L = (Kₒ, Cᵥ, Pᵥ, Q, T, R, S, G) = (4008, 276, 37, 52106, 136, 183, 164, 43)`

- `Kₒ`: owner-book atomik bilgi birimi
- `Cᵥ`: doğrulanmış kaynak bağlantılı katalog iddiası
- `Pᵥ`: birebir passage hash'iyle denetlenmiş katalog iddiası
- `Q`: deterministik soru yüzeyi
- `T`: kanonik konu
- `R`: açık tek-adımlı ilişki
- `S`: doğrulanmış kaynak kaydı
- `G`: güvenlik kuralı

Ham canlı bilgi kaydı: `Kₒ + Cᵥ = 4008 + 276 = 4284`.
Bu sayı iki katman arasında anlam tekilleştirmesi yapılmadığı için “4284
benzersiz bilgi” olarak kullanılamaz.

Her kitap bilgi birimi için ortalama **13** soru yüzeyi vardır.
10 × 14 kapsam matrisinin **137/140** hücresi doludur
(**%97.86**); 3 hücre açıktır.

## Kitap bilgi dağılımı

| Alan | Bilgi birimi |
|---|---:|
| attention_working_memory_executive | 359 |
| autonomic_hrv | 158 |
| cellular_neurophysiology | 14 |
| cns_networks | 434 |
| development_neurodiversity | 954 |
| emotion_self_coregulation | 623 |
| interoception_sensory | 780 |
| measurement_case_boundaries | 360 |
| sleep_circadian | 127 |
| stress_arousal_recovery | 199 |

Kitabın 4.909 cümlesinin tamamı terminal karara bağlandı.
4.008 atomik birim canlıdır. 262
cümlede metin içi atıf vardır; cümle–kaynakça eşlemesi henüz ayrıca tamamlanmadığı için kitap,
bağımsız bilimsel doğrulama olarak sunulmaz.

## Test gücü

- Açık geliştirme: **4916/5000 = %98.32**
- Kilitli holdout ilk sonuç: **1443/1500 = %96.2**
- Kilitli holdout güncel motor: **1457/1500 = %97.133**
- Güncel holdout motor p95: **24.184 ms**
- Eski kanonik benchmark: **1.856** soru; bunun **928** tanesi holdout

Açık geliştirme ile holdout tek bir resmî doğruluk puanına birleştirilmez. Açık set motoru
iyileştirmek, holdout ise genellemeyi görmek içindir.

## Henüz canlı olmayan rezerv

- 1.000 dış-bilim aday bilgi birimi
- 901 benzersiz birincil pasaj
- 5.000 soru biçimi
- 23 benzersiz PDF artefaktı
- Canlı birim: **0**; runtime ve release kapıları kapalıdır

## Büyümeyi nasıl izleyeceğiz?

Yeni içerik eklediğimiz her turda aynı ölçüler yeniden üretilecek. Öncelik sırası:

1. Küresel tekilleştirilmiş bilgi birimi
2. Dolu kapsam hücresi
3. Kilitli holdout doğruluğu
4. Desteklenen doğal soru yüzeyi
5. Kaynak ve atıf kapsamı

Soru yüzeyini artırmak tek başına bilgi kapasitesini artırmış sayılmaz.
