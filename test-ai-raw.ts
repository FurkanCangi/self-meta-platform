import "dotenv/config"
import OpenAI from "openai"

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
})

async function run(){

const prompt = `
Write a clinical pediatric occupational therapy regulation report.

Child profile:

Age: 4 years

Scores
physiological: 33
sensory: 19
emotional: 22
cognitive: 31
executive: 30
interoception: 29
total: 164

Anamnesis
Child shows strong sensitivity to noise and crowded environments.
During haircut and nail trimming child becomes distressed.
When overstimulated child cries and takes long time to calm down.
In structured activities like puzzles attention is good.
`

const res = await client.responses.create({
  model: "gpt-4.1-mini",
  input: prompt
})

console.log("\n======= AI REPORT =======\n")
console.log(res.output_text)

}

run()
