"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  AiOutlineBarChart,
  AiOutlineEdit,
  AiOutlineFileText,
  AiOutlineHome,
  AiOutlinePlayCircle,
  AiOutlineSetting,
  AiOutlineUser,
} from "react-icons/ai";

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
        className={[
          "group flex items-center gap-3 rounded-xl px-4 py-3 text-[15px] font-medium transition",
          active
            ? "bg-white/10 text-white"
            : "text-slate-200 hover:bg-white/6 hover:text-white",
        ].join(" ")}
      >
        <span className="shrink-0 text-[18px]">{icon}</span>
        <span className="leading-none">{label}</span>
      </Link>
    </li>
  );
}

export default function Sidebar(_props: SidebarProps) {
  const pathname = usePathname() || "";

  return (
    <aside className="hidden md:flex md:w-[304px] md:min-w-[304px] md:flex-col border-r border-slate-800 bg-[#06133d] text-white">
      <div className="px-5 pt-5 pb-4">
        <Link
          href="/"
          className="flex h-[58px] items-center rounded-[20px] bg-[#0b7bb2] px-5 text-[15px] font-semibold tracking-[0.2px] text-white shadow-[0_10px_30px_rgba(11,123,178,0.35)]"
        >
          Self Metacognition Institute
        </Link>
      </div>

      <div className="overflow-y-auto px-3 pb-6">
        <div className="px-3 pb-2 pt-2 text-[13px] font-semibold uppercase tracking-[0.14em] text-slate-400">
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

        <div className="px-3 pb-2 pt-6 text-[13px] font-semibold uppercase tracking-[0.14em] text-slate-400">
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

        <div className="px-3 pb-2 pt-6 text-[13px] font-semibold uppercase tracking-[0.14em] text-slate-400">
          Klinik Değerlendirme
        </div>
        <ul className="space-y-1">
          <Item
            href="/clients"
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
        </ul>

        <div className="px-3 pb-2 pt-6 text-[13px] font-semibold uppercase tracking-[0.14em] text-slate-400">
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
        </ul>
      </div>
    </aside>
  );
}
