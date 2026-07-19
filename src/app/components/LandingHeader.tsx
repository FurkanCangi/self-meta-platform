"use client";

import type { CSSProperties } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRef, useState } from "react";
import {
  BrainCircuit,
  ClipboardCheck,
  Database,
  FileText,
  GraduationCap,
  Handshake,
  Layers3,
  Menu,
  Sparkles,
  X,
} from "lucide-react";
import BrandLogo from "./BrandLogo";

const dnaMenuItems = [
  {
    href: "/dna-nedir",
    title: "DNA Yaklaşımı",
    description: "Yaklaşımın temel kavramları ve klinikte nasıl kullanıldığı.",
    icon: BrainCircuit,
    accent: "#7C3AED",
  },
  {
    href: "/dna-nedir/egitim-programi",
    title: "Eğitim Programı",
    description: "Yaklaşımın temelini, değerlendirmeyi ve müdahale planlamayı kapsayan 40 saatlik program.",
    icon: GraduationCap,
    accent: "#7C3AED",
  },
  {
    href: "/dna-nedir/degerlendirme-sistemi",
    title: "Değerlendirme Sistemi",
    description: "Test, anamnez ve gözlem bilgilerini birlikte değerlendirme.",
    icon: ClipboardCheck,
    accent: "#2563EB",
  },
  {
    href: "/dna-nedir/mudahale-yaklasimi",
    title: "Müdahale Yaklaşımı",
    description: "Bedenden başlayan ve düşünme becerilerini destekleyen müdahale planlama.",
    icon: Layers3,
    accent: "#00C8D7",
  },
  {
    href: "/dna-nedir/ai-raporlama",
    title: "Açıklanabilir Raporlama",
    description: "Değerlendirme bilgilerinden terapistin düzenleyebileceği rapor taslağı.",
    icon: FileText,
    accent: "#2563EB",
  },
  {
    href: "/dna-nedir/gelecek-moduller",
    title: "DNA Labs",
    description: "Üzerinde çalışılan yeni özellikler.",
    icon: Sparkles,
    accent: "#00C8D7",
  },
];

const researchMenuItems = [
  {
    href: "/arastirma/arastirma-notlari",
    title: "Araştırma Notları",
    description: "Klinik uygulamada işe yarayan araştırma özetleri ve yöntem notları.",
    icon: FileText,
    accent: "#2563EB",
  },
  {
    href: "/arastirma/is-birlikleri",
    title: "İş Birlikleri",
    description: "Üniversiteler, araştırma grupları ve kliniklerle ortak çalışma olanakları.",
    icon: Handshake,
    accent: "#7C3AED",
  },
  {
    href: "/arastirma/tez-ve-proje-destegi",
    title: "Tez ve Proje Desteği",
    description: "Tez ve araştırma projelerinde soru, yöntem ve veri analizi desteği.",
    icon: GraduationCap,
    accent: "#00C8D7",
  },
  {
    href: "/arastirma/veri-agi",
    title: "Veri Ağı",
    description: "Birden fazla merkezden güvenli ve karşılaştırılabilir veri toplama çalışmaları.",
    icon: Database,
    accent: "#2563EB",
  },
];

