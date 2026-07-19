# Faz 25–27: çelişki, DNA ilişkisi ve nihai yayın uygunluğu

Bu sözleşme, bilimsel içeriğin aday kaydı ile canlı çalışma zamanı yetkisini
birbirinden ayırır. Bir çağıran bütün alanları `passed` olarak gönderse bile
kayıt canlıya alınmaz. Canlı yetki yalnız kod incelemesiyle sabitlenen SHA-256
özet kayıtlarından gelebilir. Üç üretim yetki kaydı da şu anda bilinçli olarak
boştur; dolayısıyla Faz 25–27 tek başına V3 içerik yayımlamaz.

## Faz 25 — Çelişki kümeleri

Aynı konuya ilişkin farklı sonuçlar `conflictSetId` altında, kaynak ve iddia
hash'lerine bağlı biçimde tutulur. Küme için en az iki farklı iddia ve en az iki
farklı sonuç yönü zorunludur. Kanıt düzeyi, sonuçların değiştiği koşullar,
bilinmeyenler ve kaynak kesim tarihi açık alanlardır.

Çözülmüş küme daha güçlü iddianın kimliğini taşımak zorundadır. Çözülmemiş küme
hiçbir iddiayı kazanan olarak seçemez ve en az bir bilinmeyen belirtmelidir.
Yetkilendirilmiş çözülmemiş kümenin cevap sınırı şudur:

> Bulgular tutarlı değildir; bu nedenle bireysel vaka için kesin sonuç çıkarılamaz.

Yetkisiz veya hash'i değiştirilmiş bir küme çalışma zamanında `not_available`
döner; iddia veya kaynak kimliği sızdırmaz. Çelişki gizlenmez fakat denetlenmemiş
bir çelişki de bilimsel gerçek gibi sunulmaz.

## Faz 26 — Kontrollü DNA ilişki sınıflandırması

Yalnız şu değerler kabul edilir:

- `product_definition`
- `supported_relation`
- `conceptual_proximity`
- `theory_only`
- `not_established`
- `contradicted`
- `not_applicable`

Her sınıf kendi zorunlu sınır koduna bağlıdır. `product_definition` yalnız DNA
ürün bilgisi otoritesine ve onaylı sahip pasajına dayanabilir; dış bilimsel
kaynak bu sınıfı üretemez. `supported_relation`, `conceptual_proximity`,
`theory_only` ve `contradicted` açık tek-adımlı ilişki iddiası ile gerçek destek
pasajı gerektirir. `not_established` ve `not_applicable` ilişki varmış gibi bir
ilişki iddiası taşıyamaz.

`supported_relation` bile yalnız kaydedilmiş tek ilişkiyi destekler; DNA
ürününün genel bilimsel geçerliğini kanıtlamaz. “DNA ile doğrudan bağlantılıdır”
şeklinde bir varsayılan değer veya varsayılan yanıt yoktur.

## Faz 27 — Nihai yayın kapısı

Her adayın aşağıdaki 14 kapının tamamı için ayrı, role bağlı ve hash ile
doğrulanmış bir `passed` kaydı taşıması gerekir:

1. Geçerli kaynak
2. Uygun lisans
3. Geri çekilme kontrolü
4. Gerçek pasaj
5. Kesin locator
6. İki kör çıkarım ve uzlaştırma
7. Kaynak sadakati
8. Yöntem denetimi
9. Karşı kanıt denetimi
10. Güvenlik denetimi
11. Türkçe aktarım denetimi
12. Yaş ve popülasyon
13. İddia sınırı
14. DNA ilişki sınıfı

Her onay, adayın bütün kaynak–artefakt–pasaj–iddia bağlamını kapsayan
`subjectSha256` ile kendi gate-specific kanıt hash'ine bağlıdır. Kör A ve B
çıkarımlarının hash'leri aynı olamaz. `not_reported` yaş veya popülasyon yayın
öznesi oluşturamaz. Türkçe özgün metin de “çeviri gerekmedi” diye atlanmaz;
özgün Türkçe aktarım kontrolü kaydı ister.

Kapılar eksiksiz olsa bile sonuç yalnız `preauthorizationEligible` olur. Nihai
`releaseEligible`, ilişki, varsa çelişki kümesi ve bütün aday özetinin kod içinde
sabitlenmiş üretim kayıtlarında bulunmasını gerektirir. Çağıran bu kayıtları
gövde, ortam değişkeni veya API parametresiyle genişletemez.

## Mevcut dürüst durum

- Yetkilendirilmiş çelişki kümesi: **0**
- Yetkilendirilmiş DNA ilişki sınıflandırması: **0**
- Yetkilendirilmiş nihai yayın: **0**
- V3 çalışma zamanı yayını: **0**

Bu sayılar bir hata değil, gerçek içerik çok geçişli denetimden geçene kadar
uygulanan yayın emniyetidir. V3 yayın derleyicisi Faz 20–24 review bundle'ını,
Faz 25 çözümünü, Faz 26 ilişki kaydını ve Faz 27 publication candidate'ını
doğrudan ve hash-bağlı biçimde tüketir. Üretim sicilleri boş olduğu için sonuç
yine sıfır yayındır.

## Doğrulama

Hedefli test:

```bash
npx tsx scripts/run-dna-publication-eligibility-tests.ts
```

Test; bozulmuş hash, fazla alan enjeksiyonu, eksik/çift kapı, yanlış denetçi
rolü, bağlı olmayan kanıt, uygunsuz ilişki sınıfı, çözülmemiş çelişkide kazanan
seçimi ve çağıran tarafından yetkilendirme denemelerini reddeder.
