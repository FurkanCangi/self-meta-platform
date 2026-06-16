import type { Metadata } from "next";
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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="tr" suppressHydrationWarning>
      <body className="min-h-screen">
        <ThemeProvider>
          <LayoutGate>{children}</LayoutGate>
          <CookieConsent />
        </ThemeProvider>
      </body>
    </html>
  );
}
