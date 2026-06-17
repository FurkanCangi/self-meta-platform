# App Faz 1: Bilgi Mimarisi

Tarih: 2026-06-17

Bu doküman Faz 0 mevcut durum sabitlemesinden sonra terapist app'inin ekran yapısını tanımlar. Ürün kararı nettir: app içinde landing, pazarlama veya public site akışı yoktur. App, satın alımı ve üyeliği tamamlanmış terapistin giriş bilgileriyle eriştiği klinik çalışma alanıdır.

## Ürün İlkesi

- İlk ekran: session check / splash.
- Oturum yoksa: login.
- Oturum varsa: ana çalışma alanı.
- App içindeki her ekran klinik iş yapmalı; public landing, satış anlatısı veya pazarlama section'ı olmamalı.
- Web panelin iş mantığı korunmalı: danışan kaydı, anamnez, değerlendirme, tek rapor kilidi, rapor geçmişi, eğitim, video gözlem, paketler, profil/ayarlar.
- Owner audit app v1 terapist deneyiminde yer almaz; admin/owner için ayrı web-only veya ayrı admin modu olarak tutulur.

## Web Route -> App Screen Eşleme

| Web route | App screen | Navigator yeri | Taşınma durumu | Not |
|---|---|---|---|---|
| `/login` | `LoginScreen` | Auth stack | Kesin | Supabase login, email confirmation, app session register ve cihaz limiti korunur. |
| `/signup`, `/auth-signup` | `SignupScreen` | Auth stack, opsiyonel | İkincil | App v1 varsayımı satın almış kullanıcıdır. Gerekirse destek/aktivasyon akışı olarak eklenir. |
| `/starter` | `HomeScreen` | Main tabs: Home | Kesin | Klinik çalışma alanı ana ekranı. Mobilde kart yoğunluğu azaltılır, "devam et" işleri öne çıkarılır. |
| `/dashboard` | Yok | Redirect | Taşınmaz | Web'de `/starter` redirect'i. App'te ayrı ekran olmaz. |
| `/clients` | `ClientsListScreen` | Main tabs: Clients | Kesin | Arama, filtre, durum, rapor kilidi ve danışan aksiyonları. |
| `/clients/[id]` | `ClientDetailScreen` | Clients stack | Kesin, düzeltme gerekli | Danışan özeti, anamnez, değerlendirmeler, rapor durumu, sil/arşiv. Değerlendirme başlatma parametresi `client_id` ile hizalanmalı. |
| `/clients/new` | `ClientCreateWizardScreen` | Clients stack modal/fullscreen | Kesin | Demografik, tıbbi, gebelik/doğum, günlük yaşam, hedefler, ek bulgular adımları. |
| `/assessments` | `AssessmentWizardScreen` | Clients stack, contextual | Kesin | Bağımsız tab değil; seçili danışandan başlatılır. 60 soru, sonuç, rapor üretimi. |
| `/assessments/new` | Yok | Redirect | Taşınmaz | Web'de `/assessments` redirect'i. |
| `/reports` | `ReportsListScreen` | Main tabs: Reports | Kesin | Rapor listesi, danışan kodu, tarih, versiyon, silme davranışı. |
| `/reports` seçili rapor alanı | `ReportViewerScreen` | Reports stack / Clients stack | Kesin | Klinik rapor viewer. Aynı rapor hem rapor tabından hem danışan detayından açılabilir. |
| `/education` | `EducationLibraryScreen` | Main tabs: Learn | Kesin ama Faz 6 | Eğitim listesi ve güvenli video erişimi. Owner video ekleme terapist app ana akışına konmaz. |
| `/education` player alanı | `EducationPlayerScreen` | Learn stack | Kesin ama Faz 6 | Watermark, heartbeat, access token, native/iframe player davranışı. |
| `/video-observation` | `VideoSessionsScreen` | More tab / Tools stack | Faz 7 | Session listesi ve evidence viewer giriş ekranı. |
| `/video-observation` upload workflow | `VideoUploadWorkflowScreen` | Tools stack | Faz 7 | Solo, dyadic, transition segment yükleme. Mobil dosya/video UX ayrı ele alınır. |
| `/video-observation?session_id=...` | `VideoEvidenceViewerScreen` | Tools stack | Faz 7 | Summary, domain, timeline, evidence, fusion ve rapor blokları. |
| `/report-packages` | `PackagesScreen` | More tab / Account stack | Faz 6 | Paket listesi app içinde görünür; gerçek satın alma/entitlement bağlantısı kurulmalı. |
| `/profile` | `ProfileScreen` | More tab / Account stack | Kesin ama backend gerekir | Şu an localStorage; app için Supabase kalıcılığı gerekir. |
| `/profile-setting`, `/settings` | `SettingsScreen` | More tab / Account stack | Kesin ama backend gerekir | Rapor imzası, bildirimler, plan/fatura tercihleri. |
| `/legal/accept` | `LegalAcceptanceScreen` | Auth/app blocking modal | Gerektiğinde | Kabul eksikse app açılışında blocking modal veya screen. |
| `/privacy`, `/terms`, `/kvkk`, `/explicit-consent`, `/retention-policy`, `/package-agreement` | `LegalWebViewScreen` | Account stack | Link olarak | App içinde belge görüntüleme; ana navigasyon tabı olmaz. |
| `/owner-audit`, `/owner-audit/[memberOwnerId]` | Yok / `OwnerAuditScreen` opsiyonel | Admin-only build | V1 dışında | Terapist app deneyimine dahil edilmez. |
| Public marketing route'ları | Yok | Yok | Taşınmaz | `/`, `/dna-nedir`, `/cozumler`, `/arastirma`, `/fiyatlandirma`, `/iletisim` app içinde ana deneyim değildir. |

