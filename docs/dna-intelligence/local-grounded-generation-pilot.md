# DNA Intelligence - Yerel Kaynağa Bağlı Cevap Pilotu

Bu deney, dört kitaplı deterministik aramanın getirdiği birden fazla kaynak
cümlesini küçük bir yerel modelle Türkçeye aktarır ve cümle düzeyindeki kaynak
bağını koruyarak daha doğal bir yanıt halinde sunar. Canlı DNA Asistanı'na bağlı
değildir; `runtimeEligible=false` ve `releaseEligible=false` olarak mühürlenir.

## Yerel çalışma ortamı

- Model: `Qwen3-4B-Instruct-2507`, MLX 4-bit dönüşümü
- Üst model: `Qwen/Qwen3-4B-Instruct-2507`
- Yerel paket: `mlx-community/Qwen3-4B-Instruct-2507-4bit`
- Lisans: Apache 2.0
- Model revizyonu: `50d427756c6b1b2fe0c0a10f67fbda1fc8e82c1b`
- Ağırlık SHA-256: `2a73c6c248601ab904e035548abd8e6abb65ea27dcb5f342fb0a8910eb44173f`
- Ağırlık boyutu: 2.263.022.417 bayt
- Çalışma: ResearchSSD üzerindeki izole Python/MLX ortamı; ücretli API yok

Model ve büyük çıktı dosyaları repoya alınmaz:

```text
/Volumes/ResearchSSD/Models/SelfMetaAI/Qwen3-4B-Instruct-2507-4bit
/Volumes/ResearchSSD/Tools/SelfMetaAI/dna-local-llm/.venv
/Volumes/ResearchSSD/Outputs/SelfMetaAI/dna-intelligence/grounded-answer-pilot/qwen3-4b-instruct-2507-4bit
```

## Neden serbest cevap üretmiyor?

İlk denemede modele soru ve birkaç pasaj verildiğinde, doğru alıntının yanına
kaynakta bulunmayan örnekler ekleyebildiği görüldü. Bu nedenle pilot bilinçli
olarak daha dar bir akışa çevrildi:

1. Güvenlik kapısı tanı, tedavi, ilaç, kişiye özgü biyolojik çıkarım ve gizli
   veri taleplerini model çalışmadan reddeder.
2. Dört kitaplı deterministik arama ilgili sayfayı getirir.
3. İstenen profile göre en fazla bir, iki veya üç ayrı pasajdan temiz bildirim
   cümlesi seçilir; sayfa başlığı, çalışma kitabı sorusu ve öğrenme hedefi cevap
   kabul edilmez.
4. Daha önce kaynak cümlesiyle birebir eşlenip kod içinde denetlenmiş kanonik
   çeviriler doğrudan kullanılır; diğer İngilizce kaynak cümlelerini yerel model
   birbirinden bağımsız ve zorunlu Türkçe terminolojiyle çevirir. Kanonik
   sözleşme bağımsız insan doğrulaması sayılmaz.
5. Her cümle için şema, kaynak kimliği, sayı, klinik dil, kesinlik dili,
   çevrilmeden kalan İngilizce ve görünür dahili kaynak işareti denetlenir.
6. Aynı yerel model soruyu görmeyen ikinci görevde her Türkçe iddianın yalnız
   kendi İngilizce cümlesi tarafından tamamen desteklenip desteklenmediğini
   sınar.
7. Yalnız tek tek onaylanmış Türkçe cümleler, her kaynak kimliği bir kez
   kullanılacak şekilde deterministik geçişlerle sıralanır. Cümlelerin olgusal
   olarak birleştirilmesi veya yeni bilgi eklenmesi yasaktır.
8. Deneysel yerel dil editörü yalnız `DNA_LOCAL_STYLE_COMPOSER=local_model`
   ile açılabilir. Varsayılan kapalıdır; açıldığında düzenlenmiş cümleler yeniden
   deterministik ve anlamsal denetimden geçer, kanıtlanamazsa onaylı bağımsız
   çevirilere geri dönülür.
9. Birincil cümle doğrulanamazsa `generation_blocked`; yalnız ek cümlelerden
   biri doğrulanamazsa dürüstçe daha kısa cevap profili döner.

Bu yapı bir “kitabı modele ezberletme” işlemi değildir. Kitap doğrulanmış bilgi
deposu, küçük model ise kaynak cümlesini Türkçeleştiren kontrollü dil katmanıdır.

## Komutlar

```bash
npm run chat:local-answer-pilot:guard
npm run chat:local-answer-pilot:ask -- --profile concise --question "Aksiyon potansiyeli nedir?"
npm run chat:local-answer-pilot:ask -- --profile standard --question "Aksiyon potansiyeli nedir?"
npm run chat:local-answer-pilot:ask -- --profile detailed --question "Aksiyon potansiyeli nasıl oluşur?"
npm run chat:local-answer-pilot:test
npm run chat:local-answer-pilot:family
npm run chat:local-answer-pilot:holdout
npm run chat:local-answer-pilot:cache
```

## Test kapsamı

Pilot testi şunları ayrı ayrı doğrular:

- Kısa, standart ve ayrıntılı profillerde zorunlu bilimsel terimler
- Standart yanıtta iki pasaj ve iki kaynak; ayrıntılı yanıtta üç pasaj, üç
  kaynak cümlesi ve en az iki ayrı kitap kullanımı
- Katalog dışı bilgi ve kaynakta yalnız soru bulunan sayfada `not_found`
- Tanı ve prompt manipülasyonu taleplerinde model çalışmadan ret
- Bilinmeyen kaynak kimliği, şema genişletme, kaynaksız sayı, klinik dil ve
  kesinlik dili, görünür dahili kaynak etiketi ve çevrilmemiş İngilizcenin reddi
