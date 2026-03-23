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
      <body className="min-h-screen bg-slate-50 text-slate-900">
        <LayoutGate>{children}</LayoutGate>
      </body>
    </html>
  );
}
