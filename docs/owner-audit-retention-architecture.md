# Owner-Only Audit + Retention Architecture

## Hedef
- Platform üyelerinin oluşturduğu `clients`, `assessments_v2` ve `reports` verilerini owner tarafında merkezi olarak görmek.
- Üye kendi kaydını veya raporunu silse bile owner tarafında append-only audit izi kalması.
- Veriyi kolay CSV/Excel dışa aktarımına uygun biçimde almak.
- Bu alanı üyelerin ürün içi arayüzünde göstermemek.
- Ancak hukuki metinlerde açıkça tanımlamak:
  - aydınlatma metni
  - saklama / imha politikası
  - sözleşme / hizmet koşulları

## Hukuki çerçeve
- Bu mekanizma "gizli takip" gibi değil, sözleşme + aydınlatma metni ile açıklanmış `owner-only audit / denetim / güvenlik / yasal saklama` mekanizması olarak kurgulanmalıdır.
- KVKK tarafında özellikle şu başlıklar açık yazılmalıdır:
  - hangi veri kategorilerinin saklandığı
  - hangi amaçla saklandığı
  - kimlerin erişebileceği
  - ne kadar süre tutulacağı
  - silme talebi ile ürün görünürlüğü kalksa bile audit / yasal saklama katmanında hangi sınırlı veri setinin tutulacağı
- Resmi kaynaklar:
  - KVKK örnek saklama ve imha politikası: https://kvkk.gov.tr/Icerik/5387/KVKK-Kisisel-Veri-Saklama-ve-Imha-Politikasi
  - KVKK veri güvenliğinde teknik ve idari tedbirler: https://www.kvkk.gov.tr/Icerik/6976/Carsamba-Semineri-Veri-Guvenliginin-Saglanmasinda-Teknik-ve-Idari-Tedbirler

## Önerilen mimari

### 1. Transaction tables
- `public.clients`
- `public.assessments_v2`
- `public.reports`

### 2. Audit schema
- `owner_audit.audit_events`
- append-only çalışır
- her `INSERT / UPDATE / DELETE` için snapshot alır
- hard delete olsa bile `DELETE` trigger üzerinden son veri owner audit tablosunda kalır

### 3. Access model
- ürün içi kullanıcılar:
  - `anon`
  - `authenticated`
  - audit schema erişimi yok
- yalnız owner:
  - allowlist email üzerinden doğrulanan özel kullanıcı
  - export API erişimi var
- teknik erişim:
  - service role key yalnız server route içinde kullanılır

### 4. Export model
- owner için gizli route:
  - `/api/owner-audit/export`
- desteklenen format:
  - `csv`
  - `json`
- filtreler:
  - `table`
  - `owner_id`
  - `from`
  - `to`
  - `limit`

### 5. Neden append-only?
- Kullanıcı üründe bir kaydı silince günlük iş akışından kaybolabilir.
- Ama owner denetim, uyuşmazlık çözümü, sözleşmesel inceleme, veri bütünlüğü, finansal ve yasal izleme için geçmiş snapshot'ı görmeye devam eder.
- Bu mekanizma uygulama seviyesindeki `deleted_at` veya hard delete işlemlerinden bağımsızdır.

## Güvenlik şartları
- `owner_audit` şemasında RLS açık olacak.
- `anon` ve `authenticated` için doğrudan `select` olmayacak.
- export route yalnız allowlist email ile çalışacak.
- route logları ayrıca tutulmalı:
  - kim export aldı
  - hangi tarih aralığını aldı
  - hangi tabloyu çekti
- en iyi ikinci faz:
  - export access log tablosu
  - download hashing / watermark

## Uygulama fazları

### Faz 1
- audit schema
- 3 ana tablo için trigger
- owner export route

### Faz 2
- owner dashboard
- tablo bazlı filtreleme
- tek üyenin tüm lifecycle'ını zaman çizgisinde görme
- export access log

### Faz 3
- günlük snapshot özetleri
- veri kalite raporu
- churn / kötüye kullanım / toplu silme alarmı
- otomatik warehouse replikasyonu (BigQuery / Postgres replica / S3 parquet)

## Dışa aktarım stratejisi
- Excel için en hızlı yol CSV.
- Audit export route JSON payload'ı flatten ederek CSV üretir.
- Büyük veri hacminde ikinci faz önerisi:
  - nightly materialized export
  - S3 / bucket / parquet
  - Looker Studio / Metabase / Power BI

## Kritik operasyon notları
- Uygulamada kullanıcı bir şeyi sildiğinde:
  - ürün görünürlüğü kalkar
  - audit event kalır
- Üyelerin bunu UI içinde görmesi gerekmez.
- Ama sözleşme ve aydınlatma metninde açıkça belirtilmelidir.
- Owner erişimi kişi bazlı değil, kurum bazlı kontrol edilmelidir.
- Mümkünse owner account için:
  - 2FA
  - IP allowlist
  - access log

## Repo içindeki karşılığı
- SQL:
  - `sql/owner_audit_retention.sql`
- Owner erişim helper:
  - `src/lib/owner/ownerAccess.ts`
- Service role admin client:
  - `src/lib/supabase/admin.ts`
- Export route:
  - `src/app/api/owner-audit/export/route.ts`

## Zorunlu environment variables
- `SUPABASE_SERVICE_ROLE_KEY`
- `OWNER_AUDIT_EMAILS`

Örnek:
```env
SUPABASE_SERVICE_ROLE_KEY=...
OWNER_AUDIT_EMAILS=owner@example.com,second-owner@example.com
```
