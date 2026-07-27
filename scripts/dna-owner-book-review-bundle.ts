#!/usr/bin/env node

import { createHash } from "node:crypto"
import { existsSync, lstatSync, readFileSync, realpathSync, statSync } from "node:fs"
import { dirname, join, relative, resolve, sep } from "node:path"

import {
  DEFAULT_REPO_MANIFEST,
  DEFAULT_SSD_ROOT,
  FINALIZATION_OUTPUT_SUBPATH,
  sha256Bytes,
  stableHash,
  stableJson,
  verifyFinalizationWorkbench,
} from "./dna-owner-book-finalization-workbench"
import {
  assertContained,
  resolveSecureRoot,
  secureAtomicWriteFile,
  verifySecureFile,
} from "./dna-secure-artifact"

const VERSION = "dna-owner-book-review-bundle@1" as const
const MANIFEST_SCHEMA = "dna-owner-book-review-bundle-manifest@1" as const
const OUTPUT_SUBPATH = "Outputs/SelfMetaAI/dna-intelligence/owner-book-review-bundle"
const REPO_MANIFEST = join(
  process.cwd(),
  "docs/dna-intelligence/program/evidence/owner-book-review-bundle-current.json",
)

type JsonObject = Record<string, unknown>

type ReviewRow = Readonly<{
  order: number
  slotId: string
  chapterId: string
  passageId: string
  artifactPassageSha256: string
  canonicalPassageSha256: string
  passageText: string
}>

type ReviewPayload = Readonly<{
  schemaVersion: "dna-owner-book-review-payload@1"
  workbenchSha256: string
  sourcePackageSha256: string
  finalArtifactSha256: string
  rows: readonly ReviewRow[]
  boundaries: Readonly<Record<string, boolean | string>>
}>

type ReviewManifest = Readonly<{
  schemaVersion: typeof MANIFEST_SCHEMA
  version: typeof VERSION
  workbenchSha256: string
  sourcePackageSha256: string
  finalArtifactSha256: string
  output: Readonly<{
    researchSsdRelativePath: string
    htmlSha256: string
    htmlByteLength: number
    fileMode: "0600"
  }>
  counts: Readonly<{
    chapters: number
    reviewRows: number
  }>
  acceptance: Readonly<{
    sourceWorkbenchVerified: true
    passageHashBindingsVerified: true
    deterministic: true
    offlineOnly: true
    repoTextLeakCount: 0
  }>
  boundaries: Readonly<Record<string, boolean | string>>
}>

function fail(code: string): never {
  throw new Error(code)
}

function asObject(value: unknown, code: string): JsonObject {
  if (!value || typeof value !== "object" || Array.isArray(value)) fail(code)
  return value as JsonObject
}

function asString(value: unknown, code: string): string {
  if (typeof value !== "string" || !value) fail(code)
  return value
}

function asHash(value: unknown, code: string): string {
  const hash = asString(value, code)
  if (!/^[a-f0-9]{64}$/.test(hash)) fail(code)
  return hash
}

function asInteger(value: unknown, code: string): number {
  if (!Number.isSafeInteger(value) || (value as number) < 0) fail(code)
  return value as number
}

function readJson(path: string, code: string): JsonObject {
  if (!existsSync(path) || lstatSync(path).isSymbolicLink() || !lstatSync(path).isFile()) {
    fail(code)
  }
  try {
    return asObject(JSON.parse(readFileSync(path, "utf8")), code)
  } catch {
    fail(code)
  }
}

function exactPackagePath(ssdRoot: string, outputRelativePath: string): string {
  const outputRoot = realpathSync(join(ssdRoot, FINALIZATION_OUTPUT_SUBPATH))
  const requested = resolve(ssdRoot, outputRelativePath)
  const requestedDelta = relative(outputRoot, requested)
  if (!requestedDelta || requestedDelta === ".." || requestedDelta.startsWith(`..${sep}`)
    || requestedDelta.startsWith(sep) || !existsSync(requested)
    || lstatSync(requested).isSymbolicLink() || !lstatSync(requested).isDirectory()) {
    fail("dna_owner_review_workbench_path_invalid")
  }
  const packageDirectory = realpathSync(requested)
  if (dirname(packageDirectory) !== outputRoot) fail("dna_owner_review_workbench_path_invalid")
  return packageDirectory
}

