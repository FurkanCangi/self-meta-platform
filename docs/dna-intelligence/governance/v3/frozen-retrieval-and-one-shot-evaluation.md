# Frozen Retrieval Adapter ve One-Shot Değerlendirme

Bu akış, development-only Türkçe retrieval adapterini kilitli iç holdout'tan ayırır. Runtime veya release davranışını değiştirmez ve bağımsız insan doğrulaması değildir.

## Rol ayrımı

- Holdout yazarı gerçek konu phrase'lerini, eşikleri veya routing algoritmasını yazamaz ve adapter tuning yapamaz.
- Holdout'u görmemiş source-review rolü config ve evaluator modülünü yalnız candidate package, izinli development QA ve kendi config girdisinden üretir.
- Schema/integrity rolü yalnız exact alanları, tuning allowlist'i, yasak girdileri, hash bağlarını, one-shot yazımı ve aggregate metrikleri doğrular.
- `scripts/lib/dna-locked-retrieval-core.mjs` bir scorer değildir. Semantic routing yalnız source-review rolünün ayrı evaluator modülünde bulunur.

## Frozen adapter sözleşmesi

Otorite dosyası `frozen-turkish-retrieval-adapter-contract.json` ve executable validator `scripts/lib/dna-locked-retrieval-core.mjs` dosyasıdır.

Adapter şu bağları taşır:

- Candidate package ve development QA evaluation SHA-256
- Source-review rolünün evaluator modül yolu ve exact code SHA-256 değeri
- Config SHA-256, `builtWithoutLockedHoldout=true` ve exact tuning input allowlist
- 14 konu için 1-4 tokenlık positive, negative ve context phrase listeleri
- Sabit threshold alanları
- `runtimeEligible=false` ve `releaseEligible=false`
- Exact payload üzerinden `adapterSha256`

Tuning allowlist yalnız `candidate_package`, `development_qa` ve `adapter_config` türlerini kabul eder. Evaluation kökü, `locked`/`holdout` adları ve soru-cevap artefaktları input olamaz.

Evaluator modülü yalnız `scripts/generated/dna-retrieval-evaluators/` altında düzenli, symlink olmayan `.mjs` dosyası olabilir. Tek giriş `routeFrozenAdapter(adapter, question)` ve exact dönüş `{ decision, topicId }` sözleşmesidir. Import/require, dosya sistemi, process/env, ağ, dinamik kod, mutlak path, locked/holdout metni ve yazma/log side effect'i statik olarak reddedilir. Harness modül byte hash'ini adapter `codeSha256` alanıyla tekrar bağlar ve evaluatorün stdout/stderr girişimlerini yakalayıp koşuyu kapatır.

Evaluator'e verilen adapter bütün alt nesne ve dizileriyle `deepFreeze` edilir. Yazma, alan ekleme veya silme girişimi koşuyu kapatır; evaluator çağrısından önceki ve sonraki adapter hash'i de aynı olmak zorundadır.

## Sabit development kapısı

Resmî komut yalnız repodaki `turkish-retrieval-adapter-development-current.json` otoritesini ve bu manifestin gösterdiği sabit SSD adapterini kabul eder. Caller `--manifest`, `--adapter`, `--output` veya başka argüman veremez. Manifest exact şemayla doğrulanır; raw development soru metni taşıyamaz. Adapter path/file SHA, adapter SHA, evaluator code SHA, config SHA, candidate package/file SHA ve development-QA evaluation/file SHA değerleri gerçek frozen adapterle yeniden bağlanır.

`developmentGate=pass` değeri tek başına güvenilir sayılmaz. Harness şu önceden sabit eşikleri aggregate sayılardan tekrar hesaplar: catalog anchor `>=0.95`, doğal paraphrase `>=0.80`, hard-neighbor `>=0.90`, ambiguous non-answer `>=0.80`, unsupported non-answer `>=0.80`, adapterin bilinen güvenli sorularda non-refusal oranı `>=0.98`, karakter kaybı `>=0.95`, çekim varyasyonları `>=0.90`, 20 deterministic tekrar ve tek prediction hash'i. Mevcut güvenlik kapısının baseline non-refusal oranı yalnız bilgi alanıdır; adapter kapısının yerine kullanılamaz. Bu kontroller geçmeden sealed holdout payload'ı okunmaz.

## One-shot resmî koşu

`chat:locked-evaluation:official:ssd` yalnız frozen adapter doğrulandıktan sonra çalışabilir. Harness sealed holdout path ve SHA-256 değerini repo manifestinden alır. Adapter veya manifest uyuşmazsa soru yükü skorlanmaz.

Harness holdout payload'ını açmadan önce `0600` modlu ve `O_CREAT|O_EXCL|O_WRONLY|O_NOFOLLOW` claim dosyası oluşturur. Claim ve sonuç parent zincirindeki her bileşen symlink/realpath kaçışına karşı yeniden doğrulanır. Claim veya sonuç zaten varsa rerun ve overwrite reddedilir. Claim alındıktan sonra artifact okuma, import, değerlendirme ya da sonuç yazma hatası oluşur ve sonuç yoksa durum `claimed_failed_no_rerun` sayılır; claim korunur ve sessiz retry yapılmaz. Sonuç SSD'ye aynı dizindeki temporary-file + `fsync` + `rename` + directory `fsync` + byte/hash readback ile atomik ve `0600` olarak yalnız bir kez yazılır; başarısız geçici dosya temizlenir.

Sonuç ve stdout yalnız şunları taşıyabilir:

- Aggregate toplamlar
- Split ve konu doğruluğu
- Abstention doğruluğu, gerçek safe-theory non-refusal oranı ve bundan ayrı safe-theory routing doğruluğu
- 20 tekrar determinism özeti
- p95 süre
- Adapter, development manifest, holdout, değerlendirme kod kapanışı ve sonuç hash'leri

`evaluationCodeSha256`, yalnız harness dosyasını değil harness ve `dna-locked-retrieval-core.mjs` exact byte hash'lerinin birlikte stable SHA-256 değerini bağlar.

Soru, referans cevap, claim/passage/source metni, item çıktısı veya eşleşen phrase loglanmaz ve repoya yazılmaz. İlk resmî koşu bu geliştirme görevinde çalıştırılmaz.

## Komutlar

```bash
npm run chat:retrieval-adapter:verify:ssd
npm run chat:locked-evaluation:test:ssd

# Yalnız kod/config freeze ve resmî açma onayından sonra, bir kez:
npm run chat:locked-evaluation:official:ssd
```

Freeze işlemi source-review rolünün config/evaluator ve development QA akışıdır; holdout yazarı tarafından tekrar üretilmez. Test modu yalnız sentetik geçici phrase ve soru fixture'ları kullanır; gerçek holdout'u açmaz. Forged-green development metriği, caller path override, evaluator byte drift ve mutation, locked input allowlist, holdout hash mismatch, output/claim varlığı, claimed-failure no-rerun, gerçek writer parent symlink'i, mode, result tamper, stdout capture, iki ayrı safe-theory metriği ve 20 tekrar determinism kapılarını doğrular.
