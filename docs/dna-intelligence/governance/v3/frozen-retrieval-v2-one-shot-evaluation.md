# Frozen Turkish Retrieval V2 ve One-Shot Değerlendirme

Bu akış, Turkish Retrieval V2 adapterinin bağımsız yazılmış V2 iç holdout
üzerindeki tek resmî koşusunu fail-closed biçimde yönetir. V1 harness, core,
sonuç ve claim dosyalarına dokunmaz. V2 sonucu bağımsız insan doğrulaması
değildir; runtime, release veya aktivasyon yetkisi vermez.

## Ayrı ve exact otorite kapanışı

V2 harness aşağıdaki dosyaları gerçek byte SHA-256 değerleriyle birlikte bağlar:

- Frozen V2 adapteri ve repo frozen manifesti
- V2 evaluator ve compiler kaynak kodları
- V2 config dosyası
- Development bankası ve development sonuç dosyası
- External-science candidate package
- Development, frozen ve V2 holdout repo manifestleri
- Bağımsız V2 pre-open overlap makbuzu ve aggregate repo manifesti
- V2 harness ve V2 core kaynak kodları

Development manifestte `developmentGate=pass` bulunması tek başına yeterli
değildir. Harness raw development sonucunun, adapterin ve tüm girdi/kod
hash'lerinin manifestlerle uyuşmasını; development yanlış sayısının sıfır,
holdout erişiminin false ve bütün runtime/release/activation sınırlarının false
olmasını tekrar doğrular.

## Resmî açılış öncesi bağımsız overlap kapısı

Development bankasının 560 yeni ve izinli legacy havuzdan gelen 148 sorusu,
kilitli V2 holdout'un 196 sorusuyla ayrı bir bütünlük rolünde karşılaştırılır.
Kontrol; exact, Türkçe normalize edilmiş exact, token edit-distance tabanlı
near-duplicate ve anlamlı kelimelerin hafif köklenmiş semantic-family
eşleşmelerini kapsar. Dört overlap sayısının da sıfır olması zorunludur.

Bu rol holdout payloadını yalnız bu karşılaştırma için okur; soru metni,
kimlik, eşleşme örneği veya hata örneği stdout'a ya da makbuza yazılmaz.
Aggregate sonuç 20 kez yeniden hesaplanır ve tek aggregate hash zorunludur.
Makbuz ResearchSSD üzerinde atomik olarak `0600` izinle tutulur; repo yalnız
aggregate manifesti taşır. Her ikisi de development bankası, izinli 148 legacy
havuza ait hash, holdout, iki repo manifesti ve overlap kodunun byte hash'lerine
bağlıdır. Makbuz `visibleToAdapterTuning=false` ve
`adapterTuningUseAllowed=false` taşır; adapter geliştirmede kullanılamaz.

24 Temmuz 2026 kapanışında 708 × 196 karşılaştırmanın aggregate sonucu
exact `0`, normalized `0`, near-duplicate `0`, semantic-family `0`; 20 tekrarda
tek aggregate hash'tir. Bu sonuç performans skoru veya bağımsız insan
doğrulaması değildir.

## Payload açma ve tek-koşu sınırı

Resmî akış holdout repo manifestini ve yukarıdaki bilgi otoritelerini önce
doğrular; exact pre-open makbuzu yoksa, hash'i kaymışsa veya overlap sıfır
değilse durur. Bu aşamada kilitli soru payloadını açmaz. Ardından aynı SSD dizininde
`O_CREAT | O_EXCL | O_NOFOLLOW` ile `0600` claim dosyasını oluşturup `fsync`
eder. Yalnız claim kalıcı olarak yazıldıktan sonra payload okunabilir.

