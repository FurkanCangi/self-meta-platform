# DNA Intelligence Production Readiness Checklist

Bu checklist ticari yayına çıkmadan önce doğrulanması gereken operasyonel maddeleri takip etmek için tutulur.

App store / mobile app güvenlik sertliği için ayrıntılı kontrol listesi:
`docs/app-phase-8-security-production-hardening.md`.

Store wrapper ve yayın akışı için ayrıntılı kontrol listesi:
`docs/app-phase-9-store-wrapper-release.md`.

Web kaynaklı app güncelleme sistemi için ayrıntılı kontrol listesi:
`docs/app-phase-10-update-system.md`.

## Environment

- `NEXT_PUBLIC_SUPABASE_URL` production Supabase projesini göstermeli.
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` production anon key olmalı.
- Production ortamında `OPENAI_*`, LLM provider anahtarı veya rapor model bütçesi tanımlanmamalı; rapor hattı tamamen deterministiktir.
- `DNA_REPORT_DEBUG=false` olmalı; debug loglar sadece geçici inceleme sırasında açılmalı.
- `SUPABASE_SERVICE_ROLE_KEY` production ortamında yalnız server-side route'larda kullanılmalı; client bundle'a sızmamalı.
- `OWNER_AUDIT_EMAILS` owner/admin e-posta allowlist'i olarak doldurulmalı.
- `VIDEO_OBS_API_BASE_URL` video observation modülü production'a açılacaksa production servisine işaret etmeli.

## Database

- `sql/legal_acceptances.sql` production Supabase database'e uygulanmalı.
- `sql/owner_audit_retention.sql` production Supabase database'e uygulanmalı.
- Owner audit RLS, revoke ve trigger kurulumları Supabase SQL editor veya migration pipeline üzerinden doğrulanmalı.

## Security And Logs

- Rapor debug logları kapalı kalmalı; varsayılan `DNA_REPORT_DEBUG=false`.
- Production rapor import grafiği harici model SDK'sı, runtime retrieval veya model API çağrısı içermemeli.
- Klinik rapor metni, anamnez veya final rapor snippet'i loglara yazılmamalı.
- Owner audit export erişimi `OWNER_AUDIT_EMAILS` allowlist'i ile test edilmeli.
- Hukuki clickwrap kabul kayıtları IP, user-agent, plan ve doküman versiyonlarıyla yazılıyor olmalı.
- App store öncesi Faz 8 bloklayıcıları kapanmalı: paylaşımlı rate limit, legal acceptance blocker, rapor kredisi/entitlement kontrolü ve production RLS kanıtı.
- Store wrapper sonrası Faz 10 güncelleme kontratı tamamlanmalı: runtime config, bakım modu, minimum shell version ve klinik veri için no-store stratejisi.

## Release Checks

- `npm run lint`
- `npm run build`
- `npm run report:quality`
- `npm run report:audit`
- `npm run report:professor-five`
- `npm run report:forbidden-imports`
- `npm run report:determinism`
- Hukuki sayfalarda yer tutucu şirket bilgileri yayından önce doldurulmalı veya bilinçli olarak taslak statüsünde bırakıldığı doğrulanmalı.
