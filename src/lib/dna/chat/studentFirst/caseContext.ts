import { normalizeDnaChatText } from "../text"
import type { StudentCaseContext, StudentCaseEventId } from "./contracts"

export const DNA_STUDENT_CASE_EVENT_LABELS: Readonly<Record<StudentCaseEventId, string>> = Object.freeze({
  task_interrupted: "görevi bırakma",
  self_recovered: "kendi kendine toparlanma",
  task_resumed: "göreve geri dönme",
  adult_support_received: "yetişkinin sakin desteği",
  activity_resumed: "etkinliğe geri dönme",
  environmental_load_observed: "kalabalık veya sesli ortam",
  activation_increased: "sesin ya da hareketin artması",
  emotional_response_observed: "sinirlenme veya gerginleşme",
  instruction_received: "yönergeyi alma",
  adult_orientation_observed: "başlamak için yetişkine bakma",
})

export const EMPTY_STUDENT_CASE_CONTEXT: StudentCaseContext = Object.freeze({
  eventIds: Object.freeze([]),
  rawMessageStored: false,
})

function unique<T>(values: readonly T[]): T[] {
  return [...new Set(values)]
}

export function observeStudentCaseContext(message: string): StudentCaseContext {
  const normalized = normalizeDnaChatText(message)
  const eventIds: StudentCaseEventId[] = []
  const add = (eventId: StudentCaseEventId, present: boolean) => {
    if (present) eventIds.push(eventId)
  }

  const taskMentioned = /\b(?:gorev|is)\w*\b/u.test(normalized)
  const taskInterrupted = /\b(?:gorev|is)\w*.{0,70}\b(?:birak|kalk|gez)\w*\b/u.test(normalized)
  const selfRecovered = /\bkendi(?:ni| kendine)?\s+toparla\w*\b/u.test(normalized)
  const returnObserved = /\bdon\w*\b/u.test(normalized)
  const adultSupport = /\b(?:ogretmen|yetiskin)\w*\b/u.test(normalized)
    && /\b(?:yavas\w*|yumusat\w*|sakin\w*|yan\w*|destek\w*|bekle\w*)\b/u.test(normalized)
  const activityMentioned = /\b(?:oyun|etkinlik)\w*\b/u.test(normalized)
  const environmentalLoad = /\b(?:kalabalik|sesli|gurultu)\w*\b/u.test(normalized)
  const activationIncrease = /\bses\w*.{0,24}\b(?:yuksel|art)\w*\b/u.test(normalized)
    || /\b(?:cok\s+hareket|hareket\w*.{0,20}\bart|hizli\s+dolas)\w*\b/u.test(normalized)
  const emotionalResponse = /\b(?:sinirlen|ofkelen|gergin)\w*\b/u.test(normalized)
  const instruction = /\b(?:sozlu\s+)?yonerge\w*\b/u.test(normalized)
  const adultOrientation = /\b(?:yetiskin|ogretmen)\w*.{0,36}\bbak\w*\b/u.test(normalized)

  add("task_interrupted", taskInterrupted)
  add("self_recovered", selfRecovered)
  add("task_resumed", returnObserved && (taskMentioned || taskInterrupted || selfRecovered))
  add("adult_support_received", adultSupport)
  add("activity_resumed", returnObserved && activityMentioned)
  add("environmental_load_observed", environmentalLoad)
  add("activation_increased", activationIncrease)
  add("emotional_response_observed", emotionalResponse)
  add("instruction_received", instruction)
  add("adult_orientation_observed", adultOrientation)

  return Object.freeze({
    eventIds: Object.freeze(unique(eventIds)),
    rawMessageStored: false,
  })
}

export function studentCaseEventLabels(context: StudentCaseContext): readonly string[] {
  return Object.freeze(context.eventIds.map((eventId) => DNA_STUDENT_CASE_EVENT_LABELS[eventId]))
}
