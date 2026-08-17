# DNA Intelligence v1 Answer Architecture — internal canary

Durum: altyapı hazır, trafik başlatılmadı, production release yapılmadı.

## Freeze

S13-Strict v4 aşağıdaki değişmez akışla `DNA Intelligence v1 Answer Architecture` olarak dondurulmuştur:

`Privacy / Safety → Query Interpretation → S1 Knowledge Core → Required Answer Slots → Comparison-Specific Two-Sided Retrieval → Relevance-Gated Explanatory Claims → Locked Content Plan → Realizer → Claim + Relation + Comparison Validator → Repair / Deterministic Fallback → Answer`

Canary katmanı mevcut `Realizer`, `LunaRealizer`, `LocalRealizer`, `DeterministicRealizer`, provenance, shadow ve training/export sözleşmelerini değiştirmez. Yeni model, embedding, reranker, architecture tournament veya benchmark tuning içermez.

## Feature flags

Tüm flag'ler varsayılan olarak kapalıdır:

- `DNA_S13_INTERNAL_CANARY_ENABLED=1`: master canary kapısı.
- `DNA_S13_INTERNAL_CANARY_UI_ENABLED=1`: internal sayfa ve API erişimi.
- `DNA_S13_INTERNAL_CANARY_LUNA_ENABLED=1`: provider-neutral Realizer arkasında Luna kullanımı; kapalıyken deterministic realizer.
- `DNA_S13_INTERNAL_CANARY_TESTER_EMAILS=email1,email2`: açık tester allowlist'i. Tester ayrıca `OWNER_AUDIT_EMAILS` içinde olmalıdır.
- `DNA_S13_INTERNAL_CANARY_OUTPUT_ROOT=...`: isteğe bağlı kayıt kökü. Varsayılan `/Volumes/ResearchSSD/Outputs/SelfMetaAI/dna-intelligence/internal-canary/s13-strict-v4`.

`VERCEL_ENV=production` veya `DNA_RUNTIME_ENV=production` olduğunda master flag verilse bile canary hard-block olur.

## Internal giriş ve kapsam

Yetkili internal tester, flag'ler etkinleştirildikten ve yerel/internal uygulamaya giriş yaptıktan sonra doğrudan `/owner-audit/dna-canary` yolunu açar. Production menüsüne link eklenmemiştir.

Akış yalnız genel, bilimsel ve kişisel olmayan konuşmalara izin verir. Yaklaşık 100–300 doğal mesaj daha sonra internal testerlar tarafından üretilebilir; bu altyapı kurulumu trafik başlatmaz ve bu konuşmalar statik benchmarka dönüştürülmez.

## Privacy sınırı

Privacy kontrolü retrieval ve Luna çağrısından önce çalışır. Kişisel tanımlayıcı, danışan/hasta/çocuk/vaka/anamnez/rapor/seans/kurum bağlamı veya güvenlik sınıfı `none` olmayan mesajlar fail-closed engellenir. Reddedilen kayıtta ham soru bulunmaz; yalnız soru hash'i, sebep kodları, tester hash'i ve zaman tutulur. Feedback notları da aynı privacy kontrolden geçer.

## Telemetry

Her kabul edilen mesaj için:

- Routing: intent, topic ID, focus, question type, follow-up, correction, alt soru sayısı, answerability, comparison mode, parser uncertainty.
- Retrieval: aday sayısı, required/explanatory claim ID'leri, confidence, lexical/semantic/graph katkısı, comparison A/B coverage, eksik required slot.
- Realization: provider, realized/repaired/fallback/deterministic-only, ilk ve repair validator sonucu, token/cache, latency, maliyet, Luna/repair çağrıları.
- Validation: wrong claim, claim/relation/comparison violation, unsupported addition, source/safety violation ve failure code'ları.
- Quality: tanımlanmış 13 internal kalite alanı; kullanıcıya otomatik gösterilmez, review etiketiyle doldurulur.
- Provenance: tam S13 structured provenance ayrı append-only JSONL kaydında tutulur.

Özet; safety, completeness, UX, p50/p95 latency, Luna call/repair oranı, token/message ve 1k/10k/100k maliyet projeksiyonlarını hesaplar.

## Feedback ve training ayrımı

Internal arayüzde tek tıkla `GOOD`, `WRONG_INFORMATION`, `WRONG_TOPIC`, `INCOMPLETE`, `TOO_SHALLOW`, `UNNATURAL_TURKISH`, `UNNECESSARY_ABSTENTION`, `UNNECESSARY_WARNING`, `FOLLOWUP_FAILURE`, `COMPARISON_FAILURE` veya `OTHER` etiketi verilir. İsteğe bağlı kısa not, 1–5 kalite ve Luna değer sınıfı eklenebilir.

Mesaj kaydı başlangıçta daima `training_candidate=false / review_pending` olur. Yalnız `GOOD + privacy PASS + validator PASS + accepted/repaired + provenance` birleşimi ayrı bir immutable training annotation içinde aday olabilir. Bir mesaj yeniden etiketlenirse seçim politikası `latest_annotation_per_message` olur; eski kayıt audit amacıyla kalır. Bu annotation dataset export, distillation veya model eğitimi başlatmaz.

## Dosya düzeni

Her canary oturumu `<output-root>/sessions/<session-id>/` altında tutulur:

- `messages.jsonl`: mesaj telemetry'si, tam raw provenance hariç.
- `provenance.jsonl`: structured provenance, raw first/repair output ve maliyet.
- `feedback.jsonl`: append-only internal review.
- `training-annotations.jsonl`: review sonrası aday/exclusion kararı.
- `privacy-rejections.jsonl`: ham mesaj içermeyen privacy retleri.
- `summary.json`: safety/completeness/UX/operasyon/maliyet özeti.

Dosyalar `0600`, oturum dizinleri `0700` izinleriyle oluşturulur. Şu anda output dizini veya dataset oluşturulmamıştır.

## Regression ve production sınırı

40 soru ile 10 comparison seti yalnız regression suite olarak kalır. Canary gözlemleri benchmarka özel kurala dönüştürülmez. Mevcut production chat rotası canary modüllerini import etmez; bu çalışma runtime/release eligibility vermez.

## Başlatma

Tek sonraki operasyonel adım: internal geliştirme ortamında master/UI/Luna flag'lerini ve açık tester email allowlist'ini tanımlayıp uygulamayı başlatmak, ardından `/owner-audit/dna-canary` sayfasında doğal ve kişisel olmayan konuşmaları kullanmak.
