# Development Turkish Retrieval V2

## Amaç ve otorite

Bu hat, dış bilim aday paketindeki 14 konu için Türkçe soru yönlendirme esnekliğini
geliştiren ve yalnız geliştirme verisiyle ölçen deterministik bir retrieval
fizibilitesidir. Canlı yanıt motoru, yayın kararı, DNA sahibi kitabı veya bağımsız
bilimsel doğrulama değildir.

Tüm V2 çıktılarında şu sınırlar zorunludur:

- `runtimeEligible=false`
- `releaseEligible=false`
- `activationAllowed=false`
- `ownerBookAuthority=false`
- `lockedHoldoutAccessed=false`
- `officialEvaluationAuthority=false`

## İzinli girdiler

Hat yalnız şu üç girdiyi kullanır:

1. mühürlü `external_science_candidate` paketi,
2. mevcut dış bilim offline geliştirme QA probları,
3. bu hat için oluşturulan SSD-only Türkçe geliştirme soru bankası.

Önceki frozen adapter, evaluator, konfigürasyon veya sonuçlar V2 ayarlama otoritesi
değildir ve değiştirilmez. Resmî tek seferlik değerlendirme bu hatta çalıştırılmaz.

## Geliştirme bankası

Tam soru metinleri yalnız ResearchSSD üzerinde ve `0600` kipinde tutulur:

`Datasets/DNA-Intelligence/evaluation/development-banks/turkish-retrieval-v2/development-bank.json`

Banka 560 yeni geliştirme sorusu ile 148 izinli eski geliştirme probunu içerir.
Yeni soruların 280'i tuning, 280'i ayrı şablon ailelerinden family holdout olarak
ayrılmıştır. Doğal soru, yakın konu, belirsiz soru, kapsam dışı soru ve güvenli teori
aileleri; Türkçe karakter kaybı, yazım hatası, çekim, kelime sırası, eş anlam, karma
Türkçe/İngilizce ve olumsuzlama dönüşümlerini kapsar.

Her soru `route`, `clarify` veya `abstain` kararını açıkça taşır. `route` için konu
kimliği zorunludur; `clarify` ile `abstain` yalnız `topicId=null` oldukları için aynı
sayılmaz.

## V2 yönlendirme tekniği

Evaluator saf ve self-contained bir JavaScript modülüdür. Dosya sistemi, ağ,
`process`, log veya başka modül importu kullanmaz. Yönlendirme şu bileşenlerden
oluşur:

- Türkçe karakter ve sınırlı çekim normalizasyonu,
- en fazla bir karakterlik typo ve komşu harf değişimi toleransı,
- kelime sırasından bağımsız token kapsaması,
- konuya özgü token nadirliği,
- anchor ile context birlikteliği,
- komşu konu için negatif ağırlık,
- açık belirsizlik marjı ve çift-anchor kapısı,
- kapsam dışı token üstünlüğü ve zayıf-anchor kapısı,
- yalnız tuning sorularından derlenen order-independent token setleri.

Teknik, kayıtlı konu etiketini seçer; yeni bilimsel iddia, biyolojik mekanizma veya
klinik sonuç üretmez.

## Hash ve dondurma sözleşmesi

Frozen adapter aşağıdakilere exact hash ile bağlıdır:

- aday paket ve dosya,
- geliştirme bankası ve dosya,
- config dosyası,
- saf evaluator kodu,
- adapter derleyici kodu,
- tuning soru kimlikleri,
- family-holdout soru kimlikleri,
- konu bazlı tuning token allowlisti.

Adapter yalnız development gate geçerse şu yola atomik olarak yazılır, `fsync`
edilir, geri okunur ve `0600` doğrulanır:

`Datasets/DNA-Intelligence/evaluation/frozen-adapters/turkish-retrieval-v2/adapter.json`

Tam geliştirme sonucu yalnız SSD'dedir:

`Outputs/SelfMetaAI/dna-intelligence/turkish-retrieval-adapter/development-v2/result.json`

Repo manifestleri soru metni içermez; yalnız aggregate sayı, skor, sınır ve hash
taşır.

## Geliştirme kabul kapısı

- 14 konu kapsanmalı.
- Her karar tam olarak puanlanmalı.
- Family holdout doğal, yakın konu, belirsiz, kapsam dışı ve güvenli teori
  doğruluğu ayrı ayrı en az `%95` olmalı.
- Family holdout kapsam dışı doğruluğu `%100` olmalı.
- Metamorphic dönüşüm grupları ayrı raporlanmalı.
- Aynı girdi 20 tekrar boyunca tek adapter ve tek karar hash'i üretmeli.
- p95 değerlendirme süresi 25 ms altında olmalı.
- Banka, allowlist, boundary, path, symlink, kip, içerik ve aggregate metin sızıntısı
  saldırıları fail-closed olmalı.

Bu kapının geçmesi adapteri yalnız geliştirme için dondurmaya izin verir. Canlıya
alma, yayınlama veya resmî performans iddiası sağlamaz.
