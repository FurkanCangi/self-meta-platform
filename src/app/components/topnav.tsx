"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AiOutlineBell,
  AiOutlineMenu,
  AiOutlineMoon,
  AiOutlineSearch,
  AiOutlineSetting,
  AiOutlineSun,
  AiOutlineLogout,
  AiOutlineUser,
} from "react-icons/ai";
import { supabase } from "@/lib/supabase/client";
import { useTheme } from "./theme-provider";

const STORAGE_KEY = "dna_therapist_profile";

type TopnavProps = {
  toggle?: boolean;
  setToggle?: (value: boolean) => void;
};

export default function Topnav({ toggle = false, setToggle }: TopnavProps) {
  const { theme, toggleTheme } = useTheme();
  const [profileOpen, setProfileOpen] = useState(false);
  const [displayName, setDisplayName] = useState("DNA Intelligence");
  const [initials, setInitials] = useState("DNA");
  const [showOwnerAudit, setShowOwnerAudit] = useState(false);
  const profileRef = useRef<HTMLDivElement | null>(null);
  const router = useRouter();

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (!profileRef.current) return;
      if (!profileRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      const fullName = [parsed?.firstName, parsed?.lastName].filter(Boolean).join(" ").trim();
      if (fullName) {
        setDisplayName(fullName);
        const parts = fullName.split(" ").filter(Boolean);
        const nextInitials = parts.slice(0, 2).map((x: string) => x[0]?.toUpperCase() || "").join("");
        if (nextInitials) setInitials(nextInitials);
      }
    } catch {}
  }, []);

  useEffect(() => {
    let isMounted = true;

    const loadOwnerStatus = async () => {
      try {
        const res = await fetch("/api/owner-audit/status", { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        if (isMounted) {
          setShowOwnerAudit(Boolean(data?.allowed));
        }
      } catch {}
    };

    loadOwnerStatus();
    return () => {
      isMounted = false;
    };
  }, []);

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
    } catch {}
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {}
    setDisplayName("DNA Intelligence");
    setInitials("DNA");
    setProfileOpen(false);
    router.replace("/login");
    router.refresh();
  };

  return (
    <header className="dna-topnav sticky top-0 z-30 border-b border-slate-200/80 bg-white/88 shadow-[0_10px_34px_rgba(7,27,58,0.04)] backdrop-blur-xl">
      <div className="flex items-center justify-between gap-4 px-6 py-4">
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            onClick={() => setToggle?.(!toggle)}
            className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-900 shadow-sm transition hover:border-blue-200 hover:bg-blue-50/50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
            aria-label="Menüyü Aç/Kapat"
            aria-expanded={toggle}
            title={toggle ? "Sol menüyü kapat" : "Sol menüyü aç"}
          >
            <AiOutlineMenu className="text-xl" />
          </button>

          <div className="relative hidden md:block">
            <AiOutlineSearch className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Ara..."
              className="h-11 w-[280px] rounded-2xl border border-slate-200 bg-white/90 pl-11 pr-4 text-sm font-medium text-slate-700 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-blue-300 focus:ring-4 focus:ring-blue-100/70"
            />
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={toggleTheme}
            className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-900 shadow-sm transition hover:border-blue-200 hover:bg-blue-50/50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
            aria-label={theme === "dark" ? "Açık temaya geç" : "Koyu temaya geç"}
            title={theme === "dark" ? "Açık tema" : "Koyu tema"}
          >
            {theme === "dark" ? (
              <AiOutlineSun className="text-[22px]" />
            ) : (
              <AiOutlineMoon className="text-[22px]" />
            )}
          </button>

          <button
            type="button"
            className="relative inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-900 shadow-sm transition hover:border-blue-200 hover:bg-blue-50/50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
            aria-label="Bildirimler"
            title="Bildirimler"
          >
            <AiOutlineBell className="text-[22px]" />
            <span className="absolute right-2 top-2 h-2.5 w-2.5 rounded-full bg-red-500" />
          </button>

          <div className="relative" ref={profileRef}>
            <button
              type="button"
              onClick={() => setProfileOpen((v) => !v)}
              className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-2 py-1.5 shadow-sm transition hover:border-blue-200 hover:bg-blue-50/40"
              aria-label="Profil Menüsü"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-100 via-blue-100 to-violet-100 text-xs font-black text-blue-700">
                {initials}
              </div>
              <div className="hidden text-left md:block">
                <div className="text-sm font-semibold leading-none text-slate-900">
                  {displayName}
                </div>
                <div className="mt-1 text-xs text-slate-500">Klinik çalışma alanı</div>
              </div>
            </button>

            {profileOpen && (
              <div className="absolute right-0 mt-3 w-60 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_28px_70px_rgba(7,27,58,0.16)]">
                <div className="border-b border-slate-100 px-4 py-3">
                  <div className="text-sm font-semibold text-slate-900">Hesap</div>
                  <div className="mt-1 text-xs text-slate-500">DNA Intelligence</div>
                </div>

                <div className="p-2">
                  <Link
                    href="/profile"
                    className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                  >
                    <AiOutlineUser className="text-lg" />
                    Profil
                  </Link>

                  {showOwnerAudit ? (
                    <>
                      <Link
                        href="/owner-audit"
                        className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                      >
                        <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-indigo-100 text-[10px] font-bold text-indigo-700">
                          OA
                        </span>
                        Owner Paneli
                      </Link>
                      <Link
                        href="/owner-audit/security"
                        className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-rose-700 transition hover:bg-rose-50"
                      >
                        <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-rose-100 text-[10px] font-bold text-rose-700">
                          OS
                        </span>
                        Güvenlik Merkezi
                      </Link>
                    </>
                  ) : null}

                  <Link
                    href="/profile-setting"
                    className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                  >
                    <AiOutlineSetting className="text-lg" />
                    Ayarlar
                  </Link>

                  <button
                    type="button"
                    onClick={handleLogout}
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-rose-600 transition hover:bg-rose-50"
                  >
                    <AiOutlineLogout className="text-lg" />
                    Çıkış Yap
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
