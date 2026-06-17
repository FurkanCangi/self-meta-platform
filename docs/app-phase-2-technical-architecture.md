# App Faz 2: Teknik Mimari

Tarih: 2026-06-17

Bu doküman, Faz 1 bilgi mimarisini uygulanabilir teknik mimariye çevirir. Hedef, mevcut Next.js terapist panelini ana kaynak olarak koruyup aynı kod tabanı içinde mobile-first app shell üretmek ve iOS/Android store uygulamalarını bu shell'i açan ince kabuk olarak paketlemektir.

## Mimari Karar

Seçilen mimari:

1. Mevcut Next.js panel ana kaynak kalır.
2. Mobile-first app shell aynı kod tabanı içinde geliştirilir.
3. iOS/Android uygulama, store için ince wrapper olur.
4. Backend aynı kalır:
   - Supabase
   - Next.js API route'ları
   - DNA rapor motoru
   - Auth/session güvenliği
   - Eğitim video erişimi
   - Video observation proxy
   - Payment webhook ve entitlement sistemi

Bu modelde app store uygulaması kendi içinde klinik iş mantığı taşımaz. Klinik mantık hosted Next.js uygulamasından gelir. Böylece panelde yapılan UI ve iş akışı güncellemeleri, store'a yeni build göndermeden app deneyimine yansıyabilir.

## Uygulama Katmanları

| Katman | Sorumluluk | Nerede çalışır |
|---|---|---|
| Store wrapper | App icon, splash, native shell, webview açılışı, gerekirse deep link | iOS/Android |
| Mobile app shell | Login sonrası terapist panelinin mobil layout'u, tab/stack hissi, app mode navigasyon | Next.js client/server |
| Protected web panel | Mevcut desktop terapist paneli | Next.js |
| API boundary | AI rapor, session, legal, education, billing, video observation proxy | Next.js route handlers |
| Data layer | RLS ile tenant izolasyonu, auth, storage, audit tabloları | Supabase |
| Rapor motoru | DNA scoring, deterministic report, literature section, quality gates | Server-side TypeScript |
| External services | OpenAI, video observation service, payment provider | Server-to-server |

## App Mode Yapısı

### URL Stratejisi

Önerilen başlangıç:

- Store wrapper launch URL: `/starter?surface=app`
- Oturum yoksa mevcut proxy/login davranışıyla `/login?next=/starter&surface=app` benzeri akış.
- İlk app açılışında `surface=app` bilgisi localStorage veya cookie ile saklanır.
- Protected route'lar aynı kalır: `/starter`, `/clients`, `/reports`, `/education`, `/video-observation`, `/profile`, `/profile-setting`.

Neden aynı route'lar:

- Web ve app aynı iş mantığını kullanır.
- Güncelleme iki ayrı route ağacına bölünmez.
- Store wrapper sadece hosted paneli açar.
- Linkler, rapor geçmişi ve Supabase ownership davranışı aynı kalır.

Alternatif olan `/app/*` route seti şu an önerilmez. Çünkü aynı ekranların iki kopyasını üretir ve web/app davranış drift'i yaratır. Gerekirse ileride sadece wrapper başlangıcı için `/app` route'u oluşturulup `/starter?surface=app` yönlendirmesi yapabilir.

### Shell Ayrımı

Mevcut `LayoutGate` public/protected ayrımını yapıyor. App mode'da aynı protected içerik farklı shell ile render edilmeli:

- Desktop/web shell:
  - Sidebar
  - Topnav
  - Geniş grid/kart layout
- Mobile app shell:
  - Üstte kompakt app header
  - Altta bottom tab
  - Stack hissi veren geri navigasyon
  - Fullscreen wizard ekranları
  - Landing/public route göstermeme

Önerilen dosya yapısı:

```text
src/app/components/
  layout-gate.tsx
  app-shell/
    AppShell.tsx
    AppHeader.tsx
    BottomTabs.tsx
    MoreMenu.tsx
    useAppSurface.ts
```

`layout-gate.tsx` protected route içindeyken surface/app viewport bilgisini okuyup desktop shell veya app shell seçer. İlk fazda viewport tabanlı mobil shell yeterli olabilir; store wrapper için `surface=app` daha deterministik olur.

