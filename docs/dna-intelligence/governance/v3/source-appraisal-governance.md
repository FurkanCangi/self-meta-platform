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

## 20 Temmuz 2026 aday korpus ve yöntem pilotu

Source-library içindeki 26 manifest-bağlı JATS artefaktı, üst seviye `article-meta` lisans alanı ve gerçek Creative Commons URL'si üzerinden yeniden denetlenmiştir. Yalnız anlatı paragrafları adaylaştırılır; tablo, şekil, ek materyal, ölçek ve test maddeleri kapsam dışıdır. Güncel aday korpus 1.724 paragraf, 401 dışlama ve bütünlük + passage-lisans kapılarını birlikte geçen 24 yöntem workpack'i içerir. Workpack ve appraisal kayıtlarının hiçbiri tek başına runtime veya release yetkisi vermez.

`dna-v3-candidate-jats-corpus@3`, `dna-v3-method-review-workpack@2` ve `dna-v3-method-review-workpack-index@3` yalnız karar değerini değil; kullanılan bütünlük audit dosyasını, bileşen-lisans audit dosyasını ve bunların iki committed repo-safe yönetişim snapshot'ındaki güven köklerini tam dosya SHA-256 değerleriyle bağlar. Her kaynak girdisi ayrıca source kaydı, bütünlük audit kaydı/kararı ve lisans audit kaydı/kararı hash'lerini taşır. Audit kararı değiştirilip dosya yeniden hash'lense bile committed snapshot bağı uyuşmadan aday korpus üretilemez. Snapshot-audit ayrışması ile yinelenen veya çelişkili source ID'leri fail-closed reddedilir. Index'te bulunmayan eski veya artık uygun olmayan bir workpack güvenilir girdi sayılamaz.

Çıktı-körlenmiş Codex çoklu-geçiş hattında A ve B geçişleri birbirinin sonucunu görmeden 20 yöntem alanını ve 5 uyarlanmış GRADE boyutunu inceler. Bu düzen süreç içi anchoring riskini azaltır ancak bağımsız insan/hakem değerlendirmesi değildir; kanonik etiketi `output_blinded_codex_multi_pass_not_independent` olarak tutulur. Zincir otomatik olarak yeniden açılıp hash, locator, yöntem alanı ve güvenlik sınırları bakımından doğrulanır. Güncel kaynak bazlı ilerleme sayıları, sabit doküman metninden değil `prebook-readiness-current.json` kanıtından okunur.

## Ölçeklenebilir batch değerlendirme hattı

Yeni değerlendirmeler `dna-method-appraisal-batch-contract@1` sözleşmesine göre yürür. Pass A ve Pass B artık aynı `dna-method-appraisal-review-pass@2` şemasını kullanır; rol dışında alan farkına izin verilmez. `sampleSize` tek ve belirsiz bir toplam taşımaz: `studyCount`, `participantCount` ve `datasetCount` ayrı tutulur. Sonuçlara göre değişen veya tekilleştirilmemiş sayılar toplanamaz ve sınır notu olmadan toplam gibi derlenemez.

Her çalışma tasarımı exact alias ile sürümlü bir tasarım profiline yönlendirilir. Profil yalnız sorulacak yöntem sorularını ve varsayılan uygulanabilirlik çerçevesini belirler; eksik bulgu üretmez. A/B geçişlerinden sonra uzlaştırma ve ayrı bir `source_fidelity` geçişi zorunludur. Fidelity geçişi; bütün bulguların kaynağa sadakatini, locator çözümünü, sayı türlerinin karıştırılmadığını, desteklenmeyen mekanizma eklenmediğini ve sınırların korunduğunu doğrulamadan kanonik aday derlenemez.

SSD run-index, workpack indexi ile sözleşme/tasarım profili hash'lerini bağlar ve her kaynak için `queued` → A/B → uzlaştırma → fidelity → `candidate_complete_unregistered` ilerlemesini kaydeder. Run-index bir güven kökü veya release yetkisi değildir. Ayrı registration hattı; tamamlanmış zinciri, bütün kanıt locator'larını ve muhafazakâr kanonik alan eşlemesini yeniden doğrular. Başarılı kayıt yalnız `registered_for_method_pipeline` anlamına gelir. Ürettiği SSD appraisal/trust-registry derlemesi claim, passage, V3 paket, runtime veya release yetkisi vermez; repo-pinned runtime kayıt kökü boş kalır.

