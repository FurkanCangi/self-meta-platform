# DNA bilgi kataloğu araştırma paketleri — V2

Bu dizin, DNA Asistanı katalog sözleşmesi `dna-chat-catalog@2` için ikinci dalgada teslim edilen dört araştırma paketinin kanonik Markdown denetim kopyalarını içerir. Geniş runtime konu kategorileri değişmemiştir; her belge ayrıca kendi araştırma paketi kimliğiyle izlenir.

## Kanonik dosyalar

| Araştırma paketi | Geniş kategori | Kanonik Markdown | Ham iddia | Kavram kartı | Soru | Kaynak |
|---|---|---|---:|---:|---:|---:|
| Prefrontal süreçler | Merkezi sinir sistemi | `prefrontal-processes.md` | 20 | 24 | 70 | 32 |
| Anterior singulat korteks | Merkezi sinir sistemi | `anterior-cingulate-cortex.md` | 30 | 32 | 80 | 45 |
| İnsular korteks | Merkezi sinir sistemi | `insular-cortex.md` | 40 | 42 | 72 | 40 |
| İnterosepsiyon | Otonom sinir sistemi | `interoception.md` | 40 | 48 | 96 | 51 |
| **Toplam** |  |  | **130** | **146** | **318** | **168** |

`SHA256SUMS`, bu dört kanonik dosyanın değişmezlik denetimini sağlar. ZIP paketlerindeki DOCX, PDF, CSV ve JSON/JSONL dosyaları aynı araştırmanın sunum veya yapılandırılmış ek kopyaları olduğu için ikinci bir kanonik kayıt oluşturmaz. Kanonik Markdown dosyalarında UTF-8 BOM bulunmaz.

## Yayın ve denetim politikası

Bu belgelerdeki 130 iddia, 146 kavram kartı, 318 soru ve 168 kaynak ham inceleme envanteridir. Belgeye alınmış olmak, bir kaydın doğrulandığı, uzman tarafından onaylandığı veya runtime yanıtlarında yayımlandığı anlamına gelmez. Runtime yalnız ayrı katalog kayıtlarında doğrulanmış kaynak, yaş kapsamı, kanıt düzeyi ve iddia sınırı bulunan güvenli alt kümeyi kullanır.

Her ham kayıt `sourcePackId` ile özgün araştırma paketine bağlanır. Böylece aynı geniş kategori ve aynı yerel kodu kullanan paketler birbirine karışmaz. Dört soru tablosunun bütün 318 satırı, kaynak kodu ve tam Markdown satırı korunarak benchmark katmanına aktarılır; güvenli ret etiketli soruların tamamı bağımsız holdout grubundadır.

Prefrontal, ACC ve insula belgeleri merkezi sinir sistemi geniş kategorisinde; interosepsiyon belgesi otonom sinir sistemi geniş kategorisinde tutulur. Bu eşleme yalnız katalog organizasyonudur. DNA puanından beyin bölgesi, otonom durum, tanı, neden, prognoz veya tedavi çıkarımı yapma yetkisi vermez.
