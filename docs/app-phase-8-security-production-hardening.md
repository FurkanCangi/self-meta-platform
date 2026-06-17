# Faz 8: Guvenlik, KVKK ve Uretim Sertligi

Bu dokuman app store oncesi yayina hazirlik checklist'idir. Kapsam, post-login terapist app deneyimi ve ayni Next.js/Supabase backend uzerindeki klinik veri akislaridir.

## Karar

Faz 8 mevcut kod tabaninda kismen hazir. Auth/session, cihaz limiti, RLS SQL'leri, legal acceptance kaydi, owner audit, temel rate limit ve rapor kilidi mevcut. App store oncesi asagidaki bloklayicilar kapatilmadan production cikisi yapilmamali:

1. Rate limit process ici `Map` yerine production paylasimli storage'a tasinmali.
2. Login sonrasi app acilisinda legal acceptance eksikse blocking screen zorunlu olmali.
3. Rapor uretimi paket/rapor kredisi entitlement'i ile server-side baglanmali.
4. Production Supabase'te SQL policy dosyalarinin uygulandigi ve RLS'in canli oldugu dashboard/migration kanitiyla dogrulanmali.
5. CKEditor dependency uyarilari icin kullanilmiyorsa paket kaldirilmali, kullaniliyorsa guvenli surume yukseltme plani yapilmali.

## Kontrol Tablosu

| Kontrol | Durum | Kanit | App Store Oncesi Aksiyon |
| --- | --- | --- | --- |
| Auth/session | Hazir | `src/proxy.ts`, `src/lib/security/appSession.ts`, `src/app/api/security/session/register/route.ts` | Production login/logout ve expired session manuel test edilmeli. |
| Maksimum 2 cihaz | Hazir | `MAX_REGISTERED_DEVICES = 2`, `account_devices` policy | Gercek iki cihaz + ucuncu cihaz blok testi yapilmali. |
| Tek aktif oturum | Hazir | Yeni session acilinca eski `account_sessions` kayitlari `replaced` yapiliyor. | Web + mobil es zamanli login testi yapilmali. |
| RLS | Operasyonel dogrulama gerekli | `sql/core_data_rls.sql`, `sql/account_session_policy.sql`, `sql/legal_acceptances.sql`, `sql/kvkk_operational_security.sql` | Production Supabase'te migration uygulama ve tablo bazli RLS kontrolu kanitlanmali. |
| KVKK/legal acceptance | Kismi | Signup checkbox'lari, `/api/legal/accept`, `legal_acceptances` | Post-login legal status blocker eklenmeli. |
| Owner audit | Hazir ama hassas | `sql/owner_audit_retention.sql`, `/api/owner-audit/export`, `OWNER_AUDIT_EMAILS` | Allowlist canli ortamda dar tutulmali; export testi audit event uretmeli. |
| Klinik veri loglanmamasi | Kismi/hazir | `src/lib/dna/reportLogger.ts`, `security:smoke` redaction testi | Production env'de `OPENAI_REPORT_DEBUG=false`, `DNA_REPORT_DEBUG=false` dogrulanmali. |
| API rate limit | Kismi | `src/lib/security/rateLimit.ts` ve route kullanimlari | Redis/Upstash/Supabase tabanli paylasimli rate limit'e gecilmeli. |
| Rapor maliyet kontrolu | Kismi | `/api/ai-report` ownership, 60 cevap validasyonu, saatlik limit, tek rapor lock | Paket/rapor kredisi server-side decrement ve atomic ledger eklenmeli. |
| Service role izolasyonu | Hazir | `src/lib/supabase/admin.ts`, server route kullanimlari | Build artifact/env leak kontrolu release checklist'te kalmali. |
| Trusted mutation guard | Hazir | `requireTrustedMutation`, `security:readiness` mutating route kontrolu | Native wrapper fetch'lerinde `x-dna-request: same-origin` korunmali. |
| Video/egitim erisimi | Kismi/hazir | Education entitlement, signed playback, video proxy | Production provider config ve storage policy canli ortamda test edilmeli. |

## Auth Ve Session

Mevcut yapi Supabase Auth + app session cookie uzerinden calisiyor. Protected route'lar `src/proxy.ts` icinde Supabase user, email confirmation ve `sm_active_session` cookie kontrolunden geciyor.

Server tarafinda `verifyCurrentAppSession` session status, expiry, lock/suspended state ve IP/user-agent degisikliklerini denetliyor. Login sonrasi `/api/security/session/register` cihazi hash'leyerek kaydediyor, en fazla iki aktif cihaza izin veriyor ve yeni aktif session acildiginda eski aktif session'lari `replaced` durumuna cekiyor.

Yayin oncesi manuel test:

- Ayni hesapla cihaz 1 login: basarili.
- Ayni hesapla cihaz 2 login: basarili.
- Ayni hesapla cihaz 3 login: `device_limit_exceeded`.
- Ayni cihazda ikinci login: onceki session protected route'a girince login'e dusmeli.
- Email confirmation olmayan kullanici protected route'a girememeli.

## KVKK Ve Legal Acceptance

Signup ekraninda hizmet sozlesmesi, KVKK, acik riza ve veri giris yetkisi checkbox'lari var. `/api/legal/accept` aktif hukuki dokuman snapshot'ini, plan kodunu, IP'yi, user-agent'i ve kaynak path'i `legal_acceptances` tablosuna yaziyor.

