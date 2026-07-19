# DNA Intelligence V3 — Faz 20–24 İddia İnceleme Kapıları

Bu sözleşme, Faz 14–19 hattından gelen `candidate_only` iddialar için beş ayrı denetim kaydını tanımlar. Modül bilimsel metni otonom olarak yorumlamaz, çevirmez veya onaylamaz. Ayrı denetim süreçlerinde hazırlanmış yapılandırılmış kararları kaynak, artefakt, pasaj ve iddia hash’lerine bağlar; eksik veya güven registry’sinde bulunmayan her kararı kapalı durumda reddeder.

Beş kapının tamamından geçmek yalnız `eligible_for_phase_25_conflict_processing` sonucunu verir. Bu sonuç bilimsel kabul, `released` lifecycle durumu veya çalışma zamanı yetkisi değildir. Bütün çıktılarda `runtimeEligible: false` korunur.

## Ortak güven ve provenance kuralları

Her inceleme kaydı:

- aynı kaynak, artefakt, atomik iddia ve tam pasaj kümesine bağlanır;
- iddia ve pasaj bütünlük hash’lerini yeniden doğrular;
- kendi payload SHA-256 değerini ve ayrı kanıt SHA-256 değerini taşır;
- sabit bir reviewer rolüne, benzersiz review kimliğine ve kesin UTC zamanına sahiptir;
- üretim için derlenmiş trust registry’sindeki birebir kayıt olmadan geçemez.

Fazlar sırasıyla 20, 21, 22, 23 ve 24 olarak yürütülür. Review kimlikleri ile kanıt hash’leri tekrar edemez ve zamanlar kesin biçimde artmalıdır. Bu kontroller farklı bağlam kullanımını kayda bağlar; bağımsız insan veya otonom bilimsel inceleme kanıtı değildir.

Üretim registry’si bilerek boştur. Sentetik olumlu yol yalnız `explicit_test_only` registry, `DNA_CLAIM_REVIEW_TEST_FIXTURE_MODE=1` ve production dışı çalışma ortamında çalışır. Caller’ın bir alana `approved`, `entailed` veya `preserved` yazması kendi başına güven üretmez.

## Faz 20 — Kaynak sadakati

Zorunlu soru, iddianın bağlı gerçek pasajda gerçekten bulunup bulunmadığıdır. `entailed` dışındaki bütün entailment durumları bloke edilir. Şu yedi olası sorun ayrı ayrı incelenmeli ve hepsi `absent` olmalıdır:

- pasajdan daha geniş kapsam;
- ilişkinin nedenselliğe yükseltilmesi;
- başka yaş grubuna genelleme;
- hayvan/in-vitro sonucunun insan sonucuna çevrilmesi;
- grup ortalamasının bireysel vakaya aktarılması;
- teorinin olgu gibi sunulması;
- kaynak türünün yanlış etiketlenmesi.

Bu kayıt passage–claim entailment denetiminin sonucunu saklar; serbest metin semantik kararını kendi başına üretmez.

## Faz 21 — Yöntem desteği

İddia yalnız güven registry’sine bağlanmış ve `eligible_for_body_synthesis_with_limits` durumundaki yöntem değerlendirmesiyle incelenebilir. Çalışma tasarımı, korelasyon–nedensellik sınırı, ölçüm geçerliği, örneklem ve yaş, etki büyüklüğü/belirsizlik ve çalışma bağlamı ayrı alanlardır. Her biri `adequate_with_stated_limits` olmadıkça kayıt ilerlemez.

Bu kapı tek kaynağa GRADE kesinliği atamaz. Önceki yöntem değerlendirmesini değiştirmez; yalnız o değerlendirmenin belirli iddiayı destekleyip desteklemediğini kaydeder.

## Faz 22 — Karşı kanıt ve adversarial denetim

Denetim, yalnız doğrulayıcı kaynak aramaz; karşıt sonuç, daha güçlü sentez, tartışmalı teori, yayın yanlılığı, ölçüm eleştirisi, tek-ekol bağımlılığı, yeni bulgunun sonucu değiştirmesi ve alternatif açıklamayı ayrı ayrı arar.

İncelenen kaynak kimlikleri, arama kesim zamanı ve evidence-set hash’i zorunludur. Kıyaslama ilkesi sabittir: yöntemsel kalite, yalnız yenilik veya çalışma sayısından üstündür. `not_assessed` ilerlemeyi engeller. Maddi karşı kanıt bulunan ve diğer kapıları tamamlanan kayıt `contested` olarak yalnız Faz 25 çelişki çözümüne ilerleyebilir; çalışma zamanına çıkamaz. Geçen durumun anlamı “karşı kanıt yoktur” değil, “denetlenmiş evidence set içinde maddi karşı kanıt bulunmadı”dır.

## Faz 23 — Klinik güvenlik

Tanı, ayırıcı tanı, tedavi/ilaç, prognoz, yeni klinik eşik, bireysel biyolojik mekanizma, davranıştan beyin/otonom çıkarım, belirsiz yaş ve kesin nedensellik izlenimi ayrı kontrollere sahiptir. Aşağıdaki durumlar türetilmiş otomatik blocker üretir:

- tamamlanmamış inceleme;
- yasak klinik içerik;
- tek kaynağa dayanan kritik klinik sonuç;
- açıklanmamış istatistik;
- belirsiz/yasak lisans;
- çözülemeyen bilimsel çatışma.

Caller’ın türetilmesi gereken bir blocker’ı listeden çıkarması incelemeyi geçirmez; liste yeniden hesaplanır ve birebir eşleşmek zorundadır.

## Faz 24 — İngilizceden Türkçeye aktarım

Bağlı İngilizce pasajların tam orijinal metni, içerik hash’i ve provenance hash’i inceleme kaydında korunur. Onaylı Türkçe anlatım ile ayrı back-translation zorunludur. Kavramsal eşdeğerlik, ters anlam, anlam daralması/genişlemesi, nedensellik gücü ve kiplik ayrı alanlarda değerlendirilir.

Sekiz terim ailesinin tamamı her kayıtta bulunur:

- association / causation;
- regulation / control;
- arousal / activation;
- recovery / restoration;
- awareness / accuracy;
- predict / explain;
- may / can / is;
- evidence / proof.

Kaynak pasajda bulunan İngilizce terimler deterministik olarak tekrar taranır. Bulunan bir terim ailesi `not_present` olarak gizlenemez. İlgili terimler için kavram korunumu, ters-anlam kontrolü ve kapsam değişikliği denetimi tamamlanmadan Türkçe aktarım geçmez.

## Mevcut gerçek durum

- Üretim trust registry’sindeki Faz 20–24 inceleme kaydı: **0**
- Gerçek corpus üzerinde tamamlanmış Faz 20–24 claim paketi: **0**
- Canlı V3 iddiası: **0**
- Sentetik test yolu: yalnız şema, fail-closed davranış, provenance ve adversarial örnekleri doğrular

Dolayısıyla bu fazlarda tamamlanan şey denetim mimarisi ve yürütme sözleşmesidir; gerçek bilimsel claim’lerin üçüncü–altıncı geçiş ve Türkçe denetiminin tamamlandığı ileri sürülmez.

Doğrulama komutları:

```bash
npx tsc --noEmit --target ES2022 --module commonjs --moduleResolution node --esModuleInterop --skipLibCheck --strict scripts/run-dna-claim-review-gates-tests.ts
npx tsx scripts/run-dna-claim-review-gates-tests.ts
```
