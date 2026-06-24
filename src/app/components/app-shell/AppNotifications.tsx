"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AiOutlineBell, AiOutlineCheckCircle } from "react-icons/ai";

type AppNotification = {
  id: string;
  title: string;
  message: string;
  kind: "info" | "education" | "system" | "warning";
  actionLabel: string | null;
  actionUrl: string | null;
  read: boolean;
};

function appSurfaceUrl(actionUrl: string | null | undefined) {
  if (!actionUrl) return null;

  try {
    const parsed = new URL(actionUrl, window.location.origin);
    parsed.searchParams.set("surface", "app");
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    const separator = actionUrl.includes("?") ? "&" : "?";
    return `${actionUrl}${separator}surface=app`;
  }
}

export default function AppNotifications() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [setupRequired, setSetupRequired] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const loadNotifications = async () => {
      try {
        const res = await fetch("/api/notifications", { cache: "no-store" });
        const data = await res.json().catch(() => null);
        if (!isMounted || !res.ok || !data?.ok) return;
        setNotifications(Array.isArray(data.notifications) ? data.notifications : []);
        setUnreadCount(Number(data.unreadCount || 0));
        setSetupRequired(Boolean(data.setupRequired));
      } catch {}
    };

    loadNotifications();
    const timer = window.setInterval(loadNotifications, 60_000);

    return () => {
      isMounted = false;
      window.clearInterval(timer);
    };
  }, []);

  async function markRead(notificationId: string, actionUrl?: string | null) {
    const wasUnread = notifications.some((item) => item.id === notificationId && !item.read);
    setNotifications((items) => items.map((item) => (item.id === notificationId ? { ...item, read: true } : item)));
    if (wasUnread) setUnreadCount((count) => Math.max(0, count - 1));

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

    const target = appSurfaceUrl(actionUrl);
    if (target) {
      setOpen(false);
      router.push(target);
    }
  }

  async function markAllRead() {
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
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="relative grid h-10 w-10 place-items-center rounded-2xl border border-slate-200 bg-white text-slate-800 shadow-sm"
        aria-label="Bildirimler"
      >
        <AiOutlineBell className="text-xl" />
        {unreadCount > 0 ? (
          <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-rose-500 px-1 text-[10px] font-black text-white ring-2 ring-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="absolute right-0 mt-3 w-[min(360px,calc(100vw-1.5rem))] overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_28px_70px_rgba(7,27,58,0.18)]">
          <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
            <div>
              <div className="text-sm font-black text-slate-950">Bildirimler</div>
              <div className="mt-0.5 text-xs font-medium text-slate-500">
                {unreadCount > 0 ? `${unreadCount} okunmamış` : "Tümü okundu"}
              </div>
            </div>
            {notifications.length > 0 ? (
              <button type="button" onClick={markAllRead} className="rounded-full bg-blue-50 px-3 py-1.5 text-xs font-black text-blue-700">
                Okundu yap
              </button>
            ) : null}
          </div>

          <div className="max-h-[420px] overflow-y-auto p-2">
            {setupRequired ? (
              <div className="m-2 rounded-2xl border border-violet-200 bg-violet-50 px-4 py-3 text-xs font-bold leading-5 text-violet-900">
                Bildirim altyapısı henüz hazırlanıyor.
              </div>
            ) : null}

            {notifications.length === 0 ? (
              <div className="px-5 py-8 text-center">
                <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-cyan-100 to-violet-100 text-blue-700">
                  <AiOutlineBell className="text-2xl" />
                </div>
                <div className="mt-3 text-sm font-black text-slate-900">Henüz bildirim yok</div>
                <p className="mt-1 text-xs font-medium leading-5 text-slate-500">
                  Eğitim, sistem ve destek bildirimleri burada görünür.
                </p>
              </div>
            ) : (
              notifications.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => markRead(item.id, item.actionUrl)}
                  className="group flex w-full gap-3 rounded-2xl px-3 py-3 text-left transition hover:bg-slate-50"
                >
                  <span
                    className={[
                      "mt-1 h-2.5 w-2.5 shrink-0 rounded-full",
                      item.read
                        ? "bg-slate-200"
                        : item.kind === "warning"
                          ? "bg-violet-400"
                          : "bg-gradient-to-br from-cyan-400 to-violet-600",
                    ].join(" ")}
                  />
                  <span className="min-w-0">
                    <span className="flex items-center gap-2">
                      <span className="truncate text-sm font-black text-slate-950">{item.title}</span>
                      {item.read ? <AiOutlineCheckCircle className="shrink-0 text-base text-cyan-600" /> : null}
                    </span>
                    <span className="mt-1 line-clamp-2 text-xs font-medium leading-5 text-slate-500">{item.message}</span>
                    {item.actionLabel ? <span className="mt-2 inline-flex text-xs font-black text-blue-700">{item.actionLabel}</span> : null}
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
