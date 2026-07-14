import { classifyTotalScore } from "../dna/normativeBands"
import { scoreAssessmentAnswers } from "./itemScoring"

export type AssessmentResult = {
  fizyolojik: number
  duyusal: number
  duygusal: number
  bilissel: number
  yurutucu: number
  intero: number
  toplam: number
  siniflama: "Tipik" | "Riskli" | "Atipik"
}

export function calculateAssessment(rawAnswers: number[]): AssessmentResult {
  const scores = scoreAssessmentAnswers(rawAnswers)

  const fizyolojik = scores.slice(0, 10).reduce((a, b) => a + b, 0)
  const duyusal = scores.slice(10, 20).reduce((a, b) => a + b, 0)
  const duygusal = scores.slice(20, 30).reduce((a, b) => a + b, 0)
  const bilissel = scores.slice(30, 40).reduce((a, b) => a + b, 0)
  const yurutucu = scores.slice(40, 50).reduce((a, b) => a + b, 0)
  const intero = scores.slice(50, 60).reduce((a, b) => a + b, 0)

  const toplam =
    fizyolojik +
    duyusal +
    duygusal +
    bilissel +
    yurutucu +
    intero

  const siniflama = classifyTotalScore(toplam)

  return {
    fizyolojik,
    duyusal,
    duygusal,
    bilissel,
    yurutucu,
    intero,
    toplam,
    siniflama,
  }
}
