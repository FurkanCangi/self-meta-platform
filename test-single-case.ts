import "dotenv/config";
import { generateAIClinicalReport } from "./src/lib/selfmeta/aiReportService";

async function run() {
  const caseData = {
    clientCode: "DEMO-SENSORY-01",
    ageMonths: 48,
    anamnez: `
Çocuk 4 yaşında erkek çocuktur. Aile özellikle kalabalık ve gürültülü ortamlarda belirgin huzursuzluk yaşadığını ifade etmektedir.
Alışveriş merkezleri, doğum günü partileri veya kalabalık park ortamlarında çocuk kulaklarını kapatmakta ve ortamdan uzaklaşmak istemektedir.
Ev ortamında genellikle sakin bir çocuk olarak tanımlanmaktadır. Birebir oyunlarda ve yapılandırılmış aktivitelerde katılımı iyidir.
Ancak ortamda birden fazla uyaran olduğunda dikkatini sürdürmekte zorlandığı ve oyunu bırakıp dolaşmaya başladığı ifade edilmektedir.
Aile ayrıca bazı dokunsal hassasiyetler bildirmektedir. Özellikle saç kesimi sırasında huzursuzluk artmakta,
tırnak kesimi ve yüz yıkama gibi aktivitelerde kaçınma davranışı görülmektedir.
Duygusal açıdan çocuk zaman zaman ani duygu değişimleri yaşayabilmektedir.
Özellikle yorulduğunda veya yoğun uyaran sonrası ağlama ve sakinleşmekte gecikme gözlenmektedir.
Çocuğun güçlü yönleri arasında yapboz ve blok oyunları sayılmıştır.
Bu tür yapılandırılmış aktivitelerde uzun süre odaklanabildiği belirtilmiştir.
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
    deterministicReport: "",
  };

  const result = await generateAIClinicalReport(caseData);

  console.log("\n==============================");
  console.log("SELF META AI TEST RAPORU");
  console.log("==============================\n");
  console.log(result.reportText);
  console.log("\n\n--- STRUCTURED ANALYSIS ---\n");
  console.log(JSON.stringify(result.analysis, null, 2));
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
