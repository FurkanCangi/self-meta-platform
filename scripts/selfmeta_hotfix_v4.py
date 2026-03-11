from pathlib import Path
from datetime import datetime
import shutil
import re
import sys

root = Path.cwd()
stamp = datetime.now().strftime("%Y%m%d_%H%M%S")

targets = [
    Path("src/lib/selfmeta/aiRewrite.ts"),
    Path("src/lib/selfmeta/aiClinicalPrompt.ts"),
    Path("src/lib/selfmeta/clinicalAnalysis.ts"),
    Path("src/app/api/ai-report/route.ts"),
    Path("src/components/assessment/AssessmentWizardClient.tsx"),
    Path("src/components/assessment/ClinicalReportPanel.tsx"),
    Path("src/app/reports/page.tsx"),
]

for p in targets:
    if p.exists():
        shutil.copy2(p, p.with_suffix(p.suffix + f".bak.{stamp}"))

def read(path: str) -> str:
    return Path(path).read_text(encoding="utf-8")

def write(path: str, text: str) -> None:
    Path(path).write_text(text, encoding="utf-8")

def patch_ai_rewrite():
    path = Path("src/lib/selfmeta/aiRewrite.ts")
    if not path.exists():
        return
    txt = read(str(path))

    txt = txt.replace("gpt-4.1-mini", "gpt-5")
    txt = txt.replace('process.env.OPENAI_REPORT_MODEL || "gpt-4.1"', 'process.env.OPENAI_REPORT_MODEL || "gpt-5"')
    txt = txt.replace("process.env.OPENAI_REPORT_MODEL || 'gpt-4.1'", "process.env.OPENAI_REPORT_MODEL || 'gpt-5'")
    txt = txt.replace('process.env.OPENAI_REPORT_MODEL || "gpt-5-mini"', 'process.env.OPENAI_REPORT_MODEL || "gpt-5"')

    if "SELF_META_MAX_OUTPUT_TOKENS" not in txt:
        block = '''
const SELF_META_MODEL = process.env.OPENAI_REPORT_MODEL || "gpt-5"
const SELF_META_MAX_OUTPUT_TOKENS = Number(process.env.OPENAI_REPORT_MAX_OUTPUT_TOKENS || "2200")
const SELF_META_TEMPERATURE = Number(process.env.OPENAI_REPORT_TEMPERATURE || "0.35")
'''
        m = re.search(r'(function\s+getClient\s*\(\)\s*{[\s\S]*?}\s*)', txt)
        if m:
            txt = txt[:m.end()] + "\n" + block + "\n" + txt[m.end():]
        else:
            txt = block + "\n" + txt

    txt = re.sub(r'model\s*:\s*process\.env\.OPENAI_REPORT_MODEL\s*\|\|\s*["\'][^"\']+["\']', 'model: SELF_META_MODEL', txt)
    txt = re.sub(r'model\s*:\s*["\']gpt-[^"\']+["\']', 'model: SELF_META_MODEL', txt)

    if "max_output_tokens: SELF_META_MAX_OUTPUT_TOKENS" not in txt and "max_completion_tokens: SELF_META_MAX_OUTPUT_TOKENS" not in txt:
        txt = re.sub(
            r'(\{\s*model\s*:\s*SELF_META_MODEL\s*,)',
            r'\1\n      temperature: SELF_META_TEMPERATURE,\n      max_output_tokens: SELF_META_MAX_OUTPUT_TOKENS,',
            txt,
            count=1
        )

    write(str(path), txt)
    print("patched", path)

