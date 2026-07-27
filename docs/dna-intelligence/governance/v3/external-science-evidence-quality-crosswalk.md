# External Science Evidence-Quality Crosswalk

Bu bileşen, 14 dış bilim aday kaynağını kayıtlı yöntem değerlendirmesiyle **candidate-only** düzeyde çapraz bağlar. Üretim motoruna, retrieval adapter'ına, owner kitap otoritesine veya release kararına bağlanmaz.

## İzin verilen girdiler

Crosswalk yalnız ResearchSSD üzerindeki şu girdileri okur:

- `external-science-candidate-package.json`
- Her aday kaynağın `decision.json`
- Her aday kaynağın `result.json`
- Her aday kaynağın `receipt.json`
- `trusted-method-appraisal-registry.json`

Registration index, derlenmiş appraisal koleksiyonu, ham yayın dosyaları veya runtime katalogları bu çıktının girdisi değildir.

## Bağlama sözleşmesi

Her kaynak için aşağıdaki zincir fail-closed doğrulanır:

1. Candidate paketindeki `sourceId`, `sourceSha256` ve `artifactSha256`.
2. Decision, result ve receipt dosyalarının aynı `sourceId` ve appraisal kimliğini taşıması.
3. Decision/result canonical payload hash'leri ve receipt'teki exact dosya SHA-256 değerleri.
4. Decision mapping ile result appraisal alanlarının birebir eşitliği.
5. Result içindeki source-specific registry alt kümesinin güncel trusted registry içindeki exact kayıt setiyle eşitliği.
6. Registry evidence ref'lerinin candidate kaynağın exact artifact hash'ine bağlanması.
7. Study design, population, age scope, causal boundary, adapted GRADE boyutları, body-of-evidence certainty, review status ve disposition değerlerinin değiştirilmeden taşınması.
8. Sınırlılık metinlerinin yalnız SSD artifact'ında tutulması; repoda yalnız kaynak başına sayı ve hash saklanması.

## Zorunlu bilimsel sınır

Bir kaynağın yöntem değerlendirmesi, o kaynağa bağlı her iddianın kesinlik derecesi değildir. Bu nedenle 220 claim binding kaydının tamamı:

- `sourceAppraisalIsClaimCertainty=false`
- `certaintyInheritance=forbidden`
- candidate claim'in kendi `evidenceLevel` değerini aynen koruma
- runtime ve release uygunluğunu `false` tutma

kurallarına bağlıdır. Kaynak düzeyindeki GRADE-benzeri boyutlar claim düzeyine otomatik aktarılmaz.

## İlk sonuç

- Kaynak: 14/14
- Claim binding: 220/220
- Ham sınırlılık girdisi: 217
- Trusted registry evidence ref: 442
- Review-pass kaydı: 42
- Registry appraisal kaydı: 14
- `bodyOfEvidenceCertainty=not_assessed`: 14/14
- `reviewStatus=codex_multi_pass_audited`: 14/14
- `disposition=eligible_for_body_synthesis_with_limits`: 14/14
- Nedensellik sınırı: 8 `descriptive_only`, 4 `association_only`, 2 `theory_only`
- 20 üretimde tek crosswalk hash'i

Receipt'ler kayıt sırasındaki registry snapshot hash'ini taşır. İzin verilen girdiler geçmiş registry snapshot'larını içermediğinden 14 receipt'in yalnız biri güncel registry hash'iyle aynıdır. Diğer 13 tarihsel hash aynen korunur ancak yeniden oluşturulmuş gibi sunulmaz. Bunun yerine her kaynağın result registry alt kümesi güncel trusted registry içindeki exact kayıt setine bağlanır.

## Çıktılar ve komutlar

- Tam artifact: `ResearchSSD/Outputs/SelfMetaAI/dna-intelligence/evidence-quality-crosswalk/candidate-only-v1/crosswalk.json`
- Küçük repo manifesti: `docs/dna-intelligence/program/evidence/external-science-evidence-quality-crosswalk-current.json`

```bash
npm run chat:evidence-quality-crosswalk:test:ssd
npm run chat:evidence-quality-crosswalk:ssd
```

Girdiler bilinçli olarak değiştiğinde manifest şu komutla yenilenir:

```bash
npm run chat:evidence-quality-crosswalk:write:ssd
```

Tam çıktı ve manifest atomik temp-write, dosya ve dizin `fsync`, `rename`, `0600`, exact readback ve SHA-256 doğrulamasıyla yazılır. Testler source/hash/registry/receipt uyumsuzluğu, claim-certainty mirası, raw limitation sızıntısı, manifest drift, symlink, path escape, içerik tamperi ve mode tamper vakalarını reddeder.

## Release sınırı

Bu crosswalk yalnız denetlenebilir aday kalite metadata'sıdır. Kanıt kesinliği kararı, bağımsız insan validasyonu, DNA ürün geçerliği, canlı yanıt üretimi veya V3 release yetkisi sağlamaz. `runtimeAuthority=none`, `releaseAuthority=none` ve `v3ReleaseDecision=no_go_unchanged` kalır.
