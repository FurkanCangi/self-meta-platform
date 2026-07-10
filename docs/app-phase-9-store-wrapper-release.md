# Faz 9: Store Wrapper ve Yayin

Bu faz, web app mode hazir olduktan sonra iOS ve Android magazalarina gonderilebilir native kabugu tanimlar. Ana urun kaynagi yine mevcut Next.js paneldir; native taraf yalnizca store dagitimi, app icon/splash, guvenli WebView ve deep link ihtiyaci icin vardir.

## Karar

Onerilen paketleme modeli: Capacitor tabanli ince native wrapper.

Neden:

- Web panel tek kaynak olarak kalir.
- Web tarafindaki guncellemeler store update beklemeden app'e yansir.
- Supabase, API route'lari, rapor motoru, egitim video erisimi ve video gozlem backend'i ayni kalir.
- Native maliyet ve bakim dusuk kalir; magazaya sadece kabuk girer.

Bu modelde native app, production URL'i su sekilde acar:

```text
https://<production-domain>/starter?surface=app
```

Login redirect, protected route ve app navigation `surface=app` parametresini korumalidir.

## Store Metadata Kararlari

| Alan | Onerilen Deger | Not |
| --- | --- | --- |
| App display name | DNA Intelligence | Store'da terapist/klinik calisma alani olarak konumlanir. |
| iOS bundle id | `com.dnaintelligence.therapist` | Apple Developer hesabinda unique olmali. |
| Android package name | `com.dnaintelligence.therapist` | Google Play'de unique olmali. |
| Production app URL | `https://<production-domain>/starter?surface=app` | Domain kesinlesince doldurulacak. |
| Associated domain | `applinks:<production-domain>` | Deep link/universal link gerekiyorsa. |
| URL scheme | `dnaintelligence://` | OAuth/deep link gerekiyorsa opsiyonel. |
| Minimum iOS | iOS 15+ | Kamera/video upload ve modern WebView icin yeterli alt sinir. |
| Minimum Android | Android 8+ / API 26+ | Play target SDK release aninda guncel tutulmali. |

## Native Wrapper Yapisi

Wrapper repo icinde su sekilde tutulmali:

```text
capacitor.config.json
ios/
android/
public/store-assets/
```

Capacitor config taslagi:

```json
{
  "appId": "com.dnaintelligence.therapist",
  "appName": "DNA Intelligence",
  "webDir": "out",
  "server": {
    "url": "https://<production-domain>/starter?surface=app",
    "cleartext": false
  },
  "ios": {
    "contentInset": "automatic"
  },
  "android": {
    "allowMixedContent": false
  }
}
```

Not: Bu proje Next.js server/API route kullandigi icin `webDir` ana kaynak degildir. Store build icin Capacitor `server.url` production web app'i acar. Bu yuzden production hosting, native build'den once hazir ve HTTPS olmalidir.

## App Icon Ve Splash

Mevcut marka kaynaklari:

- `public/images/brand/dna-logo-symbol.png`
- `public/images/brand/dna-logo-full.png`
- `public/images/brand/dna-logo-intelligence-symbol-transparent.png`
- `public/images/logo-icon.png`

Store icin gerekli kaynaklar:

- iOS app icon: 1024x1024 PNG, alpha olmadan.
- Android adaptive icon foreground: 432x432 veya daha buyuk transparent PNG.
- Android adaptive icon background: tek renk veya sade marka arka plan.
- Splash screen: acik zemin, ortada DNA symbol/lockup, koyu veya yogun gradient yok.

Icon/splash karar noktasi:

- App icon icin sadece DNA symbol kullanilmali; full logo kucuk boyutta okunmaz.
- Splash icin symbol + `DNA Intelligence` lockup kullanilabilir.
- Klinik uygulama oldugu icin store gorselleri sade, guvenilir ve panel ekranlarina dayali olmali.

## Deep Link / Universal Link

Ilk surum icin zorunlu degil. Gerekli olacagi durumlar:

