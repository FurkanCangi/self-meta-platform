import { calculateAssessment } from "./assessment/assessmentEngine"
import { scoreRawAnswer } from "./assessment/itemScoring"

export function reverseScore(value: number) {
  return 6 - value
}

// Eski çağrılar için korunur; puan yönü artık çağıranın verdiği geçici bir
// listeden değil, merkezi soru tanımlarından okunur.
export function calculateScores(answers: number[], _reverseItems?: number[]) {
  return calculateAssessment(answers)
}

export { scoreRawAnswer }
