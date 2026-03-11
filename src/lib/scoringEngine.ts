export function reverseScore(value:number){
  return 6 - value
}

export function calculateScores(answers:number[], reverseItems:number[]){

  const adjusted = answers.map((a,i)=>{
    const q = i+1
    if(reverseItems.includes(q)){
      return reverseScore(a)
    }
    return a
  })

  const domainScore = (start:number,end:number)=>{
    return adjusted.slice(start,end).reduce((a,b)=>a+b,0)
  }

  const phys = domainScore(0,10)
  const sensory = domainScore(10,20)

  const total = phys + sensory

  return {
    phys,
    sensory,
    total
  }

}
