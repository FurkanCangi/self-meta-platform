import type { ReportInput } from "../../src/lib/dna/reportEngine"
import { answersForJuryTotals } from "./dna-report-jury-cases"

const totals = [30, 30, 30, 30, 30, 30] as const

export const FORM_DUMP_DUPLICATE_EXTERNAL_INPUT = Object.freeze({
  clientCode: "SYNTH-FORM-DUMP",
  ageMonths: 30,
  answers: [...answersForJuryTotals(totals)],
  scores: Object.freeze({
    fizyolojik: 30,
    duyusal: 30,
    duygusal: 30,
    bilissel: 30,
    yurutucu: 30,
    intero: 30,
    toplam: 180,
  }),
  anamnez: "Adı-soyadı: aaa Danışan Kodu: aaa Kayıt Tarihi: 2026-06-22 Yaş aralığı: 24-35 ay Cinsiyet: aa Kardeş sayısı: aa Kaçıncı çocuk: aa Evde kaç kişi kalıyor: aa Çocuk doğduğunda annenin yaşı: aa Annenin eğitim düzeyi: aa Annenin mesleği / çalışıyor mu?: aa Annenin çalışma saatleri: aa Çalışıyorsa, çocuğa kim bakıyor: aa Babanın eğitim düzeyi: aa Babanın mesleği: aa Babanın çalışma saatleri: aa Tanı: aaa Tıbbi geçmiş: aaaa Alerji/epilepsi/kronik kabızlık-ishal/kolik ağrı/nöbet: aaa Şu an aldığı tedavi ve terapiler: aaa Daha önce aldığı tedaviler: aaa Medikal tedaviler (ilaçlar ve saatleri): aaa Doğum öncesi hikâye (hamilelik süresi, doğum kilosu, doğum şekli): aaa Doğum hikayesi: aaa Doğum sonrası hikâye: aaa Düşük doğum hikayesi var mı: aaa Beslenme şekli: aaa Sevdiği yemekler: aaa Reddettiği yemekler: aaa Sevdiği oyuncaklar: aaa Çocuğun güçlü yanları: aaa Birincil endişeler/hedefler: aaa Ebeveyn iletişim bilgileri: aaa Başvuru sebebi: aaa. Ek klinik test / bulgular: Test 1: Test adı: Vineland-3 | Puan / sonuç: sonuç bilgisi eksik | Klinik yorum: yorumlanamaz. Test 2: Test adı: BASC-3 | Puan / sonuç: sonuç bilgisi eksik | Klinik yorum: yorumlanamaz. Test 3: Test adı: Sensory Profile 2 | Puan / sonuç: sonuç bilgisi eksik | Klinik yorum: yorumlanamaz. Test 4: Test adı: PLS-5 | Puan / sonuç: sonuç bilgisi eksik | Klinik yorum: yorumlanamaz. Test 5: Test adı: BOT-2 | Puan / sonuç: form geçersiz | Klinik yorum: yorumlanamaz. Test 6: Test adı: Vineland-3 | Puan / sonuç: sonuç bilgisi eksik | Klinik yorum: yorumlanamaz. Test 7: Test adı: BASC-3 | Puan / sonuç: sonuç bilgisi eksik | Klinik yorum: yorumlanamaz. Test 8: Test adı: Sensory Profile 2 | Puan / sonuç: sonuç bilgisi eksik | Klinik yorum: yorumlanamaz. Test 9: Test adı: PLS-5 | Puan / sonuç: sonuç bilgisi eksik | Klinik yorum: yorumlanamaz. Test 10: Test adı: BOT-2 | Puan / sonuç: form geçersiz | Klinik yorum: yorumlanamaz.",
}) satisfies ReportInput
