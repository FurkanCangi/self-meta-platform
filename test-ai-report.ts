import "dotenv/config";
import { demoCases } from "./src/lib/selfmeta/demoCases";
import { generateAIClinicalReport } from "./src/lib/selfmeta/aiReportService";

async function run() {
  const arg = process.argv[2];
  const index = arg && arg !== "all" ? Number(arg) - 1 : null;
  const selected =
    index !== null && Number.isInteger(index) && demoCases[index]
      ? [demoCases[index]]
      : demoCases;

  for (const [i, c] of selected.entries()) {
    const result = await generateAIClinicalReport({
      clientCode: `DEMO-${i + 1}`,
      anamnez: c.anamnez,
      scores: c.scores,
      deterministicReport: "",
    });

    console.log("\n=======================");
    console.log("CASE:", c.name);
    console.log("MODEL:", result.model, "| EFFORT:", result.reasoningEffort);
    console.log("=======================\n");

    console.log(result.reportText);

    console.log("\n--- STRUCTURED DEBUG JSON ---\n");
    console.log(JSON.stringify(result.analysis, null, 2));
    console.log("\n=======================\n");
  }
}

run().catch((err) => {
  console.error("\nHATA:\n");
  console.error(err);
  process.exit(1);
});
