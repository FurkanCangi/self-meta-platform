# App Faz 0: Mevcut Durumu Sabitleme

Tarih: 2026-06-17

Bu doküman, terapist app çalışmasına başlamadan önce web panelin mevcut durumunu sabitlemek için hazırlanmıştır. Amaç yeni bir landing ürünü tasarlamak değil; satın alımı ve üyeliği tamamlanmış terapistin gireceği klinik çalışma alanını bire bir app deneyimine taşımaktır.

## Kapsam Kararı

- App açılışında landing page olmayacak.
- App deneyimi login ve yetkili terapist paneli üzerine kurulacak.
- Mevcut DNA Intelligence marka dili, klinik terminoloji, rapor akışı ve güvenlik davranışları korunacak.
- Web paneldeki iş mantığı app için yeniden icat edilmeyecek; Supabase tabloları, API route'ları, rapor motoru ve güvenlik katmanları ortak kaynak olacak.

## Protected Terapist Panel Route'ları

| Route | Durum | App'e taşınma kararı | Not |
|---|---|---|---|
| `/login` | Aktif | Kesin | Supabase email/password login, email confirmation, app session register ve plan yönlendirmesi var. |
| `/signup`, `/auth-signup` | Aktif ama app v1 için ikincil | Sadece gerekiyorsa | Kullanıcı zaten satın almış/üye olmuş kabul edildiği için app ilk sürümünde ana akış değil. |
| `/starter` | Aktif | Kesin | Terapist çalışma alanı ana ekranı. Mobilde landing değil dashboard/home olacak. |
| `/dashboard` | Redirect | Taşınmaz | `/starter` route'una yönlendiriyor. |
| `/clients` | Aktif | Kesin | Supabase `clients`, `assessments_v2`, `reports` üzerinden liste, durum, rapor kilidi ve silme davranışı var. Risk rozeti şu an anamnez uzunluğuna dayalı MVP. |
| `/clients/new` | Aktif | Kesin | Anamnez wizard, zorunlu alan kontrolü, yaş aralığı, ek klinik test/bulgu desteği ve Supabase insert var. |
| `/clients/[id]` | Aktif ama akış uyumsuzluğu var | Kesin, düzeltme gerekli | Detay ekranı gerçek Supabase okuyor. Ancak yeni değerlendirme yönlendirmesi `evaluation_id` gönderiyor; ana assessment wizard daha çok `client_id` bekliyor. |
| `/assessments` | Aktif | Kesin | 60 soruluk DNA değerlendirme wizard, 6 alan skoru, rapor üretimi, rapor kilidi ve `/api/ai-report` entegrasyonu var. |
| `/assessments/new` | Redirect | Taşınmaz | `/assessments` route'una yönlendiriyor. |
| `/reports` | Aktif | Kesin | Sahip olunan danışanların raporlarını Supabase üzerinden listeler, rapor görüntüler ve siler. |
| `/education` | Aktif/MVP | Kesin ama Faz 6 | Eğitim listesi, owner video kaydı ekleme, access token, playback event, watermark ve player davranışı var. Tablolar kurulmamışsa setup mesajı gösteriyor. |
| `/report-packages` | Placeholder/statik | Taşınacak ama backend bağlanmalı | Paket kartları ve satın al butonu var; gerçek checkout veya rapor hakkı düşümü henüz UI'da bağlı değil. |
| `/video-observation` | MVP | Taşınacak ama ayrı faz | Session listesi, evidence viewer ve üç segment upload workflow mevcut. Harici video observation servisine bağlı. |
| `/profile` | Yarım/yerel | Taşınacak ama backend gerekir | Terapist profili sadece `localStorage` ile saklanıyor. Supabase `profiles` ile kalıcı hale getirilmeli. |
| `/profile-setting` | Yarım/yerel | Taşınacak ama backend gerekir | Rapor imzası, bildirim ve faturalama tercihleri `localStorage` tabanlı. Rapor çıktısına bağlanması ayrıca doğrulanmalı. |
| `/settings` | Redirect | Taşınmaz | `/profile-setting` route'una yönlendiriyor. |
| `/owner-audit` | Aktif owner-only | App v1 dışında, admin build'de opsiyonel | Owner allowlist ve audit export kullanan server component. Terapist app ana sürümüne konmamalı. |
| `/owner-audit/[memberOwnerId]` | Aktif owner-only | App v1 dışında, admin build'de opsiyonel | Üye bazlı clients/reports/audit detayı. |

