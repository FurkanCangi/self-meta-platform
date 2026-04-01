"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AiOutlineBell,
  AiOutlineMenu,
  AiOutlineSearch,
  AiOutlineSetting,
  AiOutlineLogout,
  AiOutlineUser,
} from "react-icons/ai";
import { supabase } from "@/lib/supabase/client";
import { useTheme } from "./theme-provider";

const STORAGE_KEY = "selfmeta_therapist_profile";

type TopnavProps = {
  toggle?: boolean;
  setToggle?: (value: boolean) => void;
};

export default function Topnav({ toggle = false, setToggle }: TopnavProps) {
  const [profileOpen, setProfileOpen] = useState(false);
  const [displayName, setDisplayName] = useState("Terapist Paneli");
  const [initials, setInitials] = useState("TP");
  const [showOwnerAudit, setShowOwnerAudit] = useState(false);
  const profileRef = useRef<HTMLDivElement | null>(null);
  const router = useRouter();
  const { theme, setTheme } = useTheme();

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
    setDisplayName("Terapist Paneli");
    setInitials("TP");
    setProfileOpen(false);
    router.replace("/login");
    router.refresh();
  };

  return (
    <header className="selfmeta-topnav sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="flex items-center justify-between gap-4 px-6 py-4">
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            onClick={() => setToggle?.(!toggle)}
            className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 transition hover:bg-slate-50"
            aria-label="Menüyü Aç/Kapat"
          >
            <AiOutlineMenu className="text-xl" />
          </button>

          <div className="relative hidden md:block">
            <AiOutlineSearch className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Ara..."
              className="h-11 w-[260px] rounded-full border border-slate-200 bg-white pl-11 pr-4 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
            />
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            className="relative inline-flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 transition hover:bg-slate-50"
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
              className="flex items-center gap-3 rounded-full border border-slate-200 bg-white px-2 py-1.5 transition hover:bg-slate-50"
              aria-label="Profil Menüsü"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-100 text-sm font-semibold text-indigo-700">
                {initials}
              </div>
              <div className="hidden text-left md:block">
                <div className="text-sm font-semibold leading-none text-slate-900">
                  {displayName}
                </div>
                <div className="mt-1 text-xs text-slate-500">Hesap Menüsü</div>
              </div>
            </button>

            {profileOpen && (
              <div className="absolute right-0 mt-3 w-56 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
                <div className="border-b border-slate-100 px-4 py-3">
                  <div className="text-sm font-semibold text-slate-900">Hesap</div>
                  <div className="mt-1 text-xs text-slate-500">Self Meta AI</div>
                </div>

                <div className="p-2">
                  <div className="mb-2 rounded-xl border border-slate-200 bg-slate-50 p-2">
                    <div className="px-1 pb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Tema
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setTheme("light")}
                        className={[
                          "rounded-xl px-3 py-2 text-sm font-medium transition",
                          theme === "light"
                            ? "bg-white text-slate-900 shadow-sm ring-1 ring-slate-200"
                            : "bg-transparent text-slate-600 hover:bg-white/70",
                        ].join(" ")}
                      >
                        Aydınlık
                      </button>
                      <button
                        type="button"
                        onClick={() => setTheme("dark")}
                        className={[
                          "rounded-xl px-3 py-2 text-sm font-medium transition",
                          theme === "dark"
                            ? "bg-slate-900 text-white shadow-sm ring-1 ring-slate-900"
                            : "bg-transparent text-slate-600 hover:bg-white/70",
                        ].join(" ")}
                      >
                        Karanlık
                      </button>
                    </div>
                  </div>

                  <Link
                    href="/profile"
                    className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                  >
                    <AiOutlineUser className="text-lg" />
                    Profil
                  </Link>

                  {showOwnerAudit ? (
                    <Link
                      href="/owner-audit"
                      className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                    >
                      <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-indigo-100 text-[10px] font-bold text-indigo-700">
                        OA
                      </span>
                      Owner Paneli
                    </Link>
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
