import { questions, type QuestionScoringDirection } from "../dna/questions"

export const ASSESSMENT_ITEM_COUNT = 60
export const ASSESSMENT_SCORING_VERSION = "dna-polarity-v2"
export const LIKERT_MIN = 1
export const LIKERT_MAX = 5

const questionById = new Map(questions.map((question) => [question.id, question]))

function assertLikert(value: unknown, label: string): number {
  const numeric = Number(value)
  if (!Number.isInteger(numeric) || numeric < LIKERT_MIN || numeric > LIKERT_MAX) {
    throw new Error(`${label} 1 ile 5 arasında tam sayı olmalıdır`)
  }
  return numeric
}

export function getItemScoringDirection(questionId: number): QuestionScoringDirection {
  const question = questionById.get(questionId)
  if (!question) throw new Error(`Bilinmeyen soru kimliği: ${questionId}`)
  return question.scoringDirection
}

export function validateRawAnswers(answers: readonly unknown[]): number[] {
  if (!Array.isArray(answers) || answers.length !== ASSESSMENT_ITEM_COUNT) {
    throw new Error(`${ASSESSMENT_ITEM_COUNT} soru tamamlanmadan sonuç hesaplanamaz`)
  }

  return answers.map((answer, index) => assertLikert(answer, `${index + 1}. yanıt`))
}

export function scoreRawAnswer(questionId: number, rawAnswer: unknown): number {
  const answer = assertLikert(rawAnswer, `${questionId}. yanıt`)
  return getItemScoringDirection(questionId) === "reverse" ? 6 - answer : answer
}

export function scoreAssessmentAnswers(answers: readonly unknown[]): number[] {
  return validateRawAnswers(answers).map((answer, index) => scoreRawAnswer(index + 1, answer))
}

// 1 en düşük, 5 en yüksek klinik güçlük şiddetidir.
export function getConcernSeverity(questionId: number, rawAnswer: unknown): number {
  return 6 - scoreRawAnswer(questionId, rawAnswer)
}

export function isCriticalConcern(questionId: number, rawAnswer: unknown): boolean {
  return getConcernSeverity(questionId, rawAnswer) === LIKERT_MAX
}

export function isElevatedConcern(questionId: number, rawAnswer: unknown): boolean {
  return getConcernSeverity(questionId, rawAnswer) >= 4
}
