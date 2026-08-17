import assert from "node:assert/strict"
import { readFileSync } from "node:fs"

const originalDotAll = new RegExp("Kaynak:\\s*(.+)$", "su")
const es2017Compatible = /Kaynak:\s*([\s\S]+)$/u

const cases = [
  "Kaynak: Diamond, 2013",
  "Kaynak:\tDiamond, 2013",
  "Kaynak: Türkçe karakterler: ğüşöçıİ",
  "Kaynak: Noktalama; iki nokta: ve parantez (2024).",
  "Kaynak: Satır 1\nSatır 2",
  "Kaynak: Satır 1\n\nSatır 3",
  "Ön metin. Kaynak: Diamond, 2013",
  "Ön metin.\nKaynak: Diamond, 2013",
  "Ön metin.\nKaynak:\nDiamond, 2013",
  "Ön metin.\r\nKaynak:\r\nDiamond, 2013",
  "Kaynak: Birinci paragraf.\n\nİkinci paragraf.",
  "Kaynak: — uzun çizgi —",
  "Kaynak: 'tek tırnak' ve \"çift tırnak\"",
  "Kaynak: https://example.org/a?b=1&c=2",
  "Kaynak: DOI: 10.1000/xyz123",
  "Kaynak: Emoji 🧠 ve çocuk 👧",
  "Kaynak: Matematik 1 + 2 = 3",
  "Kaynak: [Köşeli] {süslü} (yuvarlak)",
  "Kaynak: Bir\nİki\nÜç\nDört",
  "Kaynak: Başlangıç\n- madde 1\n- madde 2",
  "Kaynak: sondaki boşluk   ",
  "Kaynak:\n\nboş satırlardan sonra",
  "Kaynak:\t\nkarma boşluk",
  "A\nB\nKaynak: C\nD\nE",
  "Kaynak: ilk Kaynak: ikinci",
  "Kaynak: ilk\nKaynak: ikinci",
  "kaynak: küçük harf",
  "KAYNAK: büyük harf",
  "Kaynak:",
  "Kaynak:   ",
  "Kaynak:\n",
  "Kaynak:\n\n",
  "Kaynak etiketi yok",
  "",
  "\n\n",
  "Prefix Kaynak: değer\nson",
  "Kaynak: null değil; gerçek metin",
  "Kaynak: a.b.c\nçok satır",
  "Kaynak: soru? ünlem! nokta.",
  "Kaynak: birleşik\u00a0boşluk",
]

function signature(match) {
  return match
    ? { matched: true, full: match[0], capture: match[1], index: match.index }
    : { matched: false, full: null, capture: null, index: null }
}

for (const [index, input] of cases.entries()) {
  assert.deepEqual(
    signature(input.match(es2017Compatible)),
    signature(input.match(originalDotAll)),
    `regex_semantic_mismatch:${index + 1}`,
  )
}

const source = readFileSync("src/lib/dna/reportV2/plainClinicalTurkish.ts", "utf8")
assert.match(source, /claim\.text\.match\(\/Kaynak:\\s\*\(\[\\s\\S\]\+\)\$\/u\)/u)
assert.doesNotMatch(source, /claim\.text\.match\(\/Kaynak:[^\n]+\$\/su\)/u)

console.log(JSON.stringify({
  cases: cases.length,
  matchResultInvariancePercent: 100,
  target: "ES2017",
  sourcePattern: "Kaynak:\\s*([\\s\\S]+)$ /u",
}, null, 2))
