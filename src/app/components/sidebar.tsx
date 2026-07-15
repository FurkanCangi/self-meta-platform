"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  AiOutlineBarChart,
  AiOutlineEdit,
  AiOutlineFileText,
  AiOutlineHome,
  AiOutlineMessage,
  AiOutlinePlayCircle,
  AiOutlineRead,
  AiOutlineSetting,
  AiOutlineShoppingCart,
  AiOutlineUser,
} from "react-icons/ai";
import BrandLogo from "./BrandLogo";

type SidebarProps = {
  toggle?: boolean;
  setToggle?: (value: boolean) => void;
};

function Item({
  href,
  label,
  icon,
  active,
}: {
  href: string;
  label: string;
  icon: React.ReactNode;
  active: boolean;
}) {
  return (
    <li>
      <Link
        href={href}
        aria-current={active ? "page" : undefined}
        className={[
          "group flex items-center gap-3 rounded-2xl px-4 py-3 text-[15px] font-semibold transition",
          active
            ? "bg-gradient-to-r from-cyan-50 via-blue-50 to-violet-50 text-[#071b3a] shadow-[0_14px_34px_rgba(37,99,235,0.12)] ring-1 ring-blue-100"
            : "text-slate-600 hover:bg-white hover:text-[#071b3a] hover:shadow-[0_10px_24px_rgba(37,99,235,0.08)]",
        ].join(" ")}
      >
        <span
          className={[
            "grid h-8 w-8 shrink-0 place-items-center rounded-xl text-[18px] transition",
            active
              ? "bg-white text-blue-700 shadow-sm"
              : "bg-slate-50 text-slate-500 group-hover:bg-gradient-to-br group-hover:from-cyan-50 group-hover:via-blue-50 group-hover:to-violet-50 group-hover:text-blue-700",
          ].join(" ")}
        >
          {icon}
        </span>
        <span className="leading-none">{label}</span>
      </Link>
    </li>
  );
}

export default function Sidebar({ toggle = true }: SidebarProps) {
  const pathname = usePathname() || "";

  return (
    <aside
      aria-hidden={!toggle}
      inert={!toggle ? true : undefined}
      className={[
        "hidden overflow-hidden md:flex md:flex-col border-r bg-white/94 text-[#071b3a] backdrop-blur-xl transition-[width,min-width,opacity,transform,border-color,box-shadow] duration-300 ease-out",
        toggle
          ? "md:w-[304px] md:min-w-[304px] border-slate-200/80 opacity-100 shadow-[18px_0_60px_rgba(7,27,58,0.08)]"
          : "pointer-events-none md:w-0 md:min-w-0 -translate-x-3 border-transparent opacity-0 shadow-none",
      ].join(" ")}
    >
      <div className="flex h-full w-[304px] min-w-[304px] flex-col">
        <div className="relative border-b border-slate-100 bg-white px-4 py-4">
          <Link
            href="/"
            className="dna-sidebar-logo-card relative flex h-[126px] items-center justify-center overflow-visible rounded-[28px] border border-cyan-100/80 bg-gradient-to-br from-white via-cyan-50/55 to-violet-50/45 shadow-[0_18px_44px_rgba(37,99,235,0.10)] transition hover:border-blue-100 hover:shadow-[0_22px_52px_rgba(37,99,235,0.14)]"
            aria-label="DNA Intelligence ana sayfa"
          >
            <BrandLogo variant="panel" />
          </Link>
        </div>

        <div className="overflow-y-auto px-3 pb-6">
          <div className="px-3 pb-2 pt-2 text-[12px] font-black uppercase tracking-[0.18em] text-slate-400">
            Gösterge Paneli
          </div>
          <ul className="space-y-1">
            <Item
              href="/starter"
              label="Genel Bakış"
              icon={<AiOutlineHome />}
              active={pathname === "/starter" || pathname === "/dashboard"}
            />
          </ul>

          <div className="px-3 pb-2 pt-6 text-[12px] font-black uppercase tracking-[0.18em] text-slate-400">
            Danışan Yönetimi
          </div>
          <ul className="space-y-1">
            <Item
              href="/clients"
              label="Danışan Listesi"
              icon={<AiOutlineUser />}
              active={pathname === "/clients" || pathname.startsWith("/clients/")}
            />
            <Item
              href="/clients/new"
              label="Yeni Danışan Ekle"
              icon={<AiOutlineEdit />}
              active={pathname === "/clients/new"}
            />
          </ul>

          <div className="px-3 pb-2 pt-6 text-[12px] font-black uppercase tracking-[0.18em] text-slate-400">
            Eğitim Alanı
          </div>
          <ul className="space-y-1">
            <Item
              href="/education"
              label="Eğitimler"
              icon={<AiOutlineRead />}
              active={pathname === "/education" || pathname.startsWith("/education/")}
            />
          </ul>

          <div className="px-3 pb-2 pt-6 text-[12px] font-black uppercase tracking-[0.18em] text-slate-400">
            Klinik Değerlendirme
          </div>
          <ul className="space-y-1">
            <Item
              href="/assessments"
              label="Skor Girişi"
              icon={<AiOutlineFileText />}
              active={pathname === "/assessments" || pathname === "/assessments/new"}
            />
            <Item
              href="/video-observation"
              label="Video Gözlem"
              icon={<AiOutlinePlayCircle />}
              active={pathname === "/video-observation"}
            />
            <Item
              href="/reports"
              label="Rapor Geçmişi"
              icon={<AiOutlineBarChart />}
              active={pathname === "/reports"}
            />
            <Item
              href="/dna-asistani"
              label="DNA Asistanı"
              icon={<AiOutlineMessage />}
              active={pathname === "/dna-asistani"}
            />
            <Item
              href="/report-packages"
              label="Rapor Paketleri"
              icon={<AiOutlineShoppingCart />}
              active={pathname === "/report-packages"}
            />
          </ul>

          <div className="px-3 pb-2 pt-6 text-[12px] font-black uppercase tracking-[0.18em] text-slate-400">
            Hesap
          </div>
          <ul className="space-y-1">
            <Item
              href="/profile"
              label="Profil"
              icon={<AiOutlineUser />}
              active={pathname === "/profile"}
            />
            <Item
              href="/profile-setting"
              label="Ayarlar"
              icon={<AiOutlineSetting />}
              active={pathname === "/profile-setting" || pathname === "/settings"}
            />
            <Item
              href="/support"
              label="Destek"
              icon={<AiOutlineMessage />}
              active={pathname === "/support"}
            />
          </ul>
        </div>
      </div>
    </aside>
  );
}
