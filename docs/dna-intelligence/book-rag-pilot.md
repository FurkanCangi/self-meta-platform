# DNA Intelligence - Kitap RAG Pilotları

Bu pilot, `Neuroscience: Canadian 3rd Edition` kaynağının tamamını PDF sayfası
temelinde indeksler ve Türkçe bir sorudan ilgili İngilizce kaynak pasajlarını
getirir. Canlı DNA Asistanı'na bağlı değildir.

İkinci pilot aynı güvenlik modelini dört kaynağa genişletir. Kontrollü Türkçe
kavramlar, sınırlı yazım hatası toleransı, kaynak otoritesi ve BM25 metin araması
birlikte kullanılır. Bu aşama RAG akışının yalnız **retrieval** bölümüdür; serbest
cevap üreten bir LLM veya klinik yorumlayıcı değildir.

## Neden bu kaynak seçildi?

- 172 sayfa ve okunabilir, etiketli PDF.
- Kaynak dosyasının SHA-256 değeri daha önce doğrulanmıştır.
- Lisans kaydı `CC BY 4.0 except where otherwise noted` biçimindedir.
- Temel nörobilim, membran potansiyeli, aksiyon potansiyeli, sinaptik süreçler
  ve nörobilim teknikleri için uygun bir pilot kapsamı sunar.

Kitap DNA ürün bilgisini, HRV bilgisini veya bireysel vaka mekanizmasını
doğrulayan bir otorite değildir. Şekiller, tablolar ve üçüncü taraf bileşenler
pilot tarafından yorumlanmaz.

## Komutlar

```bash
npm run chat:book-rag-pilot:build
npm run chat:book-rag-pilot:ask -- --question "Aksiyon potansiyeli nedir?"
npm run chat:book-rag-pilot:test
```

Dört kaynaklı pilot:

```bash
npm run chat:multibook-rag-pilot:build
npm run chat:multibook-rag-pilot:ask -- --question "Sempatik ve parasempatik sistem farkı nedir?"
npm run chat:multibook-rag-pilot:test
```

Üretilen büyük sayfa ve parça dosyaları yalnız ResearchSSD'de tutulur:

```text
/Volumes/ResearchSSD/Outputs/SelfMetaAI/dna-intelligence/book-rag-pilot/neuroscience-canadian-3e
/Volumes/ResearchSSD/Outputs/SelfMetaAI/dna-intelligence/book-rag-pilot/multi-book-v1
```

## Dört kaynaklı pilotun kapsamı

| Kaynak | Rol | Arama kapsamı |
| --- | --- | --- |
| Neuroscience: Canadian 3rd Edition (2022) | `foundational_book` | Hücresel nörofizyoloji, temel nörobilim, öğrenme/plastisite |
| Physiology (2023) | `foundational_book` | Membran ve sinaps fizyolojisi, duyusal reseptörler, otonom sinir sistemi |
| The Science of Sleep (2022) | `reference_only` | Başlangıç düzeyi uyku, REM/NREM, PSG, aktigrafi ve sirkadiyen ritim |
| Applied Human Neuroanatomy (2022) | `reference_only` | Terminoloji, yön bulma ve soru üretimi; bilimsel iddia otoritesi değil |

Toplam 766 PDF sayfası 1.026 sayfa-sınırlı metin parçasına dönüştürüldü.
1.017.374 aranabilir karakter yalnız ResearchSSD üzerinde tutulur. Her kaynakta
PDF hash'i, sayfa sayısı, lisans kaydı, gövde sınırı ve kaynak rolü tekrar
doğrulanır. Şekiller ve tablolar metin aramasına dayanak yapılmaz.

Gelişim alanındaki iki ek kitap bu koşuya bilinçli olarak alınmadı. İçlerinde
CC BY-NC-SA ve farklı lisanslı bölümler bulunduğu için bölüm/sayfa düzeyinde
ayrı bir izin listesi hazırlanmadan ticari ürün adayına katılamazlar.

## Son test sonucu

- 44 desteklenen teori/parafraz/yazım hatası sorusu doğru kaynak ve beklenen
  bölüm aralığına gitti.
- 9 katalog dışı soru güvenli biçimde `not_found` döndü.
- 9 tanı, tedavi, gizli veri veya kişiye özgü biyolojik çıkarım talebi reddedildi.
- Toplam sonuç: **62/62**.
- Aynı sorgu 20 çalıştırmada tek hash üretti.
- Yerel arama p95 süresi son doğrulama koşusunda 4,84 ms oldu ve
  pilotun 25 ms geliştirme sınırının altında kaldı.
- Aksiyon potansiyeli sorgusu iki temel kitaptan da pasaj getirdi.

Bu sayılar geliştirme benchmark'ıdır; bağımsız klinik geçerlik veya gerçek
kullanıcı başarısı olarak sunulamaz.

## Bilinçli sınırlar

- Harici veya yerel LLM kullanılmaz.
- Doğal Türkçe sentez yerine ilgili kaynak pasajları ve PDF sayfaları döner.
- Paket `runtimeEligible=false` ve `releaseEligible=false` durumundadır.
- Tanı, tedavi, kişiye özgü biyolojik çıkarım ve gizli veri istekleri reddedilir.
- `reference_only` kaynak sonucu görünür bir otorite uyarısı taşır.
- Bilinmeyen terimlerde yakın görünen rastgele kitap pasajı döndürülmez.
- Küçük açık modelle kaynaklı Türkçe cevap üretimi ayrı
  `local-grounded-generation-pilot.md` deneyinde yürütülür; bu arama paketinin
  canlılık durumunu değiştirmez.
