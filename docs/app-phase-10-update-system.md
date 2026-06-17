# Faz 10: Guncelleme Sistemi

Bu faz, store wrapper yayinlandiktan sonra "sitede guncelleme olunca app'e de gelsin" beklentisini garanti altina alir. Temel prensip: app icerigi web kaynakli calisir; native kabuk yalnizca WebView, izinler, icon/splash ve store dagitimi icindir.

## Karar

Cogunlukla store update gerekmeyecek.

Capacitor/WebView wrapper production Next.js URL'ini acar:

```text
https://<production-domain>/starter?surface=app
```

Bu nedenle asagidaki degisiklikler app'e otomatik yansir:

- Terapist panel ekranlari.
- Danisan, degerlendirme, rapor, egitim, paket ve video gozlem UI degisiklikleri.
- API route ve backend davranisi.
- Rapor motoru ve klinik icerik guncellemeleri.
- Tasarim sistemi, logo kullanimi, renk ve tipografi guncellemeleri.
- KVKK/legal metin guncellemeleri.

Store update gerektiren durumlar:

- Native izinler degisirse.
- App icon/splash degisirse.
- Bundle id/package name degisirse.
- Deep link/universal link native config degisirse.
- Kamera, dosya sistemi, push notification gibi yeni native capability eklenirse.
- Eski native kabuk kritik WebView/API kontratini desteklemeyecek kadar geride kalirsa.

## Mevcut Durum

Repo'da su an service worker veya offline PWA cache yok. Bu, klinik veri/KVKK acisindan dogru baslangic durumudur. Klinik veriler cihazda offline cache'lenmemelidir.

Mevcut guvenli pratikler:

- Video observation proxy isteklerinde `cache: "no-store"` kullanimi var.
- Egitim ve billing status client fetch'lerinde `cache: "no-store"` kullanimi var.
- Faz 2 mimarisinde hassas API'lerin service worker ile agresif cache edilmemesi karari alinmis.

Eksik katman:

- App runtime config endpoint'i yok.
- Bakim modu endpoint'i yok.
- Minimum native shell version kontrolu yok.
- Kullaniciya "yeni surum/yenile" uyarisi verecek app-level bileşen yok.

## Runtime Config Kontrati

Production icin server-side bir endpoint eklenmeli:

```text
GET /api/app/runtime-config
```

Onerilen response:

```json
{
  "ok": true,
  "webVersion": "2026.06.17.1",
  "minimumShellVersion": "1.0.0",
  "recommendedShellVersion": "1.0.0",
  "maintenance": {
    "enabled": false,
    "message": null,
    "retryAfterSeconds": null
  },
  "updateNotice": {
    "enabled": false,
    "severity": "info",
    "title": null,
    "message": null
  },
  "storeUrls": {
    "ios": null,
    "android": null
  }
}
```

Cache policy:

```text
Cache-Control: no-store
```

Bu endpoint klinik veri dondurmez. Yalnizca versiyon, bakim ve guncelleme meta bilgisi dondurur.

## Native Shell Version

Native wrapper her WebView istegine veya runtime config fetch'ine shell bilgisi gondermelidir:

```text
X-DNA-Shell-Platform: ios | android | web
X-DNA-Shell-Version: 1.0.0
```

Alternatif olarak initial URL'e query param eklenebilir:

```text
/starter?surface=app&shell_platform=ios&shell_version=1.0.0
```

Header daha temizdir; query param sadece fallback olarak kullanilmalidir.

Minimum shell kontrolu:

- `shellVersion >= minimumShellVersion`: normal devam.
- `shellVersion < minimumShellVersion`: app icinde blocking update screen.
- `shellVersion < recommendedShellVersion`: non-blocking update banner.

## App Update Gate Bileseni

App shell icine client component eklenmeli:

```text
AppUpdateGate
```

Davranis:

1. App acilisinda `/api/app/runtime-config` fetch eder.
2. `maintenance.enabled=true` ise app calisma alanini kapatip bakim ekrani gosterir.
3. Native shell version minimumdan eskiyse zorunlu guncelleme ekrani gosterir.
4. `updateNotice.enabled=true` ise non-blocking banner gosterir.
5. Web deploy sonrasi yeni asset/version fark ederse "Yenile" aksiyonu sunar.

Hassas kural:

- AppUpdateGate hicbir klinik veriyi localStorage/sessionStorage'a yazmamalidir.
- Sadece runtime config timestamp/version gibi zararsiz metadata tutabilir.

## Cache Stratejisi

### Klinik Veri

No-store olmali:

- Danisan listesi/detayi.
- Anamnez ve klinik test girdileri.
- Değerlendirme cevaplari ve skorlar.
- Raporlar.
- Rapor uretimi.
- Billing/entitlement status.
- Education playback access.
- Video observation session, upload, processing status ve evidence.
- Owner audit.