### Bottom Tab Route Haritası

| Tab | URL | Aktif route pattern |
|---|---|---|
| Home | `/starter` | `/starter`, `/dashboard` |
| Clients | `/clients` | `/clients`, `/clients/*`, `/assessments` |
| Reports | `/reports` | `/reports` |
| Learn | `/education` | `/education` |
| More | `/profile` veya app-only menu | `/profile`, `/profile-setting`, `/report-packages`, `/video-observation`, legal links |

Değerlendirme ayrı tab değildir. `/assessments` route'u app shell'de Clients tab altında aktif görünmelidir.

## Store Wrapper Yapısı

Wrapper sorumlulukları sınırlı tutulmalı:

- Native splash ekranı.
- Hosted app URL açılışı.
- Webview storage/cookie sürekliliği.
- Dış linkleri sistem tarayıcısında açma.
- Kamera/video dosya seçimi için gerekli izin açıklamaları.
- Gerekirse deep link veya universal link yönlendirmesi.

Wrapper sorumluluğu olmamalı:

- Rapor motoru.
- Supabase service-role işlemleri.
- Payment webhook.
- Klinik veri işleme.
- Eğitim video token üretimi.
- Video observation processing.

Not: Mevcut `next.config.ts` içinde `X-Frame-Options: DENY` ve `frame-ancestors 'none'` var. Bu iframe gömmeyi engeller, doğru bir güvenlik davranışıdır. Native webview URL'yi doğrudan açtığı için iframe gibi çalışmaz. Store wrapper tasarımında uygulamayı başka bir web sitesinin iframe'i olarak gömme yaklaşımı kullanılmamalıdır.

## Auth / Session Stratejisi

Mevcut davranış korunur:

1. Kullanıcı email/password ile Supabase auth üzerinden giriş yapar.
2. E-posta doğrulaması yoksa protected route açılmaz.
3. Login sonrası `/api/security/session/register` çağrılır.
4. Cihaz id `dna_device_id` ile client storage'da tutulur.
5. Server `account_devices` ve `account_sessions` kayıtlarını yönetir.
6. HttpOnly `sm_active_session` cookie set edilir.
7. `src/proxy.ts` protected route'larda Supabase user + app session cookie kontrolü yapar.
8. Session yoksa veya geçersizse login'e döner.

### Store Wrapper İçin Session Gereksinimleri

- Webview cookies kalıcı olmalı.
- localStorage kalıcı olmalı.
- App silinirse cihaz id ve session kaybolabilir; bu normaldir.
- Aynı hesap için maksimum 2 cihaz politikası korunur.
- Tek aktif session davranışı server tarafında kalır.
- Logout, Supabase session'ı kapatmalı ve local app profil cache'lerini temizlemelidir.

### Plan ve Legal Gate

Mevcut login `profiles.plan` alanını okuyor ve `plan === "none"` ise `/fiyatlandirma` route'una yönlendiriyor. App mode'da bu davranış revize edilmeli:

- App içinde public fiyatlandırma landing'i açmak yerine `PackagesScreen` veya aktivasyon ekranı açılmalı.
- Legal kabul eksikse `LegalAcceptanceScreen` blocking modal/screen olarak gösterilmeli.
- Legal dokümanlar app içinde webview/read-only ekran olarak açılabilir.

## API Kullanım Sınırları

### Client'ın Doğrudan Kullanabileceği Supabase Tabloları

Bu tablolar RLS ile kullanıcıya ait satırlar üzerinden çalışabilir:

- `profiles`: kendi profil/plan okuma.
- `clients`: kendi danışanları.
- `assessments_v2`: kendi danışanlarına bağlı değerlendirmeler.
- `reports`: kendi danışanlarına bağlı raporlar.
- `user_entitlements`: kendi erişim hakları.
- `billing_audit_events`: kendi hedef kullanıcı eventleri.
- `account_devices`: kendi cihaz listesi.
- `account_sessions`: kendi session listesi.
- `account_security_events`: kendi güvenlik olayları.
- `legal_acceptances`: kendi legal kabul kayıtları.

Bu kullanımda RLS ve ownership kontrolleri authoritative kalır. App client tarafı sadece kullanıcının erişmesine izin verilen satırları görmelidir.