## Public Route'lar

Bu route'lar mevcut sitede kalacak; app ana deneyimine taşınmayacak.

- `/`
- `/dna-nedir`
- `/self-regulasyon-nedir`
- `/cozumler`
- `/arastirma`
- `/klinik-alanlar/[slug]`
- `/fiyatlandirma`
- `/pricing`
- `/iletisim`
- `/privacy`
- `/terms`
- `/kvkk`
- `/explicit-consent`
- `/retention-policy`
- `/package-agreement`
- `/cerez-politikasi`
- `/legal/accept`
- `/clearra/privacy`
- `/clearroll/privacy`

Not: Legal ve fiyatlandırma sayfaları app içinden linklenebilir, fakat app'in ilk ekran yapısına landing/public marketing olarak alınmayacak.

## App'e Taşınacak Kesin Ekran Listesi

1. Splash / session check
2. Login
3. Ana çalışma alanı
4. Danışan listesi
5. Danışan detay
6. Yeni danışan / anamnez wizard
7. Ek klinik test ve bulgu girişi
8. DNA değerlendirme wizard
9. Değerlendirme sonuç ekranı
10. Rapor üretim ekranı
11. Rapor geçmişi
12. Klinik rapor viewer
13. Eğitim listesi
14. Güvenli eğitim video player
15. Rapor paketleri
16. Profil
17. Ayarlar
18. Video gözlem session listesi
19. Video gözlem upload workflow
20. Video gözlem evidence viewer

Owner audit ekranları, terapist app v1 kapsamına dahil edilmemeli. Ayrı admin modu veya web-only kalması daha güvenli.

## Aktif/Yarım/Placeholder Ayrımı

### Aktif Çekirdek

- Auth/login ve app session kontrolü.
- Danışan listeleme, ekleme, detay ve silme.
- DNA değerlendirme wizard.
- Rapor üretimi ve rapor kilidi.
- Rapor geçmişi ve rapor görüntüleme.
- Legal acceptance sync.
- Owner audit server tarafı.

### MVP veya Dikkatli Taşınacak

- Video observation: gerçek proxy ve servis yapısı var, fakat ekran kendi içinde "MVP" olarak işaretli. App'te upload, timeout, dosya boyutu, background davranışı ve mobil video seçimi ayrıca tasarlanmalı.
- Eğitim kütüphanesi: veri ve erişim altyapısı var; ancak tablo/asset kurulumu yapılmadığında setup ekranı gösteriyor. App'te boş durum ve owner-only video ekleme ayrımı netleşmeli.
- Clients risk rozeti: şu an yorumda "Minimal deterministik risk (MVP)" olarak işaretli ve anamnez uzunluğu ile hesaplanıyor.

### Placeholder / Backend Bağı Eksik

- Rapor paketleri: statik paket kartları var, satın alma butonu gerçek checkout akışına bağlı görünmüyor.
- Profil: sadece `localStorage`.
- Ayarlar: sadece `localStorage`.
- Topnav arama ve bildirim ikonları: görsel/yerel davranış; global gerçek arama/bildirim sistemi yok.
- Eski template bileşenleri: `src/app/components` altında kripto, shop, mail, product gibi Techwind kalıntıları var; protected terapist akışı için kullanılmıyor.

## selfmeta -> dna Geçiş Durumu

Geçiş büyük ölçüde tamamlanmış görünüyor:

