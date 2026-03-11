import { questions } from "./questions"

export function getDefaultAnswers(){
const obj:any = {}

questions.forEach(q=>{
obj[q.id] = 3
})

return obj
}