Registration worker beklenen önceki index hash'ini CAS ile denetler, kilit altında yeniden kontrol eder, karar/sonuç/makbuz dosyalarını hash'lerle bağlar ve indexi son commit noktası olarak atomik yazar. Yarım yazımda yeni kaynak klasörü ve global derlemeler geri alınır. Durum doğrulaması makbuz oynama, eski batch artefaktı, eksik global registry, index dışı kaynak klasörü ve runtime/release bayrağı yükseltmesini kapalı biçimde reddeder.

## Aday pasaj kayıt kapısı

Yöntem hattına kaydedilmiş bir kaynak doğrudan claim veya canlı cevap kaynağı olamaz. `dna-candidate-passage-decision@1` kararı, seçilen her pasajı gerçek workpack dosyası ve payload hash'i, gerçek method-registration sonuç dosyası ve payload hash'i, kaynak artefaktı ve paragraf locatorlarıyla bağlar. Worker ham JATS'i yeniden parse eder; paragraf ve dışlama listesi workpack ile birebir değilse kayıt kapanır.

Pasaj yaşı yöntem appraisal yaş kapsamını, kanıt türü de appraisal çalışma tasarımını aşamaz. Aynı paragraf iki pasajda kullanılamaz. Lisans bileşeni `cleared` değilse, kaynak kaydı veya artefakt hash'i değişmişse, method-registration durumu geçersizse ya da karar CAS sırasında eskimişse işlem reddedilir. Başarılı sonuç yalnız `candidate_audit` otoritesinde saklanır; normal runtime trust denetimi bu otoriteyi özellikle yetkisiz sayar. Bu nedenle aday pasaj sayısı artsa bile V3 runtime ve release sayıları sıfır kalır.

Candidate-passage worker karar, sonuç ve makbuzu atomik kaydeder; global aday-pasaj listesi ile aday trust registry'sini yeniden derler. Durum denetimi güncel ham kaynaktan deterministik yeniden derleme yapar ve makbuz, method-registration, workpack, global registry veya index oynamasını fail-closed reddeder. `prepare` komutu yalnız kaynak, yöntem sınırları ve izinli paragraf listesini içeren aday inceleme paketi üretir; tek başına kayıt veya yayın durumu oluşturmaz.

## Kör aday-iddia çıkarımı

Kayıtlı aday pasajlar için A ve B kanallarına ayrı `dna-candidate-claim-review-packet@1` paketleri üretilir. Paket; izinli pasajları, kaynak yöntem sınırlarını, exact passage-registration hash'ini ve karşı kanalın çıktısının dışlandığı context commitment'ını taşır. DNA kitabı, DNA ilişki kayıtları ve karşı kanal çıktısı bu aşamanın girdisi değildir.

Bir claim proposition'ı pasajda kelimesi kelimesine bulunmalı, tek atomik önerme olmalı ve pasajın yaş kapsamı ile claim boundary'sini aynen korumalıdır. Paraphrase, desteklenmeyen nedensellik, DNA bağlantısı ve tek kaynaktan `high/moderate/low` body-of-evidence kesinliği reddedilir. Etki büyüklüğü ancak değer, metrik ve locator metni aynı pasajda doğrulanabiliyorsa taşınabilir. Nedensel dil kaynakta geçse bile claim karantinaya alınır.

Candidate-claim worker A/B sonuçlarını ayrı klasörlerde, hash-bağlı karar/sonuç/makbuz zinciriyle ve index CAS kilidiyle saklar. İkinci kanal geldiğinde durum yalnız `awaiting_reconciliation` olur; consensus veya yayın yetkisi oluşmaz. Yinelenen lane, eski passage kaydı, oynanmış makbuz, silinmiş global run collection veya packet/decision uyuşmazlığı fail-closed reddedilir. Aday claim authority runtime ve release için daima sıfırdır.

## Kör iddia uzlaştırması