- Aktif app importları `@/lib/dna/*` kullanıyor.
- `src/lib/dna` altında rapor motoru, prompt, kalite, soru, norm ve RAG seçici dosyaları mevcut.
- `scripts/fixtures/dna-*` fixture seti mevcut.
- `package.json` scriptleri `run-dna-report.ts` ve DNA report quality/audit runner'larına yönelmiş.
- `grep` ile aktif `src`, `scripts`, `test-*.ts`, `tsconfig*.json`, `package.json` içinde `@/lib/selfmeta`, `src/lib/selfmeta`, `run-selfmeta`, `SelfMetaSignupForm`, `sidebar.selfmeta` referansı bulunmadı.

Tamamlanmamış/temizlenecek taraf:

- Git status'ta eski `src/lib/selfmeta/*`, `scripts/fixtures/selfmeta-*`, `run-selfmeta-report.ts`, `selfmeta_*` scriptleri silinmiş; yeni DNA karşılıkları untracked görünüyor. Bu, rename state'inin commitlenmediğini gösteriyor.
- `.bak`, `.debug`, `.fixregex`, `.autofix`, `.duplicatefix`, `.tabsfix` gibi çok sayıda geçici/backup dosya repo içinde duruyor.
- `services/video-observation-mvp` altında `__pycache__`, SQLite DB ve eski/new egg-info rename kalıntıları git status'ta görünüyor.
- Cookie adı `sm_active_session` hâlâ eski kısaltmayı taşıyor; fonksiyonel bir sorun değil, fakat marka temizliği için ileride değerlendirilebilir.

Karar: App çalışmasına başlarken güncel kaynak `dna` dosyaları kabul edilmeli; eski `selfmeta` dosyaları ve backup/pycache/egg-info kalıntıları ayrı temizlik fazında ele alınmalı. Kullanıcı onayı olmadan silme/rename yapılmamalı.

## Ortak Backend Kontrat Listesi

### Supabase Tabloları

- `profiles`: kullanıcı rol/plan profili.
- `clients`: danışan kayıtları, `owner_id` tenant izolasyonu, anamnez.
- `assessments_v2`: danışana bağlı değerlendirme kayıtları.
- `reports`: immutable klinik raporlar, `snapshot_json`, `report_text`.
- `legal_acceptances`: clickwrap ve aktif doküman kabul kanıtı.
- `account_devices`: cihaz fingerprint, cihaz tipi, revocation.
- `account_sessions`: tek aktif oturum, session cookie, expiry.
- `account_security_events`: güvenlik olayları.
- `account_security_state`: kilit/suspension/risk state.
- `user_entitlements`: eğitim/video/paket erişim hakları.
- `payment_webhook_events`: doğrulanmış ödeme event kayıtları.
- `billing_audit_events`: ödeme/entitlement audit izleri.
- `education_video_assets`: eğitim video metadata.
- `education_video_access_tokens`: video erişim tokenları.
- `education_video_playback_sessions`: playback heartbeat/session.
- `education_video_access_logs`: video erişim ve watermark logları.
- `privacy_data_requests`: veri talep kayıtları.
- `data_access_audit_events`: klinik veri erişim audit olayları.
- `owner_audit.audit_events`: owner-only append-only audit snapshot.

### API Route'ları

- `POST /api/security/session/register`: cihaz ve app session kaydı.
- `POST /api/ai-report`: rapor üretimi, input validation, client ownership, rate limit, report lock.
- `GET /api/education/videos`: eğitim video listesi.
- `POST /api/education/videos`: owner/admin eğitim video kaydı.
- `GET/POST /api/education/videos/[id]/access/events`: route dosyaları envanterde var, eğitim player bu uçları kullanıyor.
- `POST /api/billing/webhook`: imzalı ödeme webhook'u ve entitlement grant/revoke.
- `POST /api/legal/accept`: aktif hukuki doküman kabul kaydı.
- `GET /api/legal/status`: kabul ve profil plan durumu.
- `POST /api/privacy/data-request`: KVKK/veri talep kaydı.
- `GET /api/owner-audit/status`: owner audit yetki durumu.
- `GET /api/owner-audit/export`: owner audit CSV/JSON export.
- `GET/POST /api/video-observation/sessions`: video observation session proxy.
- `POST /api/video-observation/sessions/[sessionId]/segments/presign`: upload hedefi.
- `PUT /api/video-observation/sessions/[sessionId]/segments/upload/[segmentType]`: segment upload proxy.
- `POST /api/video-observation/sessions/[sessionId]/segments/complete`: segment tamamla.
- `POST /api/video-observation/sessions/[sessionId]/submit`: işleme gönder.
- `GET /api/video-observation/processing/[sessionId]/status`: işleme durumu.

