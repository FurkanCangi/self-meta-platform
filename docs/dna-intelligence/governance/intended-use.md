# DNA Intelligence — Amaçlanan Kullanım Sözleşmesi

Sürüm: `dna-intelligence-intended-use@1`

Bu sözleşmenin konusu, **DNA Intelligence** platformu içindeki **DNA Asistanı** bileşenidir. Dynamic Neuro-Regulation Approach eğitim çerçevesi, deterministik değerlendirme/rapor motoru ve sohbet bileşeni birbirinden ayrı ürün katmanlarıdır. Bu belge sohbet bileşeninin klinik ve teknik sınırını tanımlar.

Katmanların kanonik ayrımı şöyledir:

- **Dynamic Neuro-Regulation Approach:** terapiste yönelik eğitim ve klinik düşünme çerçevesidir; yazılım değildir.
- **DNA Intelligence:** değerlendirme verisini yapılandıran ve terapist incelemesine açık deterministik rapor taslağı üreten çalışma platformudur; klinik öncelik veya müdahale kararı vermez.
- **DNA Asistanı:** aşağıdaki izinli ve yasak davranışlara bağlı, kaynak kontrollü bilgi bileşenidir.

Makine-okunur kanonik sözleşme `src/lib/dna/chat/intendedUse.ts` dosyasındadır. Denetim kopyası `docs/dna-intelligence/governance/intended-use-contract.json`, otomatik davranış matrisi ise `scripts/dna-chat-fixtures/intended-use-matrix.json` dosyasındadır. `npm run chat:intended-use` bu üç kaynağın paritesini ve kullanıcı yüzeylerini doğrular.

## Amaçlanan kullanıcı ve kullanım

DNA Asistanı, terapist paneline erişimi olan ve oturumu doğrulanmış kullanıcıların:

- katalogda bulunan nörofizyoloji ve düzenleme kavramlarını kaynak sınırlarıyla incelemesine,
- açıkça kayıtlı kavramları ve tek adımlı ilişkileri karşılaştırmasına,
- kanıt düzeyini, yaş kapsamını, yapılandırılmış örneklem sınırını ve iddia sınırını görmesine,
- DNA konseptiyle yalnız kayıtlı ve sınırlandırılmış ilişkiyi tartışmasına,
- yalnız sahipliği doğrulanan seçili raporun güvenli yapılandırılmış bulgularını görmesine,
- rapor bulgusunu genel literatürden ayrı ve biyolojik ölçüm iddiası olmadan değerlendirmesine,
- kullanılan kaynak kayıtlarını incelemesine,
- bilgi bulunmadığında sistemin tahmin yerine açıkça geri çekilmesine

yardımcı olan deterministik, kaynak kontrollü bir bilgi asistanıdır.

DNA eğitiminin tamamlanması mesleki kullanım beklentisidir; mevcut sohbet rotası bu eğitim durumunu teknik bir erişim koşulu olarak doğrulamaz. Bu nedenle belge, uygulanmayan bir eğitim yetkilendirme kontrolü varmış gibi yorumlanmamalıdır.

## Yasak kullanımlar

DNA Asistanı:

- tanı veya ayırıcı tanı üretmez,
- tedavi, terapi, müdahale, ev programı veya seans planlamaz,
- ilaç veya doz önermez,
- bireysel prognoz vermez,
- kesin neden veya etiyoloji çıkarmaz,
- davranıştan ya da rapordan beyin bölgesi, HRV, kortizol veya otonom durum çıkarmaz,
- ham cevap, anamnez, snapshot, trace, audit içeriği, gizli eşik ya da kural göstermez,
- başka terapistin vakasına erişmez,
- birden çok rapordan karşılaştırmalı klinik profil üretmez,
- sohbet mesajlarından kendiliğinden öğrenmez ve canlı kataloğu değiştirmez.

Doğrudan tanımlayıcı veri, kriz yönetimi ve prompt/reasoning çıkarma girişimleri ayrıca güvenlik kapılarıyla engellenir.

## Veri, kanıt ve denetim sınırı

Sohbet metni kalıcı geçmişe kaydedilmez. Güvenlik ve erişim denetimi için istek kimliği, mod, intent etiketi, yanıt sınıfı, motor ve sözleşme sürümü, ret durumu ve kaynak kimlikleriyle sınırlı metadata tutulabilir. Bu kayıt soru veya cevap metni, danışan kodu, rapor kimliği, skor ya da vaka bulgusu içermez. Vaka sorusunda rapor sahipliği her istek için yeniden doğrulanır; teori sorusunda seçili rapor kimliği bulunsa bile rapor içeriği okunmaz.

Kaynak kartındaki çalışma türü ve yaş kapsamı gösterilir. Ayrıntılı örneklem büyüklüğü veya örneklem özelliği katalogda yapılandırılmamışsa sistem bunu açıkça söyler; eksik veriyi tamamlamaz. `source_verified_expert_pending` kaydı insan uzman onayı anlamına gelmez.

Sistem çalışma zamanında harici LLM, model API'si veya internet araması kullanmaz. Yanıtlar klinik kararın ve kullanıcı mesleki sorumluluğunun yerine geçmez.

## Yönetişim dayanağı

Amaçlanan kullanımın, sınırların, testlerin ve yaşam döngüsü izlemesinin açıkça belgelenmesi yaklaşımı şu çerçevelerle uyumludur:

- [WHO — Ethics and governance of artificial intelligence for health](https://www.who.int/publications/i/item/9789240078871)
- [NIST AI Risk Management Framework — Core](https://airc.nist.gov/airmf-resources/airmf/5-sec-core/)

Bu atıflar ürün için düzenleyici onay veya bağımsız klinik validasyon iddiası değildir.