function readSecurePackageFile(packageDirectory: string, name: string, code: string): Buffer {
  const path = join(packageDirectory, name)
  if (!existsSync(path) || lstatSync(path).isSymbolicLink() || !lstatSync(path).isFile()
    || (statSync(path).mode & 0o777) !== 0o600 || dirname(realpathSync(path)) !== packageDirectory) {
    fail(code)
  }
  return readFileSync(path)
}

function buildRows(packageDirectory: string): {
  rows: ReviewRow[]
  finalArtifactSha256: string
  chapterCount: number
} {
  const wrapper = asObject(JSON.parse(readSecurePackageFile(
    packageDirectory,
    "final-book-manifest.json",
    "dna_owner_review_book_manifest_invalid",
  ).toString("utf8")), "dna_owner_review_book_manifest_invalid")
  const bookManifest = asObject(wrapper.bookManifest, "dna_owner_review_book_manifest_invalid")
  const chapters = bookManifest.chapters
  if (!Array.isArray(chapters) || chapters.length < 1) fail("dna_owner_review_chapters_invalid")
  const artifact = readSecurePackageFile(packageDirectory, "final-book-candidate.txt",
    "dna_owner_review_book_artifact_invalid")
  const expectedArtifactSha = asHash(bookManifest.artifactSha256,
    "dna_owner_review_artifact_hash_invalid")
  if (sha256Bytes(artifact) !== expectedArtifactSha) fail("dna_owner_review_artifact_hash_mismatch")
  const passageIndex = new Map<string, { chapterId: string; passage: JsonObject }>()
  for (const chapterValue of chapters) {
    const chapter = asObject(chapterValue, "dna_owner_review_chapter_invalid")
    const chapterId = asString(chapter.chapterId, "dna_owner_review_chapter_id_invalid")
    if (!Array.isArray(chapter.passages)) fail("dna_owner_review_passages_invalid")
    for (const passageValue of chapter.passages) {
      const passage = asObject(passageValue, "dna_owner_review_passage_invalid")
      const passageId = asString(passage.passageId, "dna_owner_review_passage_id_invalid")
      if (passageIndex.has(passageId)) fail("dna_owner_review_duplicate_passage")
      passageIndex.set(passageId, { chapterId, passage })
    }
  }
  const queue = readSecurePackageFile(packageDirectory, "claim-review-queue.jsonl",
    "dna_owner_review_queue_invalid").toString("utf8").trim().split("\n").filter(Boolean)
    .map((line) => asObject(JSON.parse(line), "dna_owner_review_queue_invalid"))
  if (queue.length !== passageIndex.size) fail("dna_owner_review_queue_count_mismatch")
  const rows = queue.map((slot, order) => {
    const passageId = asString(slot.passageId, "dna_owner_review_slot_passage_invalid")
    const indexed = passageIndex.get(passageId)
    if (!indexed) fail("dna_owner_review_slot_binding_missing")
    const range = asObject(indexed.passage.range, "dna_owner_review_range_invalid")
    const start = asInteger(range.startByte, "dna_owner_review_range_start_invalid")
    const end = asInteger(range.endByteExclusive, "dna_owner_review_range_end_invalid")
    if (end <= start || end > artifact.byteLength) fail("dna_owner_review_range_out_of_bounds")
    const slice = artifact.subarray(start, end)
    const artifactPassageSha256 = asString(indexed.passage.artifactPassageSha256,
      "dna_owner_review_passage_hash_invalid")
    const canonicalPassageSha256 = asString(indexed.passage.canonicalPassageSha256,
      "dna_owner_review_canonical_hash_invalid")
    if (sha256Bytes(slice) !== artifactPassageSha256
      || slot.artifactPassageSha256 !== artifactPassageSha256
      || slot.canonicalPassageSha256 !== canonicalPassageSha256
      || slot.chapterId !== indexed.chapterId) {
      fail("dna_owner_review_passage_binding_mismatch")
    }
    return Object.freeze({
      order: order + 1,
      slotId: asString(slot.slotId, "dna_owner_review_slot_id_invalid"),
      chapterId: indexed.chapterId,
      passageId,
      artifactPassageSha256,
      canonicalPassageSha256,
      passageText: new TextDecoder("utf-8", { fatal: true }).decode(slice),
    })
  })
  return { rows, finalArtifactSha256: expectedArtifactSha, chapterCount: chapters.length }
}

