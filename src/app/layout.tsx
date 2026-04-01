import type { Metadata } from "next";
import "./globals.css";
import LayoutGate from "./components/layout-gate";
import { ThemeProvider } from "./components/theme-provider";

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
    <html lang="tr" suppressHydrationWarning>
      <body className="min-h-screen">
        <ThemeProvider>
          <LayoutGate>{children}</LayoutGate>
        </ThemeProvider>
      </body>
    </html>
  );
}
