import { notFound } from "next/navigation"
import { resolveDnaS13CanaryAccess } from "@/lib/dna/chat/s13/canary/access.server"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import DnaCanaryClient from "./DnaCanaryClient"

export default async function DnaCanaryPage() {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  const access = resolveDnaS13CanaryAccess(user?.email)
  if (!access.allowed) notFound()

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <header className="rounded-[2rem] border border-cyan-200 bg-white/90 p-6 shadow-sm">
        <div className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-700">Internal canary · production dışı</div>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">DNA Intelligence v1 Answer Architecture</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
          Yalnız genel, bilimsel ve kişisel olmayan sorular içindir. Vaka, danışan, çocuk, anamnez, rapor,
          kimlik veya kurum verisi Luna çağrısından önce engellenir.
        </p>
        <div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold">
          <span className="rounded-full bg-slate-950 px-3 py-1 text-white">Mimari donduruldu</span>
          <span className="rounded-full bg-cyan-50 px-3 py-1 text-cyan-800">Canary açık</span>
          <span className={`rounded-full px-3 py-1 ${access.flags.lunaEnabled ? "bg-violet-50 text-violet-800" : "bg-slate-100 text-slate-700"}`}>
            Luna {access.flags.lunaEnabled ? "açık" : "kapalı · deterministic"}
          </span>
        </div>
      </header>
      <DnaCanaryClient />
    </div>
  )
}
