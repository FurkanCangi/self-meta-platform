import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";
import CookieConsent from "./components/CookieConsent";
import LayoutGate from "./components/layout-gate";
import { ThemeProvider } from "./components/theme-provider";

export const metadata: Metadata = {
  title: "DNA Intelligence | Dynamic Neuro-Regulation Approach",
  description: "DNA Intelligence clinical education and AI-supported reporting platform",
  icons: {
    icon: "/images/favicon.ico",
    shortcut: "/images/favicon.ico",
    apple: "/images/logo-icon.png",
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const headerStore = await headers();
  const initialAppSurface = headerStore.get("x-dna-app-surface") === "app";

  return (
    <html lang="tr" suppressHydrationWarning>
      <body className="min-h-screen">
        <ThemeProvider>
          <LayoutGate initialAppSurface={initialAppSurface}>{children}</LayoutGate>
          <CookieConsent />
        </ThemeProvider>
      </body>
    </html>
  );
}
