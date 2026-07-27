# Development-only Turkish Retrieval Adapter

Bu adapter, dış bilim aday paketindeki 14 konuyu Türkçe sorulara daha esnek eşlemek için hazırlanmış deterministik bir geliştirme artefaktıdır. Canlı V2 motoruna bağlanmaz ve V3 yayın yetkisi vermez.

## Girdi sınırı

Semantik yapı ve eşikler yalnız şu geliştirme girdilerinden üretildi:

- `external-science-candidate-package.json` içindeki 14 konu ve `lexicalIndex`
- Mevcut external-science development QA sonucu
- 1–4 kelimelik kısa bilimsel kavram ifadeleri

Kilitli değerlendirme artefaktı, manifesti, sonucu ve geçici seed config kullanılmadı. Config içindeki hiçbir ifade tam geliştirme sorusu değildir.

## Yönlendirme

Pure evaluator:

- Türkçe karakterleri ve bunların ASCII karşılıklarını ortak biçime getirir.
- Sınırlı çekim eki ve ünsüz yumuşaması toleransı uygular.
- Positive, context ve negative ifadeleri ayrı ağırlıklarla değerlendirir.
- Bir positive eşleşme olmadan konu seçmez.
- Minimum skor veya komşu konu farkı sağlanmazsa cevap yerine abstain/clarification üretir.
- Dosya sistemi, ağ, ortam değişkeni, dış model, log veya yan etki kullanmaz.

## Development sonucu

İzinli 148 geliştirme sorusunda:

- Doğal paraphrase: 28/28
- Zor komşu ayrımı: 24/24
- Belirsiz soruda konu seçmeme: 10/10
- Kapsam dışı soruda konu seçmeme: 30/30
- Bilinen güvenli sorularda adapter-refusal oluşturmama: 108/108
- Türkçe karakter kaybı varyasyonu: 108/108
- Ayrı çekim varyasyonu: 14/14
- 20 yönlendirme ve 20 freeze tekrarında tek sonuç/hash

Mevcut güvenlik kapısının `%99,3243` non-refusal değeri ayrıca baseline olarak saklanır; yeni adapter skoru veya development gate girdisi değildir.

Bu skorların tümü geliştirme verisine aittir. Bağımsız, kör veya klinik geçerlik kanıtı olarak kullanılamaz.

## Artefaktlar

- Config: `docs/dna-intelligence/governance/v3/development-turkish-retrieval-adapter-config.json`
- Pure evaluator: `scripts/generated/dna-retrieval-evaluators/turkish-development-v1.mjs`
- SSD frozen adapter: `Datasets/DNA-Intelligence/evaluation/frozen-adapters/turkish-retrieval-v1/adapter.json`
- SSD development sonucu: `Outputs/SelfMetaAI/dna-intelligence/turkish-retrieval-adapter/development-v1/result.json`
- Repo current manifest: `docs/dna-intelligence/program/evidence/turkish-retrieval-adapter-development-current.json`

Frozen adapter exact candidate, development QA, config ve evaluator kod hash'lerini taşır. Timestamp komut girdisi olarak sabittir; aynı girdiler 20 tekrarda byte düzeyinde aynı adapter üretir. SSD ve repo çıktıları `0600`, atomik yazım, exact readback, path containment ve symlink reddiyle korunur.

## Komutlar

```bash
npm run chat:turkish-adapter:dev
npm run chat:turkish-adapter:test:ssd
npm run chat:turkish-adapter:verify:ssd
```

`chat:turkish-adapter:freeze:ssd` yalnız yeni ve henüz var olmayan resmî frozen adapter yoluna ilk yazım içindir. Mevcut artefaktın üzerine yazmayı reddeder.

## Yayın sınırı

- `developmentGate=pass` yalnız belirlenen development hedeflerinin geçtiğini gösterir.
- `runtimeEligible=false`
- `releaseEligible=false`
- `runtimeAuthority=none`
- `releaseAuthority=none`
- `v3ReleaseDecision=no_go_unchanged`

Resmî bağımsız kapı ayrıca ve tek seferlik çalıştırılmalıdır; bu entegrasyon o değerlendirmeyi çalıştırmaz.
