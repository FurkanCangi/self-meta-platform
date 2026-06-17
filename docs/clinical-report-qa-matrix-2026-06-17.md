# Klinik Rapor QA Matrisi - 2026-06-17

Bu dokuman, deterministic rapor motorunda son kalite turunda uygulanan ilk 3 onerinin kabul kaydidir:

1. Gercekci coklu vaka matrisi ile manuel klinik okuma.
2. Ek test sonuc formatlarini genisletme.
3. Rapor okunabilirligi ve tekrar azaltma.

## Genel Durum

- Uretim modu: deterministic.
- Final AI katkisi: %0.
- Runtime RAG katkisi: %0.
- Deterministic Knowledge Base: aktif.
- Word RAG chunk coverage: 71/71.
- Quality gate: PASS.
- Deterministic audit: 48/48 fixture temiz.

## 15 Vaka Klinik Matris

| # | Fixture | Klinik aile | Ek test / format kapsami | Iyi calisan nokta | Izlem notu |
|---|---|---|---|---|---|
| 1 | `dna-fully-typical-development.json` | Dengeli / korunmus profil | Ek test yok | Korunmus alanlari gereksiz risk diline cevirmiyor. | Tipik profillerde gereksiz klinik genisleme manuel okumada izlenmeli. |
| 2 | `dna-global-typical-selective-interoception.json` | Secici interosepsiyon | Ek test yok | Genel skor tipik kalirken secici kirilganligi ayri gorunur tutuyor. | Secici risk dilinin tani veya tibbi nedensellik diline kaymamasi izlenmeli. |
| 3 | `dna-dual-sensory-emotional-overload.json` | Duyusal-duygusal | Ek test yok | Ikili mekanizmayi en dusuk skor yerine duyusal-duygusal yayilimla kuruyor. | Duyusal tema olmayan vakalara duyusal dil sizmamasi audit ile izleniyor. |
| 4 | `dna-adhd-executive-load.json` | Yurutucu-duygusal | BRIEF/Conners ailesiyle uyumlu senaryo | Dikkat/yurutucu dili tani koymadan klinik organizasyon ekseninde kaliyor. | ADHD veya tedavi hukmu uretmeme siniri korunmali. |
| 5 | `dna-adaptive-daily-living.json` | Beden-temelli / gunluk yasam | Uyumsal islev baglami | Gunluk akisi yalniz skor degil beden-temelli toparlanma ve rutin yukunden okuyor. | Adaptive ve fizyolojik hat ayrimi yeni vakalarda izlenmeli. |
| 6 | `dna-age-mismatch-warning.json` | Yas uyumsuz ek test siniri | Yas uyumsuz test | Yas uyumsuz testi ana karar agirligina katmiyor. | Uyari dili kisa kalmali ama gorunur olmasi gerekiyor. |
| 7 | `dna-item-level-linkage.json` | Duyusal-duygusal, madde baglami | Madde duzeyi sinyal | Madde/anamnez/test uyumunu klinik kanit gibi bagliyor. | Madde icerigi telifli test maddesine donusmemeli. |
| 8 | `dna-new-06-somatodyspraxia-motor-planning.json` | Motor/praksi | PDMS/SIPT hattina yakin | Ana karar yurutucu islevden praksi ve motor planlama mekanizmasina tasindi. | Motor dilinin dikkat eksikligi gibi okunmamasi icin audit surdurulmeli. |
| 9 | `dna-language-pragmatic-load.json` | Dilsel + sosyal-pragmatik | Coklu test tek eksen | Dilsel yuk ile sosyal-pragmatik talebi birlesik mekanizma olarak okuyor. | Birlesik hatlarda tekrar eden karar/formulasyon cumleleri izlenmeli. |
| 10 | `dna-format-briefp-tscore-clinical.json` | Yurutucu-duygusal | T skoru / klinik yukselme | T skoru formatini yakalayip testin puan sistemini raporda gosteriyor. | T skoru tani veya kesin klinik esik gibi kullanilmamali. |
| 11 | `dna-format-pedicat-percentile-adaptive.json` | Gunluk yasam / oz bakim | T skoru + percentil | PEDI-CAT, Vineland ve adaptive islev kanitini DNA skorunu degistirmeden baglama ekliyor. | Percentil bilgisi tek basina agir karar kaniti olmamali. |
| 12 | `dna-format-pdms3-standard-score-motor.json` | Motor planlama / beden organizasyonu | Standart skor + percentil | PDMS-3 ve MABC-3 motor/praksi mekanizmasini destekleyici kanit olarak yerlestiriyor. | Motor gorev dilinin genel dikkat saptamasina donusmesi engellendi. |
| 13 | `dna-format-pls-age-equivalent-language.json` | Dilsel talep | Yas esdegeri + scaled score | PLS-5 yas esdegeri ve CELF scaled score formatini yorum siniriyla rapora tasiyor. | Yas esdegeri gelisim yorumu dikkatli, sinirli ve test-spesifik kalmali. |
| 14 | `dna-format-preserved-vineland-abas.json` | Korunmus adaptive profil | Standart skor / korunmus sonuc | Vineland-3 ve ABAS-3 korunmus sonuc geldiginde risk buyutmuyor. | Korunmus ek test ile riskli DNA skoru celistiginde yakinsama dili ayrica test edilmeli. |
| 15 | `dna-format-mixed-multi-test.json` | Dilsel + sosyal-pragmatik | Standart skor + T skoru + scaled score | Ilk 3 testi kompakt ek test profilinde verip kalanlari destekleyici baglamda tutuyor. | 3 testten fazla veride okunabilirlik manuel kontrol edilmeli. |

## Ek Test Format Kapsami

Bu turda eklenen fixture seti asagidaki sonuc formatlarini kapsar:

- T skoru ve klinik yukselme bandi.
- Standart skor.
- Percentil.
- Scaled score.
- Yas esdegeri.
- Korunmus/ortalama sonuc.
- Coklu testte ilk 3 test + ek destekleyici test ozeti.
- Ham puan-only ve yas uyumsuz testlerde yorum siniri.

Ek testler DNA skorunu degistirmez. Yalniz kanit agirligi, mekanizma secimi, anamnez-test uyumu ve literatur siralamasina destek verir. Yas uyumsuz veya ham puan-only veri ana karar agirligini artirmaz.

## Okunabilirlik Duzeltmeleri

- `1. Klinik Karar Ozeti` ana hipotezi tasir.
- `4. Klinik Oruntu ve Formulasyon` ayni karar cumlesini tekrar etmek yerine mekanizmanin islevsel aciklamasini verir.
- `6. Klinik Onceliklendirme Notu` uzun tekrar yerine `Karar ozeti`, `Formulasyon ozeti`, `Klinik oncelik sirasi`, `Vaka ici karar kanitlari` ve `Veri guven duzeyi` yapisina indi.
- Ek test profili tek satirlik kompakt siraya cekildi: yas/kapsam, alan, puan sistemi, sonuc, iliski, sinir.
- Telif siniri kisa tutuldu ve test maddesi/norm tablosu/manual icerigi tasinmadi.

## Kabul Notu

Bu matris otomatik kalite kapilarini gecen fixture setini klinik acidan da izlenebilir hale getirir. Bundan sonraki en anlamli kalite adimi, gercek kullanici vakalarindan anonimlestirilmis 10-20 raporu bu matrise ekleyip manuel klinisyen okuma notlarini ayrica tutmaktir.
