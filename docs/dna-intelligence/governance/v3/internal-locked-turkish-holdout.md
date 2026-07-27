# Internal Locked Turkish Holdout

Bu paket, external-science adapter ve retrieval ayarlarından önce hazırlanmış iç kör değerlendirme setidir. Etiketi `internal_locked_holdout_not_independent_human_validation` değeridir. Codex çoklu kontrolünden geçmiş bir iç mühendislik değerlendirmesidir; bağımsız insan veya klinik validasyon değildir.

## Kapsam ve bölünme

Toplam 126 öğe ve 14 konu vardır:

- `natural_supported`: 70 (her konu için 5 doğal Türkçe soru)
- `hard_neighbor`: 14
- `ambiguous`: 14
- `unsupported`: 14
- `safe_theory_control`: 14

Tam soru, referans cevap ve claim/passage/source bağları yalnız ResearchSSD üzerindeki mühürlü artefaktta bulunur. Repo ve komut çıktıları ham soru veya cevap içermez. Artefakt runtime ya da release için uygun değildir ve adapter/retrieval tuning süreci tarafından okunamaz.

## Körlük ve ilk resmî skor

Adapter kodu, lexical kurallar, eşikler, kaynak paketi ve değerlendirilecek sürüm önce freeze edilir. Freeze kaydı oluşturulduktan sonra mühürlü set ilk resmî skor için yalnız bir kez açılır ve tek değerlendirme koşusu yapılır. Sonuç görüldükten sonra aynı set geliştirme veya tuning girdisine dönemez. Bir bütünlük olayı koşuyu geçersiz kılarsa olay kaydı tutulur ve yeni, ayrı hash'li bir set hazırlanır; mevcut set üzerinde yeniden tuning yapılmaz.

## Repo manifest sözleşmesi

Repo yalnız `internal-locked-turkish-holdout-current.json` manifestini taşır. Verifier aşağıdaki alanları exact-key olarak doğrular; eksik veya fazladan alan fail-closed sonuç üretir:

- Üst düzey: `schemaVersion`, `label`, `artifact`, `authorities`, `counts`, `splits`, `privacyBoundary`, `validation`
- `artifact`: `researchSsdRelativePath`, `sha256`, `byteCount`
- `authorities`: candidate package, development ledger ve prebook draft için SSD relative path ile SHA-256 alanları
- `counts`: `total`, `topics`, `answerable`, `clarification`, `unsupported`
- `splits`: beş sabit split adı ve sayısı
- `privacyBoundary`: repo payload yokluğu, yalnız SSD saklama, tuning görünmezliği, runtime/release ve bağımsız insan doğrulaması sınırları
- `validation`: overlap, determinism, tamper, izin modu, symlink, atomik yazım ve no-fallback kapıları

Manifest soru metni, cevap metni, claim önerme metni veya klinik içerik taşımaz.

## Verifier kapıları

`npm run chat:internal-locked-holdout:ssd` aşağıdakileri yeniden hesaplar ve herhangi bir uyuşmazlıkta non-zero çıkar:

- Artefakt byte sayısı, dış SHA-256, iç payload SHA-256 ve item hash'leri
- 126 toplam, split sayıları ve konu başına 7 cevaplanabilir öğe
- Expected topic, allowed claim, forbidden topic, answerability, query kind, yaş, nedensellik ve güvenlik sınırları
- Development ledger, prebook draft ve repo içindeki geliştirme sorularına karşı exact, Türkçe-normalize, semantic-family/provenance ve deterministic near-duplicate overlap sıfırı
- Aynı item kümesinin 20 tekrarda tek hash üretmesi
- ResearchSSD dışında local fallback olmaması
- Parent-chain symlink escape ve leaf symlink reddi
- Artefaktın düzenli dosya ve `0600` izin modunda olması
- Hash, byte, mode ve repo manifest drift tamper denemelerinin fail-closed reddi

Verifier artefaktı değiştirmez ve ham soru/cevapları stdout, stderr veya repo dosyalarına yazmaz.