`dna-candidate-claim-reconciliation-packet@1`, aynı kaynağın doğrulanmış A ve B sonuçlarını ve dosya hash'lerini tek bir yeniden inceleme bağlamında toplar. Uzlaştırıcı her iddiayı ya birebir bir eşleştirme içinde ya da gerekçeli `unmatched` kaydıyla kapsamak zorundadır. Zorla birleştirme ve çoğunluk oyu yoktur. Pasaj, proposition, yaş kapsamı, nedensellik, kanıt seviyesi veya claim boundary uyuşmazlığı consensus sayılmaz; yapısal veya kaynak bağındaki sorun karantinaya gider.

Worker; karar, sonuç ve makbuzu SSD'de atomik ve CAS korumalı olarak saklar. Kayıtlı A/B sonuçları sonradan bozulursa durum denetimi uzlaştırmayı da geçersiz sayar. `exact_consensus_candidate` bile yayınlanmış bilgi değildir; bağımsız kaynak sentezi, claim yeniden incelemesi ve yayın kapıları tamamlanmadan runtime veya release yetkisi vermez.

Transactional worker bilimsel bulgu üretmez. `prepare`, Pass A ve Pass B için yalnız izin verilen workpack/contract/profile girdilerini taşıyan ayrı, SHA-bağlı packet'ler hazırlar. `ingest-pass`, `ingest-reconciliation` ve `ingest-fidelity`; dışarıda hazırlanmış JSON'u gerçek workpack paragraph kimlikleri ve exact authority hash'leriyle doğrular. Her kabul edilen artefakt ayrı revision ve evidence receipt olarak append-only saklanır; run-index güncellemesi beklenen index hash'iyle CAS ve lock altında yapılır. Bir workpack, contract veya profile değişirse kaynak etkili olarak `stale_inputs` olur ve mutasyon reddedilir. `compile` yalnız temiz fidelity geçişinden sonra deterministik `candidate_complete_unregistered` üretir; trust registry, runtime veya release yetkisi vermez.

Worker kullanımı:

```bash
npm run chat:method-appraisal-worker:build
npm run chat:method-appraisal-worker:cli -- status --strict
npm run chat:method-appraisal-worker:cli -- prepare --source=<sourceId> --role=A --expected-index-sha=<sha256>
npm run chat:method-appraisal-worker:cli -- ingest-pass --source=<sourceId> --role=A --input=<pass.json> --packet=<packet.json> --expected-index-sha=<sha256>
npm run chat:method-appraisal-worker:cli -- ingest-reconciliation --source=<sourceId> --input=<reconciliation.json> --expected-index-sha=<sha256>
npm run chat:method-appraisal-worker:cli -- ingest-fidelity --source=<sourceId> --input=<fidelity.json> --expected-index-sha=<sha256>
npm run chat:method-appraisal-worker:cli -- compile --source=<sourceId> --expected-index-sha=<sha256>
```

Repo-safe `source-appraisal-normalization-snapshot.json` yalnız kaynak kimlikleri, hash’ler, durumlar ve toplu sayımları içerir. Ham metin, özet, kimlik kanıt payload’ı, lisanslı dosya veya mutlak SSD yolu içermez.

Test komutu:

```bash
npm run chat:source-appraisal
npm run chat:evidence-candidates:ssd
npm run chat:method-appraisal-pilot:ssd
npm run chat:method-appraisal-batch:ssd
npm run chat:method-appraisal-worker:ssd
npm run chat:method-appraisal-registration:ssd
npm run chat:candidate-passages:ssd
npm run chat:candidate-claims:ssd
npm run chat:candidate-claim-reconciliation:ssd
```

Test; 47 kayıt normalizasyonunu, giriş sırasından bağımsız deterministik çıktıyı, eksik yaş/popülasyonun korunmasını, malformed identity için kontrollü hatayı, pending kayıtta yöntem bulgusu taşınamamasını, pass benzersizliği/sırasını, sahte “high quality” alanının reddini, tek kaynaktan kesinlik iddiasının reddini ve boş üretim güven kökleri nedeniyle kendiliğinden runtime yetkilendirilememesini doğrular. Cross-binding’in pozitif yolu yalnız açık `explicit_test_only` kayıt köküyle test edilir; üretim release sayısı sıfır kalır.