function safeScriptJson(value: unknown): string {
  return JSON.stringify(value).replace(/</g, "\\u003c")
    .replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029")
}

function cspHash(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("base64")
}

function htmlForPayload(payload: ReviewPayload): string {
  const embedded = safeScriptJson(payload)
  const style = `:root{color-scheme:light dark;font-family:Inter,ui-sans-serif,system-ui,sans-serif;background:#07111f;color:#e8f4ff}*{box-sizing:border-box}body{margin:0;min-height:100vh;background:radial-gradient(circle at 50% -10%,#12375b 0,#07111f 45%)}button,input,select,textarea{font:inherit}.shell{max-width:1100px;margin:auto;padding:28px 20px 70px}.hero{display:flex;gap:18px;align-items:flex-start;justify-content:space-between;margin-bottom:22px}.eyebrow{color:#64d9ff;font-size:12px;letter-spacing:.14em;text-transform:uppercase}h1{font-size:clamp(26px,4vw,42px);margin:8px 0}.sub{color:#a9bed2;max-width:720px;line-height:1.55}.badge{padding:8px 12px;border:1px solid #245073;border-radius:999px;color:#9bdfff;background:#0a1c2d;white-space:nowrap}.toolbar{display:grid;grid-template-columns:1fr 180px auto;gap:10px;position:sticky;top:0;z-index:3;padding:12px;background:#091829e8;backdrop-filter:blur(12px);border:1px solid #183750;border-radius:18px}.toolbar input,.toolbar select,.field textarea,.field select{min-height:44px;border:1px solid #26465f;border-radius:12px;background:#081522;color:#edf8ff;padding:10px 12px}.progress{margin:18px 2px;color:#a9bed2}.card{border:1px solid #183b57;border-radius:22px;padding:22px;margin:16px 0;background:linear-gradient(145deg,#0b1b2c,#08131f);box-shadow:0 18px 60px #0005}.meta{display:flex;flex-wrap:wrap;gap:8px 14px;color:#81bddc;font-size:12px}.passage{white-space:pre-wrap;line-height:1.65;margin:18px 0;padding:18px;border-radius:16px;background:#07101a;border-left:4px solid #30c8ff}.fields{display:grid;grid-template-columns:220px 1fr;gap:12px}.field{display:grid;gap:7px;color:#cce6f7}.field textarea{resize:vertical;min-height:100px}.actions{display:flex;gap:10px;justify-content:flex-end;margin-top:24px}.primary{min-height:44px;border:0;border-radius:13px;padding:0 18px;background:linear-gradient(110deg,#22c8ff,#7374ff);color:#04101a;font-weight:750;cursor:pointer}.secondary{min-height:44px;border:1px solid #2b5978;border-radius:13px;padding:0 18px;background:#0a1a29;color:#dff5ff;cursor:pointer}.empty{padding:50px;text-align:center;color:#8ba9bf}.warning{color:#ffc778}.hidden{display:none!important}@media(max-width:720px){.hero{display:block}.badge{display:inline-block;margin-top:12px}.toolbar{grid-template-columns:1fr}.fields{grid-template-columns:1fr}.shell{padding:18px 12px 60px}.card{padding:16px}}`
  const script = `const payload=${embedded};
const decisions=new Map();let onlyPending=false;
const cards=document.getElementById('cards'),search=document.getElementById('search'),chapter=document.getElementById('chapter'),progress=document.getElementById('progress');
const chapters=[...new Set(payload.rows.map(row=>row.chapterId))];chapter.append(new Option('Tüm bölümler',''));chapters.forEach(id=>chapter.append(new Option(id,id)));
function node(tag,className,text){const value=document.createElement(tag);if(className)value.className=className;if(text!==undefined)value.textContent=text;return value}
function current(row){return decisions.get(row.slotId)||{status:'pending',proposedClaim:'',note:''}}
function save(row,key,value){const next={...current(row),[key]:value};decisions.set(row.slotId,next);renderProgress()}
function renderProgress(){const reviewed=[...decisions.values()].filter(x=>x.status!=='pending').length;progress.textContent=reviewed+' / '+payload.rows.length+' pasaj karara bağlandı. Bu kayıt bir owner onayı değildir.'}
function render(){cards.replaceChildren();const term=search.value.toLocaleLowerCase('tr-TR');const rows=payload.rows.filter(row=>(!chapter.value||row.chapterId===chapter.value)&&(!term||row.passageText.toLocaleLowerCase('tr-TR').includes(term))&&(!onlyPending||current(row).status==='pending'));if(!rows.length){cards.append(node('div','empty','Bu filtrede pasaj bulunamadı.'));return}rows.forEach(row=>{const state=current(row),card=node('article','card');const meta=node('div','meta');[row.order+' / '+payload.rows.length,row.chapterId,row.passageId].forEach(text=>meta.append(node('span','',text)));card.append(meta,node('div','passage',row.passageText));const fields=node('div','fields');const statusLabel=node('label','field');statusLabel.append(node('span','','Karar'));const status=document.createElement('select');[['pending','Bekliyor'],['accept_as_product_claim','Ürün iddiası olarak kabul et'],['revise_claim','İddiayı düzenle'],['exclude','Dışla']].forEach(([value,label])=>status.append(new Option(label,value)));status.value=state.status;status.addEventListener('change',()=>{save(row,'status',status.value);if(onlyPending)render()});statusLabel.append(status);const claimLabel=node('label','field');claimLabel.append(node('span','','Önerilen atomik iddia'));const claim=document.createElement('textarea');claim.value=state.proposedClaim;claim.placeholder='Yalnız bu pasajın desteklediği tek iddiayı yaz';claim.addEventListener('input',()=>save(row,'proposedClaim',claim.value));claimLabel.append(claim);const noteLabel=node('label','field');noteLabel.append(node('span','','Not'));const note=document.createElement('textarea');note.value=state.note;note.placeholder='Düzeltme, sınır veya dışlama gerekçesi';note.addEventListener('input',()=>save(row,'note',note.value));noteLabel.append(note);fields.append(statusLabel,claimLabel,noteLabel);card.append(fields);cards.append(card)})}
search.addEventListener('input',render);chapter.addEventListener('change',render);document.getElementById('unreviewed').addEventListener('click',event=>{onlyPending=!onlyPending;event.currentTarget.textContent=onlyPending?'Tümünü göster':'Yalnız bekleyenler';render()});document.getElementById('clear').addEventListener('click',()=>{if(confirm('Tarayıcı belleğindeki karar taslağı temizlensin mi?')){decisions.clear();render();renderProgress()}});document.getElementById('export').addEventListener('click',()=>{const rows=payload.rows.map(row=>({slotId:row.slotId,chapterId:row.chapterId,passageId:row.passageId,artifactPassageSha256:row.artifactPassageSha256,canonicalPassageSha256:row.canonicalPassageSha256,...current(row)}));const output={schemaVersion:'dna-owner-book-owner-review-decisions-draft@1',workbenchSha256:payload.workbenchSha256,sourcePackageSha256:payload.sourcePackageSha256,finalArtifactSha256:payload.finalArtifactSha256,decisionCount:rows.filter(row=>row.status!=='pending').length,rows,ownerApproval:false,runtimeEligible:false,releaseEligible:false,answerEligible:false,activationAllowed:false};const blob=new Blob([JSON.stringify(output,null,2)+'\n'],{type:'application/json'}),url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download='dna-owner-review-decisions-'+payload.workbenchSha256.slice(0,12)+'.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),0)});render();renderProgress();`
  const csp = `default-src 'none'; style-src 'sha256-${cspHash(style)}'; script-src 'sha256-${cspHash(script)}'; connect-src 'none'; img-src 'none'; media-src 'none'; font-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-src 'none'; worker-src 'none'`
  return `<!doctype html>
<html lang="tr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta http-equiv="Content-Security-Policy" content="${csp}">
  <title>DNA Kitabı Owner İnceleme Paketi</title>
  <style>${style}</style>
</head>
<body>
<main class="shell">
  <div class="hero"><div><div class="eyebrow">DNA Intelligence · yerel owner aracı</div><h1>Kitap pasajlarını karara bağla</h1><div class="sub">Bu sayfa internete bağlanmaz. Kararlar yalnız tarayıcı belleğinde kalır ve dışa aktarılan dosya owner onayı sayılmaz. Nihai onay ayrıca hash bağlı imza kapısından geçer.</div></div><div class="badge">Otomatik onay kapalı</div></div>
  <div class="toolbar"><input id="search" aria-label="Pasajlarda ara" placeholder="Pasajlarda ara"><select id="chapter" aria-label="Bölüm filtresi"></select><button class="secondary" id="unreviewed">Yalnız bekleyenler</button></div>
  <div class="progress" id="progress" aria-live="polite"></div>
  <section id="cards"></section>
  <div class="actions"><button class="secondary" id="clear">Kararları temizle</button><button class="primary" id="export">Karar taslağını indir</button></div>
</main>
<script>${script}</script>
</body>
</html>
`
}

