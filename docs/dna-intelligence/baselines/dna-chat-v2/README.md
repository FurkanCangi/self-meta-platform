# DNA Chat V2 baseline

Bu dizin, DNA Intelligence V3 çalışması başlamadan önceki deterministik V2
motorunu ve katalog yüzeyini yeniden üretilebilir bir geri dönüş noktası olarak
kilitler.

- Kaynak commit: `5ed87217280a40e4566a04289d4c98b1f3883494`
- Motor: `dna-chat-engine@2`
- Katalog: `dna-chat-catalog@2`
- Kalıcı ref: `dna-chat-v2-baseline-20260719`

`baseline-manifest.json`, rollback commitindeki ilgili dosyaların tekil ve grup
SHA-256 kayıtlarını taşır. `regression-fixtures.json`, yalnız sentetik bağlamla
üretilmiş V2 cevap örneklerini kilitler. `gate-evidence.json`, ilk dondurma
anındaki yerel test sonuçlarını saklar. `SHA256SUMS` bu üç artefaktı birbirine
bağlar.

Tek komut doğrulaması:

```bash
npm run chat:baseline
```

Baseline artefaktlarını yalnız V2 dondurma işlemi sırasında yeniden üretmek
için:

```bash
npm run chat:baseline:update
```

Online kaynak doğrulaması bu hızlı ve deterministik yerel baseline'ın parçası
değildir. Canlı çapraz hesap testi de yalnız doğrulanmış deploy üzerinde release
kapısı olarak çalıştırılır.

Kod geri dönüşü veritabanı migration geri dönüşü anlamına gelmez. Üretim
rollback'i sırasında uygulama commit'i, Supabase şema uyumluluğu ve Vercel
deployment artefaktı birlikte doğrulanmalıdır.
