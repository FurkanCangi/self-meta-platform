# DNA owner kitabı taslak alım hattı

Bu hat, henüz tamamlanmamış DNA kitabı bölümlerini değiştirmeden denetlenebilir
bir aday pakete dönüştürür. Çıktı bir eğitim veya yayın onayı değildir. Aktif
motor `dna-chat-engine@2 / v2_legacy` olarak kalır.

## Ne yapar?

- `DNA_OWNER_BOOK_DRAFT_ROOT` altındaki dokuz DOCX'i doğal bölüm sırasıyla okur.
- Her kaynak dosyanın bayt uzunluğunu ve SHA-256 değerini işlem öncesinde ve
  sonrasında doğrular.
- Paragraf ve tabloları OOXML gövdesindeki gerçek sıralarıyla çıkarır.
- Bölüm, başlık, paragraf/tablo konumu, kanonik pasaj hash'i ve üretilmiş
  kanonik artefakt bayt aralığını kaydeder.
- Dış bilim, DNA ürün bilgisi, güvenlik sınırı, klinik örnek, tanım,
  karşılaştırma, yanlış yorum, klinik düşünme sorusu ve anlatı bağlamını ayrı
  aday türlerde tutar.
- Kaynakları DOI veya bibliyografik kimlik üzerinden tekilleştirir; metin içi
  yazar-yıl atıflarını yalnız aynı bölümün kaynakçasına bağlar.
- Sözlük, yanlış yorum ve klinik düşünme sorularından yalnız `draft_unsealed`
  benchmark adayları üretir.

## Nereye yazar?

Tam metin ve yapılandırılmış kayıtlar yalnız şu SSD kökünün altındadır:

`$RESEARCH_SSD_ROOT/Outputs/SelfMetaAI/dna-intelligence/owner-book-draft/<package-sha256>`

Her paket değiştirilemez bir hash dizinidir. Aynı kaynaklar ve aynı alım
kuralları tekrar çalıştırıldığında aynı paket kullanılır. Kaynakta tek bayt
değişirse yeni bir kaynak kümesi ve paket kimliği oluşur; eski paket silinmez.

Repoda yalnız
`docs/dna-intelligence/governance/v3/owner-book-draft-manifest.json` bulunur.
Bu dosya tam metin, kaynakça metni, tablo hücresi veya benchmark sorusu taşımaz;
bölüm başlıklarını da içermez; yalnız hash, sayım, dosya adı ve güvenlik durumu
taşır. Komut satırı çıktısı da mutlak kaynak, paket veya repo yolu yayımlamaz.

## Yetki sınırı

Üretilen bütün kayıtlar için aşağıdaki değerler zorunludur:

- `ownerApproval=false`
- `runtimeEligible=false`
- `releaseEligible=false`
- `answerEligible=false`

Kitaptaki DNA sentezi `dna_product_candidate` olabilir; fakat sahibin nihai
kitap sürümü ve pasajları onaylanmadan `owner_approved` değildir. Kitaptaki
bilimsel atıf, iddianın kaynağa sadakat denetimini geçmiş sayılmaz. Kitaptaki
güvenlik cümlesi de sürümlü ürün politikasının yerine geçip `policy_enforced`
olamaz.

Dokuz ayrı DOCX, mevcut tek-artefaktlı `dna-owner-book-lock@1` sözleşmesine
sessizce final kitap gibi verilmez. Kitap tamamlandığında deterministik final
artefakt hazırlanacak, kullanıcı o kesin sürümü onaylayacak ve claim-pasaj
bağları iki ayrı hash ile yeniden kurulacaktır.

## Komutlar

```bash
npm run chat:owner-book-draft:test
npm run chat:owner-book-draft:build
npm run chat:owner-book-draft:verify
npm run chat:owner-book-draft:status
```

Hepsini tek koşuda çalıştırmak için:

```bash
npm run chat:owner-book-draft:ssd
```

Kaynak yolu değişirse:

```bash
DNA_OWNER_BOOK_DRAFT_ROOT=/tam/yol npm run chat:owner-book-draft:ssd
```

SSD bağlı değilse işlem yerel diske sessizce düşmez; fail-closed durur.

## Taslak sürüm fark denetimi

Mevcut `current.json` işaretçisinin gösterdiği değiştirilemez SSD paketi ile
kaynak DOCX'lerden bellekte yeniden oluşturulan aday şu salt-okunur komutla
karşılaştırılır:

```bash
npm run chat:owner-book-diff:ssd
```

Yalnız karşılaştırmayı çalıştırmak için `npm run chat:owner-book-diff`, izole
fixture testleri için `npm run chat:owner-book-diff:test` kullanılır. Komut yeni
paket veya fark dosyası yazmaz, `current.json` değerini değiştirmez ve SSD bağlı
değilse yerel diske düşmez.

Çıktı eklenen, kaldırılan, değişen ve taşınan kayıtları; DOI farklarını;
güvenlik, DNA ürün bilgisi ve dış bilim adaylarına etkileri; kritik silmeleri ve
önceki kesin-artefakt onayının geçersiz olup olmayacağını gösterir. Kayıt
metinleri, kaynakça metinleri ve mutlak dosya yolları çıktıya alınmaz. Sonuç
`changeSetSha256` ile deterministik olarak mühürlenir. Bu denetim hiçbir kayda
owner onayı, runtime veya release yetkisi vermez.

