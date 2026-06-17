"use client";

import AppHeader from "./AppHeader";
import BottomTabs from "./BottomTabs";
import PendingLegalAcceptanceSync from "../auth/PendingLegalAcceptanceSync";

type AppShellProps = {
  children: React.ReactNode;
};

export default function AppShell({ children }: AppShellProps) {
  return (
    <div className="dna-shell min-h-screen bg-[#f8fbff] text-slate-900">
      <PendingLegalAcceptanceSync />
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(circle_at_12%_0%,rgba(0,200,215,0.12),transparent_32%),radial-gradient(circle_at_92%_8%,rgba(124,58,237,0.10),transparent_34%)]" />
      <AppHeader />
      <main className="min-w-0 px-3 pb-[calc(96px+env(safe-area-inset-bottom))] pt-4 md:px-8 md:pb-8">
        {children}
      </main>
      <BottomTabs />
    </div>
  );
}