### Mutlaka API Route Üzerinden Yapılacak İşler

Bu işler client tarafında doğrudan yapılmamalıdır:

- App session/device kaydı: `/api/security/session/register`
- AI/deterministic rapor üretimi: `/api/ai-report`
- Legal kabul yazımı: `/api/legal/accept`
- Legal durum kontrolü: `/api/legal/status`
- Eğitim video listesi/access/playback eventleri: `/api/education/videos...`
- Billing webhook: `/api/billing/webhook`
- Privacy data request: `/api/privacy/data-request`
- Owner audit status/export: `/api/owner-audit...`
- Video observation proxy/upload/processing: `/api/video-observation...`

### Client'ın Asla Yapmaması Gerekenler

- `SUPABASE_SERVICE_ROLE_KEY` kullanmak.
- OpenAI API key kullanmak.
- Payment webhook doğrulamak.
- Eğitim video signed URL/token üretmek.
- Owner audit export üretmek.
- Rapor motorunu güvenlik/ownership kontrolü olmadan çalıştırmak.
- Başka terapistin `owner_id` alanına erişmek veya yazmak.
- Server-controlled field göndermek: `owner_id`, `user_id`, `role`, `plan`, `immutable`, audit alanları.

## Server'da Kalacak İşler

| İş | Neden server'da kalmalı |
|---|---|
| Rapor üretimi | Klinik veri, rate limit, ownership, age validation, report lock ve OpenAI/server-side logic içerir. |
| Report lock kontrolü | Tek rapor kuralı client'a bırakılamaz. |
| Service role işlemleri | Browser/app bundle'a secret sızmamalı. |
| Payment webhook | İmza doğrulama ve entitlement grant/revoke server-to-server olmalı. |
| Education video access | Signed URL, access token, watermark ve heartbeat güvenlik için server'da üretilir. |
| Video observation proxy | Harici servis URL ve upload güvenliği server üzerinden kontrol edilir. |
| Owner audit | Owner-only append-only data ve export server-only kalmalı. |
| Privacy/audit logging | Klinik veri erişim izleri client manipülasyonuna açık olmamalı. |
| Account anomaly/risk scoring | Session, IP, UA, device risk değerlendirmesi server'da kalmalı. |

## Data ve State Stratejisi

### Kalıcı Kaynak

- Klinik veri: Supabase.
- Auth/session: Supabase Auth + `account_sessions`.
- Rapor: `reports.report_text` ve `reports.snapshot_json`.
- Eğitim erişimi: `user_entitlements` + video access tabloları.
- Legal kabul: `legal_acceptances`.

### Geçici Client State

- Form draft'ları.
- Wizard progress.
- UI theme.
- App surface flag.
- Device id.

### App Öncesi Düzeltilmesi Gereken State Sorunları

- `profile` ve `profile-setting` şu an localStorage tabanlı. App/web ortaklığı için Supabase kalıcı tabloya veya `profiles` genişletmesine taşınmalı.
- `topnav` profil adını localStorage'dan okuyor. Backend profile kaynağına bağlanmalı.
- Rapor imza/kurum bilgileri rapor çıktısıyla ilişkilendirilecekse server-side snapshot'a dahil edilmeli.

## Cache ve Otomatik Güncelleme Stratejisi

Store wrapper hosted Next.js URL'yi açacağı için:

- UI ve iş akışı güncellemeleri deploy sonrası app'e gelir.
- Store update sadece native shell, izinler, app icon/splash, deep link veya wrapper davranışı değiştiğinde gerekir.
- Klinik API route'ları `cache: no-store` gerektiren yerlerde no-store kalmalı.
- Rapor, danışan, education access gibi hassas veriler service worker ile agresif cache edilmemeli.
- Static logo/CSS/JS assetleri normal Next.js cache stratejisiyle çalışabilir.

App mode için öneri:

- Kritik klinik ekranlarda stale data yerine revalidate/no-store tercih edilmeli.
- Offline mode v1 kapsamına alınmamalı.
- Webview yüklenemezse wrapper basit "Bağlantı kurulamadı" ekranı göstermeli.

## Güvenlik Sınırları

