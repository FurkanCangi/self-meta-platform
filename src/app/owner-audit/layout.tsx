import OwnerAuditNav from "./OwnerAuditNav"

export default function OwnerAuditLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen overflow-x-hidden bg-[radial-gradient(circle_at_14%_12%,rgba(34,211,238,0.14),transparent_30%),radial-gradient(circle_at_88%_16%,rgba(124,58,237,0.12),transparent_28%),linear-gradient(180deg,#f8fbff_0%,#eef5ff_100%)] text-slate-950">
      <div className="pointer-events-none fixed inset-0 bg-[linear-gradient(90deg,rgba(37,99,235,0.04)_1px,transparent_1px),linear-gradient(180deg,rgba(37,99,235,0.04)_1px,transparent_1px)] bg-[size:72px_72px] opacity-45" />
      <OwnerAuditNav />
      <main className="relative mx-auto w-full max-w-7xl px-4 py-7 sm:px-6 lg:px-8">
        {children}
      </main>
    </div>
  )
}