def patch_ai_prompt():
    path = Path("src/lib/selfmeta/aiClinicalPrompt.ts")
    if not path.exists():
        return
    txt = read(str(path))

    guide = '''
const SELF_META_CLINICAL_STYLE_GUIDE = `
YALNIZCA VERİ TEMELLİ YAZ:
- Yalnızca deterministik analiz ve clinicalAnalysis alanlarına dayan.
- Yeni veri, dışsal bilgi, normatif açıklama veya ek klinik çıkarım üretme.
- Tanı koyma, müdahale önerme, tedavi önerme, tavsiye listesi üretme.

DİL VE KLİNİK TON:
- Türkçe yaz.
- Profesyonel klinik üslup kullan.
- "self-regülasyon" terminolojisini koru.
- "çocuk" veya "danışan" ifadesini kullan.
- Gereksiz çekingenlikten kaçın; ancak verinin izin vermediği kesinlik kurulmasın.
- Bölümler kısa geçilmesin. Her başlık tamamlansın.
- Metin yarım kalmış görünmemeli.
- Toplam metin yaklaşık 450 ile 700 kelime aralığında olsun.
- Her bölüm en az 3 cümle içersin.
- Bölüm başlıkları mutlaka yer alsın.
- Teknik örüntü yorumu boş bırakılmasın.
- confidenceLevel ve confidenceReason bilgisi, anamnez ve ölçek uyumu bölümünde açık biçimde kullanılmalıdır.

BAŞLIK ZORUNLULUĞU:
1. Genel Klinik Değerlendirme
2. Öncelikli Self-Regülasyon Alanları
3. Alanlar Arası Klinik Örüntü
4. Anamnez ve Ölçek Bulgularının Uyum Düzeyi
5. Sonuç Düzeyinde Klinik Özet

İÇERİK ZORUNLULUĞU:
- Genel Klinik Değerlendirme bölümünde profileType, globalLevel ve korunmuş alanlar ile zorlanan alanlar birlikte anlatılmalı.
- Öncelikli Self-Regülasyon Alanları bölümünde priorityDomains ve domainSummary kullanılmalı.
- Alanlar Arası Klinik Örüntü bölümünde patternNarrative ve domainInteractionSummary kullanılarak tetikleyici alan, zorlanan alan, kontrol alanı ve korunmuş alan açıkça anlatılmalı.
- Anamnez ve Ölçek Bulgularının Uyum Düzeyi bölümünde anamnezThemes, confidenceLevel ve confidenceReason doğrudan kullanılmalı.
- Sonuç Düzeyinde Klinik Özet bölümü tamamlanmış, yoğun ve güçlü bir kapanış yapmalı.

KAÇINILACAK İFADELER:
- normatif veri gösteriyor ki
- kesin olarak
- önerilir
- uygulanmalıdır
- tedavi
- İngilizce ifade
- çok sık tekrar eden düşündürebilir, olabilir, görünebilir kalıpları
`
'''.strip()

    if "SELF_META_CLINICAL_STYLE_GUIDE" not in txt:
        m = re.search(r'^(import[\s\S]+?;\n)+', txt)
        if m:
            txt = txt[:m.end()] + "\n" + guide + "\n\n" + txt[m.end():]
        else:
            txt = guide + "\n\n" + txt

    pairs = [
        ("1. Genel Klinik Özet", "1. Genel Klinik Değerlendirme"),
        ("3. Ölçekler Arası Örüntü", "3. Alanlar Arası Klinik Örüntü"),
        ("4. Anamnez ile Test Bulgularının Uyum Analizi", "4. Anamnez ve Ölçek Bulgularının Uyum Düzeyi"),
        ("5. Kısa Klinik Sonuç", "5. Sonuç Düzeyinde Klinik Özet"),
        ("duysal", "duyusal"),
        ("dosyal", "duyusal"),
    ]
    for a, b in pairs:
        txt = txt.replace(a, b)

    inserted = False
    for rgx in [
        r'(return\s*`)',
        r'((?:const|let)\s+\w*prompt\w*\s*=\s*`)',
        r'((?:const|let)\s+prompt\s*=\s*`)',
    ]:
        m = re.search(rgx, txt)
        if m:
            if "${SELF_META_CLINICAL_STYLE_GUIDE}" not in txt[m.start():m.start()+250]:
                txt = txt[:m.end()] + "${SELF_META_CLINICAL_STYLE_GUIDE}\n\n" + txt[m.end():]
            inserted = True
            break

    if not inserted and "SELF_META_CLINICAL_STYLE_GUIDE" not in txt:
        txt += "\n\nexport const SELF_META_PROMPT_MIN_WORD_TARGET = 450\n"

    write(str(path), txt)
    print("patched", path)