Uygulama kurali:

```ts
fetch("/api/...", { cache: "no-store" })
```

veya route response header:

```text
Cache-Control: no-store
```

### Static Asset

Cache edilebilir:

- Next.js hashed JS/CSS chunks.
- Logo/icon/static images.
- Public legal/static page assetleri.

Next.js hashed asset cache'i kullanılabilir. Manuel service worker eklenmemeli.

### HTML/App Shell

App shell ve protected HTML yanitlari kisa yasamli veya no-store olmalidir. Store wrapper WebView eski HTML'i uzun sure tutmamali.

Oneri:

- Protected app route'lari: `no-store` veya server-side session validation ile taze response.
- Public marketing sayfalari: normal cache olabilir.
- App runtime config: kesin `no-store`.

## Bakim Modu

Bakim modu server tarafindan kontrol edilmeli. Basit baslangic:

```text
APP_MAINTENANCE_ENABLED=false
APP_MAINTENANCE_MESSAGE=
APP_MAINTENANCE_RETRY_AFTER_SECONDS=900
```

Davranis:

- Bakim aktifse app shell login sonrasi calisma alanini kapatir.
- Kullanici klinik veriyi duzenleyemez.
- Mesaj sade ve operasyonel olur.
- Public legal/privacy sayfalari mumkunse acik kalir.

Bakim modu klinik veri tutarliligi icin onemli:

- RLS/migration yayinlari.
- Rapor motoru guncellemeleri.
- Payment/entitlement degisiklikleri.
- Video observation backend bakimi.

## Versiyon Uyarisi

Iki seviye olmali:

### Web Version Notice

Yeni web deploy yayinlandiysa:

- Non-blocking banner: "Yeni surum hazir. Yenile."
- Kullanici rapor/degerlendirme formu ortasindaysa otomatik reload yapilmaz.
- Kullanici aksiyonuyla reload edilir.

### Native Shell Notice

Native shell tavsiye edilen surumden eskiyse:

- Non-blocking banner: "App kabugu icin yeni surum var."
- Store URL varsa ilgili store'a yonlendirir.

Native shell minimum surumden eskiyse:

- Blocking screen.
- Kullanici store update yapmadan app'e devam edemez.

## Eski App Kabugu Cok Geride Kalirsa

Zorunlu update kriterleri:

- WebView kamera/video upload davranisi mevcut app akisini bozuyorsa.
- Native header/query shell version bilgisi yoksa ve guvenlik kontrolu artik bunu gerektiriyorsa.
- Deep link veya auth callback kontrati degistiyse.
- Store compliance icin yeni privacy permission text gerekiyorsa.
- Eski shell yeni CSP/cookie/session politikasiyla uyumsuzsa.

Bu durumda `minimumShellVersion` yukseltilecek ve eski kabuk blocking update ekranina dusecek.

## Uygulama Sirasi

1. `/api/app/runtime-config` endpoint'i ekle.
2. `AppUpdateGate` bileşenini app shell'e bagla.
3. Maintenance env degiskenlerini `.env.example` ve production env'e ekle.
4. Native wrapper'a shell platform/version header'i ekle.
5. Store URL'lerini runtime config'e bagla.
6. Protected app route/API cache politikalarini kontrol et.
7. TestFlight/internal testing'de web deploy -> app refresh davranisini test et.

## Test Senaryolari

| Senaryo | Beklenen |
| --- | --- |
| Web panel deploy edilir | App yeniden acildiginda yeni web UI gorunur. |
| Runtime config no-store | Endpoint her istekte taze config dondurur. |
| Maintenance aktif | App calisma alani bakim ekranina duser. |
| Maintenance kapali | App normal devam eder. |
| Shell version minimumdan eski | Zorunlu update ekrani gelir. |
| Shell version tavsiye edilenden eski | Non-blocking update banner gelir. |
| Kullanici rapor formu ortasinda | Otomatik reload yapilmaz. |
| Klinik API offline/cache denemesi | Eski/stale klinik veri gosterilmez. |

## Faz 10 Cikis Kriteri

Faz 10 tamam sayilmasi icin:

1. App icerigi production web kaynagindan calisir.
2. Runtime config endpoint'i vardir ve `no-store` dondurur.
3. AppUpdateGate app shell'de aktif calisir.
4. Maintenance mode production env ile kontrol edilir.
5. Minimum native shell version blocking update davranisi verir.
6. Recommended shell version non-blocking banner verir.
7. Klinik veri no-store stratejisi korunur.
8. Web deploy sonrasi app'in store update beklemeden yeni icerigi aldigi test edilir.
