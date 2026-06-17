"use client";

import AppHeader from "./AppHeader";
import AppUpdateGate from "./AppUpdateGate";
import BottomTabs from "./BottomTabs";
import LegalAcceptanceGate from "./LegalAcceptanceGate";
import PendingLegalAcceptanceSync from "../auth/PendingLegalAcceptanceSync";

type AppShellProps = {
  children: React.ReactNode;
};

export default function AppShell({ children }: AppShellProps) {
  return (
    <div className="dna-shell min-h-screen bg-[#eef6ff] text-slate-900">
      <PendingLegalAcceptanceSync />
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(circle_at_12%_0%,rgba(0,200,215,0.12),transparent_32%),radial-gradient(circle_at_92%_8%,rgba(124,58,237,0.10),transparent_34%)]" />
      <div className="dna-app-frame relative mx-auto min-h-screen w-full max-w-[430px] overflow-x-hidden bg-[#f8fbff] shadow-[0_0_0_1px_rgba(148,163,184,0.26),0_28px_90px_rgba(7,27,58,0.18)]">
        <AppHeader />
        <main className="dna-app-main min-w-0 px-3 pb-[calc(96px+env(safe-area-inset-bottom))] pt-4">
          <AppUpdateGate>
            <LegalAcceptanceGate>{children}</LegalAcceptanceGate>
          </AppUpdateGate>
        </main>
        <BottomTabs />
      </div>
    </div>
  );
}