Eksik nokta: App acilisinda `/api/legal/status` kontrolu yapilip `accepted=false` ise terapist app alaninin bloklanmasi henuz zorunlu degil. Bu ozellikle manuel olusturulan veya eski kullanicilar icin riskli. Faz 8 production blocker olarak app shell icinde legal blocker eklenmeli.

## RLS Ve Veri Izolasyonu

SQL tarafinda temel tenant izolasyonu hazir:

- `profiles`: kullanici sadece kendi profilini okur.
- `clients`: `owner_id = auth.uid()`.
- `assessments_v2`: ilgili client owner'i ile kontrol edilir.
- `reports`: assessment -> client -> owner zinciriyle kontrol edilir.
- `account_devices`, `account_sessions`, `legal_acceptances`, `privacy_data_requests`, `data_access_audit_events`: kullanici kendi kayitlarini okur; yazimlar server/admin route'larda kalir.

Kod dosyalarinin varligi yeterli degildir. Production Supabase'te migration'lar uygulanmadan app yayina alinmamalidir. Kanit olarak Supabase SQL editor/migration log'u ve RLS enabled tablo listesi saklanmali.

## Owner Audit

Owner audit tasarimi member UI'dan ayridir. `owner_audit.audit_events` append-only snapshot tutar; `clients`, `assessments_v2`, `reports` insert/update/delete olaylarini trigger ile yakalar. Export route'u sadece `OWNER_AUDIT_EMAILS` allowlist'i ile calisir ve export islemini `data_access_audit_events` tablosuna yazar.

Bu mekanizma KVKK metinlerinde ve retention policy'de acik olmalidir. Terapist app v1 navigasyonunda owner audit gorunmemelidir.

## Klinik Veri Loglari

AI/report debug logger hassas anahtarlar icin redaction yapiyor: email, token, anamnez, report, client, child, name, notes, clinical, session gibi alanlar `[redacted]` olur. `security:smoke` bu davranisi test ediyor.

Yine de production'da klinik veri loglamama politikasinin guvenli olmasi icin:

- `OPENAI_REPORT_DEBUG=false`
- `DNA_REPORT_DEBUG=false`
- API catch bloklari raw request body, anamnez, report text veya assessment payload loglamamali.
- Owner audit export loglari sadece metadata/count yazmali; export icerigi application log'a basilmamali.

## API Rate Limit

Mevcut `checkRateLimit` process ici `Map` kullanir. Bu local ve tek instance icin yeterlidir, fakat serverless/multi-instance production icin guvenilir degildir. Rate limit kullanan kritik yuzeyler:

- `/api/ai-report`: kullanici basina saatte 8.
- `/api/owner-audit/export`: kullanici basina saatte 20.
- `/api/privacy/data-request`: kullanici basina gunde 5.

Production icin paylasimli, atomic rate limit gerekir. En pratik secenekler:

- Upstash Redis/Vercel KV benzeri TTL counter.
- Supabase RPC ile atomic insert/update counter.
- Provider WAF/rate limit + uygulama ici user-based counter.

## Rapor Uretim Maliyeti

Rapor endpoint'i su an:

- Confirmed user ister.
- Client ownership dogrular.
- Server-controlled alanlari reddeder.
- 60 cevap ve skor araligi validasyonu yapar.
- Desteklenen yas araligini zorunlu tutar.
- Vaka icin mevcut rapor varsa yeniden uretmek yerine mevcut raporu dondurur.
- Saatlik rate limit uygular.

Eksik nokta: Paket/rapor hakki server-side authoritative degil. `/api/billing/status` rapor kullanimini sayiyor ama `included/remaining` null ve credit ledger yok. Production icin rapor uretimi atomik entitlement/credit dusumuyle baglanmali. Tek rapor lock kurali korunarak, yeni rapor yaratma aninda credit kontrolu ve decrement ayni transaction/RPC icinde yapilmalidir.

## Dependency Ve Build Guvenligi

`npm audit --omit=dev --audit-level=high` yuksek/critical seviyede bloklayici bulgu ile cikmadi. Ancak moderate XSS uyarilari var:

- CKEditor 5 paket ailesi.
- Next icindeki PostCSS advisories.

CKEditor mevcut app fazlarinda core terapist akisi icin gerekli gorunmuyor; kullanilmiyorsa dependency ve template component temizlenmeli. Kullanilacaksa guvenli surume gecis ayrica test edilmeli.

## Release Gate

App store build'i alinmadan once asagidaki komutlar temiz gecmeli:

```bash
npm run lint
npm run build
npm run security:smoke
npm run security:readiness
npm run report:fixture
npm run report:quality
npm run report:audit
npm audit --omit=dev --audit-level=high
```

Not: `security:readiness` icindeki `npm audit` 30 saniyelik timeout'a takilabilir. Bu durumda `npm audit --omit=dev --audit-level=high` ayrica calistirilmali ve sonuc checklist'e eklenmelidir.

## Faz 8 Cikis Kriteri

Faz 8 tamam sayilmasi icin:

1. Production Supabase RLS/migration kaniti hazir.
2. Legal blocker app shell'e eklendi.
3. Rate limit paylasimli ve atomic hale geldi.
4. Rapor kredisi/entitlement kontrolu server-side ve atomic hale geldi.
5. CKEditor/dependency karari verildi.
6. Release gate komutlari temiz.
7. Iki cihaz/tek session manuel testi kayit altina alindi.
8. Owner audit allowlist ve export audit testi tamamlandi.
