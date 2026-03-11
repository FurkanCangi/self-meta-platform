from pathlib import Path
from datetime import datetime
import shutil
import re

root = Path.cwd()
stamp = datetime.now().strftime("%Y%m%d_%H%M%S")

candidates = [
    Path("src/components/assessment/AssessmentWizardClient.tsx"),
    Path("src/lib/selfmeta/aiClinicalPrompt.ts"),
    Path("src/lib/selfmeta/aiRewrite.ts"),
    Path("src/lib/selfmeta/clinicalAnalysis.ts"),
    Path("src/app/reports/page.tsx"),
    Path("src/components/assessment/ClinicalReportPanel.tsx"),
    Path("src/app/api/ai-report/route.ts"),
]

for p in candidates:
    if p.exists():
        shutil.copy2(p, p.with_suffix(p.suffix + f".v5bak.{stamp}"))

def read(path: Path) -> str:
    return path.read_text(encoding="utf-8")

def write(path: Path, text: str) -> None:
    path.write_text(text, encoding="utf-8")

def ensure_use_client_first(text: str) -> str:
    lines = text.splitlines()
    lines = [line for line in lines if line.strip() != '"use client"']
    lines.insert(0, '"use client"')
    return "\n".join(lines) + "\n"

def patch_all_age_queries():
    for p in root.rglob("src/**/*.*"):
        if p.suffix not in {".ts", ".tsx", ".js", ".jsx"}:
            continue
        try:
            txt = read(p)
        except:
            continue
        new = txt
        new = new.replace("clients.age", "clients.age_months")
        new = new.replace("client:clients(age", "client:clients(age_months")
        new = new.replace("clients ( age", "clients ( age_months")
        new = new.replace("clients(age,", "clients(age_months,")
        new = new.replace("clients(age)", "clients(age_months)")
        new = new.replace(" age does not exist", " age_months does not exist")
        if new != txt:
            write(p, new)
            print("patched age query", p)