def patch_clinical_analysis():
    path = Path("src/lib/selfmeta/clinicalAnalysis.ts")
    if not path.exists():
        return
    txt = read(str(path))

    helper = '''
function selfMetaNormalizeText(input: unknown): string {
  return String(input ?? "")
    .toLocaleLowerCase("tr-TR")
    .normalize("NFKD")
    .replace(/[\\u0300-\\u036f]/g, "")
}

function selfMetaCountHits(source: string, terms: string[]): number {
  const s = selfMetaNormalizeText(source)
  return terms.reduce((acc, term) => acc + (s.includes(selfMetaNormalizeText(term)) ? 1 : 0), 0)
}

function deriveSelfMetaConfidence(input: {
  anamnezThemes?: string[]
  priorityDomains?: string[]
  domainSummary?: Record<string, string> | undefined
  globalLevel?: string
  profileType?: string
  patternNarrative?: string
  domainInteractionSummary?: string
}) {
  const anamnezThemes = input.anamnezThemes ?? []
  const priorityDomains = input.priorityDomains ?? []
  const joinedThemes = anamnezThemes.join(" | ")

  const domainMap: Record<string, string[]> = {
    "Fizyolojik Regülasyon": ["uyku", "yorgunluk", "açlık", "susuzluk", "bedensel", "fizyolojik", "arousal"],
    "Duyusal Regülasyon": ["duyusal", "uyaran", "yüklenme", "ses", "kalabalık", "dokunma", "gürültü"],
    "Duygusal Regülasyon": ["öfke", "ağlama", "duygusal", "toparlanma", "kriz", "sakinleşme"],
    "Bilişsel Regülasyon": ["dikkat", "odak", "görev", "bilişsel", "sürdürme"],
    "Yürütücü İşlev": ["geçiş", "planlama", "organizasyon", "esneklik", "başlatma", "tamamlama", "ketleme"],
    "İnterosepsiyon": ["tuvalet", "açlık", "susuzluk", "yorgunluk", "ağrı", "içsel", "bedensel farkındalık"],
  }

  let matchScore = 0
  for (const domain of priorityDomains) {
    const terms = domainMap[domain] ?? []
    matchScore += selfMetaCountHits(joinedThemes, terms)
  }

  const summaryStrength = Object.values(input.domainSummary ?? {}).filter(Boolean).length
  const structureStrength =
    (input.patternNarrative ? 1 : 0) +
    (input.domainInteractionSummary ? 1 : 0) +
    (priorityDomains.length >= 2 ? 1 : 0) +
    (summaryStrength >= 2 ? 1 : 0)

  const total = matchScore + structureStrength

  let confidenceLevel: "Düşük" | "Orta" | "Yüksek" = "Düşük"
  if (total >= 6) confidenceLevel = "Yüksek"
  else if (total >= 3) confidenceLevel = "Orta"

  const reasonParts: string[] = []
  if (matchScore >= 3) reasonParts.push("Anamnez temaları ile öncelikli alanlar arasında belirgin eşleşme vardır.")
  else if (matchScore >= 1) reasonParts.push("Anamnez temaları ile öncelikli alanlar arasında kısmi eşleşme vardır.")
  else reasonParts.push("Anamnez temaları ile öncelikli alanlar arasındaki eşleşme sınırlıdır.")

  if (structureStrength >= 3) reasonParts.push("Alanlar arası örüntü yapısı klinik olarak tutarlı görünmektedir.")
  else if (structureStrength >= 1) reasonParts.push("Alanlar arası örüntü yapısı kısmen tanımlanabilmektedir.")

  const patternNarrative =
    input.patternNarrative && String(input.patternNarrative).trim()
      ? String(input.patternNarrative).trim()
      : `${input.profileType ?? "Karışık Regülasyon Profili"} içinde, öncelikli alanların birlikte yüklenmesiyle belirginleşen ve genel düzeyi ${input.globalLevel ?? "belirtilmemiş"} olan bir klinik örüntü oluşmaktadır.`

  const domainInteractionSummary =
    input.domainInteractionSummary && String(input.domainInteractionSummary).trim()
      ? String(input.domainInteractionSummary).trim()
      : `${priorityDomains.length ? priorityDomains.join(", ") : "Öncelikli alanlar"} birlikte değerlendirildiğinde, tetikleyici alanlar ile zorlanan kontrol alanlarının aynı örüntü içinde yer aldığı; korunmuş alanların ise genel profil içinde dengeleyici rol oynayabildiği anlaşılmaktadır.`

  return {
    confidenceLevel,
    confidenceReason: reasonParts.join(" "),
    patternNarrative,
    domainInteractionSummary,
  }
}
'''.strip()

    if "deriveSelfMetaConfidence(" not in txt:
        txt += "\n\n" + helper + "\n"

    if "const enhancedConfidence = deriveSelfMetaConfidence({" not in txt:
        m = re.search(r'\n(\s*)return\s*{', txt)
        if m:
            indent = m.group(1)
            block = (
                "\n"
                + indent + "const enhancedConfidence = deriveSelfMetaConfidence({\n"
                + indent + "  anamnezThemes,\n"
                + indent + "  priorityDomains,\n"
                + indent + "  domainSummary,\n"
                + indent + "  globalLevel,\n"
                + indent + "  profileType,\n"
                + indent + "  patternNarrative,\n"
                + indent + "  domainInteractionSummary,\n"
                + indent + "})\n"
            )
            txt = txt[:m.start()] + block + txt[m.start():]

    txt = re.sub(r'confidenceLevel\s*:\s*[^,\n}]+', 'confidenceLevel: enhancedConfidence.confidenceLevel', txt, count=1)
    txt = re.sub(r'confidenceReason\s*:\s*[^,\n}]+', 'confidenceReason: enhancedConfidence.confidenceReason', txt, count=1)
    txt = re.sub(r'patternNarrative\s*:\s*[^,\n}]+', 'patternNarrative: patternNarrative || enhancedConfidence.patternNarrative', txt, count=1)
    txt = re.sub(r'domainInteractionSummary\s*:\s*[^,\n}]+', 'domainInteractionSummary: domainInteractionSummary || enhancedConfidence.domainInteractionSummary', txt, count=1)

    if "patternNarrative:" not in txt:
        txt = re.sub(
            r'(return\s*{)',
            r'\1\n    patternNarrative: enhancedConfidence.patternNarrative,\n    domainInteractionSummary: enhancedConfidence.domainInteractionSummary,',
            txt,
            count=1
        )

    write(str(path), txt)
    print("patched", path)

