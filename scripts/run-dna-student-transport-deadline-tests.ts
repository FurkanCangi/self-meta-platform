import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { requestDnaS13StructuredOutputDetailed } from "../src/lib/dna/chat/s13/server"
import { executeStudentAnswer, DNA_STUDENT_ANSWER_EXECUTOR_TIMEOUT_MS, DNA_STUDENT_ANSWER_EXECUTOR_MAX_PROVIDER_CALLS,
  DNA_STUDENT_ANSWER_EXECUTOR_MAX_TRANSPORT_RETRIES } from "../src/lib/dna/chat/studentFirst/answerExecutor.server"

// Virtual time exercises real transport code without network, real keys or long waits.
async function clock<T>(action: (advance: (ms: number) => Promise<void>) => Promise<T>): Promise<T> {
  const set = globalThis.setTimeout, clear = globalThis.clearTimeout
  let now = 0, id = 0
  const timers = new Map<number, { at: number; fire: () => void }>()
  globalThis.setTimeout = ((fn: () => void, ms: number) => { const key = ++id; timers.set(key, { at: now + ms, fire: fn }); return key }) as unknown as typeof set
  globalThis.clearTimeout = ((key: number) => { timers.delete(Number(key)) }) as unknown as typeof clear
  const advance = async (ms: number) => {
    const end = now + ms
    while (true) {
      const next = [...timers].filter(([,t]) => t.at <= end).sort((a,b) => a[1].at - b[1].at)[0]
      if (!next) break
      now = next[1].at; timers.delete(next[0]); next[1].fire()
      for (let i=0;i<8;i++) await Promise.resolve()
    }
    now = end
  }
  try { return await action(advance) } finally { globalThis.setTimeout = set; globalThis.clearTimeout = clear }
}
const base = { name: "dna_student_answer_executor", schema: {}, instructions: "unchanged", content: "synthetic",
  maxOutputTokens: 900, timeoutMs: DNA_STUDENT_ANSWER_EXECUTOR_TIMEOUT_MS, apiKey: "offline-not-real" }
