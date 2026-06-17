"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { AiOutlineLogout, AiOutlineMoon, AiOutlineSun, AiOutlineUser } from "react-icons/ai";
import BrandLogo from "../BrandLogo";
import { useTheme } from "../theme-provider";
import { supabase } from "@/lib/supabase/client";

function titleForPath(pathname: string) {
  if (pathname.startsWith("/clients/new")) return "Yeni danışan";
  if (pathname.startsWith("/clients")) return "Danışanlar";
  if (pathname.startsWith("/assessments")) return "Değerlendirme";
  if (pathname.startsWith("/reports")) return "Raporlar";
  if (pathname.startsWith("/education")) return "Eğitimler";
  if (pathname.startsWith("/video-observation")) return "Video gözlem";
  if (pathname.startsWith("/report-packages")) return "Paketler";
  if (pathname.startsWith("/profile-setting") || pathname.startsWith("/settings")) return "Ayarlar";
  if (pathname.startsWith("/profile")) return "Profil";
  return "Klinik çalışma alanı";
}

export default function AppHeader() {
  const pathname = usePathname() || "";
  const router = useRouter();
  const { theme, toggleTheme } = useTheme();

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
    } catch {}
    try {
      localStorage.removeItem("dna_therapist_profile");
    } catch {}
    router.replace("/login?surface=app");
    router.refresh();
  };

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/92 px-4 pb-3 pt-[max(env(safe-area-inset-top),12px)] shadow-[0_12px_34px_rgba(7,27,58,0.06)] backdrop-blur-xl">
      <div className="flex items-center justify-between gap-3">
        <Link href="/starter?surface=app" className="flex min-w-0 items-center gap-3" aria-label="Ana ekrana git">
          <span className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-2xl border border-blue-100 bg-gradient-to-br from-cyan-50 via-blue-50 to-violet-50">
            <BrandLogo variant="mark" />
          </span>
          <span className="min-w-0">
            <span className="block truncate text-[11px] font-black uppercase tracking-[0.16em] text-blue-700">
              DNA Intelligence
            </span>
            <span className="mt-0.5 block truncate text-base font-black text-[#071b3a]">
              {titleForPath(pathname)}
            </span>
          </span>
        </Link>

        <div className="flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            onClick={toggleTheme}
            className="grid h-10 w-10 place-items-center rounded-2xl border border-slate-200 bg-white text-slate-800 shadow-sm"
            aria-label={theme === "dark" ? "Açık temaya geç" : "Koyu temaya geç"}
          >
            {theme === "dark" ? <AiOutlineSun className="text-xl" /> : <AiOutlineMoon className="text-xl" />}
          </button>
          <Link
            href="/profile?surface=app"
            className="grid h-10 w-10 place-items-center rounded-2xl border border-slate-200 bg-white text-slate-800 shadow-sm"
            aria-label="Profil"
          >
            <AiOutlineUser className="text-xl" />
          </Link>
          <button
            type="button"
            onClick={handleLogout}
            className="grid h-10 w-10 place-items-center rounded-2xl border border-rose-100 bg-rose-50 text-rose-600 shadow-sm"
            aria-label="Çıkış yap"
          >
            <AiOutlineLogout className="text-xl" />
          </button>
        </div>
      </div>
    </header>
  );
}
