"use client";

import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { AiOutlineLogout, AiOutlineMoon, AiOutlineSun } from "react-icons/ai";
import { useTheme } from "../theme-provider";
import { logoutAppSession } from "@/lib/security/clientLogout";
import AppNotifications from "./AppNotifications";

export default function AppHeader() {
  const router = useRouter();
  const { theme, toggleTheme } = useTheme();

  const handleLogout = async () => {
    try {
      await logoutAppSession("local");
    } catch {}
    try {
      localStorage.removeItem("dna_therapist_profile");
    } catch {}
    router.replace("/app-login");
    router.refresh();
  };

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/92 px-4 pb-3 pt-[max(env(safe-area-inset-top),12px)] shadow-[0_12px_34px_rgba(7,27,58,0.06)] backdrop-blur-xl">
      <div className="mx-auto flex items-center justify-between gap-3 md:max-w-6xl">
        <Link href="/starter?surface=app" className="flex min-h-14 min-w-0 items-center gap-3 rounded-2xl pr-2" aria-label="Ana ekrana git">
          <span className="min-w-0">
            <span className="block h-[58px] w-[204px] overflow-visible sm:h-[64px] sm:w-[224px]">
              <Image
                src="/images/brand/dna-logo-dashboard.png"
                alt="DNA Intelligence Dynamic Neuro-Regulation Approach"
                width={1527}
                height={708}
                priority
                unoptimized
                className="h-full w-full object-contain object-left"
                sizes="224px"
              />
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
          <AppNotifications />
          <button
            type="button"
            onClick={handleLogout}
            className="grid h-10 w-10 place-items-center rounded-2xl border border-slate-200 bg-slate-50 text-slate-700 shadow-sm"
            aria-label="Çıkış yap"
          >
            <AiOutlineLogout className="text-xl" />
          </button>
        </div>
      </div>
    </header>
  );
}
