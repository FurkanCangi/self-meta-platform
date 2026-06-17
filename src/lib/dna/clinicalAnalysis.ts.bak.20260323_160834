import { DomainResult } from "./reportEngine"

export type ClinicalAnalysis = {
  profileType:string
  globalLevel:string
  priorityDomains:string[]
  domainSummary:Record<string,string>
  anamnezThemes:string[]
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
priorityDomains:priority,
domainSummary,
anamnezThemes:anamnezFlags.slice(0,2)
}

}
