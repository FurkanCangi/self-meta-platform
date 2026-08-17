# S13-Strict v4 Limited Rollout Runbook

Durum: altyapı hazır, rollout aktif değil. Bu runbook production-wide release onayı vermez.

## Dondurulmuş aday

- DNA Intelligence: `dna-intelligence-v1`
- S13-Strict: `s13-strict-v4`
- Conversation Context Fix: `conversation-context-fix-v1`
- Limited rollout: `dna-v1-s13v4-contextv1-limited-rc1.1`
- Release hash, architecture, catalog, retrieval, prompt contract, validator ve context resolver hash'leri `release-candidate.json` içindedir.

## Gate ve cohort

- `DNA_S13_LIMITED_ROLLOUT_ENABLED=false` varsayılandır ve kill switch'tir.
- `DNA_S13_LIMITED_ROLLOUT_PERCENT=0` varsayılandır.
- L0 yalnız mevcut `OWNER_AUDIT_EMAILS` owner/internal allowlist'ini kabul eder.
- L0'da yüzde sıfırdan farklıysa yapılandırma fail-closed olur.
- L1 açık beta allowlist, L2 stabil yüzdelik cohort ve L3 daha geniş rollout yalnız belgelenmiştir; aktif değildir.
- Internal canary bayrakları limited rollout gate'inden ayrıdır.

## Privacy ve training sınırı

- Case/report modu, rapor bağlamı, vaka/danışan/hasta/anamnez/seans/terapi/rapor içeriği, doğrudan tanımlayıcı ve kurum+kişi birlikteliği Luna öncesinde engellenir.
- Engellenen metin audit, analytics veya training kaydına yazılmaz; yalnız SHA-256 tabanlı soru hash'i ve sınırlı neden kodları tutulur.
- Engellenen turn conversation context kaynağı olamaz.
- Context token kullanıcıya özgü anahtarla açılır; başka hesapta fail-closed olur.
- Gerçek kullanıcı trafiğinde privacy-pass olsa bile `trainingCandidate=false` ve `automaticTrainingUse=prohibited` sabittir.
- Dataset export ve model eğitimi bu rollout'un parçası değildir.

## Maliyet ve fail-closed davranışı

- İlk günlük global Luna limiti `DNA_S13_LIMITED_ROLLOUT_DAILY_LUNA_CAP_USD=2` değeridir.
- Varsayılan near-cap eşiği yüzde 80'dir.
- Maliyet ledger okunamazsa veya bir sonraki rezerv yeni limiti aşabilecekse yeni limited-rollout Luna çağrısı yapılmaz; mevcut deterministik production chat yolu çalışır.
- Readout kullanıcı, konuşma ve mesaj başına maliyeti ve kullanıcı başına aylık AI projeksiyonunu gösterir.
- Hedef metadata: toplam aktif kullanıcı altyapısı en çok yaklaşık USD 2/ay; değişken AI ideal olarak USD 0.75-1/ay.

## Otomatik izleme

Anlık STOP önerisi: privacy leak, cross-account leak, unsupported factual addition, unsupported relation, source violation veya kritik safety violation sayısı sıfırdan büyükse.

INVESTIGATE önerisi: follow-up, correction veya comparison başarısı yüzde 90 altı; gereksiz abstention veya missing slot yüzde 10 üstü; wrong topic yüzde 5 üstü; fallback yüzde 8 üstü.

Owner readout: `GET /api/owner-audit/dna-limited-rollout/summary`. Luna değer sınıfları son kullanıcı cevabına veya geri bildirim arayüzüne eklenmez.

## Feedback

Limited-rollout cevabında koşullu başparmak yukarı/aşağı kontrolü gösterilir. Aşağı oy nedeni isteğe bağlı ve enum ile sınırlıdır. Serbest metin, klinik metin veya otomatik training kullanımı kabul edilmez. Mevcut ayrıntılı kategorik hata bildirimi ayrı kalır.

## Rollback

1. `DNA_S13_LIMITED_ROLLOUT_ENABLED=false` yap.
2. Yeni limited routing ve limited Luna çağrılarının durduğunu doğrula.
3. Normal production chat yolunun çalıştığını doğrula.
4. Telemetri kayıtlarını silme; olay sonrası readout için koru.
5. Privacy, cross-account, unsupported fact/relation, source veya kritik safety olayında tekrar açma.

Sentetik rollback testi sırası: enable -> sentetik mesaj -> telemetri -> disable -> sonraki mesaj normal production yolu. Gerçek kullanıcı veya klinik veri kullanılmaz.
