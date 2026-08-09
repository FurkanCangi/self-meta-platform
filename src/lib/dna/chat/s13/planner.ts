import {
  DNA_S13_REQUIRED_SLOT_VERSION,
  type DnaS13AnswerPlan,
  type DnaS13Claim,
  type DnaS13QueryFrame,
  type DnaS13RequiredAnswerSlot,
} from "./contracts"

function unique(values: readonly string[]) {
  return [...new Set(values.filter(Boolean))]
}

export function createDnaS13RequiredSlots(input: Readonly<{
  frame: DnaS13QueryFrame
  claimsBySubquestion: Readonly<Record<string, readonly DnaS13Claim[]>>
}>): readonly DnaS13RequiredAnswerSlot[] {
  return Object.freeze(input.frame.subquestions.map((subquestion, index) => {
    const claims = input.claimsBySubquestion[subquestion.id] ?? []
    const requiredCount = subquestion.answerabilityHint === "supported" ? Math.min(2, claims.length) : Math.min(1, claims.length)
    const requiredClaims = claims.slice(0, requiredCount)
    const optionalClaims = claims.slice(requiredCount, 4)
    return Object.freeze({
      version: DNA_S13_REQUIRED_SLOT_VERSION,
      id: `slot-${index + 1}`,
      subquestionId: subquestion.id,
      topicId: subquestion.topicId,
      focus: subquestion.focus,
      questionType: subquestion.questionType,
      requiredClaimIds: Object.freeze(requiredClaims.map((claim) => claim.id)),
      optionalClaimIds: Object.freeze(optionalClaims.map((claim) => claim.id)),
      sourceIds: Object.freeze(unique(claims.flatMap((claim) => claim.sourceIds))),
      answerability: claims.length
        ? (subquestion.answerabilityHint === "unsupported" ? "partial" : subquestion.answerabilityHint)
        : "unsupported",
    }) satisfies DnaS13RequiredAnswerSlot
  }))
}

export function createDnaS13AnswerPlan(slots: readonly DnaS13RequiredAnswerSlot[]): DnaS13AnswerPlan {
  const first = slots[0]
  const second = slots[1]
  const direct = first ? [first.id] : []
  const explanation = first && ["definition", "explanation", "measurement", "development", "evidence"].includes(first.questionType)
    ? [first.id]
    : []
  const relation = first && ["relation", "comparison"].includes(first.questionType) ? [first.id] : []
  const secondQuestion = second ? [second.id] : []
  const boundaries = slots.filter((slot) => slot.answerability !== "supported").map((slot) => slot.id)
  return Object.freeze({
    directAnswerSlotIds: Object.freeze(direct),
    explanationSlotIds: Object.freeze(explanation),
    relationSlotIds: Object.freeze(relation),
    secondQuestionSlotIds: Object.freeze(secondQuestion),
    boundarySlotIds: Object.freeze(boundaries),
    orderedSlotIds: Object.freeze(unique([...direct, ...explanation, ...relation, ...secondQuestion, ...boundaries])),
  })
}