- Eksik cümle, yinelenen kaynak kimliği ve kaynak işaretini metne taşıyan
  kompozisyonların reddi
- Kaynağa kasıtlı biçimde işlev eklenen adversarial cümlelerin anlamsal denetçi
  tarafından reddedilmesi
- Aynı soruda zaman alanları hariç cevap, iddia, kaynak ve denetim sonucunun
  kısa profilde üç; standart ve ayrıntılı profilde ikişer çalıştırmada aynı
  hash'i vermesi

Son koşuların sonucu:

- Eski model regresyon seti: **11/11**.
- 20 soruluk, farklı konu ailelerine yayılan geliştirme seti: **20/20**.
- Önceden hash ile kilitlenmiş 20 soruluk Türkçe holdout'un ilk çalışması:
  **13/20**. İlk sonuç dosyasının SHA-256 değeri
  `d682ddd12ab4cfd66bce83e3415aaffdc8efe0117d7ec0ba8b0d7ecc47a23fd5`
  olarak SSD'de korunur.
- Yalnız sistem ve kaynak yönlendirmesi düzeltildikten sonra aynı holdout'un ham
  sonucu: **19/20**. Kalan soru, izinli dört kitapta doğrudan nöron tanımı
  olmadığı için güvenli `not_found` döndürür. Bu sonradan yapılan değerlendirme
  ham doğru sayısına eklenmez.
- Kaynak dışı işlev ekleyen adversarial anlamsal denetim: **2/2 ret**.
- Deterministik koruyucu: **8/8** hatalı iddia ve **3/3** hatalı kompozisyon
  reddedildi; önbellek tahrif testleri de geçti.
- Dört kitaplı deterministik retrieval testi: **62/62** ve 20 tekrarda tek hash;
  p95 **4,84 ms**.

Holdout farklı ailelerde hücresel nörofizyoloji, öğrenme-bellek, ölçüm yöntemi,
sistemlerarası ilişkiler, otonom sinir sistemi, uyku, nöroanatomi, temel klinik
nörobilim, bilgi sınırı ve güvenlik sorularını kapsar. Bu, ürün kullanıcısından
bağımsız dış doğrulama değil, **internal locked holdout** testidir.

## Ayrıntılı yanıt gecikmesi ve önbellek

`dna-grounding-cache@2`, soru veya klinik veri saklamaz. Anahtar; kaynak
cümlesinin SHA-256 değeri, model revizyonu, yalnız o cümleyle ilgili terim
sözlüğü ve denetim/kompozisyon politika sürümlerine bağlıdır. Yalnız bütün
kapılardan geçmiş çeviri ve kompozisyonlar yazılabilir; hash veya audit kararı
değiştirilmiş kayıtlar reddedilir.

Aynı ayrıntılı aksiyon potansiyeli yanıtında son soğuk-sıcak koşu:

- Soğuk çalışma: **8.874 ms**, dört onaylı önbellek kaydı oluşturdu.
- Sıcak çalışma: **258 ms**, model üretimi **0 ms**.
- İçerik hash'i aynı kaldı; duvar saati hızlanması **34,39 kat**.
- Tam sıcak geliştirme seti: medyan **160 ms**, p95 **197 ms**.
- Tam sıcak holdout: medyan **163 ms**, p95 **177 ms**.

Bu ölçümler tek kullanıcı ve yerel makine içindir; eşzamanlı üretim kapasitesi
ve sürekli açık sunucu maliyeti hakkında kanıt oluşturmaz.

Güncel makine tarafından okunabilir sonuçlar SSD'deki `manifest.json` ve
`test-report.json` dosyalarındadır. Test sayıları geliştirme kanıtıdır; bağımsız
bilimsel doğrulama, klinik geçerlik veya pazarlama için “eğitilmiş model” kanıtı
değildir.

## Bilinçli sınırlar ve sonraki kapı

- Çok pasajlı sentez cümle düzeyindedir: her olgusal cümle tek bir pasajla
  desteklenir. Kaynaklar arasında örtük neden-sonuç veya zincirleme biyolojik
  mekanizma kurulmaz.
- İlk kez görülen pasajların çeviri ve anlamsal denetimi saniyeler sürebilir.
  Onaylı pasaj önbelleği ayrıntılı yanıtı yüzlerce milisaniyeye indirir; yine de
  üretim sunucusu ve eşzamanlı yük kararı verilmeden canlı kullanım için uygun
  değildir.
- `reference_only` kitaplar bilimsel iddia otoritesi olarak yükseltilmez.
- Yerel Mac geliştirme makinesidir. Bilgisayar kapalıyken üretim servisi olamaz;
  ileride sürekli açık bir çalışma ortamı ayrıca seçilmelidir.
- DNA kitabı ve dış bilim paketi kesinleşmeden ürün bilgisi ile genel bilim
  birleştirilmez.
- Canlıya geçiş için daha geniş bağımsız holdout, Türkçe dil kalite incelemesi,
  eşzamanlı kullanıcı yük testi ve mevcut vaka güvenlik kapılarının yeniden
  doğrulanması gerekir.

Kaynaklar:

- [Apple MLX LM](https://github.com/ml-explore/mlx-lm)
- [Qwen3-4B-Instruct-2507 üst modeli](https://huggingface.co/Qwen/Qwen3-4B-Instruct-2507)
- [MLX 4-bit dönüşümü](https://huggingface.co/mlx-community/Qwen3-4B-Instruct-2507-4bit)