### Server-only ve Güvenlik Katmanları

- `src/lib/supabase/server.ts`
- `src/lib/supabase/admin.ts`
- `src/lib/security/apiGuards.ts`
- `src/lib/security/appSession.ts`
- `src/lib/security/entitlements.ts`
- `src/lib/security/payloadGuards.ts`
- `src/lib/security/privacyOps.ts`
- `src/lib/security/rateLimit.ts`
- `src/lib/security/videoProtection.ts`
- `src/lib/owner/ownerAccess.ts`
- `src/lib/owner/ownerAudit.ts`
- `src/lib/video-observation/server.ts`
- `src/lib/video-observation/proxy.ts`

App tarafında service-role veya admin davranışı olmayacak; bu katmanlar server'da kalacak.

## Eksik / Temizlenecek Web Panel Noktaları

1. `clients/[id]` yeni değerlendirme linki `evaluation_id` gönderiyor; assessment wizard `client_id` ile daha uyumlu çalışıyor. Faz 4/5 öncesi düzeltilmeli.
2. Profil ve ayarlar `localStorage` yerine Supabase profil/terapist ayarları tablosuna taşınmalı.
3. Rapor paketleri gerçek checkout, entitlement ve rapor hakkı düşümü ile bağlanmalı.
4. Topnav arama/bildirim ikonları gerçek işlev kazanmalı veya app shell'de sadeleştirilmeli.
5. Eğitim video yönetimi owner-only ve terapist playback ekranı ayrılmalı.
6. Video observation MVP mobile upload akışı için ayrı hata/timeout/background stratejisi gerektiriyor.
7. Eski Techwind/template bileşenleri ve backup dosyaları temizlenmeli; ancak bu çalışma güvenli temizlik fazı olarak ayrıca yapılmalı.
8. Git çalışma ağacı app geliştirmeden önce stabilize edilmeli: DNA rename seti, silinen selfmeta dosyaları ve generated dosyalar bilinçli olarak ayrılmalı.

## Faz 0 Kararı

App geliştirmeye başlangıç için ana kaynak:

- Web protected shell: `src/app/components/layout-gate.tsx`, `src/app/components/sidebar.tsx`, `src/app/components/topnav.tsx`
- Auth/session: `src/app/login/PageClient.tsx`, `src/proxy.ts`, `src/lib/security/appSession.ts`
- Danışan: `src/app/clients/page.tsx`, `src/app/clients/new/page.tsx`, `src/app/clients/[id]/page.tsx`
- Değerlendirme: `src/app/assessments/page.tsx`, `src/components/assessment/AssessmentWizardClient.tsx`
- Rapor: `src/app/reports/page.tsx`, `src/components/report/ClinicalReportView.tsx`, `src/lib/dna/reportEngine.ts`
- Eğitim: `src/app/education/page.tsx`, `src/lib/security/videoProtection.ts`
- Video gözlem: `src/app/video-observation/page.tsx`, `src/app/video-observation/video-observation-workflow.tsx`
- Ödeme/entitlement: `src/app/report-packages/page.tsx`, `src/lib/security/entitlements.ts`

Faz 1'e geçmeden önce önerilen karar: app v1 kapsamı "login -> ana ekran -> danışan -> anamnez -> değerlendirme -> rapor -> rapor geçmişi" çekirdeğiyle başlasın; eğitim, paket ve video gözlem aynı mimariye bağlanacak ama sonraki fazlarda taşınsın.