def patch_assessment():
    p = Path("src/components/assessment/AssessmentWizardClient.tsx")
    if not p.exists():
        return
    txt = read(p)
    txt = ensure_use_client_first(txt)

    txt = re.sub(
        r'\n\s*useEffect\(\(\)\s*=>\s*{\s*const clientCode[\s\S]*?}\s*,\s*\[clientInfo\]\)\s*\n',
        '\n',
        txt,
        flags=re.S
    )

    txt = re.sub(
        r'\n\s*const \[reportLocked,\s*setReportLocked\]\s*=\s*useState\(false\)\s*\n\s*const \[reportLockReason,\s*setReportLockReason\]\s*=\s*useState\(""\)\s*\n',
        '\n',
        txt,
        flags=re.S
    )

    txt = re.sub(
        r'\n\s*const checkExistingReportLock = async \([\s\S]*?\n\s*}\s*\n',
        '\n',
        txt,
        count=1,
        flags=re.S
    )

    if 'from "@/lib/supabase/client"' not in txt and "from '@/lib/supabase/client'" not in txt:
        m = re.search(r'^(?:import[^\n]+\n)+', txt)
        import_line = 'import { supabase } from "@/lib/supabase/client"\n'
        if m:
            txt = txt[:m.end()] + import_line + txt[m.end():]
        else:
            txt = import_line + txt

    component_match = None
    for pat in [
        r'export\s+default\s+function\s+AssessmentWizardClient\s*\([^)]*\)\s*{',
        r'function\s+AssessmentWizardClient\s*\([^)]*\)\s*{',
        r'const\s+AssessmentWizardClient\s*=\s*\([^)]*\)\s*=>\s*{',
    ]:
        m = re.search(pat, txt)
        if m:
            component_match = m
            break
    if not component_match:
        write(p, txt)
        print("skipped component patch", p)
        return

    block = '''
  const [reportLocked, setReportLocked] = useState(false)
  const [reportLockReason, setReportLockReason] = useState("")
  const selfMetaSupabase = supabase

  const checkExistingReportLock = async (clientCode?: string | number | null) => {
    try {
      const normalized = String(clientCode ?? "").trim()
      if (!normalized) return

      const { data, error } = await selfMetaSupabase
        .from("reports")
        .select("id, report_text, client_code, created_at")
        .eq("client_code", normalized)
        .not("report_text", "is", null)
        .order("created_at", { ascending: false })
        .limit(1)

      if (!error && data && data.length > 0) {
        setReportLocked(true)
        setReportLockReason("Bu vaka için rapor daha önce oluşturulmuş. Yeniden skor girişi kapatılmıştır.")
      } else {
        setReportLocked(false)
        setReportLockReason("")
      }
    } catch (error) {
      console.error("report lock check failed", error)
    }
  }
'''.rstrip()

    insert_at = component_match.end()
    txt = txt[:insert_at] + "\n\n" + block + "\n" + txt[insert_at:]

    client_state = re.search(r'(const\s*\[\s*clientInfo\s*,\s*setClientInfo\s*\][^\n]*\n)', txt)
    if client_state:
        effect = '''
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
'''.rstrip()
        txt = txt[:client_state.end()] + "\n" + effect + "\n" + txt[client_state.end():]

    for pat in [
        r'(const\s+handleGenerateReport\s*=\s*async\s*\([^)]*\)\s*=>\s*{)',
        r'(async\s+function\s+handleGenerateReport\s*\([^)]*\)\s*{)',
        r'(const\s+onGenerateReport\s*=\s*async\s*\([^)]*\)\s*=>\s*{)',
    ]:
        m = re.search(pat, txt)
        if m:
            txt = txt[:m.end()] + '\n    if (reportLocked) {\n      setSaveMsg(reportLockReason || "Bu vaka için rapor daha önce oluşturulduğu için yeni rapor üretimi kapatılmıştır.")\n      return\n    }\n' + txt[m.end():]
            break

    txt = txt.replace('disabled={saving}', 'disabled={saving || reportLocked}')
    txt = txt.replace('disabled={loading}', 'disabled={loading || reportLocked}')
    txt = txt.replace('disabled={isSubmitting}', 'disabled={isSubmitting || reportLocked}')
    txt = txt.replace('>Rapor Oluştur<', '>{reportLocked ? "Rapor Kilitli" : "Rapor Oluştur"}<')

    txt = txt.replace(
        'Danışan bilgisi alınamadı:',
        'Danışan özeti yüklenemedi:'
    )

    if "Yeni Klinik Değerlendirme" not in txt:
        ui_anchor = re.search(r'(Self Meta Değerlendirme Sistemi[\s\S]{0,400})', txt)
        shell = '''
      <div className="mb-6 grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Yeni Klinik Değerlendirme</div>
          <div className="mt-2 text-sm leading-6 text-slate-600">
            Bu alan, danışanın 6 self-regülasyon alanındaki skor girişini adım adım tamamlamak için kullanılır.
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Vaka Durumu</div>
          <div className="mt-2 text-sm leading-6 text-slate-600">
            Danışan özeti yüklendiğinde değerlendirme güvenli biçimde ilerler. Daha önce rapor oluşturulmuş vakalarda yeniden skor girişi kapatılır.
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Rapor Mantığı</div>
          <div className="mt-2 text-sm leading-6 text-slate-600">
            Skorlar önce deterministik karar motorunda işlenir, ardından tek final klinik rapor üretilir.
          </div>
        </div>
      </div>
'''.rstrip()
        if ui_anchor:
            idx = ui_anchor.end()
            txt = txt[:idx] + "\n" + shell + "\n" + txt[idx:]

    if "Rapor kilitli." not in txt:
        anchor = re.search(r'(\{[^{}]*saveMsg[^{}]*\}|\{saveMsg[\s\S]{0,250}\})', txt)
        banner = '''
      {reportLocked ? (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">
          Rapor kilitli. {reportLockReason || "Bu vaka için rapor daha önce oluşturulduğu için skor girişi kapatılmıştır."}
        </div>
      ) : null}
'''.rstrip()
        if anchor:
            txt = txt[:anchor.start()] + banner + "\n" + txt[anchor.start():]
        else:
            pos = txt.find("FİZYOLOJİK REGÜLASYON")
            if pos != -1:
                line_start = txt.rfind("\n", 0, pos)
                txt = txt[:line_start] + "\n" + banner + "\n" + txt[line_start:]

    write(p, txt)
    print("patched assessment", p)

def patch_ai_prompt():
    p = Path("src/lib/selfmeta/aiClinicalPrompt.ts")
    if not p.exists():
        return
    txt = read(p)

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
- ConfidenceLevel veya confidenceReason gibi sistem alan adlarını asla görünür metne taşıma.
- Bunun yerine doğal klinik cümle kullan: "Anamnez ile ölçek bulguları arasında yüksek düzeyde uyum izlenmektedir." gibi.
- Metin yaklaşık 550 ile 850 kelime aralığında olsun.
- Her başlık en az 3 cümle içersin.
- Metin yarım kalmış görünmemeli.

HOMOJEN PROFİL KURALI:
- Eğer karar motoru belirgin güçlü veya belirgin zayıf alan saptamamışsa, yapay biçimde tek veya iki alanı baskın öncelik olarak sunma.
- Böyle durumlarda profili "yaygın", "homojen dağılmış" veya "tek baskın alan göstermeyen" regülasyon güçlüğü olarak yaz.
- Deterministik bulgu baskın alan yok diyorsa, AI yeni bir baskın alan icat etmemelidir.

