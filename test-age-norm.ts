import "dotenv/config"
import { generateAIClinicalReport } from "./src/lib/selfmeta/aiReportService"

const baseCase = {
  clientCode: "AGE-NORM-TEST",

  anamnez: `
Çocuk kalabalık ve gürültülü ortamlarda huzursuzluk yaşayabilmektedir.
Birden fazla uyaran olduğunda dikkatini sürdürmekte zorlandığı ifade edilmektedir.
Saç kesimi ve yüz yıkama sırasında huzursuzluk bildirilmiştir.
Yoğun uyaran sonrası ağlama ve sakinleşmede gecikme gözlenmektedir.
`,

  scores: {
    fizyolojik: 33,
    duyusal: 19,
    duygusal: 22,
    bilissel: 31,
    yurutucu: 30,
    intero: 29,
    toplam: 164,
  }
}

async function run(){

console.log("\n====== 30 AY TEST ======\n")

const r1 = await generateAIClinicalReport({
  ...baseCase,
  ageMonths: 30
})

console.log(r1.reportText)

console.log("\n====== 60 AY TEST ======\n")

const r2 = await generateAIClinicalReport({
  ...baseCase,
  ageMonths: 60
})

console.log(r2.reportText)

}

run().catch(err=>{
console.error(err)
process.exit(1)
})
