"use client";

import { useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import PendingLegalAcceptanceSync from "./auth/PendingLegalAcceptanceSync";
import Sidebar from "./sidebar";
import Topnav from "./topnav";

type LayoutGateProps = {
  children: React.ReactNode;
};

const PUBLIC_ROUTES = new Set([
  "/",
  "/login",
  "/signup",
  "/auth-login",
  "/auth-signup",
  "/auth-signup-success",
  "/self-regulasyon-nedir",
  "/dna-nedir",
  "/cozumler",
  "/arastirma",
  "/fiyatlandirma",
  "/iletisim",
  "/pricing",
  "/privacy",
  "/terms",
  "/kvkk",
  "/cerez-politikasi",
  "/explicit-consent",
  "/retention-policy",
  "/package-agreement",
  "/legal/accept",
  "/clearroll/privacy",
]);

export default function LayoutGate({ children }: LayoutGateProps) {
  const pathname = usePathname() || "/";
  const [toggle, setToggle] = useState(true);

  const isPublicRoute = useMemo(() => {
    if (PUBLIC_ROUTES.has(pathname)) return true;
    if (pathname.startsWith("/klinik-alanlar/")) return true;
    if (pathname.startsWith("/dna-nedir/")) return true;
    if (pathname.startsWith("/arastirma/")) return true;
    return false;
  }, [pathname]);

  if (isPublicRoute) {
    return (
      <>
        <PendingLegalAcceptanceSync />
        {children}
      </>
    );
  }

  return (
    <div className="selfmeta-shell min-h-screen bg-[#f8fbff] text-slate-900">
      <PendingLegalAcceptanceSync />
      <div className="flex min-h-screen">
        <Sidebar toggle={toggle} setToggle={setToggle} />

        <div className="flex min-w-0 flex-1 flex-col">
          <Topnav toggle={toggle} setToggle={setToggle} />

          <main className="min-w-0 flex-1 px-6 py-6 md:px-8">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
