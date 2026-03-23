"use client";

import { useMemo, useState } from "react";
import { usePathname } from "next/navigation";
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
  "/pricing",
  "/privacy",
  "/terms",
]);

export default function LayoutGate({ children }: LayoutGateProps) {
  const pathname = usePathname() || "/";
  const [toggle, setToggle] = useState(true);

  const isPublicRoute = useMemo(() => {
    if (PUBLIC_ROUTES.has(pathname)) return true;
    return false;
  }, [pathname]);

  if (isPublicRoute) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
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
