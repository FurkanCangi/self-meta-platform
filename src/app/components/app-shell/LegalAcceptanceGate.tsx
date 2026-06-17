"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { FileCheck2, RefreshCw } from "lucide-react";

type LegalDocument = {
  id: string;
  title: string;
  version: string;
  href: string;
};

type LegalStatus = {
  ok: boolean;
  authenticated: boolean;
  configured: boolean;
  accepted: boolean;
  documents: LegalDocument[];
  error?: string;
};

export default function LegalAcceptanceGate({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<LegalStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadStatus() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/legal/status", { cache: "no-store" });
      const json = (await response.json()) as LegalStatus;
      setStatus(json);
    } catch {
      setError("Hukuki kabul durumu kontrol edilemedi.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadStatus();
  }, []);

  async function acceptDocuments() {
    setAccepting(true);
    setError(null);
    try {
      const response = await fetch("/api/legal/accept", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-dna-request": "same-origin",
        },
        body: JSON.stringify({
          sourcePath: `${window.location.pathname}${window.location.search}`,
        }),
      });
      const json = await response.json().catch(() => null);
      if (!response.ok || !json?.ok) {
        throw new Error(json?.error || "Hukuki onay kaydedilemedi.");
      }
      await loadStatus();
    } catch (acceptError) {
      setError(acceptError instanceof Error ? acceptError.message : "Hukuki onay kaydedilemedi.");
    } finally {
      setAccepting(false);
    }
  }

  if (loading) return <>{children}</>;

  if (status?.accepted) return <>{children}</>;

  return (
    <div className="mx-auto max-w-2xl px-3 py-8">
      <div className="rounded-[26px] border border-blue-100 bg-white/92 p-5 shadow-[0_18px_52px_rgba(7,27,58,0.08)] backdrop-blur-xl md:p-7">
        <div className="grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-cyan-50 via-blue-50 to-violet-50 text-blue-700">
          <FileCheck2 size={27} strokeWidth={1.9} />
        </div>
        <h1 className="mt-5 text-2xl font-black text-[#071b3a]">Hukuki onay gerekli</h1>
        <p className="mt-3 text-sm font-medium leading-7 text-slate-600">
          Terapist çalışma alanına devam etmek için güncel kullanım şartları, KVKK aydınlatması, açık rıza ve saklama politikası belgelerini onaylamanız gerekir.
        </p>

        <div className="mt-5 grid gap-2">
          {(status?.documents || []).map((document) => (
            <Link
              key={`${document.id}-${document.version}`}
              href={document.href}
              target="_blank"
              className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700"
            >
              <span>{document.title}</span>
              <span className="font-mono text-xs text-slate-500">v{document.version}</span>
            </Link>
          ))}
        </div>

        {error || status?.error ? (
          <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
            {error || status?.error}
          </div>
        ) : null}

        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            onClick={acceptDocuments}
            disabled={accepting || !status?.configured}
            className="inline-flex h-12 flex-1 items-center justify-center rounded-2xl bg-gradient-to-r from-cyan-400 via-blue-600 to-violet-600 px-5 text-sm font-black text-white shadow-lg shadow-blue-600/20 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {accepting ? "Kaydediliyor..." : "Okudum ve onaylıyorum"}
          </button>
          <button
            type="button"
            onClick={loadStatus}
            className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 text-sm font-black text-slate-700"
          >
            <RefreshCw size={17} />
            Yeniden kontrol et
          </button>
        </div>
      </div>
    </div>
  );
}