def patch_api_route():
    path = Path("src/app/api/ai-report/route.ts")
    if not path.exists():
        return
    txt = read(str(path))

    if "checkExistingSelfMetaReportLock" not in txt:
        helper = '''
async function checkExistingSelfMetaReportLock(supabase: any, payload: any) {
  const clientCode = String(
    payload?.client_code ??
    payload?.clientCode ??
    payload?.client?.code ??
    payload?.client?.client_code ??
    payload?.client?.id ??
    payload?.client_id ??
    payload?.clientId ??
    ""
  ).trim()

  if (!clientCode) {
    return { locked: false, existing: null }
  }

  const { data, error } = await supabase
    .from("reports")
    .select("id, report_text, client_code, created_at")
    .eq("client_code", clientCode)
    .not("report_text", "is", null)
    .order("created_at", { ascending: false })
    .limit(1)

  if (error) {
    return { locked: false, existing: null }
  }

  if (data && data.length > 0) {
    return { locked: true, existing: data[0] }
  }

  return { locked: false, existing: null }
}
'''.strip()

        m = re.search(r'^(import[\s\S]+?;\n)+', txt)
        if m:
            txt = txt[:m.end()] + "\n" + helper + "\n\n" + txt[m.end():]
        else:
            txt = helper + "\n\n" + txt

    if 'status: 409' not in txt:
        for rgx in [
            r'(const\s+body\s*=\s*await\s+request\.json\(\)\s*)',
            r'(const\s+payload\s*=\s*await\s+request\.json\(\)\s*)',
            r'(const\s+data\s*=\s*await\s+request\.json\(\)\s*)',
        ]:
            m = re.search(rgx, txt)
            if m:
                var_name = re.search(r'const\s+(\w+)\s*=', m.group(1)).group(1)
                block = (
                    "\n"
                    + f"const selfMetaLock = await checkExistingSelfMetaReportLock(supabase, {var_name})\n"
                    + "if (selfMetaLock.locked) {\n"
                    + "  return Response.json({\n"
                    + "    ok: false,\n"
                    + "    locked: true,\n"
                    + '    message: "Bu vaka için rapor daha önce oluşturulduğu için yeni rapor üretimi kapatılmıştır.",\n'
                    + "    existingReportCreatedAt: selfMetaLock.existing?.created_at ?? null,\n"
                    + "  }, { status: 409 })\n"
                    + "}\n"
                )
                txt = txt[:m.end()] + block + txt[m.end():]
                break

    write(str(path), txt)
    print("patched", path)

