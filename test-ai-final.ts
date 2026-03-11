import { buildAdvancedReport } from "./src/lib/selfmeta/reportEngine"
import { rewriteClinicalReport } from "./src/lib/selfmeta/aiRewrite"

async function run() {
  const report = buildAdvancedReport({
    clientCode: "TEST-01",
    ageMonths: 48,
    anamnez: `
Çocuk gürültülü ve kalabalık ortamlarda belirgin huzursuzluk yaşamaktadır.
Saç kesimi ve tırnak kesimi sırasında zorlanma görülmektedir.
Yoğun uyaran sonrası ağlama ve sakinleşmede gecikme bildirilmektedir.
Yapılandırılmış etkinliklerde, özellikle yapboz oyunlarında dikkati daha iyi sürdürebilmektedir.
`,
    scores: {
      fizyolojik: 33,
      duyusal: 19,
      duygusal: 22,
      bilissel: 31,
      yurutucu: 30,
      intero: 29,
      toplam: 164,
    },
  })

  console.log("\n=== DETERMINISTIC REPORT ===\n")
  console.log(report.reportText)

  if (!report.clinicalAnalysis) {
    throw new Error("clinicalAnalysis oluşmadı.")
  }

  const ai = await rewriteClinicalReport(report.clinicalAnalysis)

  console.log("\n=== AI REWRITE ===\n")
  console.log(ai)
}

run().catch((err) => {
  console.error(err)
  process.exit(1)
})
