'use client'
import React, { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import SimpleBarReact from "simplebar-react";
import "simplebar-react/dist/simplebar.min.css";
import { AiOutlineLineChart, AiOutlineUser, AiOutlineFileText, AiOutlineBook } from "react-icons/ai";

export default function Sidebar(){
  const [manu, setManu] = useState("");
  const [subManu, setSubManu] = useState("");
  const pathname = usePathname() || "";

  useEffect(() => {
    setManu(pathname);
    setSubManu(pathname);
    if (typeof window !== "undefined") window.scrollTo(0, 0);
  }, [pathname]);

  return (
    <nav className="sidebar-wrapper sidebar-colored">
      <div className="sidebar-content">
        <div className="sidebar-brand">
          <Link href="/"><Image src="/images/logo-light.png" placeholder="blur" blurDataURL="/images/logo-light.png" width={138} height={24} alt=""/></Link>
        </div>
        <SimpleBarReact style={{ height: "calc(100% - 70px)" }}>
          <ul className="sidebar-menu border-t border-white/10">
            <li className={`sidebar-dropdown ${["/starter","/progress"].includes(manu) ? "active" : ""}`}>
              <Link href="#" onClick={(e)=>{e.preventDefault(); setSubManu(subManu === "/dash-item" ? "" : "/dash-item");}}>
                <AiOutlineLineChart className="me-3 icon"/>Gösterge Paneli
              </Link>
              <div className={`sidebar-submenu ${["/starter","/progress","/dash-item"].includes(subManu) ? "block" : ""}`}>
                <ul>
                  <li className={manu === "/starter" ? "active" : ""}><Link href="/starter">Genel Bakış</Link></li>
                  <li className={manu === "/progress" ? "active" : ""}><Link href="/progress">İlerleme Raporları</Link></li>
                </ul>
              </div>
            </li>

            <li className={`sidebar-dropdown ${["/trainings","/blog","/blog-detail"].includes(manu) ? "active" : ""}`}>
              <Link href="#" onClick={(e)=>{e.preventDefault(); setSubManu(subManu === "/edu-item" ? "" : "/edu-item");}}>
                <AiOutlineBook className="me-3 icon"/>Eğitimler ve Kaynaklar
              </Link>
              <div className={`sidebar-submenu ${["/trainings","/blog","/blog-detail","/edu-item"].includes(subManu) ? "block" : ""}`}>
                <ul>
                  <li className={manu === "/trainings" ? "active" : ""}><Link href="/trainings">Teorik Eğitimler</Link></li>
                  <li className={manu === "/blog" ? "active" : ""}><Link href="/blog">Akademik Blog</Link></li>
                </ul>
              </div>
            </li>

            <li className={`sidebar-dropdown ${["/assessments","/reports"].includes(manu) ? "active" : ""}`}>
              <Link href="#" onClick={(e)=>{e.preventDefault(); setSubManu(subManu === "/clinic-item" ? "" : "/clinic-item");}}>
                <AiOutlineFileText className="me-3 icon"/>Klinik Değerlendirme
              </Link>
              <div className={`sidebar-submenu ${["/assessments","/reports","/clinic-item"].includes(subManu) ? "block" : ""}`}>
                <ul>
                  <li className={manu === "/assessments" ? "active" : ""}><Link href="/assessments">Skor Girişi</Link></li>
                  <li className={manu === "/reports" ? "active" : ""}><Link href="/reports">Rapor Geçmişi</Link></li>
                </ul>
              </div>
            </li>

            <li className={`sidebar-dropdown ${["/clients","/clients/new"].includes(manu) ? "active" : ""}`}>
              <Link href="#" onClick={(e)=>{e.preventDefault(); setSubManu(subManu === "/client-item" ? "" : "/client-item");}}>
                <AiOutlineUser className="me-3 icon"/>Danışan Yönetimi
              </Link>
              <div className={`sidebar-submenu ${["/clients","/clients/new","/client-item"].includes(subManu) ? "block" : ""}`}>
                <ul>
                  <li className={manu === "/clients" ? "active" : ""}><Link href="/clients">Danışan Listesi</Link></li>
                  <li className={manu === "/clients/new" ? "active" : ""}><Link href="/clients/new">Yeni Danışan Ekle</Link></li>
                </ul>
              </div>
            </li>
          </ul>
        </SimpleBarReact>
      </div>
    </nav>
  );
}