BAŞLIK ZORUNLULUĞU:
1. Genel Klinik Değerlendirme
2. Öncelikli Self-Regülasyon Alanları
3. Alanlar Arası Klinik Örüntü
4. Anamnez ve Ölçek Bulgularının Uyum Düzeyi
5. Sonuç Düzeyinde Klinik Özet
`
'''.strip()

    if "SELF_META_CLINICAL_STYLE_GUIDE" not in txt:
        m = re.search(r'^(?:import[^\n]+\n)+', txt)
        if m:
            txt = txt[:m.end()] + "\n" + guide + "\n\n" + txt[m.end():]
        else:
            txt = guide + "\n\n" + txt

    for a, b in [
        ("1. Genel Klinik Özet", "1. Genel Klinik Değerlendirme"),
        ("3. Ölçekler Arası Örüntü", "3. Alanlar Arası Klinik Örüntü"),
        ("4. Anamnez ile Test Bulgularının Uyum Analizi", "4. Anamnez ve Ölçek Bulgularının Uyum Düzeyi"),
        ("5. Kısa Klinik Sonuç", "5. Sonuç Düzeyinde Klinik Özet"),
        ("duysal", "duyusal"),
        ("dosyal", "duyusal"),
        ("ConfidenceLevel", "Güven düzeyi"),
        ("confidenceLevel", "güven düzeyi"),
        ("confidenceReason", "uyum gerekçesi"),
    ]:
        txt = txt.replace(a, b)

    injected = False
    for rgx in [
        r'(return\s*`)',
        r'((?:const|let)\s+\w*prompt\w*\s*=\s*`)',
        r'((?:const|let)\s+prompt\s*=\s*`)',
    ]:
        m = re.search(rgx, txt)
        if m:
            if "${SELF_META_CLINICAL_STYLE_GUIDE}" not in txt[m.start():m.start()+220]:
                txt = txt[:m.end()] + "${SELF_META_CLINICAL_STYLE_GUIDE}\n\n" + txt[m.end():]
            injected = True
            break

    write(p, txt)
    print("patched ai prompt", p)

def patch_ai_rewrite():
    p = Path("src/lib/selfmeta/aiRewrite.ts")
    if not p.exists():
        return
    txt = read(p)
    txt = txt.replace('"gpt-4.1-mini"', '"gpt-5"').replace("'gpt-4.1-mini'", "'gpt-5'")
    txt = txt.replace('"gpt-4.1"', '"gpt-5"').replace("'gpt-4.1'", "'gpt-5'")
    txt = re.sub(r'max_output_tokens\s*:\s*\d+', 'max_output_tokens: 3200', txt)
    txt = re.sub(r'max_completion_tokens\s*:\s*\d+', 'max_completion_tokens: 3200', txt)
    txt = re.sub(r'max_tokens\s*:\s*\d+', 'max_tokens: 3200', txt)
    txt = re.sub(r'temperature\s*:\s*[0-9.]+', 'temperature: 0.3', txt)
    if not re.search(r'max_output_tokens\s*:\s*3200|max_completion_tokens\s*:\s*3200|max_tokens\s*:\s*3200', txt):
        txt = re.sub(r'(model\s*:\s*[^,\n]+,)', r'\1\n      max_output_tokens: 3200,', txt, count=1)
    if not re.search(r'temperature\s*:\s*0\.3', txt):
        txt = re.sub(r'(model\s*:\s*[^,\n]+,)', r'\1\n      temperature: 0.3,', txt, count=1)
    write(p, txt)
    print("patched ai rewrite", p)

def patch_clinical_analysis():
    p = Path("src/lib/selfmeta/clinicalAnalysis.ts")
    if not p.exists():
        return
    txt = read(p)

    if "Belirgin görece zayıf alan saptanmamıştır." in txt and "homojen" not in txt.lower():
        txt = txt.replace(
            "Belirgin görece zayıf alan saptanmamıştır.",
            "Belirgin görece zayıf alan saptanmamıştır. Bu durum, riskin tek baskın alanda toplanmadığını ve alanlara daha homojen dağılmış olabileceğini düşündürmektedir."
        )
    if "Belirgin görece güçlü alan saptanmamıştır." in txt and "korunmuş baskın" not in txt.lower():
        txt = txt.replace(
            "Belirgin görece güçlü alan saptanmamıştır.",
            "Belirgin görece güçlü alan saptanmamıştır. Bu görünüm, belirgin korunmuş baskın alan olmaksızın daha yaygın bir regülasyon örüntüsüne işaret edebilir."
        )
    txt = txt.replace("ConfidenceLevel", "Güven düzeyi")
    txt = txt.replace("confidenceLevel", "güven düzeyi")
    txt = txt.replace("confidenceReason", "uyum gerekçesi")
    write(p, txt)
    print("patched clinical analysis", p)

def patch_report_views():
    for path_str in [
        "src/app/reports/page.tsx",
        "src/components/assessment/ClinicalReportPanel.tsx",
    ]:
        p = Path(path_str)
        if not p.exists():
            continue
        txt = read(p)
        txt = txt.replace("AI Rapor", "Final Klinik Rapor")
        txt = txt.replace("Klinik Yorum", "Final Klinik Raporu")
        txt = txt.replace("duysal", "duyusal")
        txt = txt.replace("dosyal", "duyusal")
        txt = re.sub(
            r'(\|\|\s*""\s*)',
            '|| "Alanlar arası teknik örüntü, mevcut skor dağılımı ve anamnez temaları birlikte değerlendirilerek oluşturulmuştur." ',
            txt,
            count=1
        )
        write(p, txt)
        print("patched report view", p)

patch_all_age_queries()
patch_assessment()
patch_ai_prompt()
patch_ai_rewrite()
patch_clinical_analysis()
patch_report_views()
print("DONE")
