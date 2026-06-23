import Link from "next/link"
import { ACTIVE_LEGAL_DOCUMENTS, LEGAL_DOCUMENT_VERSION } from "@/lib/legal/documents"

type LegalSection = {
  title: string
  body: string[]
}

type LegalDocumentPageProps = {
  title: string
  description: string
  sections: LegalSection[]
}

const identityRows = [
  ["Veri sorumlusu / hizmet sağlayıcı", "[VERI_SORUMLUSU_UNVANI]"],
  ["MERSIS / vergi no", "[MERSIS_VERGI_NO]"],
  ["Adres", "[ADRES]"],
  ["İletişim", "[ILETISIM_EPOSTA]"],
  ["Yürürlük tarihi", "[YURURLUK_TARIHI]"],
]

export default function LegalDocumentPage({ title, description, sections }: LegalDocumentPageProps) {
  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <div className="mx-auto max-w-5xl px-6 py-10">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-3">
          <Link href="/" className="text-sm font-semibold text-blue-700 hover:text-blue-800">
            DNA Intelligence
          </Link>
          <Link href="/signup" className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700">
            Kayıt Ol
          </Link>
        </div>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm md:p-8">
          <div className="text-sm font-semibold uppercase tracking-wide text-blue-700">
            Hukuki metin taslağı
          </div>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950 md:text-4xl">{title}</h1>
          <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-600">{description}</p>
          <div className="mt-5 rounded-xl border border-violet-200 bg-violet-50 px-4 py-3 text-sm leading-6 text-violet-900">
            Bu metin avukat incelemesine hazır ticari taslaktır. Nihai yayına alınmadan önce şirket bilgileri ve hukuki kontrol tamamlanmalıdır.
          </div>
        </section>

        <section className="mt-6 grid gap-3 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm md:grid-cols-2">
          {identityRows.map(([label, value]) => (
            <div key={label} className="rounded-xl bg-slate-50 px-4 py-3">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</div>
              <div className="mt-1 text-sm font-medium text-slate-900">{value}</div>
            </div>
          ))}
          <div className="rounded-xl bg-slate-50 px-4 py-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Doküman versiyonu</div>
            <div className="mt-1 text-sm font-medium text-slate-900">{LEGAL_DOCUMENT_VERSION}</div>
          </div>
        </section>

        <section className="mt-6 space-y-4">
          {sections.map((section) => (
            <article key={section.title} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-xl font-bold text-slate-950">{section.title}</h2>
              <div className="mt-4 space-y-3">
                {section.body.map((paragraph) => (
                  <p key={paragraph} className="text-sm leading-7 text-slate-700">
                    {paragraph}
                  </p>
                ))}
              </div>
            </article>
          ))}
        </section>

        <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-bold text-slate-950">İlgili Dokümanlar</h2>
          <div className="mt-4 grid gap-2 md:grid-cols-2">
            {ACTIVE_LEGAL_DOCUMENTS.map((document) => (
              <Link
                key={document.id}
                href={document.href}
                className="rounded-xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-700 hover:border-blue-300 hover:text-blue-700"
              >
                {document.title}
              </Link>
            ))}
          </div>
        </section>
      </div>
    </main>
  )
}
