"use client"

import Link from "next/link"
import { BookOpen, Clock3, UploadCloud } from "lucide-react"

export default function OwnerEducationClient() {
  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-8">
      <div className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-[0_20px_60px_rgba(37,99,235,0.08)]">
        <div className="grid gap-0 lg:grid-cols-[1fr_360px]">
          <div className="p-6 sm:p-8">
            <Link href="/owner-audit" className="text-sm font-semibold text-indigo-600 hover:text-indigo-700">
              Owner paneli
            </Link>
            <h1 className="mt-2 text-4xl font-black tracking-tight text-slate-950">Eğitim Kayıtları</h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
              Eğitim videoları için başlık, açıklama, yayın durumu ve sağlayıcı bilgilerini yönetmeye ayrılan owner alanı.
            </p>
          </div>
          <div className="grid content-center gap-3 bg-slate-950 p-6 text-white sm:p-8">
            <div className="flex items-center gap-3 rounded-2xl bg-white/10 p-4">
              <BookOpen className="h-5 w-5 text-cyan-200" />
              <div>
                <div className="text-sm font-black">Video altyapısı hazırlandı</div>
                <div className="mt-1 text-xs font-semibold text-slate-300">
                  Gerçek içerikler Bunny/Supabase geçişinde bağlanacak.
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl bg-white/10 p-4">
                <UploadCloud className="h-4 w-4 text-cyan-200" />
                <div className="mt-2 text-sm font-black">Yükleme</div>
                <div className="mt-1 text-xs text-slate-300">Pilot aşamada</div>
              </div>
              <div className="rounded-2xl bg-white/10 p-4">
                <Clock3 className="h-4 w-4 text-cyan-200" />
                <div className="mt-2 text-sm font-black">Yayın</div>
                <div className="mt-1 text-xs text-slate-300">Hazırlıkta</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-[2rem] border border-dashed border-blue-200 bg-white p-12 text-center shadow-sm">
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-3xl bg-blue-50 text-blue-700">
          <BookOpen className="h-7 w-7" />
        </div>
        <div className="mt-4 text-xl font-black text-slate-950">Eğitim yönetimi sonraki adımda açılacak</div>
        <p className="mx-auto mt-2 max-w-xl text-sm font-semibold leading-6 text-slate-500">
          Bu ekran build ve navigasyon için hazır tutuldu. Gerçek video kayıtları yüklenmeden önce provider, erişim ve yayın akışı burada tamamlanabilir.
        </p>
      </div>
    </div>
  )
}
