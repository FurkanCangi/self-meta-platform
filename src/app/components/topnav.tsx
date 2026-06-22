"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AiOutlineBell,
  AiOutlineCheckCircle,
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

type DirectoryProfilePayload = {
  profile?: {
    firstName?: string | null;
    lastName?: string | null;
    profession?: string | null;
    title?: string | null;
  } | null;
};

type PanelNotification = {
  id: string;
  title: string;
  message: string;
  kind: "info" | "education" | "system" | "warning";
  actionLabel: string | null;
  actionUrl: string | null;
  publishedAt: string;
  read: boolean;
};

function cleanText(value?: unknown) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function initialsFromName(value: string) {
  const parts = value.split(" ").filter(Boolean);
  return parts
    .slice(0, 2)
    .map((part) => part[0]?.toLocaleUpperCase("tr-TR") || "")
    .join("");
}

export default function Topnav({ toggle = false, setToggle }: TopnavProps) {
  const { theme, toggleTheme } = useTheme();
  const [profileOpen, setProfileOpen] = useState(false);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [notifications, setNotifications] = useState<PanelNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notificationsSetupRequired, setNotificationsSetupRequired] = useState(false);
  const [displayName, setDisplayName] = useState("DNA Intelligence");
  const [accountDetail, setAccountDetail] = useState("Klinik çalışma alanı");
  const [initials, setInitials] = useState("DNA");
  const [showOwnerAudit, setShowOwnerAudit] = useState(false);
  const profileRef = useRef<HTMLDivElement | null>(null);
  const notificationRef = useRef<HTMLDivElement | null>(null);
  const router = useRouter();

  const applyAccountIdentity = (name?: string | null, detail?: string | null) => {
    const nextName = cleanText(name);
    const nextDetail = cleanText(detail);
    if (nextName) {
      setDisplayName(nextName);
      const nextInitials = initialsFromName(nextName);
      if (nextInitials) setInitials(nextInitials);
    }
    if (nextDetail) {
      setAccountDetail(nextDetail);
    }
  };

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
      }
      if (notificationRef.current && !notificationRef.current.contains(e.target as Node)) {
        setNotificationOpen(false);
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
      const fullName = [parsed?.firstName, parsed?.lastName].map(cleanText).filter(Boolean).join(" ");
      applyAccountIdentity(fullName, cleanText(parsed?.profession || parsed?.title));
    } catch {}
  }, []);

  useEffect(() => {
    let isMounted = true;

    const loadAccountIdentity = async () => {
      let authName = "";
      let authEmail = "";

      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        authEmail = cleanText(user?.email);
        authName = cleanText(user?.user_metadata?.full_name || user?.user_metadata?.name);
      } catch {}

      if (isMounted) {
        applyAccountIdentity(authName || authEmail, authEmail || "Klinik çalışma alanı");
      }

      try {
        const res = await fetch("/api/therapist-directory/profile", { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as DirectoryProfilePayload;
        const profileName = [data.profile?.firstName, data.profile?.lastName].map(cleanText).filter(Boolean).join(" ");
        const profileDetail = cleanText(data.profile?.profession || data.profile?.title || authEmail);
        if (isMounted && profileName) {
          applyAccountIdentity(profileName, profileDetail);
        }
      } catch {}
    };

    loadAccountIdentity();
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    const loadNotifications = async () => {
      try {
        const res = await fetch("/api/notifications", { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        if (!isMounted || !data?.ok) return;
        setNotifications(Array.isArray(data.notifications) ? data.notifications : []);
        setUnreadCount(Number(data.unreadCount || 0));
        setNotificationsSetupRequired(Boolean(data.setupRequired));
      } catch {}
    };

    loadNotifications();
    const timer = window.setInterval(loadNotifications, 60_000);

    return () => {
      isMounted = false;
      window.clearInterval(timer);
    };
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

  const markNotificationRead = async (notificationId: string, actionUrl?: string | null) => {
    setNotifications((items) =>
      items.map((item) => (item.id === notificationId ? { ...item, read: true } : item)),
    );
    setUnreadCount((count) => Math.max(0, count - 1));

    try {
      await fetch("/api/notifications/read", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-dna-request": "same-origin",
        },
        body: JSON.stringify({ notificationId }),
      });
    } catch {}

    if (actionUrl) {
      setNotificationOpen(false);
      router.push(actionUrl);
    }
  };

  const markAllNotificationsRead = async () => {
    setNotifications((items) => items.map((item) => ({ ...item, read: true })));
    setUnreadCount(0);
    try {
      await fetch("/api/notifications/read", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-dna-request": "same-origin",
        },
        body: JSON.stringify({ all: true }),
      });
    } catch {}
  };

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
    } catch {}
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {}
    setDisplayName("DNA Intelligence");
    setAccountDetail("Klinik çalışma alanı");
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

          <div className="relative" ref={notificationRef}>
            <button
              type="button"
              onClick={() => setNotificationOpen((value) => !value)}
              className="relative inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-900 shadow-sm transition hover:border-blue-200 hover:bg-blue-50/50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
              aria-label="Bildirimler"
              title="Bildirimler"
            >
              <AiOutlineBell className="text-[22px]" />
              {unreadCount > 0 ? (
                <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-500 px-1.5 text-[10px] font-black text-white shadow-sm">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              ) : null}
            </button>

            {notificationOpen && (
              <div className="absolute right-0 mt-3 w-[min(360px,calc(100vw-2rem))] overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_28px_70px_rgba(7,27,58,0.18)]">
                <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
                  <div>
                    <div className="text-sm font-black text-slate-950">Bildirimler</div>
                    <div className="mt-0.5 text-xs font-medium text-slate-500">
                      {unreadCount > 0 ? `${unreadCount} okunmamış bildirim` : "Tümü okundu"}
                    </div>
                  </div>
                  {notifications.length > 0 ? (
                    <button
                      type="button"
                      onClick={markAllNotificationsRead}
                      className="rounded-full bg-blue-50 px-3 py-1.5 text-xs font-black text-blue-700 transition hover:bg-blue-100"
                    >
                      Tümünü okundu yap
                    </button>
                  ) : null}
                </div>

                <div className="max-h-[430px] overflow-y-auto p-2">
                  {notificationsSetupRequired ? (
                    <div className="m-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-bold leading-5 text-amber-900">
                      Bildirim altyapısı Supabase tarafında henüz kurulmamış.
                    </div>
                  ) : null}

                  {notifications.length === 0 ? (
                    <div className="px-5 py-8 text-center">
                      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-100 to-violet-100 text-blue-700">
                        <AiOutlineBell className="text-2xl" />
                      </div>
                      <div className="mt-3 text-sm font-black text-slate-900">Henüz bildirim yok</div>
                      <p className="mt-1 text-xs font-medium leading-5 text-slate-500">
                        Eğitim ve sistem duyuruları burada görünecek.
                      </p>
                    </div>
                  ) : (
                    notifications.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => markNotificationRead(item.id, item.actionUrl)}
                        className="group flex w-full gap-3 rounded-2xl px-3 py-3 text-left transition hover:bg-slate-50"
                      >
                        <span
                          className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${
                            item.read
                              ? "bg-slate-200"
                              : item.kind === "warning"
                                ? "bg-amber-400"
                                : "bg-gradient-to-br from-cyan-400 to-violet-600"
                          }`}
                        />
                        <span className="min-w-0">
                          <span className="flex items-center gap-2">
                            <span className="truncate text-sm font-black text-slate-950">{item.title}</span>
                            {item.read ? (
                              <AiOutlineCheckCircle className="shrink-0 text-base text-emerald-500" />
                            ) : null}
                          </span>
                          <span className="mt-1 line-clamp-2 text-xs font-medium leading-5 text-slate-500">
                            {item.message}
                          </span>
                          {item.actionLabel ? (
                            <span className="mt-2 inline-flex text-xs font-black text-blue-700">
                              {item.actionLabel}
                            </span>
                          ) : null}
                        </span>
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

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
                <div className="mt-1 max-w-[170px] truncate text-xs text-slate-500">{accountDetail}</div>
              </div>
            </button>

            {profileOpen && (
              <div className="absolute right-0 mt-3 w-60 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_28px_70px_rgba(7,27,58,0.16)]">
                <div className="border-b border-slate-100 px-4 py-3">
                  <div className="truncate text-sm font-semibold text-slate-900">{displayName}</div>
                  <div className="mt-1 truncate text-xs text-slate-500">{accountDetail}</div>
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
                      <Link
                        href="/owner-audit/notifications"
                        className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-blue-700 transition hover:bg-blue-50"
                      >
                        <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-blue-100 text-[10px] font-bold text-blue-700">
                          BN
                        </span>
                        Bildirim Gönder
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
