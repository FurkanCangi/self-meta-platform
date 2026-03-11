import { buildAdvancedReport } from "./src/lib/selfmeta/reportEngine"

const baseScores = {
  fizyolojik: 33,
  duyusal: 19,
  duygusal: 22,
  bilissel: 31,
  yurutucu: 30,
  intero: 29,
  toplam: 164,
}

function runCase(ageMonths: number) {
  const report = buildAdvancedReport({
    clientCode: `AGE-${ageMonths}`,
    anamnez: `
Çocuk kalabalık ve gürültülü ortamlarda huzursuzluk yaşayabilmektedir.
Birden fazla uyaran olduğunda dikkatini sürdürmekte zorlandığı ifade edilmektedir.
Saç kesimi ve yüz yıkama sırasında huzursuzluk bildirilmiştir.
Yoğun uyaran sonrası ağlama ve sakinleşmede gecikme gözlenmektedir.
`,
    ageMonths,
    scores: baseScores,
  })

  console.log("\n====================================")
  console.log(`YAŞ: ${ageMonths} AY`)
  console.log("====================================")
  console.log("normSource:", report.normSource)
  console.log("ageBandLabel:", report.ageBandLabel)
  console.log("globalLevel:", report.globalLevel)
  console.log("profileType:", report.profileType)
  console.log("domainLevels:", report.domainLevels)
  console.log("\n--- REPORT ---\n")
  console.log(report.reportText)
}

runCase(30)
runCase(60)
