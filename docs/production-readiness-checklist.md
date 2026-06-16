# Self Meta AI Production Readiness Checklist

Bu checklist ticari yayına çıkmadan önce doğrulanması gereken operasyonel maddeleri takip etmek için tutulur.

## Environment

- `NEXT_PUBLIC_SUPABASE_URL` production Supabase projesini göstermeli.
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` production anon key olmalı.
- `OPENAI_API_KEY` yalnız server ortamında tanımlanmalı.
- `OPENAI_REPORT_MODEL` ve rapor bütçe ayarları production maliyet politikasına göre sabitlenmeli.
- `OPENAI_REPORT_DEBUG=false` olmalı; debug loglar sadece geçici inceleme sırasında açılmalı.
- `SUPABASE_SERVICE_ROLE_KEY` production ortamında yalnız server-side route'larda kullanılmalı; client bundle'a sızmamalı.
- `OWNER_AUDIT_EMAILS` owner/admin e-posta allowlist'i olarak doldurulmalı.
- `VIDEO_OBS_API_BASE_URL` video observation modülü production'a açılacaksa production servisine işaret etmeli.

## Database

- `sql/legal_acceptances.sql` production Supabase database'e uygulanmalı.
- `sql/owner_audit_retention.sql` production Supabase database'e uygulanmalı.
- Owner audit RLS, revoke ve trigger kurulumları Supabase SQL editor veya migration pipeline üzerinden doğrulanmalı.

## Security And Logs

- AI rapor debug logları kapalı kalmalı; varsayılan `OPENAI_REPORT_DEBUG=false`.
- Klinik rapor metni, anamnez veya final rapor snippet'i loglara yazılmamalı.
- Owner audit export erişimi `OWNER_AUDIT_EMAILS` allowlist'i ile test edilmeli.
- Hukuki clickwrap kabul kayıtları IP, user-agent, plan ve doküman versiyonlarıyla yazılıyor olmalı.

## Release Checks

- `npm run lint`
- `npm run build`
- `npm run report:quality`
- `npm run report:audit`
- Hukuki sayfalarda yer tutucu şirket bilgileri yayından önce doldurulmalı veya bilinçli olarak taslak statüsünde bırakıldığı doğrulanmalı.