def patch_assessment_wizard():
    path = Path("src/components/assessment/AssessmentWizardClient.tsx")
    if not path.exists():
        return
    txt = read(str(path))

    if 'const [reportLocked, setReportLocked] = useState(false)' not in txt:
        txt = txt.replace(
            'const [saveMsg, setSaveMsg] = useState("")',
            'const [saveMsg, setSaveMsg] = useState("")\n  const [reportLocked, setReportLocked] = useState(false)\n  const [reportLockReason, setReportLockReason] = useState("")'
        )

    if 'const checkExistingReportLock = async (' not in txt:
        block = '''
  const checkExistingReportLock = async (clientCode?: string | number | null) => {
    try {
      const normalized = String(clientCode ?? "").trim()
      if (!normalized) return
      const { data, error } = await supabase
        .from("reports")
        .select("id, report_text, client_code, created_at")
        .eq("client_code", normalized)
        .not("report_text", "is", null)
        .order("created_at", { ascending: false })
        .limit(1)

      if (!error && data && data.length > 0) {
        setReportLocked(true)
        setReportLockReason("Bu vaka için rapor daha önce oluşturulmuş. Skor girişi yeniden açılamaz.")
      } else {
        setReportLocked(false)
        setReportLockReason("")
      }
    } catch (error) {
      console.error("report lock check failed", error)
    }
  }
'''.strip()
        m = re.search(r'(const\s+supabase\s*=.*?\n)', txt)
        if m:
            txt = txt[:m.end()] + "\n" + block + "\n\n" + txt[m.end():]
        else:
            txt += "\n\n" + block + "\n"

    if "void checkExistingReportLock(" not in txt:
        txt += '''
useEffect(() => {
  const clientCode =
    (clientInfo as any)?.code ??
    (clientInfo as any)?.client_code ??
    (clientInfo as any)?.id ??
    null
  if (clientCode) {
    void checkExistingReportLock(clientCode)
  }
}, [clientInfo])
'''

    if 'if (reportLocked)' not in txt:
        for rgx in [
            r'(const\s+handleGenerateReport\s*=\s*async\s*\([^)]*\)\s*=>\s*{)',
            r'(async\s+function\s+handleGenerateReport\s*\([^)]*\)\s*{)',
            r'(const\s+onGenerateReport\s*=\s*async\s*\([^)]*\)\s*=>\s*{)',
        ]:
            m = re.search(rgx, txt)
            if m:
                txt = txt[:m.end()] + '\n    if (reportLocked) {\n      setSaveMsg(reportLockReason || "Bu vaka için rapor daha önce oluşturulduğu için yeniden skor girişi kapatılmıştır.")\n      return\n    }\n' + txt[m.end():]
                break

    txt = txt.replace('disabled={saving}', 'disabled={saving || reportLocked}')
    txt = txt.replace('disabled={loading}', 'disabled={loading || reportLocked}')
    txt = txt.replace('disabled={isSubmitting}', 'disabled={isSubmitting || reportLocked}')
    txt = txt.replace('>Rapor Oluştur<', '>{reportLocked ? "Rapor Kilitli" : "Rapor Oluştur"}<')
    txt = txt.replace(">Skor\\nGir<", '>{"Skor Gir"}<')
    txt = txt.replace(">Skor Gir<", '>{"Skor Gir"}<')

    if 'Rapor kilitli.' not in txt:
        banner = '''
      {reportLocked ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">
          Rapor kilitli. {reportLockReason || "Bu vaka için rapor daha önce oluşturulduğu için skor girişi kapatılmıştır."}
        </div>
      ) : null}
'''.rstrip()
        idx = txt.find("saveMsg")
        if idx != -1:
            start = txt.rfind("\n", 0, idx)
            txt = txt[:start] + "\n" + banner + "\n" + txt[start:]
        else:
            txt += "\n" + banner + "\n"

    write(str(path), txt)
    print("patched", path)