## Bottom Tab Planı

Mobilde ana tab sayısı 5'i geçmemeli. Web sidebar'daki tüm route'ları alt taba koymak yerine, ana günlük işleri tablara, ikincil işleri stack içindeki "Daha" alanına alıyoruz.

### Önerilen Tablar

| Tab | Ana screen | İçindeki stack ekranları | Neden |
|---|---|---|---|
| Home | `HomeScreen` | Hızlı aksiyonlar, son danışanlar, bekleyen raporlar | Terapistin güne başladığı yer. |
| Clients | `ClientsListScreen` | `ClientDetailScreen`, `ClientCreateWizardScreen`, `AssessmentWizardScreen`, `ReportViewerScreen` | Klinik akışın merkezi danışandır. |
| Reports | `ReportsListScreen` | `ReportViewerScreen` | Raporlara hızlı erişim gerekir. |
| Learn | `EducationLibraryScreen` | `EducationPlayerScreen` | Eğitim kullanımı ayrı ama terapist için ana ürün parçası. |
| More | `MoreScreen` | `PackagesScreen`, `VideoSessionsScreen`, `VideoUploadWorkflowScreen`, `VideoEvidenceViewerScreen`, `ProfileScreen`, `SettingsScreen`, `LegalWebViewScreen`, `SupportScreen` | İkincil/araç/hesap ekranları burada toplanır. |

### Neden Değerlendirme Tab Değil?

Değerlendirme seçili danışana bağlıdır. Web'de `/assessments` direkt açıldığında danışan seçilmedi uyarısı gösteriliyor. App'te bu hatayı azaltmak için değerlendirme:

- Danışan listesindeki "Değerlendir" aksiyonundan,
- Danışan detayındaki "Değerlendirme başlat" aksiyonundan,
- Yeni danışan kaydı tamamlandıktan sonraki "Değerlendirmeye geç" aksiyonundan

başlatılmalıdır.

### More Screen Grupları

`MoreScreen` içinde bölümler:

- Araçlar: Video Gözlem
- Hesap: Profil, Ayarlar
- Kullanım ve Paketler: Rapor Paketleri, plan/entitlement özeti
- Hukuki: KVKK, Kullanım Şartları, Açık Rıza, Saklama Politikası
- Destek: iletişim/destek kanalı

Owner audit burada gösterilmez. Sadece owner/admin rolü için ayrı feature flag ile düşünülebilir.

## Stack Navigation Planı

### Auth Stack

1. `SplashScreen`
   - App brand/logo gösterir.
   - Supabase session kontrolü yapar.
   - App session cookie/cihaz kaydı durumunu doğrular.
2. `LoginScreen`
   - Email/password.
   - Login sonrası `/api/security/session/register` davranışı korunur.
   - Plan `none` ise app içinde paket/aktivasyon yönlendirmesi yapılır.
3. `LegalAcceptanceScreen`
   - Aktif hukuki doküman kabulü eksikse blocking akış.
4. `SignupScreen` opsiyonel
   - App v1'de ana CTA olmaz; gerekiyorsa destekli hesap oluşturma akışı.

### Main Tab Root