- RLS, client access için birinci savunma hattıdır.
- API route'larında `requireTrustedMutation` benzeri same-origin/origin kontrolleri korunmalıdır.
- App wrapper, API'leri farklı origin'den doğrudan çağıran ayrı native client gibi tasarlanmamalıdır; hosted app same-origin modelinde kalmalıdır.
- Klinik rapor metni, anamnez ve çocuk/danışan verisi client loglarına veya analytics'e yazılmamalıdır.
- Video access watermark ve heartbeat app içinde görünür olmalı ama token üretimi server'da kalmalıdır.
- Owner audit route'ları app v1 navigasyonundan gizlenmelidir.

## Ortam Değişkenleri

Server ortamında kalacaklar:

- `SUPABASE_SERVICE_ROLE_KEY`
- `OPENAI_API_KEY`
- `OPENAI_REPORT_MODEL`
- `OPENAI_REPORT_DEBUG`
- `PAYMENT_WEBHOOK_SECRET`
- `OWNER_AUDIT_EMAILS`
- `VIDEO_OBS_API_BASE_URL`

Client'a açık kalabilecekler:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

Store wrapper içine secret konmamalıdır. Wrapper en fazla hosted app URL, bundle id/package name ve izin açıklamaları taşımalıdır.

## App Mode Uygulama Planı

### Adım 1: Surface Detection

- `surface=app` query parametresi okunur.
- App surface localStorage veya cookie ile saklanır.
- Protected route'larda app shell seçilir.

### Adım 2: Mobile App Shell

- App header.
- Bottom tabs.
- More screen.
- Stack-like back behavior.
- Desktop sidebar/topnav mobilde gizlenir.

### Adım 3: Core Screens Responsive Refactor

- `/starter` -> Home app layout.
- `/clients` -> mobile list.
- `/clients/new` -> fullscreen wizard.
- `/clients/[id]` -> mobile detail.
- `/assessments` -> mobile assessment wizard.
- `/reports` -> report list + viewer split yerine stacked viewer.

### Adım 4: Auth/Plan/Legal App Mode

- Login app mode styling.
- `plan === "none"` redirect'i public `/fiyatlandirma` yerine app activation/packages ekranına yönlenir.
- Legal acceptance app blocking screen.

### Adım 5: Store Wrapper

- Wrapper launch URL `/starter?surface=app`.
- Cookie/localStorage persistence doğrulanır.
- External legal/payment links güvenli şekilde açılır.
- iOS/Android test build.

## Teknik Riskler

| Risk | Etki | Önlem |
|---|---|---|
| Web/app route drift'i | Aynı iş iki yerde farklı çalışır | Aynı route kontratları ve ortak components. |
| Cookie persistence sorunu | Kullanıcı sürekli login olur | Wrapper webview storage/cookie ayarı test edilir. |
| Public fiyatlandırmaya yönlenme | App landing/pazarlama hissi verir | App mode'da packages/activation ekranı. |
| localStorage profil/ayar | Web ve app farklı veri gösterir | Supabase kalıcı profil/ayar kaynağı. |
| Rapor tekrar üretimi | Klinik ve maliyet riski | Report lock server-side korunur. |
| Video upload kesintisi | Büyük dosya akışı bozulur | Faz 7'de mobil upload retry/progress stratejisi. |
| Secret sızıntısı | Kritik güvenlik ihlali | Store wrapper ve client bundle secret taşımaz. |
| Cache klinik veri sızdırır | KVKK riski | Hassas API no-store, offline cache yok. |

## Faz 2 Kararı

App mimarisi şu şekilde ilerleyecek:

- Ana ürün Next.js protected paneldir.
- Mobile-first app shell aynı route'lar ve aynı backend kontratlarıyla geliştirilecektir.
- Store uygulaması hosted app shell'i açan ince wrapper olacaktır.
- Klinik iş mantığı, rapor motoru, ödeme, video access ve owner/audit server tarafında kalacaktır.
- App v1 implementation sırası: app surface -> mobile shell -> auth/session app mode -> danışan/değerlendirme/rapor core screens.

Bu karar, "sitede güncelleme olduğunda app'e de otomatik gelsin" hedefiyle uyumludur. Store build yalnızca native wrapper davranışı değiştiğinde gerekir.