- Email magic link veya OAuth callback native app'e donsun istenirse.
- Rapor/danisan linkleri mobil app'te acilsin istenirse.
- Egitim video linkleri app icinde acilsin istenirse.

Gerekirse eklenecek dosyalar:

```text
public/.well-known/apple-app-site-association
public/.well-known/assetlinks.json
```

Domain kesinlesmeden bu dosyalar eklenmemeli. Yanlis team id, SHA-256 veya package name ile yayinlamak deep link davranisini bozabilir.

## iOS Build Akisi

1. Apple Developer hesabi ve Team ID hazirlanir.
2. Bundle id: `com.dnaintelligence.therapist`.
3. Production domain HTTPS ve HSTS ile yayinda olur.
4. Capacitor iOS project olusturulur.
5. App icon ve splash assetleri Xcode asset catalog'a eklenir.
6. Camera/photo library izin aciklamalari eklenir:
   - Video gozlem segment upload icin kamera/photo library.
   - Mikrofon izni su an gerekli degilse istenmemeli.
7. Xcode signing ayarlanir.
8. Archive build alinir.
9. TestFlight internal test'e yuklenir.
10. Review notes'a uygulamanin terapist paneli oldugu, login gerektirdigi ve test hesabinin bilgileri eklenir.

## Android Build Akisi

1. Google Play Console app olusturulur.
2. Package name: `com.dnaintelligence.therapist`.
3. Capacitor Android project olusturulur.
4. Adaptive icon ve splash kaynaklari eklenir.
5. Camera/file picker izinleri minimal tutulur.
6. Release signing key olusturulur ve guvenli saklanir.
7. AAB release build alinir.
8. Internal testing track'e yuklenir.
9. Data safety formu klinik veri, hesap, video upload ve deterministik rapor isleme gerceklerine gore doldurulur.

## Store Review Hazirligi

Store'a girmeden once hazir olmasi gerekenler:

- Test hesabi: satin alimi tamamlanmis terapist hesabi.
- Test senaryosu: login -> danisan -> degerlendirme -> rapor gecmisi -> egitim -> video gozlem.
- Privacy policy URL.
- Terms/KVKK/acik riza URL'leri.
- Support contact email.
- App icon 1024x1024.
- En az 3-5 store screenshot.
- Uygulamada landing yerine login/app workspace acildigi dogrulanmis olmalidir.

## Production Release Gate

Store build'e gecmeden once asagidakiler temiz gecmeli:

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

Faz 8 bloklayicilari kapanmadan TestFlight/internal testing disina cikilmamali:

- Paylasimli rate limit.
- Legal acceptance blocker.
- Rapor kredisi/entitlement kontrolu.
- Production Supabase RLS kaniti.

## Web Guncellemeleri App'e Otomatik Gelir Mi?

Bu wrapper modelinde evet: app store'daki native kabuk production URL'i actigi icin web panelde yayinlanan yeni ekran, tasarim ve backend davranislari app'te otomatik gorunur.

Store update gereken durumlar:

- App icon/splash degisirse.
- Bundle id/package name degisirse.
- Native izinler degisirse.
- Deep link/universal link native config degisirse.
- Kamera, dosya erisimi, bildirim gibi yeni native capability eklenirse.
- Apple/Google review gerektiren native SDK veya permission degisirse.

## Faz 9 Cikis Kriteri

Faz 9 tamam sayilmasi icin:

1. Production domain kesinlesmis ve HTTPS yayinda.
2. Native wrapper iOS ve Android projeleri olusmus.
3. App icon/splash assetleri eklenmis.
4. Bundle id/package name store hesaplarinda rezerve edilmis.
5. TestFlight build yuklenmis ve login sonrasi ana akista test edilmis.
6. Google Play internal testing AAB yuklenmis ve ana akista test edilmis.
7. Store privacy/legal formlari mevcut urun gercegine gore doldurulmus.
8. Faz 8 bloklayicilari kapanmis.
