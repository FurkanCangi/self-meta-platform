import assert from "node:assert/strict"
import {
  JURY_REPORT_HEADINGS,
  normalizeClinicalReportText,
  splitClinicalReportSections,
} from "../src/lib/dna/reportText"

const juryBodies = [
  "Özet cümlesi.",
  "Alan bulguları ve kanıt profili.",
  "Klinik örüntü açıklaması.",
  "Klinik karar açıklaması.",
  "Bilimsel açıklama.\nKaynaklar (APA 7):\nÖrnek kaynak.",
]

const juryReport = JURY_REPORT_HEADINGS
  .map((heading, index) => `${heading}\n${juryBodies[index]}`)
  .join("\n\n")

const normalizedJury = normalizeClinicalReportText(juryReport)
const normalizedTwice = normalizeClinicalReportText(normalizedJury)
const jurySections = splitClinicalReportSections(juryReport)

assert.equal(normalizedJury, normalizedTwice, "jury normalization must be idempotent")
assert.deepEqual(jurySections.map((section) => section.heading), [...JURY_REPORT_HEADINGS])
assert.deepEqual(jurySections.map((section) => section.body), juryBodies)
assert.equal(normalizedJury.includes("2. Bulgular ve\n2. Klinik Kanıt Profili"), false)
assert.equal(jurySections.some((section) => section.heading === "2. Bulgular ve"), false)

const legacyReport = [
  "1. Klinik Karar Özeti\nEski özet.",
  "2. Klinik Kanıt Profili\nEski kanıt.",
  "3. Alan Bazlı Klinik Yorum\nEski alan yorumu.",
  "4. Klinik Örüntü ve Formülasyon\nEski örüntü.",
  "5. Anamnez, Gözlem ve Test Uyumunun Değerlendirilmesi\nEski uyum.",
  "6. Klinik Önceliklendirme Notu\nEski öncelik.",
  "7. Klinik Sonuç\nEski sonuç.",
  "8. Literatürle Uyumlu Klinik Dayanak\nEski literatür.",
].join("\n\n")

const legacySections = splitClinicalReportSections(legacyReport)
assert.equal(legacySections.length, 8, "legacy 7+1 reports must remain readable")
assert.equal(legacySections[0]?.heading, "1. Klinik Karar Özeti")
assert.equal(legacySections[7]?.heading, "8. Literatürle Uyumlu Klinik Dayanak")

console.log(JSON.stringify({
  ok: true,
  juryHeadingCount: jurySections.length,
  legacyHeadingCount: legacySections.length,
  fragmentCount: jurySections.filter((section) => section.heading === "2. Bulgular ve").length,
  idempotent: normalizedJury === normalizedTwice,
}, null, 2))