Claim sonrası okuma, evaluator importu, değerlendirme veya sonuç yazımı
başarısız olursa claim korunur. Sonuç bulunmasa bile yeniden koşu yapılmaz ve
durum `claimed_failed_no_rerun` sayılır. Başarılı sonuç temporary-file, file
`fsync`, atomik rename, directory `fsync`, `0600` ve byte readback ile yazılır.
Parent veya leaf symlink, local-disk fallback, mod/hash/byte sapması ve mevcut
claim/sonuç fail-closed reddedilir.

## Değerlendirme ve çıktı sınırı

Adapter ve holdout nesneleri bütün alt alanlarıyla deep-freeze edilir. Evaluator
stdout/stderr/console yazamaz, input değiştiremez, async yan etki başlatamaz ve
statik saflık taramasını geçmek zorundadır. Her soru 20 kez değerlendirilir;
tek prediction hash'i zorunludur.

Sonuç yalnız aggregate sayımlar, split/konu oranları, abstention, safe-theory
routing/non-refusal, p95 süre, determinism ve otorite hash'lerini taşır. Soru
metni, item/failure kimliği, cevap, ranking veya scorer izi saklanmaz. Aggregate
verifier kilitli soru payloadını hiç açmaz; result ve claim'i exact otorite
kapanışına bağlayıp repo manifestini üretir.

Kalite kapısı: overall, natural, hard-neighbor, ambiguous ve safe-theory en az
`0.95`; unsupported tam `1.00`; safety non-refusal en az `0.98`; 20/20
determinism ve p95 `<25 ms`.

## Komutlar

```bash
# Yalnız sentetik fixture; resmî payloadı açmaz.
npm run chat:locked-evaluation-v2:preopen:test:ssd
npm run chat:locked-evaluation-v2:test:ssd
npm run chat:locked-evaluation-v2:result:test:ssd

# Yalnız bağımsız bütünlük rolü çalıştırır; ham soru/kimlik çıktısı üretmez.
npm run chat:locked-evaluation-v2:preopen:write:ssd
npm run chat:locked-evaluation-v2:preopen:verify:ssd

# Tek seferlik resmî koşu 24 Temmuz 2026 tarihinde tüketildi; tekrar çalıştırılamaz:
npm run chat:locked-evaluation-v2:official:ssd

# Yalnız resmî sonuç oluştuktan sonra:
npm run chat:locked-evaluation-v2:result:build:ssd
npm run chat:locked-evaluation-v2:result:verify:ssd
```

Sentetik testler claim-before-read, no-rerun, hash/mode/path/symlink tamperi,
evaluator output ve mutation, source purity, aggregate sonuç/claim/authority
tamperi, nested schema dışına alan sızdırma, kalite başarısızlığının
gizlenmemesi, manifest drift ve 20 tekrar determinism kapılarını kapsar.
Pre-open testleri ayrıca nonzero overlap, makbuz tamperi, mod, symlink ve local
fallback reddini kapsar.

## Tüketilmiş resmî V2 sonucu

Resmî ilk koşu tekrar edilmeden kaydedildi. Aggregate kalite kapısı `fail`
sonucu verdi: genel doğruluk `0.346939`, doğal destekli soru `0.418367`, zor
komşu `0.428571`, belirsiz soru `0.142857`, desteklenmeyen soru `0.107143` ve
güvenli teori yönlendirmesi `0.571429` oldu. Determinizm 20 tekrarda tek hash,
p95 süre `0.56075 ms` ve safety non-refusal `1.00` olarak geçti; bunlar düşük
yönlendirme doğruluğunu telafi etmez.

Aggregate kanıt
`docs/dna-intelligence/program/evidence/turkish-retrieval-adapter-locked-evaluation-v2-current.json`
dosyasındadır. Soru metni veya başarısız öğe kimliği repoya alınmadı. Bu sonuç
adapter tuning girdisi değildir; V2 holdout tüketilmiştir. Yeni yaklaşım ancak
bu holdout'a bakmadan geliştirilebilir ve yeni, bağımsız bir holdout üzerinde
tek sefer ölçülebilir. Runtime, release ve aktivasyon yetkileri false; V3 kararı
`NO-GO` kalır.
