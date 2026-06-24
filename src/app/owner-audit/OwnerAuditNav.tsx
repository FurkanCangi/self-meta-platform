"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Bell, BookOpen, LayoutDashboard, LifeBuoy, Mail, ShieldCheck, Stethoscope } from "lucide-react"

const navItems = [
  {
    href: "/owner-audit",
    label: "Üye Kontrolü",
    description: "Üye, vaka ve rapor takibi",
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
    href: "/owner-audit/emails",
    label: "Toplu Mail",
    description: "E-posta duyuruları",
    icon: Mail,
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
    <header className="sticky top-0 z-40 border-b border-slate-200/70 bg-white/88 backdrop-blur-2xl">
      <div className="mx-auto flex w-full max-w-6xl justify-center px-4 py-3 sm:px-6 lg:px-8">
        <nav className="flex max-w-full items-center gap-2 overflow-x-auto rounded-[1.5rem] border border-slate-200/80 bg-white/92 p-1.5 shadow-[0_18px_55px_rgba(15,23,42,0.08)]">
          {navItems.map((item) => {
            const active = isActivePath(pathname, item.href)
            const Icon = item.icon

            return (
              <Link
                key={item.href}
                href={item.href}
                className={[
                  "flex min-w-[150px] items-center justify-center gap-2.5 rounded-2xl px-4 py-3 text-center transition",
                  active
                    ? "bg-slate-950 text-white shadow-[0_14px_35px_rgba(15,23,42,0.2)] ring-2 ring-blue-500/70"
                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-950",
                ].join(" ")}
              >
                <span
                  className={[
                    "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition",
                    active ? "bg-white/14 text-cyan-200" : "bg-blue-50 text-blue-600",
                  ].join(" ")}
                >
                  <Icon className="h-4 w-4" />
                </span>
                <span className="text-sm font-black leading-tight">{item.label}</span>
              </Link>
            )
          })}
          <Link
            href="/starter"
            className="flex min-w-[150px] items-center justify-center gap-2.5 rounded-2xl px-4 py-3 text-center text-slate-600 transition hover:bg-cyan-50 hover:text-blue-700"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-cyan-50 text-cyan-600">
              <Stethoscope className="h-4 w-4" />
            </span>
            <span className="text-sm font-black leading-tight">Terapist Paneli</span>
          </Link>
        </nav>
      </div>
    </header>
  )
}