export default function LandingHeader({ compact = false }: { compact?: boolean }) {
  const pathname = usePathname() || "/";
  const [openMenu, setOpenMenu] = useState<"dna" | "research" | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancelClose = () => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  };

  const openDropdown = (menu: "dna" | "research") => {
    cancelClose();
    setOpenMenu(menu);
  };

  const scheduleClose = () => {
    cancelClose();
    closeTimerRef.current = setTimeout(() => {
      setOpenMenu(null);
      closeTimerRef.current = null;
    }, 360);
  };

  const closeDropdown = () => {
    cancelClose();
    setOpenMenu(null);
  };

  const closeMobileNavigation = () => {
    closeDropdown();
    setMobileMenuOpen(false);
  };

  const linkClass = (href: string) => {
    const isActive = href === "/" ? pathname === "/" : pathname === href;
    return `smiNavLink${isActive ? " smiNavLinkActive" : ""}`;
  };
  const dnaClass = `smiNavLink smiDropdownTrigger${
    pathname.startsWith("/dna-nedir") ? " smiNavLinkActive" : ""
  }`;
  const researchClass = `smiNavLink smiDropdownTrigger${
    pathname.startsWith("/arastirma") ? " smiNavLinkActive" : ""
  }`;

  return (
    <header className={`smiHeaderWrap${compact ? " smiHeaderCompact" : ""}${mobileMenuOpen ? " smiMobileMenuOpen" : ""}`}>
      <div className="smiHeaderInner">
        <div className="smiHeaderLeft">
          <Link href="/" className="smiBrandLink" aria-label="DNA ana sayfa">
            <BrandLogo />
          </Link>
        </div>

        <button
          type="button"
          className="smiMobileMenuButton"
          aria-label={mobileMenuOpen ? "Menüyü kapat" : "Menüyü aç"}
          aria-expanded={mobileMenuOpen}
          onClick={() => {
            closeDropdown();
            setMobileMenuOpen((current) => !current);
          }}
        >
          {mobileMenuOpen ? <X size={22} strokeWidth={2.3} /> : <Menu size={22} strokeWidth={2.3} />}
        </button>

        <nav className="smiNav" aria-label="Landing navigation">
          <Link href="/" className={linkClass("/")} onClick={closeMobileNavigation}>
            Ana Sayfa
          </Link>
          <div
            className={`smiDropdown smiMegaDropdown${openMenu === "dna" ? " smiDropdownOpen" : ""}`}
            onMouseEnter={() => openDropdown("dna")}
            onMouseLeave={scheduleClose}
            onBlur={(event) => {
              if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget)) {
                closeDropdown();
              }
            }}
          >
            <button
              type="button"
              className={dnaClass}
              aria-expanded={openMenu === "dna"}
              onClick={() => setOpenMenu((current) => (current === "dna" ? null : "dna"))}
            >
              {compact ? "DNA Intelligence" : "DNA Intelligence Nedir?"}
            </button>
            {openMenu === "dna" ? (
              <div className="smiDropdownMenu smiMegaMenu">
                {dnaMenuItems.map(({ href, title, description, icon: Icon, accent }, index) => (
                  <Link
                    href={href}
                    className="smiMegaItem"
                    key={href}
                    style={{ "--item-accent": accent } as CSSProperties}
                    onClick={closeMobileNavigation}
                  >
                    <span className="smiMegaIcon" aria-hidden="true">
                      <Icon size={20} strokeWidth={1.9} />
                    </span>
                    <span className="smiMegaNumber" aria-hidden="true">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <span>
                      <strong>{title}</strong>
                      <small>{description}</small>
                    </span>
                  </Link>
                ))}
              </div>
            ) : null}
          </div>
          <Link href="/cozumler" className={linkClass("/cozumler")} onClick={closeMobileNavigation}>
            Çözümler
          </Link>
          <div
            className={`smiDropdown smiMegaDropdown smiResearchDropdown${openMenu === "research" ? " smiDropdownOpen" : ""}`}
            onMouseEnter={() => openDropdown("research")}
            onMouseLeave={scheduleClose}
            onBlur={(event) => {
              if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget)) {
                closeDropdown();
              }
            }}
          >
            <button
              type="button"
              className={researchClass}
              aria-expanded={openMenu === "research"}
              onClick={() => setOpenMenu((current) => (current === "research" ? null : "research"))}
            >
              Araştırma
            </button>
            {openMenu === "research" ? (
              <div className="smiDropdownMenu smiMegaMenu smiResearchMenu">
                {researchMenuItems.map(({ href, title, description, icon: Icon, accent }, index) => (
                  <Link
                    href={href}
                    className="smiMegaItem"
                    key={href}
                    style={{ "--item-accent": accent } as CSSProperties}
                    onClick={closeMobileNavigation}
                  >
                    <span className="smiMegaIcon" aria-hidden="true">
                      <Icon size={20} strokeWidth={1.9} />
                    </span>
                    <span className="smiMegaNumber" aria-hidden="true">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <span>
                      <strong>{title}</strong>
                      <small>{description}</small>
                    </span>
                  </Link>
                ))}
              </div>
            ) : null}
          </div>
          <Link href="/terapist-bul" className={linkClass("/terapist-bul")} onClick={closeMobileNavigation}>
            Terapist Bul
          </Link>
          <Link href="/iletisim" className={linkClass("/iletisim")} onClick={closeMobileNavigation}>
            İletişim
          </Link>
        </nav>

        <div className="smiHeaderRight">
          <Link href="/signup" className="smiSignupPill" onClick={closeMobileNavigation}>
            Kayıt Ol
          </Link>
          <Link href="/login" className="smiLoginPill" onClick={closeMobileNavigation}>
            Giriş Yap
          </Link>
        </div>
      </div>
    </header>
  );
}
