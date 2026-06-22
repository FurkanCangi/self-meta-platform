"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  AiOutlineBarChart,
  AiOutlineHome,
  AiOutlinePlayCircle,
  AiOutlineUser,
  AiOutlineMenu,
} from "react-icons/ai";

const tabs = [
  {
    href: "/starter?surface=app",
    label: "Ana",
    icon: AiOutlineHome,
    active: (pathname: string) => pathname === "/starter" || pathname === "/dashboard",
  },
  {
    href: "/clients?surface=app",
    label: "Danışan",
    icon: AiOutlineUser,
    active: (pathname: string) => pathname.startsWith("/clients") || pathname.startsWith("/assessments"),
  },
  {
    href: "/reports?surface=app",
    label: "Rapor",
    icon: AiOutlineBarChart,
    active: (pathname: string) => pathname === "/reports",
  },
  {
    href: "/education?surface=app",
    label: "Eğitim",
    icon: AiOutlinePlayCircle,
    active: (pathname: string) => pathname === "/education",
  },
  {
    href: "/profile?surface=app",
    label: "Daha",
    icon: AiOutlineMenu,
    active: (pathname: string) =>
      pathname === "/profile" ||
      pathname === "/profile-setting" ||
      pathname === "/settings" ||
      pathname === "/support" ||
      pathname === "/report-packages" ||
      pathname === "/video-observation",
  },
];

export default function BottomTabs() {
  const pathname = usePathname() || "";

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 mx-auto max-w-[430px] border-t border-slate-200/80 bg-white/94 px-2 pb-[max(env(safe-area-inset-bottom),8px)] pt-2 shadow-[0_-18px_44px_rgba(7,27,58,0.10)] backdrop-blur-xl">
      <div className="mx-auto grid max-w-md grid-cols-5 gap-1">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const active = tab.active(pathname);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              prefetch
              className={[
                "flex min-h-[56px] flex-col items-center justify-center gap-1 rounded-2xl px-1 text-[11px] font-black transition",
                active
                  ? "bg-gradient-to-r from-cyan-50 via-blue-50 to-violet-50 text-blue-700 ring-1 ring-blue-100"
                  : "text-slate-500 hover:bg-slate-50 hover:text-slate-900",
              ].join(" ")}
            >
              <Icon className="text-[22px]" />
              <span>{tab.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
