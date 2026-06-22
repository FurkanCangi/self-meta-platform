"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Bell, BookOpen, LayoutDashboard, LifeBuoy, ShieldCheck, Stethoscope } from "lucide-react"

const navItems = [
  {
    href: "/owner-audit",
    label: "Owner Paneli",
    description: "Üye ve veri denetimi",
    icon: LayoutDashboard,
  },
  {
    href: "/owner-audit/security",
    label: "Güvenlik Merkezi",
    description: "Oturum ve risk yönetimi",
    icon: ShieldCheck,
  },
  {
    href: "/owner-audit/notifications",
    label: "Bildirim Merkezi",
    description: "Panel duyuruları",
    icon: Bell,
  },
  {
    href: "/owner-audit/education",
    label: "Eğitim Yönetimi",
    description: "Video ve erişim kayıtları",
    icon: BookOpen,
  },
  {
    href: "/owner-audit/support",
    label: "Destek Talepleri",
    description: "Sorun ve ekran görüntüleri",
    icon: LifeBuoy,
  },
]

function isActivePath(pathname: string, href: string) {
  if (href === "/owner-audit") return pathname === href
  return pathname.startsWith(href)
}

export default function OwnerAuditNav() {
  const pathname = usePathname() || "/owner-audit"

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200/70 bg-white/82 backdrop-blur-2xl">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-4 py-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-400 via-blue-600 to-violet-600 text-sm font-black text-white shadow-[0_16px_40px_rgba(37,99,235,0.24)]">
            OW
          </div>
          <div className="min-w-0">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-blue-600">
              DNA Owner Workspace
            </p>
            <h1 className="truncate text-lg font-black text-slate-950 sm:text-xl">
              Denetim, güvenlik ve bildirim alanı
            </h1>
          </div>
        </div>

        <nav className="flex gap-2 overflow-x-auto rounded-[1.4rem] border border-slate-200 bg-white p-1.5 shadow-sm">
          {navItems.map((item) => {
            const active = isActivePath(pathname, item.href)
            const Icon = item.icon

            return (
              <Link
                key={item.href}
                href={item.href}
                className={[
                  "flex min-w-[170px] items-center gap-3 rounded-2xl px-3 py-2.5 transition",
                  active
                    ? "bg-slate-950 text-white shadow-[0_14px_35px_rgba(15,23,42,0.18)]"
                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-950",
                ].join(" ")}
              >
                <span
                  className={[
                    "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl",
                    active ? "bg-white/14 text-cyan-200" : "bg-blue-50 text-blue-600",
                  ].join(" ")}
                >
                  <Icon className="h-4 w-4" />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-black">{item.label}</span>
                  <span className={["block truncate text-xs font-semibold", active ? "text-slate-300" : "text-slate-400"].join(" ")}>
                    {item.description}
                  </span>
                </span>
              </Link>
            )
          })}
          <Link
            href="/starter"
            className="flex min-w-[155px] items-center gap-3 rounded-2xl px-3 py-2.5 text-slate-600 transition hover:bg-cyan-50 hover:text-blue-700"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-cyan-50 text-cyan-600">
              <Stethoscope className="h-4 w-4" />
            </span>
            <span>
              <span className="block text-sm font-black">Terapist Paneli</span>
              <span className="block text-xs font-semibold text-slate-400">Normal panele dön</span>
            </span>
          </Link>
        </nav>
      </div>
    </header>
  )
}
