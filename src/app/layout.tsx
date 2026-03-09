import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./assets/css/tailwind.css";
import "./assets/css/materialdesignicons.min.css";
import "./globals.css";
import LayoutGate from "@/app/components/layout-gate";

export const metadata: Metadata = {
  title: "Self Meta AI",
  description: "AI destekli klinik değerlendirme, skor girişi ve versiyonlu raporlama platformu",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="tr" className="scroll-smooth">
      <body className="bg-[#f8fbfd] text-slate-900 antialiased">
        <LayoutGate>{children}</LayoutGate>
      </body>
    </html>
  );
}