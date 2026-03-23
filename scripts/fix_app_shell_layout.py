from pathlib import Path
from datetime import datetime
import shutil

root = Path.cwd()
stamp = datetime.now().strftime("%Y%m%d_%H%M%S")

def backup(path: Path):
    if path.exists():
        bak = path.with_suffix(path.suffix + f".layoutfix.{stamp}.bak")
        shutil.copy2(path, bak)
        print("BACKUP", bak)

layout_gate = root / "src/app/components/layout-gate.tsx"
layout_tsx = root / "src/app/layout.tsx"

backup(layout_gate)
backup(layout_tsx)

layout_gate.write_text(
'''\
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
      <div className="flex min-h-screen items-stretch">
        <Sidebar toggle={toggle} setToggle={setToggle} />

        <div className="flex min-h-screen min-w-0 flex-1 flex-col">
          <Topnav toggle={toggle} setToggle={setToggle} />

          <main className="min-w-0 flex-1 overflow-x-hidden">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
''',
encoding="utf-8"
)

layout_tsx.write_text(
'''\
import type { Metadata } from "next";
import "./globals.css";
import LayoutGate from "./components/layout-gate";

export const metadata: Metadata = {
  title: "Self Meta AI",
  description: "Self Meta AI clinical platform",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="tr">
      <body>
        <LayoutGate>{children}</LayoutGate>
      </body>
    </html>
  );
}
''',
encoding="utf-8"
)

print("WROTE", layout_gate)
print("WROTE", layout_tsx)