export function buildReviewBundle(ssdRoot: string, repoManifestPath = DEFAULT_REPO_MANIFEST): {
  payload: ReviewPayload
  html: string
  manifest: ReviewManifest
} {
  const resolvedSsdRoot = resolveSecureRoot(ssdRoot, true)
  if (resolvedSsdRoot !== DEFAULT_SSD_ROOT) fail("dna_owner_review_research_ssd_required")
  const verified = verifyFinalizationWorkbench({ ssdRoot: resolvedSsdRoot, repoManifestPath })
  const compact = readJson(repoManifestPath, "dna_owner_review_repo_manifest_invalid")
  const outputRelativePath = asString(compact.outputRelativePath,
    "dna_owner_review_output_path_missing")
  const packageDirectory = exactPackagePath(resolvedSsdRoot, outputRelativePath)
  const built = buildRows(packageDirectory)
  if (built.rows.length !== verified.passageCount
    || built.chapterCount !== verified.chapterCount
    || built.finalArtifactSha256 !== verified.finalArtifactSha256) {
    fail("dna_owner_review_verified_count_mismatch")
  }
  const workbenchSha256 = asHash(verified.workbenchSha256,
    "dna_owner_review_workbench_hash_invalid")
  const sourcePackageSha256 = asHash(verified.sourcePackageSha256,
    "dna_owner_review_source_hash_invalid")
  const boundaries = Object.freeze({
    ownerActionRequired: true,
    automaticApprovalForbidden: true,
    decisionDraftOnly: true,
    independentScientificReview: false,
    ownerApproval: false,
    runtimeEligible: false,
    releaseEligible: false,
    answerEligible: false,
    activationAllowed: false,
  })
  const payload = Object.freeze({
    schemaVersion: "dna-owner-book-review-payload@1" as const,
    workbenchSha256,
    sourcePackageSha256,
    finalArtifactSha256: built.finalArtifactSha256,
    rows: Object.freeze(built.rows),
    boundaries,
  })
  const html = htmlForPayload(payload)
  const htmlBytes = Buffer.from(html, "utf8")
  const researchSsdRelativePath = `${OUTPUT_SUBPATH}/${workbenchSha256}/owner-review.html`
  const manifest = Object.freeze({
    schemaVersion: MANIFEST_SCHEMA,
    version: VERSION,
    workbenchSha256,
    sourcePackageSha256,
    finalArtifactSha256: built.finalArtifactSha256,
    output: Object.freeze({
      researchSsdRelativePath,
      htmlSha256: sha256Bytes(htmlBytes),
      htmlByteLength: htmlBytes.byteLength,
      fileMode: "0600" as const,
    }),
    counts: Object.freeze({ chapters: built.chapterCount, reviewRows: built.rows.length }),
    acceptance: Object.freeze({
      sourceWorkbenchVerified: true as const,
      passageHashBindingsVerified: true as const,
      deterministic: true as const,
      offlineOnly: true as const,
      repoTextLeakCount: 0 as const,
    }),
    boundaries,
  })
  return { payload, html, manifest }
}

