import { normalizeClinicalReportText, splitClinicalReportSections } from "@/lib/selfmeta/reportText"

type Props = {
  text: string
  className?: string
  reportDate?: string | null
}

function formatReportDate(value?: string | null) {
  if (!value) return "—"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)
  return date.toLocaleString("tr-TR")
}

export default function ClinicalReportView({ text, className = "", reportDate }: Props) {
  const normalized = normalizeClinicalReportText(text)
  const sections = splitClinicalReportSections(normalized)

  if (!sections.length) {
    return (
      <div className={`rounded-2xl border border-slate-200 bg-white p-5 text-sm leading-7 text-slate-700 ${className}`.trim()}>
        {reportDate ? (
          <div className="mb-4 rounded-2xl border border-indigo-100 bg-indigo-50 px-4 py-3 text-sm">
            <div className="text-xs font-semibold uppercase tracking-wide text-indigo-500">Rapor Tarihi</div>
            <div className="mt-1 font-semibold text-indigo-900">{formatReportDate(reportDate)}</div>
          </div>
        ) : null}
        <div className="whitespace-pre-line">{normalized || "Rapor metni bulunamadı."}</div>
      </div>
    )
  }

  return (
    <div className={`rounded-2xl border border-slate-200 bg-white p-5 ${className}`.trim()}>
      {reportDate ? (
        <div className="mb-5 rounded-2xl border border-indigo-100 bg-indigo-50 px-4 py-3 text-sm">
          <div className="text-xs font-semibold uppercase tracking-wide text-indigo-500">Rapor Tarihi</div>
          <div className="mt-1 font-semibold text-indigo-900">{formatReportDate(reportDate)}</div>
        </div>
      ) : null}
      <div className="space-y-6">
        {sections.map((section) => {
          const lines = section.body.split("\n").map((line) => line.trim()).filter(Boolean)

          return (
            <section key={section.heading} className="space-y-3">
              <h4 className="text-base font-bold text-slate-900">{section.heading}</h4>

              <div className="space-y-2 text-sm leading-7 text-slate-700">
                {lines.length > 0 ? (
                  lines.map((line, index) =>
                    line.startsWith("- ") ? (
                      <div key={`${section.heading}-${index}`} className="flex gap-2">
                        <span className="mt-[10px] h-1.5 w-1.5 rounded-full bg-slate-400" />
                        <span>{line.slice(2)}</span>
                      </div>
                    ) : (
                      <p key={`${section.heading}-${index}`}>{line}</p>
                    )
                  )
                ) : (
                  <p>Bu bölüm için metin bulunamadı.</p>
                )}
              </div>
            </section>
          )
        })}
      </div>
    </div>
  )
}
