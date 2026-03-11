import { buildAdvancedReport } from "./src/lib/selfmeta/reportEngine"
import { rewriteClinicalReport } from "./src/lib/selfmeta/aiRewrite"

async function run(){

const report = buildAdvancedReport({
clientCode:"CASE-02",
ageMonths:54,
anamnez:`
Çocuk özellikle kalabalık ve gürültülü ortamlarda belirgin huzursuzluk göstermektedir.
Alışveriş merkezlerinde kulaklarını kapatmakta ve ortamdan uzaklaşmak istemektedir.
Saç kesimi ve tırnak kesimi sırasında belirgin dokunsal hassasiyet gözlenmektedir.

Aile ayrıca yoğun uyaran sonrası çocuğun ağladığını ve sakinleşmesinin uzun sürdüğünü ifade etmektedir.
Birden fazla uyaran olduğunda dikkatini sürdürmekte zorlandığı ve oyunu bıraktığı bildirilmektedir.

Ev ortamında ise yapılandırılmış oyunlarda daha uzun süre odaklanabildiği belirtilmektedir.
`,
scores:{
fizyolojik:31,
duyusal:18,
duygusal:21,
bilissel:30,
yurutucu:28,
intero:29,
toplam:157
}
})

console.log("\n=== DETERMINISTIC REPORT ===\n")
console.log(report.reportText)

if(!report.clinicalAnalysis){
throw new Error("clinicalAnalysis oluşmadı")
}

const ai = await rewriteClinicalReport(report.clinicalAnalysis)

console.log("\n=== AI REWRITE ===\n")
console.log(ai)

}

run().catch((err)=>{
console.error(err)
process.exit(1)
})
