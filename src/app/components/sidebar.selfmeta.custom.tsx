"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AiOutlineHome, AiOutlineUser, AiOutlineFileText, AiOutlineSetting, AiOutlineEdit } from "react-icons/ai";

export default function Sidebar() {
  const pathname = usePathname() || "";

  const isActive = (href: string) => (pathname === href ? "active" : "");

  return (
    <div className="sidebar-wrapper">
      <ul className="sidebar-menu">
        <li className="menu-title">
          <span>Gösterge Paneli</span>
        </li>
        <li className={isActive("/starter")}>
          <Link href="/starter">
            <AiOutlineHome className="me-3 icon" />
            Genel Bakış
          </Link>
        </li>

        <li className="menu-title">
          <span>Danışan Yönetimi</span>
        </li>
        <li className={isActive("/clients")}>
          <Link href="/clients">
            <AiOutlineUser className="me-3 icon" />
            Danışan Listesi
          </Link>
        </li>
        <li className={isActive("/clients/new")}>
          <Link href="/clients/new">
            <AiOutlineEdit className="me-3 icon" />
            Yeni Danışan Ekle
          </Link>
        </li>

        <li className="menu-title">
          <span>Değerlendirme</span>
        </li>
        <li className={isActive("/assessments")}>
          <Link href="/assessments">
            <AiOutlineFileText className="me-3 icon" />
            Skor Girişi
          </Link>
        </li>

        <li className="menu-title">
          <span>Raporlar</span>
        </li>
        <li className={isActive("/reports")}>
          <Link href="/reports">
            <AiOutlineFileText className="me-3 icon" />
            Rapor Geçmişi
          </Link>
        </li>

        <li className="menu-title">
          <span>Sistem</span>
        </li>
        <li className={isActive("/settings")}>
          <Link href="/settings">
            <AiOutlineSetting className="me-3 icon" />
            Ayarlar
          </Link>
        </li>
      </ul>
    </div>
  );
}