1. `HomeScreen`
2. `ClientsStack`
3. `ReportsStack`
4. `LearnStack`
5. `MoreStack`

### Clients Stack

1. `ClientsListScreen`
2. `ClientDetailScreen`
3. `ClientCreateWizardScreen`
4. `ExternalTestsScreen` veya wizard adımı
5. `AssessmentWizardScreen`
6. `AssessmentResultScreen`
7. `ReportGenerationScreen`
8. `ReportViewerScreen`

Not: Web'deki değerlendirme ve rapor üretimi aynı component içinde ilerliyor. App bilgi mimarisinde bu akış kullanıcı açısından ayrı adımlar gibi görünmeli, ancak backend kontratı aynı kalmalı.

### Reports Stack

1. `ReportsListScreen`
2. `ReportViewerScreen`
3. `ReportActionsSheet`
   - Paylaş/export ileride.
   - Silme davranışı dikkatli onayla.

### Learn Stack

1. `EducationLibraryScreen`
2. `EducationVideoDetailScreen`
3. `EducationPlayerScreen`

Not: Owner/admin eğitim kaydı oluşturma ekranı terapist app içinde görünmemeli. Web owner panelinde veya ayrı admin modda kalmalı.

### More / Tools Stack

1. `MoreScreen`
2. `PackagesScreen`
3. `VideoSessionsScreen`
4. `VideoUploadWorkflowScreen`
5. `VideoEvidenceViewerScreen`
6. `ProfileScreen`
7. `SettingsScreen`
8. `LegalWebViewScreen`
9. `SupportScreen`

## Home Screen İçeriği

Home, web'deki `/starter` kartlarının mobil çalışma alanı karşılığıdır. İlk ekranda pazarlama metni değil, iş kuyruğu olmalı.

Önerilen bloklar:

- Bugünkü hızlı aksiyonlar:
  - Yeni danışan
  - Danışan ara
  - Rapor geçmişi
  - Eğitimlere devam et
- Devam edilecek işler:
  - Anamnezi tamamlanmamış danışanlar
  - Raporu olmayan değerlendirmeler
  - Son oluşturulan raporlar
- Hesap durumu:
  - Plan/entitlement
  - Rapor hakkı, bağlanınca
  - Oturum/cihaz uyarıları
- Modül kısayolları:
  - Video gözlem
  - Paketler
  - Profil/Ayarlar

## Terapistin Ana Kullanım Senaryoları

### Senaryo 1: Giriş ve Çalışma Alanına Dönüş

1. Terapist app'i açar.
2. Splash/session check çalışır.
3. Oturum geçerliyse Home açılır.
4. Oturum yoksa Login açılır.
5. Login sonrası cihaz/session kaydı yapılır.
6. Aktif plan ve legal kabul durumu doğrulanır.
7. Home açılır.

Başarı kriteri: Terapist public landing görmeden klinik çalışma alanına girer.

### Senaryo 2: Yeni Danışan Oluşturma

1. Home veya Clients tabından "Yeni Danışan" açılır.
2. Wizard adımları doldurulur:
   - Demografik
   - Tıbbi geçmiş
   - Gebelik/doğum
   - Günlük yaşam
   - Hedefler
   - Ek klinik test/bulgu
3. Zorunlu alanlar tamamlanır.
4. Danışan Supabase `clients` tablosuna owner ile kaydedilir.
5. Kullanıcı doğrudan değerlendirmeye geçebilir veya danışan detayına döner.

Başarı kriteri: Danışan kaydı web ile aynı anamnez içeriğini üretir.

### Senaryo 3: Mevcut Danışanı Değerlendirme

1. Terapist Clients tabında danışanı arar.
2. Danışan detayını açar.
3. "Değerlendirme başlat" aksiyonuna basar.
4. 60 soruluk DNA wizard açılır.
5. 6 alan için Likert yanıtları girilir.
6. Sonuç ekranı domain skorlarını ve genel sınıflamayı gösterir.

Başarı kriteri: Değerlendirme seçili danışana bağlı ve yaş/anamnez bağlamıyla çalışır.

### Senaryo 4: Rapor Üretme

1. Değerlendirme sonuç ekranında rapor üretimi başlatılır.
2. Sistem daha önce rapor var mı kontrol eder.
3. Rapor yoksa `/api/ai-report` üzerinden rapor metni üretilir.
4. Rapor `reports` tablosuna immutable snapshot ile kaydedilir.
5. Rapor viewer açılır.