def patch_clinical_report_panel():
    path = Path("src/components/assessment/ClinicalReportPanel.tsx")
    if not path.exists():
        return
    txt = read(str(path))

    txt = txt.replace("AI Rapor", "Final Klinik Rapor")
    txt = txt.replace("Klinik Yorum", "Final Klinik Raporu")
    txt = txt.replace("duysal", "duyusal")
    txt = txt.replace("dosyal", "duyusal")

    txt = re.sub(
        r'advancedReport\??\.clinicalAnalysis\??\.domainInteractionSummary\s*\|\|\s*""',
        'advancedReport?.clinicalAnalysis?.domainInteractionSummary || advancedReport?.clinicalAnalysis?.patternNarrative || advancedReport?.deterministic?.clinicalAnalysis?.domainInteractionSummary || advancedReport?.deterministic?.clinicalAnalysis?.patternNarrative || "Alanlar arası teknik örüntü mevcut klinik yapıdan üretilmiştir."',
        txt
    )
    txt = re.sub(
        r'advancedReport\??\.clinicalAnalysis\??\.patternNarrative\s*\|\|\s*""',
        'advancedReport?.clinicalAnalysis?.patternNarrative || advancedReport?.clinicalAnalysis?.domainInteractionSummary || advancedReport?.deterministic?.clinicalAnalysis?.patternNarrative || advancedReport?.deterministic?.clinicalAnalysis?.domainInteractionSummary || "Klinik örüntü anlatısı mevcut veriye göre oluşturulmuştur."',
        txt
    )

    if "Pattern Güveni" not in txt:
        block = '''
      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Pattern Güveni</div>
        <div className="mt-2 text-2xl font-semibold text-slate-900">
          {advancedReport?.clinicalAnalysis?.confidenceLevel || advancedReport?.deterministic?.clinicalAnalysis?.confidenceLevel || "Belirtilmedi"}
        </div>
        <div className="mt-2 text-sm leading-6 text-slate-600">
          {advancedReport?.clinicalAnalysis?.confidenceReason || advancedReport?.deterministic?.clinicalAnalysis?.confidenceReason || "Anamnez ve ölçek bulgularının eşleşme düzeyi bu alanda gösterilir."}
        </div>
      </div>
'''
        m = re.search(r'(<div[^>]+>\s*<div[^>]*>\s*Toplam Skor)', txt)
        if m:
            txt = txt[:m.start()] + block + "\n" + txt[m.start():]

    write(str(path), txt)
    print("patched", path)

def patch_reports_page():
    path = Path("src/app/reports/page.tsx")
    if not path.exists():
        return
    txt = read(str(path))

    txt = txt.replace("AI Rapor", "Final Klinik Rapor")
    txt = txt.replace("Klinik Yorum", "Final Klinik Raporu")
    txt = txt.replace("duysal", "duyusal")
    txt = txt.replace("dosyal", "duyusal")

    txt = re.sub(
        r'report\.clinicalAnalysis\??\.domainInteractionSummary\s*\|\|\s*""',
        'report.clinicalAnalysis?.domainInteractionSummary || report.clinicalAnalysis?.patternNarrative || report.deterministic?.clinicalAnalysis?.domainInteractionSummary || report.deterministic?.clinicalAnalysis?.patternNarrative || "Alanlar arası teknik örüntü mevcut klinik yapıdan üretilmiştir."',
        txt
    )
    txt = re.sub(
        r'report\.clinicalAnalysis\??\.patternNarrative\s*\|\|\s*""',
        'report.clinicalAnalysis?.patternNarrative || report.clinicalAnalysis?.domainInteractionSummary || report.deterministic?.clinicalAnalysis?.patternNarrative || report.deterministic?.clinicalAnalysis?.domainInteractionSummary || "Klinik örüntü anlatısı mevcut veriye göre oluşturulmuştur."',
        txt
    )

    write(str(path), txt)
    print("patched", path)

patch_ai_rewrite()
patch_ai_prompt()
patch_clinical_analysis()
patch_api_route()
patch_assessment_wizard()
patch_clinical_report_panel()
patch_reports_page()
print("DONE")
