import { DomainResult } from "./reportEngine"

export type ClinicalAnalysis = {
  profileType:string
  globalLevel:string
  priorityDomains:string[]
  domainSummary:Record<string,string>
  anamnezThemes:string[]
}

function applyInteroPriorityBias(domainResults: any[], priorityDomains: string[]): string[] {
  const intero = domainResults.find((d) => d.key === "interoception");
  if (!intero) return priorityDomains;

  const interoIsRelevant = intero.level === "Riskli" || intero.level === "Atipik";
  const otherNonTypicalExists = domainResults.some(
    (d) => d.key !== "interoception" && (d.level === "Riskli" || d.level === "Atipik")
  );

  if (!interoIsRelevant || !otherNonTypicalExists) {
    return priorityDomains;
  }

  const interoLabel = intero.label || "İnterosepsiyon";

  if (priorityDomains.includes(interoLabel)) {
    return priorityDomains;
  }

  if (priorityDomains.length === 0) {
    return [interoLabel];
  }

  if (priorityDomains.length === 1) {
    return [interoLabel, priorityDomains[0]];
  }

  return [interoLabel, priorityDomains[0]];
}

export function buildClinicalAnalysis(
  domainResults:DomainResult[],
  profileType:string,
  globalLevel:string,
  anamnezFlags:string[]
):ClinicalAnalysis{

const priority = [...domainResults]
  .filter(d => d.level !== "Tipik")
  .sort((a,b)=>a.score-b.score)
  .slice(0,2)
  .map(d=>d.label)

const domainSummary:Record<string,string> = {}

for(const d of domainResults){
domainSummary[d.label] = d.level
}

return{
profileType,
globalLevel,
priorityDomains: applyInteroPriorityBias(domainResults, priority),
domainSummary,
anamnezThemes:anamnezFlags.slice(0,2)
}

}
