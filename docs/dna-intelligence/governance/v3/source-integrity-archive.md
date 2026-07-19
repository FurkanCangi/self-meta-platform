# Faz 10–11 kaynak bütünlüğü ve SSD arşiv sözleşmesi

Bu katman çalışma zamanı interneti kullanmaz. Çevrim içi denetçi yalnız geliştirme/yenileme sırasında Crossref, Crossmark alanları, Crossref içindeki Retraction Watch işaretleri, PubMed ve Europe PMC kayıtlarını toplar. Ham yanıtlar ve edinme defteri yalnız `ResearchSSD:` kökü altında saklanır. Repo yalnız sözleşme, test ve hash bağlı metadata özeti taşır.

## Faz 10 — bütünlük kararı

Her kaynakta başlık, DOI, yayın yeri ve yayıncı tutarlılığı; düzeltme, erratum, expression of concern, yeni sürüm, geri çekme ve kaldırma işaretleri denetlenir. Dış otorite doğrulanamıyorsa karar `pending` olur. Başlık, DOI veya yayın yeri uyuşmazlığı ile expression of concern `quarantined`; retraction, partial retraction, removal veya withdrawal `withdrawn` üretir. Yalnız yayıncı alanındaki uyuşmazlık, yerel kayıtta dergi adının yanlışlıkla yayıncı olarak tutulabilmesi nedeniyle karantinaya değil `pending` durumuna gider.

Geri çekme geçmişi silinmez. `withdrawn` durumu yapışkandır: otorite işaretinin sonraki çağrıda kaybolması kaynağı yeniden etkinleştiremez. Yalnız kanıt kimliği ve inceleme tarihi taşıyan açık `verified` reinstatement incelemesi bu kilidi açabilir. Durum geçişleri eklemeli history kaydıyla korunur. Her çevrim içi yenilemenin ham yanıtı, bütünlük kararı ve edinme defteri ayrıca zaman + içerik hash’i adresli, değiştirilemez SSD history run’ına yazılır; `current.json` yalnız güncel run işaretçisidir.

Deterministik etki gezgini `source → passage → claim → relation → answer` zincirini kapatır. Bütünlük kaydı olmayan kaynak, eksik referans, yinelenen kimlik veya boş destek grafı geçersiz kılar ve ilgili cevapları fail-closed `not_available` yapar. Güvenli alternatif ancak cevap sözleşmesinde birbirinden bağımsız alternatifler açıkça aynı grupta kaydedildiyse kullanılabilir; yalnız aynı cevapta başka bir güvenli kaynak bulunması yeterli değildir.

19 Temmuz 2026 denetiminde 47 kaynağın 7’si yalnız bütünlük kapısını geçti, 40’ı fail-closed `pending` kaldı. Karantinada veya withdrawn kayıt yoktu. Üç DOI Crossref tarafında doğrulanamadı. Bütünlükle ilgili iki post-publication kaydı bulundu: TRIPOD-AI kaydına bağlı correction ve erratum çözümü bekliyor. Europe PMC’nin `Preprint in` ve `Comment in` ilişkileri bütünlük olayı olmadığı için bu sayıya ve karar girdisine alınmadı. Retraction Watch işareti bulunmaması, yalnız denetim anındaki otorite yanıtının sonucudur ve kalıcı temizlik garantisi değildir. V3 runtime’a geçen kaynak sayısı hâlâ sıfırdır.

## Faz 11 — edinme defteri

SSD’deki 66 ham artefaktın tamamı kaynak URL’si, gerçek indirme/edinme URL’si ve bunun provenance türü, edinme tarihi, media type, byte boyutu, SHA-256, lisans ve edinme yöntemiyle ledger’a bağlandı. URL provenance dağılımı: 34 artefakta açık URL, 21 official-access URL, 8 deterministik Pressbooks export endpoint’i ve 3 denetlenmiş kayıt eşlemesi. Gerçek dosya üzerinden byte ve SHA yeniden hesaplandı. 33 PDF imza/EOF, 31 XML well-formedness ve 2 EPUB ZIP bütünlüğü denetiminden geçti; 66/66 kabul, 0 ret üretildi.

Ledger yalnız SSD-köküne göre göreli yollar taşır. Her dosyanın `realpath` değeri okunmadan ve hash’lenmeden önce kök içinde yeniden doğrulanır; `..`, mutlak yol ve kök dışına çıkan symlink reddedilir. Eksik dosya, byte/hash uyuşmazlığı veya başarısız PDF/XML/EPUB denetimi otomatik ret nedenidir. `work` ve `releases` kökleri hazırdır; bu denetim anında ikisinde de yayın artefaktı yoktur.

Çevrim içi yenileme komutu açık ağ yetkisi gerektirir. Çevrim dışı doğrulama aynı audit ve ledger’ı tekrar hesaplar, güncel immutable manifestteki bütün dosya hash ve boyutlarını da doğrular; testte Node izin modeliyle ağ ve yazma yetkisi kapalı tutulur. Böylece offline komutun gizlice yenileme yapmadığı da sınanır.

Sayısal sonuçlar ve SSD dosya hash’leri `source-integrity-archive-snapshot.json` içindedir. Snapshot hiçbir ham yayın, PDF/XML metni veya mutlak SSD yolu içermez.