## Finalizasyon ve onay çalışma tezgâhı

Doğrulanmış mevcut taslak paketteki kanonik artefakt, bölüm aralıkları ve yalnız
`dna_product_candidate` pasajları aşağıdaki komutla exact-book-lock uyumlu bir
aday pakete hazırlanır:

```bash
npm run chat:owner-book-finalization:ssd
```

Ayrı adımlar `chat:owner-book-finalization:test`,
`chat:owner-book-finalization:prepare` ve
`chat:owner-book-finalization:verify` komutlarıdır. Tam artefakt, exact bölüm ve
pasaj manifesti, pending claim-review kuyruğu ve owner declaration şablonu yalnız
şu SSD alanında tutulur:

`$RESEARCH_SSD_ROOT/Outputs/SelfMetaAI/dna-intelligence/owner-book-finalization-workbench/<workbench-sha256>`

Repoda yalnız hash, sayım ve kapalı yetki durumlarını içeren
`owner-book-finalization-workbench-manifest.json` tutulur. Claim metni otomatik
üretilmez. Declaration şablonunun durumu `pending_owner_action` kalır;
`owner_approved` değeri oluşturulamaz. Bütün owner approval, runtime, release,
answer ve activation alanları `false` kalır. Bu paket final kitabın gerçek owner
onayı veya claim incelemesi değildir ve mevcut runtime sicillerini değiştirmez.

## 24 Temmuz 2026 doğrulanmış taslak durumu

- 9 bölüm
- 1.502 kaynak konumlu aday kayıt
- 238 kaynakça girdisinden 210 tekil kaynak
- 185 benzersiz DOI
- 139 dış bilim adayı ve `%100` aynı-bölüm bibliyografik eşleşme
- 114 DNA ürün bilgisi adayı
- 182 güvenlik sınırı adayı
- 121 sözlük tanımı
- 56 klinik düşünme kaydı
- 252 mühürlenmemiş benchmark adayı
- tekrar eden kaynak kimliği: `0`
- çözülemeyen metin içi atıf: `0`
- mevcut 47 kayıtlı V3 kaynakla kesin DOI eşleşmesi: `9`
- yöntem kaydı ve dış-bilim aday zinciri bulunan kesin eşleşme: `3`
- owner onayı, runtime ve release yetkisi: `0`

Bu sayılar bibliyografik ve mühendislik denetimidir; iddia sadakati, klinik
geçerlik veya ürünün bilimsel doğrulanması değildir.

Dokuz DOI eşleşmesinin tamamı mevcut kaynak kimlik sicilinde doğrulanmıştır;
pasaj lisans kararı beşinde `cleared`, birinde `metadata_only`, üçünde
`restricted` durumundadır. Bunların üçü ayrıca mevcut çok-geçişli yöntem
değerlendirmesi ve `external_science_candidate` paketinde bulunur:
`review.porges-2021-polyvagal-theory`,
`pfc-cognitive-control-review-2022` ve
`chen-et-al-2024-self-regulation-measures`. Bu bağlar dosya ve kayıt hash'leriyle
tutulur; kaynak hakkında önceki denetim, kitaptaki belirli paragrafın o kaynağa
sadık olduğunu otomatik olarak kanıtlamaz ve hiçbir yetki miras alınmaz.

## Kitap tamamlandığında kalan kapılar

1. Nihai bölüm dosyalarının yeni hash paketi üretilecek.
2. Kullanıcı kesin sürüm, bölüm ve pasajları onaylayacak.
3. DNA ürün adayları owner onaylı pasajlara atomik claim düzeyinde bağlanacak.
4. Dış bilim adayları mevcut çok-geçişli kaynak sadakati, yöntem, yaş kapsamı,
   nedensellik ve lisans kapılarından geçecek.
5. Benchmark geliştirme ve kilitli holdout aileleri ayrılacak ve mühürlenecek.
6. Kesin aday motor güvenlik, mahremiyet, determinism, performans ve insan
   değerlendirme kapılarından geçmeden canary yayına alınmayacak.

## Yerel owner inceleme paketi

Kitap tamamlanmadan onay arayüzünün mühendisliği hazırlanmıştır. Aşağıdaki
komut, doğrulanmış güncel workbench içindeki 114 ürün pasajını bölüm ve pasaj
hash'lerine bağlı, çevrimdışı çalışan tek bir HTML dosyasına dönüştürür:

```bash
npm run chat:owner-book-review:build:ssd
npm run chat:owner-book-review:verify:ssd
npm run chat:owner-book-review:test:ssd
```

Arayüzde pasaj arama, bölüm filtresi, `kabul / düzenle / dışla` kararı, atomik
iddia taslağı ve not alanı bulunur. Tam metin yalnız ResearchSSD üzerinde
`0600` kipinde kalır; repo manifesti metin taşımaz ve sayfa ağ isteği yapamaz.
Tek dosyalık arayüzün stil ve betiği SHA-256 CSP izinlerine bağlıdır; `unsafe-inline`,
haricî kaynak, bağlantı ve form hedefi yetkisi verilmez.
Tarayıcıdan indirilen karar dosyası yalnız `decision draft` niteliğindedir:
`ownerApproval`, `runtimeEligible`, `releaseEligible`, `answerEligible` ve
`activationAllowed` değerlerinin tamamı `false` kalır. Bu araç owner beyanının,
bilimsel kaynak denetiminin veya yayınlama kapısının yerine geçmez.