function assertManifestSafe(manifest: ReviewManifest, payload: ReviewPayload): void {
  const serialized = stableJson(manifest)
  for (const row of payload.rows) {
    if (serialized.includes(row.passageText)) fail("dna_owner_review_repo_text_leak")
  }
}

function assertHtmlSecurity(html: string): void {
  const csp = /<meta http-equiv="Content-Security-Policy" content="([^"]+)">/.exec(html)?.[1]
  const style = /<style>([\s\S]*?)<\/style>/.exec(html)?.[1]
  const script = /<script>([\s\S]*?)<\/script>/.exec(html)?.[1]
  if (!csp || style === undefined || script === undefined
    || !csp.includes("default-src 'none'")
    || !csp.includes(`style-src 'sha256-${cspHash(style)}'`)
    || !csp.includes(`script-src 'sha256-${cspHash(script)}'`)
    || !csp.includes("connect-src 'none'") || !csp.includes("object-src 'none'")
    || !csp.includes("base-uri 'none'") || !csp.includes("form-action 'none'")
    || csp.includes("'unsafe-inline'") || csp.includes("'unsafe-eval'")
    || html.includes("innerHTML") || html.includes("outerHTML")
    || html.includes("insertAdjacentHTML") || html.includes("ownerApproval:true")
    || !script.includes("ownerApproval:false") || !script.includes("runtimeEligible:false")
    || !script.includes("releaseEligible:false") || !script.includes("answerEligible:false")
    || !script.includes("activationAllowed:false")) {
    fail("dna_owner_review_html_security_invalid")
  }
}

