# S13-Strict Comparison Conclusion v4

Bu tur yalnız mevcut 10 `comparison_relation` vakasını kapsar. Yeni mimari, model veya architecture tournament açılmamıştır.

## Graded policy

1. `direct`: locked claim iki hedef arasındaki ayrımı açıkça söylüyorsa kullanılır.
2. `safe_categorical_inference`: iki tarafın farklı ve izinli kategorileri locked claim ve başlık temsilinden ayrı ayrı türetilebiliyorsa kontrollü sonuç kurulur.
3. `abstain`: kategori eksik, aynı veya claim-başlık temsili yetersizse tek güvenli fallback kullanılır.

Her conclusion planında `comparisonConclusionMode`, `comparisonConclusionSupportClaimIds`, kategori etiketleri ve türetim dayanağı saklanır. Validator A, B ve conclusion desteğini ayrı doğrular.

## 10-vaka sonucu

- Side A / Side B / conclusion: `10/10 / 10/10 / 10/10`
- Direct / safe categorical inference / abstain: `0 / 4 / 6`
- Unsupported factual addition / relation / source / safety: `0 / 0 / 0 / 0`
- Gereksiz abstention: `0`
- v2 → v3 → v4 insan-gözü tercihi: v4 `10/10`

Altı abstention gerçek fallback'tir: bir tarafta izinli kategori türetilememiştir, claim karşılaştırma başlığını temsil etmiyordur veya iki taraf aynı kategoriye düşmektedir.

Kanıt paketi ResearchSSD üzerindeki `s13-strict-comparison-conclusion-v4` klasöründedir. Internal canary paketi hazırlanmıştır; `runtimeEligible` ve `releaseEligible` false kalır, production davranışı değişmez.
