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
    icon: [
      { url: "/images/favicon.ico" },
      { url: "/images/logo-icon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/images/logo-icon-64.png", sizes: "64x64", type: "image/png" },
      { url: "/images/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/images/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    shortcut: "/images/favicon.ico",
    apple: "/images/apple-touch-icon.png",
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
