# Faz 12–13 — Yöntem değerlendirmesi ve kanonik kaynak

Bu katman, kaynağın yalnız başlığı veya özetinden “yüksek kaliteli” sayılmasını engeller. Kaynak kimliği, A–E soru önceliği ve lisans denetimi yöntem kalitesi değildir. Yöntem değerlendirmesi bunlardan ayrı tutulur.

## Faz 12: yöntem değerlendirmesi

`DnaMethodAppraisal`, çalışma tasarımı, örneklem, yaş/popülasyon, dahil/dışla koşulları, ölçümler, körleme, randomizasyon, kayıp veri, karıştırıcılar, çoklu karşılaştırmalar, etki büyüklüğü, güven aralığı, ön kayıt, tekrar edilebilirlik, finansman/çıkar çatışması, genellenebilirlik ve nedensellik sınırını kontrollü değerlerle kaydeder.

GRADE’den risk of bias, tutarsızlık, dolaylılık, belirsizlik ve yayın yanlılığı boyutları uyarlanmıştır. Bu uyarlama bir GRADE kesinlik derecesi değildir:

- Tek kaynak `high`, `moderate`, `low` gibi body-of-evidence kesinliği alamaz.
- Tutarsızlık ve yayın yanlılığı tek kaynak kaydında daima `not_assessed` kalır.
- Sayısal toplam kalite puanı üretilmez.
- Başlık, kaynak rolü veya yayıncı adına bakarak eksik yöntem alanı tamamlanmaz.
- `not_reported` ile `not_assessed` gerçek veri gibi yorumlanmaz.

`codex_multi_pass_audited` durumu sırasıyla `method_appraisal_a`, `method_appraisal_b` ve `method_appraisal_reconciliation` adlı üç yöntem değerlendirme geçişini gerektirir. Pass kimlikleri ve kanıt hash’leri benzersiz, zamanları A → B → uzlaştırma yönünde artan olmalıdır. Bunlar Faz 17–19’daki pasaj/iddia çıkarımı geçişlerinden ayrıdır; `blind_extraction_a`, `blind_extraction_b` veya claim uzlaştırması yöntem değerlendirmesini yetkilendiremez.

Biçim olarak geçerli bir SHA-256 değeri tek başına “gerçek kanıt” sayılmaz. Appraisal’ın kullandığı artefakt + içerik + locator üçlüsü güvenilir pasaj/artefakt kayıt kökünde; her pass kanıtı da ayrı pass kayıt kökünde bulunmalıdır. Son appraisal payload’ı aynı kaynak ve source-evidence hash’iyle derleme sırasında güvenilen appraisal kayıt köküne bağlanmalıdır. Üretim kayıt köklerinin üçü de şu anda boştur; bu yüzden aday appraisal’lar yalnız denetlenebilir taslak olarak kalır ve release yetkisi vermez. Pozitif yol yalnız testte açıkça enjekte edilen test kayıt köküyle sınanır.

`not_assessed` ve `pending_multi_pass` kayıtları çalışma tasarımı, örneklem, popülasyon, yaş veya yöntem kalitesi hakkında olumlu değer taşıyamaz; bu alanlar `not_assessed`/`not_reported` olarak kalır.

## Faz 13: kanonik şema

`NormalizedDnaSource`, mevcut kimlik, soru-öncelik ve bileşen-lisans kayıtlarını tek sözleşmeye dönüştürür. Mevcut öncelik kaydı tek kanonik rol taşıdığı için sözleşmedeki alan `sourceRole` olarak tekildir. DOI/PMID/PMCID/ISBN değerleri kanonik veya `null` olmak zorundadır. Kimlik doğrulama durumu ve kanıt hash’i, yayın sürümü, yayın rolü, correction durumu ve cohort çözüm durumu kanonik kayıtta kaybolmaz. Popülasyon ve yaş bilinmiyorsa tahmin yapılmaz; `not_reported` korunur. Yöntem tasarımı, kanıt düzeyi, konu kategorisi, claim sınırı ve bütünlük değerlendirmesi henüz yapılmadıysa `not_assessed` kalır.

İki ayrı hash tutulur:

- `evidencePayloadSha256`: o kaynak için kullanılan kimlik + öncelik + lisans kayıtlarını bağlar.
- `sourcePayloadSha256`: kanonik kaynak kaydının tamamını bağlar.

Kaynak artefakt hash’i repo snapshot’ında yoksa `artifactHashes` boş kalır. Yönetişim veya lisans kanıt hash’leri kaynak PDF/XML hash’i gibi yeniden etiketlenmez.

Gelecekte bir kaynak release pipeline’a alınacaksa kimliği `verified`, sürümü `version_of_record` veya uygulanmış `corrected`, correction/cohort durumu çözülmüş olmalıdır. Lisans durumu açıkça `approved_component_bound` olmalı, en az bir gerçek artefakt SHA-256 değeri bulunmalı ve kategori, kanıt düzeyi ile claim sınırı değerlendirilmiş olmalıdır. Kaynak release kaydı; source payload, identity evidence, source evidence ve gerçek registered method-appraisal payload hash’lerini birlikte bağlar. Appraisal kaydı eksik, başka kaynağa bağlı veya kendi güvenilir evidence/pass köklerinden geçemiyorsa kaynak release olamaz. Kısıtlı lisans, boş artefakt zinciri veya `not_assessed` alanları registry girdisi olsa bile release uygunluğu üretemez.

Kanonikleştirme girişi yalnız TypeScript türüne güvenmez. Priority kararları soru türü matrisiyle yeniden hesaplanır; yayın sürümü ve psikometrik rol kontrollü değer olmalıdır. Lisans yükümlülükleri boolean ve politika ile tutarlı olmalı; component/evidence kümeleri eksiksiz ve yalnız doğrulanmış değerlerden oluşmalıdır.

## Mevcut 47 kaynak için sonuç

19 Temmuz 2026 snapshot’ı deterministik olarak normalize edilmiştir:

| Durum | Sayı |
|---|---:|
| Normalize edilen kaynak | 47 |
| Yöntem değerlendirmesi bekleyen | 47 |
| Yaş kapsamı `not_reported` | 47 |
| Popülasyon `not_reported` | 5 |
| V3 release pipeline için uygun | 0 |

Bu `0`, kaynakların yanlış olduğu anlamına gelmez. Tam metin yöntem değerlendirmesi, bütünlük kontrolü, gerçek pasaj/claim provenance’ı ve sonraki release kapıları tamamlanmadığı için fail-closed sonuçtur.

Repo-safe `source-appraisal-normalization-snapshot.json` yalnız kaynak kimlikleri, hash’ler, durumlar ve toplu sayımları içerir. Ham metin, özet, kimlik kanıt payload’ı, lisanslı dosya veya mutlak SSD yolu içermez.

Test komutu:

```bash
npm run chat:source-appraisal
```

Test; 47 kayıt normalizasyonunu, giriş sırasından bağımsız deterministik çıktıyı, eksik yaş/popülasyonun korunmasını, malformed identity için kontrollü hatayı, pending kayıtta yöntem bulgusu taşınamamasını, pass benzersizliği/sırasını, sahte “high quality” alanının reddini, tek kaynaktan kesinlik iddiasının reddini ve boş üretim güven kökleri nedeniyle kendiliğinden runtime yetkilendirilememesini doğrular. Cross-binding’in pozitif yolu yalnız açık `explicit_test_only` kayıt köküyle test edilir; üretim release sayısı sıfır kalır.