const payload = { output_text: '{"ok":true}', usage: { input_tokens: 3, output_tokens: 2 } }
async function main() {
  const tests: string[] = []
  const pass = (name: string) => tests.push(name)
  assert.equal(DNA_STUDENT_ANSWER_EXECUTOR_MAX_PROVIDER_CALLS,1)
  assert.equal(DNA_STUDENT_ANSWER_EXECUTOR_MAX_TRANSPORT_RETRIES,0)
  pass("single_attempt_no_hidden_retry")
  for (const [name,timeoutMs,delay,expected] of [
    [base.name,30_000,35_000,false], [base.name,90_000,35_000,true],
    [base.name,90_000,89_000,true], [base.name,900_000,91_000,false],
    ["legacy_s13",90_000,35_000,false], ["legacy_s13",undefined,6_000,false],
  ] as const) {
    await clock(async advance => {
      let calls=0
      const p=requestDnaS13StructuredOutputDetailed({ ...base,name,timeoutMs,
        fetchImpl: (async (_url,init) => { calls++; return new Promise<Response>((resolve,reject)=>{
          init!.signal!.addEventListener("abort",()=>reject(new DOMException("aborted","AbortError")),{once:true})
          setTimeout(()=>resolve(Response.json(payload)),delay)
        }) }) as typeof fetch })
      await advance(Math.max(delay,91_000)); const result=await p
      assert.equal(result.ok,expected);assert.equal(calls,1)
      if(!result.ok) assert.equal(result.failure.reason,"timeout")
      if(name==="legacy_s13"&&!result.ok) assert.equal(result.failure.transport,undefined)
    })
    pass(`${name}_${timeoutMs ?? "default"}_${delay}_${expected}`)
  }
  await clock(async advance=>{
    const p=requestDnaS13StructuredOutputDetailed({...base,fetchImpl:(async()=>{
      const error=new Error("sensitive raw details");Object.assign(error,{cause:{code:"ECONNRESET"}});throw error
    }) as typeof fetch})
    await advance(0);const r=await p;assert.ok(!r.ok)
    assert.equal(r.failure.reason,"network_error");assert.equal(r.failure.transport?.phase,"waiting_headers")
    assert.equal(r.failure.transport?.causeCode,"ECONNRESET");assert.equal(r.failure.transport?.deadlineExceeded,false)
    assert.ok(!JSON.stringify(r).includes("sensitive"));pass("sanitized_connection_failure")
  })
  await clock(async advance=>{
    const p=requestDnaS13StructuredOutputDetailed({...base,fetchImpl:(async(_url,init)=>({
      ok:true,status:200,json:()=>new Promise((_,reject)=>init!.signal!.addEventListener("abort",()=>reject(Error("wrapped abort")),{once:true}))
    } as Response)) as typeof fetch})
    await Promise.resolve();await advance(90_000);const r=await p;assert.ok(!r.ok)
    assert.equal(r.failure.reason,"timeout");assert.equal(r.failure.httpStatus,200)
    assert.equal(r.failure.transport?.phase,"reading_body");assert.equal(r.failure.transport?.deadlineExceeded,true)
    pass("body_timeout_not_invalid_json")
  })
  await clock(async advance=>{
    const p=requestDnaS13StructuredOutputDetailed({...base,fetchImpl:(async(_url,init)=>new Promise((_,reject)=>
      init!.signal!.addEventListener("abort",()=>reject(Error("recorder replacement error")),{once:true}))) as typeof fetch})
    await advance(90_000);const r=await p;assert.ok(!r.ok)
    assert.equal(r.failure.reason,"timeout");assert.equal(r.failure.transport?.deadlineExceeded,true)
    pass("deadline_survives_wrapped_abort")
  })
  const http=await requestDnaS13StructuredOutputDetailed({...base,fetchImpl:(async()=>Response.json({error:{type:"rate_limit",code:"rate_limit_exceeded"}},{status:429})) as typeof fetch})
  assert.ok(!http.ok);assert.equal(http.failure.reason,"http_error");assert.equal(http.failure.httpStatus,429);pass("http_status_not_transport_timeout")
  const oldRoot="/Volumes/ResearchSSD/Outputs/SelfMetaAI/DNA_CHAT_V1_RELEASE_CLOSURE_20260911/acceptance-attempt-1"
  const old=JSON.parse(readFileSync(oldRoot+"/box3-sci-007-runtime.json","utf8"))
  const original=JSON.parse(readFileSync(oldRoot+"/call-1083-started.json","utf8"))
  await clock(async advance=>{
    let calls=0
    const p=executeStudentAnswer({question:original.active.question,contract:old.student.contract,apiKey:"offline-not-real",
      fetchImpl:(async(_url,init)=>{
        calls++;assert.deepEqual(JSON.parse(String(init!.body)),original.request,"technical fix must preserve full model payload")
        return new Promise((_,reject)=>init!.signal!.addEventListener("abort",()=>reject(Error("opaque wrapper")),{once:true}))
      }) as typeof fetch})
    await advance(90_000);const r=await p;assert.ok(!r.ok&&r.reason==="provider_failure")
    assert.equal(r.failure.reason,"timeout");assert.equal(calls,1);assert.equal(r.provider.transportRetries,0)
    assert.equal(r.provider.usageComplete,false);assert.equal(r.failure.transport?.deadlineMs,90_000)
    pass("executor_payload_identical_timeout_usage_unknown_no_retry")
  })
  const route=readFileSync("src/app/api/app/dna-chat/route.ts","utf8")
  assert.match(route,/export const maxDuration = 180/);pass("route_budget_exceeds_context_plus_answer")
  console.log(JSON.stringify({status:"PASS",checks:tests.length,tests,networkCalls:0,syntheticVirtualTime:true,releaseAcceptance:false}))
}
void main().catch(error=>{console.error(error);process.exitCode=1})
