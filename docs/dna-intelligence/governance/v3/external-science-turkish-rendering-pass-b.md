# External Science Turkish Rendering Pass B

## Amaç

Bu geçiş, yalnız `external_science_candidate` paketindeki bilimsel iddiaların Türkçe
aktarılabilirliğini ölçen bağımsız bir Codex çeviri fizibilite katmanıdır. Ürün bilgisi,
canlı yanıt otoritesi, yayın kararı veya bağımsız insan incelemesi değildir.

Köken etiketi sabittir:
`codex_translation_pass_b_not_independent_human_review`.

## Körlük ve giriş sınırı

- Tek bilimsel giriş, ResearchSSD üzerindeki mühürlü dış bilim aday paketidir.
- Önceki Türkçe aktarım geçişleri, kararları, manifestleri ve sonuçları bu üretimde
  okunmaz veya karşılaştırılmaz.
- DNA sahibi kitabı bu geçişin girdisi değildir.
- Çalışma zamanında internet, haricî LLM, embedding veya vektör veritabanı yoktur.

## Deterministik örnekleme

Her 14 konu için aday paketindeki pasaj sırası korunur. Her konudan üç ayrı pasaj
seçilir:

1. ilk pasaj,
2. `floor((n-1)/2)` konumundaki pasaj,
3. son pasaj.

Her seçilmiş pasajda aday paket sırasındaki ilk temsilî iddia kullanılır. Böylece
toplam 42 aktarım oluşturulur; seçim kod veya veri değişmediği sürece aynıdır.

## Sadakat kapıları

Her kayıt aşağıdaki bilgileri hash bağlı taşır:

- kaynak, konu, pasaj ve iddia kimliği,
- yaş kapsamı,
- kanıt düzeyi ve nedensellik statüsü,
- iddia ve pasaj sınırlarının hashleri,
- yayın ve ilişki sınıfları,
- özgün önerme ve Türkçe aktarımın ayrı hashleri.

Otomatik kapılar sayı dizisinin, olumsuzluğun, ihtiyat dilinin ve nedensel gücün
korunmasını; klinik eylem veya yeni biyolojik mekanizma eklenmemesini zorunlu kılar.
Bir kapı başarısızsa artefakt üretilmez.

## Depolama ve sızıntı sınırı

Özgün önermeler, Türkçe aktarımlar ve kayıt kararları yalnız şu SSD kökünde tutulur:

`Outputs/SelfMetaAI/dna-intelligence/turkish-rendering-pass-b/feasibility-v1`

Tam artefakt atomik yazılır, `fsync` sonrasında geri okunur ve `0600` kipinde
doğrulanır. Repo içinde yalnız sayı, dağılım, hash ve sınır bilgisi içeren toplu
manifest bulunur. Manifest sızıntı testi özgün önerme, Türkçe aktarım ve karar
metinlerinin hiçbirini kabul etmez.

## Test kapsamı

- 14 konu ve 42 aktarımın tam ve üçlü kapsamı,
- 20 tekrarın aynı artefakt hashini üretmesi,
- sayı, olumsuzluk ve nedensellik bozma saldırıları,
- eksik ve yinelenen seçimler,
- yaş ve iddia sınırı bağlarının değiştirilmesi,
- manifest metin sızıntısı,
- içerik ve dosya kipi oynama,
- kök, üst dizin, yaprak symlink ve yol kaçışı saldırıları.

## Yayın sınırı

Bu geçişin sonuçları için aşağıdaki değerler değişmez:

- `runtimeEligible=false`
- `releaseEligible=false`
- `activationAllowed=false`
- `adapterAuthority=false`
- `ownerBookAuthority=false`
- `independentHumanReview=false`

Bu nedenle geçişin başarılı olması V3'ü etkinleştirmez, V2 canlı motorunu değiştirmez
ve bilimsel ya da klinik doğrulama iddiası oluşturmaz.
