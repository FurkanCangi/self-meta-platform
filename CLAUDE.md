# Security Rules

Bu projede güvenlik varsayılan davranıştır. Yeni kod yazarken şu kuralları uygula:

- Secret değerleri sadece `.env*` dosyalarında veya deployment secret manager içinde yaşar. Frontend koduna, fixture'a, dokümana veya loga `sk-...`, service role key, webhook secret, access token yazma.
- Browser'a açık değişkenlerde yalnız gerçekten public değer kullan. `NEXT_PUBLIC_*` adı altında secret, private token veya service role key tanımlama.
- Public veya mutating API route'larında rate limit kullan. Login, form submit, video event, owner export, ödeme, gizlilik ve rapor üretimi limit aşımında 429 dönmeli.
- Client doğrulaması sadece UX içindir. Güvenlik doğrulaması server'da yapılır: Zod schema/normalizer, ownership kontrolü, RLS veya service-role route guard birlikte kullanılmalıdır.
- Auth'u elle yazma. Supabase Auth kullan; route içinde sadece kimliği değil, verinin sahibini de doğrula.
- SQL string birleştirme kullanma. Supabase query builder, RPC veya parametreli SQL kullan.
- Production CORS'u wildcard açma. Sadece bilinen origin'lere izin ver.
- Güvenlik header'larını koru: CSP, HSTS, X-Frame-Options, Referrer-Policy, Permissions-Policy ve no-sniff.
- Dosya yüklemede boyut, content-type ve dosya imzası server'da doğrulanmalı. Dosya adı/path kullanıcı girdisinden doğrudan üretilmemeli.
- Kullanıcıya stack trace, DB hata mesajı veya provider detayı döndürme. Kullanıcıya genel hata kodu, server log/audit tarafına detay yaz.
- Klinik rapor üretimi tamamen deterministik kalır. Harici üretken model, LLM API anahtarı veya çalışma zamanı model çağrısı ekleme. Kullanıcı hakkı, sahiplik, girdi doğrulama, veri minimizasyonu ve görünür karar sınırı kontrollerini koru.
- Owner/admin kolaylığı normal kullanıcı güvenliğini gevşetmemeli. Owner bypass gerekiyorsa sadece owner mail/role için dar kapsamlı olmalı.
