import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import {
  applyFullBoldClinicalReportParagraphs,
  extractFullBoldClinicalReportParagraphs,
  normalizeClinicalReportText,
  splitClinicalReportSections,
} from "../src/lib/dna/reportText"

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

const decision = "Bulgular en çok yürütücü işlev alanındaki güçlüğü desteklemektedir."
const ordinary = "Bakım veren anlatısı değerlendirmeye ek bağlam sağlamaktadır."
const source = [
  "1. Klinik Özet",
  decision,
  ordinary,
  "2. Bulgular ve Klinik Kanıt Profili",
  "Ölçek bulguları birlikte değerlendirilmiştir.",
  "3. Klinik Örüntü",
  "Güçlük görev geçişlerinde belirginleşmektedir.",
  "4. Klinik Karar",
  "Klinik yorum yürütücü işlev üzerinde yoğunlaşmaktadır.",
  "5. Bilimsel Literatür",
  "Bilimsel dayanak vaka bulgularını açıklamak amacıyla kullanılmıştır.",
].join("\n")

const emphasized = applyFullBoldClinicalReportParagraphs(source, [decision])
assert(emphasized.includes(`**${decision}**`), "Karar paragrafı rapor metninde bold işareti taşımıyor.")
assert(!emphasized.includes(`**${ordinary}**`), "Normal paragraf yanlışlıkla bold işaretlendi.")

const extracted = extractFullBoldClinicalReportParagraphs(emphasized)
assert(extracted.length === 1 && extracted[0] === decision, "Bold karar paragrafı güvenli biçimde çıkarılamadı.")
assert(extractFullBoldClinicalReportParagraphs("**dengesiz*\n***yanlış**").length === 0, "Bozuk bold işareti kabul edildi.")

const normalized = normalizeClinicalReportText(emphasized)
assert(!normalized.includes("**"), "Kullanıcı ekranında ham Markdown işareti kalıyor.")
assert(splitClinicalReportSections(emphasized).length === 5, "Beş başlıklı rapor sözleşmesi bold işaretinden etkilendi.")

const viewSource = readFileSync(
  resolve(process.cwd(), "src/components/report/ClinicalReportView.tsx"),
  "utf8"
)
assert(viewSource.includes("extractFullBoldClinicalReportParagraphs(text)"), "Ekran bold karar listesini rapor işaretinden okumuyor.")
assert(viewSource.includes('<strong className="font-bold">'), "Ekran ve yazdırma yüzeyi semantik strong üretmiyor.")
assert(viewSource.includes("dna-report-decision"), "Karar paragrafı için kararlı UI seçicisi bulunmuyor.")

console.log("REPORT_BOLD_SURFACE_TESTS: PASS")
console.log(JSON.stringify({ boldDecisionParagraphs: extracted.length, ordinaryParagraphsBolded: 0, rawMarkdownVisible: 0, headingCount: 5 }))