function writeAndVerify(bundle: ReturnType<typeof buildReviewBundle>, root: string): void {
  const htmlPath = assertContained(root, join(root, bundle.manifest.output.researchSsdRelativePath))
  secureAtomicWriteFile(root, htmlPath, bundle.html)
  verifySecureFile(root, htmlPath, bundle.html)
}

function main(): void {
  const command = process.argv[2] ?? "verify"
  if (!["build", "verify", "print-manifest", "test"].includes(command)
    || process.argv.length !== 3) fail("dna_owner_review_command_invalid")
  const ssdRoot = resolveSecureRoot(process.env.RESEARCH_SSD_ROOT ?? DEFAULT_SSD_ROOT, true)
  const bundle = buildReviewBundle(ssdRoot)
  assertManifestSafe(bundle.manifest, bundle.payload)
  assertHtmlSecurity(bundle.html)
  const hashes = Array.from({ length: 20 }, () => stableHash(buildReviewBundle(ssdRoot).manifest))
  if (new Set(hashes).size !== 1) fail("dna_owner_review_nondeterministic")
  if (command === "build" || command === "print-manifest" || command === "test") {
    writeAndVerify(bundle, ssdRoot)
  } else {
    const htmlPath = assertContained(ssdRoot,
      join(ssdRoot, bundle.manifest.output.researchSsdRelativePath))
    verifySecureFile(ssdRoot, htmlPath, bundle.html)
  }
  if (command === "print-manifest") {
    process.stdout.write(stableJson(bundle.manifest, true))
    return
  }
  if (command !== "test") {
    const recorded = readJson(REPO_MANIFEST, "dna_owner_review_manifest_missing")
    if (stableJson(recorded) !== stableJson(bundle.manifest)) fail("dna_owner_review_manifest_drift")
  }
  if (command === "test") {
    const [first, ...rest] = bundle.payload.rows
    if (!first) fail("dna_owner_review_test_fixture_missing")
    const hostileText = "</script><img src=x onerror=alert(1)>"
    const hostilePayload = {
      ...bundle.payload,
      rows: [{ ...first, passageText: hostileText }, ...rest],
    } satisfies ReviewPayload
    const hostileHtml = htmlForPayload(hostilePayload)
    assertHtmlSecurity(hostileHtml)
    if (hostileHtml.includes(hostileText) || hostileHtml.includes("<img src=x")) {
      fail("dna_owner_review_html_injection_escape_failed")
    }
  }
  process.stdout.write(`${JSON.stringify({
    ok: true,
    version: VERSION,
    counts: bundle.manifest.counts,
    deterministicRepeats: hashes.length,
    uniqueHashes: new Set(hashes).size,
    htmlSha256: bundle.manifest.output.htmlSha256,
    offlineOnly: true,
    automaticApprovalForbidden: true,
    ownerApproval: false,
    runtimeEligible: false,
    releaseEligible: false,
  }, null, 2)}\n`)
}

try {
  main()
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
  process.exitCode = 1
}