Başarı kriteri: Tek rapor kilidi korunur; aynı vaka için tekrar rapor üretilmez.

### Senaryo 5: Rapor Geçmişinden Rapor Açma

1. Terapist Reports tabını açar.
2. Raporları tarih/danışan koduyla tarar.
3. Bir raporu açar.
4. Klinik rapor viewer web'deki `ClinicalReportView` yapısına uygun gösterilir.

Başarı kriteri: Rapor metni okunabilir, danışan/assessment snapshot bağlamı görünür ve silme aksiyonu açık onay ister.

### Senaryo 6: Eğitim İzleme

1. Terapist Learn tabını açar.
2. Erişebildiği eğitimleri görür.
3. Eğitim videosunu açar.
4. Access token, watermark ve heartbeat davranışı arka planda çalışır.
5. Video bitirme/durdurma eventleri kaydedilir.

Başarı kriteri: Eğitim erişimi entitlement ve güvenli video kurallarıyla çalışır.

### Senaryo 7: Video Gözlem

1. Terapist More -> Video Gözlem açar.
2. Eski session'ları listeler veya yeni session oluşturur.
3. Solo, dyadic, transition segmentlerini yükler.
4. İşleme durumunu takip eder.
5. Evidence viewer'da domain, timeline, evidence ve raporu görür.

Başarı kriteri: Mobil upload akışı kesilirse kullanıcı ne olduğunu anlar; tamamlanan session yeniden açılabilir.

### Senaryo 8: Profil ve Ayarlar

1. Terapist More -> Profil açar.
2. Profesyonel bilgilerini düzenler.
3. More -> Ayarlar ekranında rapor imzası/bildirim/fatura tercihlerini düzenler.
4. Değişiklikler backend'e kaydedilir.

Başarı kriteri: Ayarlar sadece cihazda kalmaz; web ve app aynı profil/ayar verisini görür.

### Senaryo 9: Paket / Kullanım Hakkı

1. Terapist More -> Paketler ekranını açar.
2. Mevcut plan ve rapor/eğitim hakkını görür.
3. Gerekirse satın alma akışına yönlenir.
4. Webhook sonrası `user_entitlements` güncellenir.

Başarı kriteri: Client-side plan bilgisi authoritative değildir; entitlement server tarafından doğrulanır.

## Ekran Önceliği

### V1 Zorunlu

1. Splash/session check
2. Login
3. Home
4. Clients list
5. Client create wizard
6. Client detail
7. Assessment wizard
8. Report generation
9. Reports list
10. Report viewer

### V1.1

1. Profile
2. Settings
3. Packages
4. Legal document viewer

### V1.2

1. Education library
2. Education player

### V1.3

1. Video sessions
2. Video upload workflow
3. Video evidence viewer

## Bilgi Mimarisi Kararları

- Danışan, klinik iş akışının ana bağlamıdır.
- Değerlendirme danışan seçmeden başlatılmamalıdır.
- Rapor viewer hem danışan stack'inden hem reports stack'inden açılabilir.
- Eğitim ana tab olmalı çünkü satın alınmış terapist için kullanım değeri yüksek.
- Video gözlem, MVP ve daha ağır dosya/servis akışı olduğu için More/Tools altında başlamalı.
- Paketler app ana tabı olmamalı; kullanım hakkı ve satın alma ekranı More altında bulunmalı.
- Profil ve ayarlar ayrı tab olmamalı; More altında hesap grubu olarak tutulmalı.
- Owner audit terapist app'te görünmemeli.

## Faz 2'ye Hazırlık Notları

Faz 2 teknik mimaride şu kararlar netleştirilmeli:

1. App mode aynı Next.js kod tabanı içinde mi başlayacak, yoksa native wrapper/PWA kabuğu ayrı mı tutulacak?
2. Mobil app shell route'ları web protected route'larıyla aynı URL'leri mi kullanacak, yoksa `/app/*` gibi ayrı mobile-first route seti mi olacak?
3. Profil ve ayarlar için Supabase tablo/migration tasarımı nasıl yapılacak?
4. Rapor paketleri için checkout yönlendirmesi ve entitlement okuma UI kontratı nasıl kurulacak?
5. App store wrapper için hangi ekranlar remote web view, hangi ekranlar native shell sorumluluğu olacak?

Önerilen Faz 2 başlangıç kararı: aynı backend ve aynı route kontratları korunarak, önce Next.js içinde mobile-first protected app shell çıkarılsın. Store wrapper bu shell'i açan ince kabuk olarak kalsın.
