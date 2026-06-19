"use client";

import { useEffect, useMemo, useState } from "react";
import { RefreshCw } from "lucide-react";

type RuntimeConfig = {
  ok: boolean;
  webVersion?: string | null;
  minimumShellVersion?: string | null;
  recommendedShellVersion?: string | null;
  maintenance?: {
    enabled: boolean;
    message: string | null;
    retryAfterSeconds: number | null;
  };
  updateNotice?: {
    enabled: boolean;
    severity: string | null;
    title: string | null;
    message: string | null;
  };
  storeUrls?: {
    ios: string | null;
    android: string | null;
  };
};

const RUNTIME_CONFIG_CACHE_KEY = "dna_app_runtime_config_v1";
const RUNTIME_CONFIG_CACHE_MS = 60_000;

function readCachedRuntimeConfig(): RuntimeConfig | null {
  if (typeof window === "undefined") return null;
  try {
    const cached = JSON.parse(window.sessionStorage.getItem(RUNTIME_CONFIG_CACHE_KEY) || "null");
    if (!cached?.savedAt || Date.now() - Number(cached.savedAt) > RUNTIME_CONFIG_CACHE_MS) return null;
    return cached.value || null;
  } catch {
    return null;
  }
}

function writeCachedRuntimeConfig(value: RuntimeConfig) {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(
      RUNTIME_CONFIG_CACHE_KEY,
      JSON.stringify({ savedAt: Date.now(), value })
    );
  } catch {}
}

function versionParts(value?: string | null) {
  return String(value || "0.0.0")
    .split(".")
    .map((part) => Number.parseInt(part.replace(/\D/g, "") || "0", 10))
    .slice(0, 3);
}

function compareVersions(left?: string | null, right?: string | null) {
  const a = versionParts(left);
  const b = versionParts(right);
  for (let index = 0; index < 3; index += 1) {
    const diff = (a[index] || 0) - (b[index] || 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

function currentShellVersion() {
  if (typeof window === "undefined") return "1.0.0";
  const url = new URL(window.location.href);
  return url.searchParams.get("shell_version") || window.localStorage.getItem("dna_shell_version") || "1.0.0";
}

function BlockingState({ title, message, actionLabel, actionHref }: {
  title: string;
  message: string;
  actionLabel?: string;
  actionHref?: string | null;
}) {
  return (
    <div className="mx-auto grid min-h-[58vh] max-w-lg place-items-center px-3 py-10">
      <div className="w-full rounded-[26px] border border-blue-100 bg-white/90 p-6 text-center shadow-[0_18px_52px_rgba(7,27,58,0.08)] backdrop-blur-xl">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-cyan-50 via-blue-50 to-violet-50 text-blue-700">
          <RefreshCw size={26} strokeWidth={1.9} />
        </div>
        <h1 className="mt-5 text-2xl font-black text-[#071b3a]">{title}</h1>
        <p className="mt-3 text-sm font-medium leading-7 text-slate-600">{message}</p>
        {actionHref ? (
          <a
            href={actionHref}
            className="mt-6 inline-flex h-12 items-center justify-center rounded-2xl bg-gradient-to-r from-cyan-400 via-blue-600 to-violet-600 px-5 text-sm font-black text-white shadow-lg shadow-blue-600/20"
          >
            {actionLabel || "Güncelle"}
          </a>
        ) : (
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-6 inline-flex h-12 items-center justify-center rounded-2xl bg-gradient-to-r from-cyan-400 via-blue-600 to-violet-600 px-5 text-sm font-black text-white shadow-lg shadow-blue-600/20"
          >
            Yenile
          </button>
        )}
      </div>
    </div>
  );
}

export default function AppUpdateGate({ children }: { children: React.ReactNode }) {
  const [config, setConfig] = useState<RuntimeConfig | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let active = true;
    const cached = readCachedRuntimeConfig();
    if (cached) setConfig(cached);

    async function loadConfig() {
      if (active && !cached) setLoading(true);
      try {
        const response = await fetch("/api/app/runtime-config", { cache: "no-store" });
        const json = (await response.json()) as RuntimeConfig;
        if (active && response.ok && json.ok) {
          setConfig(json);
          writeCachedRuntimeConfig(json);
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadConfig();
    return () => {
      active = false;
    };
  }, []);

  const shellVersion = useMemo(() => currentShellVersion(), []);

  if (config?.maintenance?.enabled) {
    return (
      <BlockingState
        title="Bakım modu"
        message={config.maintenance.message || "Kısa bir bakım çalışması yapıyoruz. Lütfen biraz sonra tekrar deneyin."}
      />
    );
  }

  if (config?.minimumShellVersion && compareVersions(shellVersion, config.minimumShellVersion) < 0) {
    const url = config.storeUrls?.ios || config.storeUrls?.android || null;
    return (
      <BlockingState
        title="App güncellemesi gerekli"
        message="Bu app kabuğu artık desteklenen minimum sürümün gerisinde. Devam etmek için uygulamayı güncelleyin."
        actionLabel="Store'a git"
        actionHref={url}
      />
    );
  }

  const showRecommendedUpdate =
    config?.recommendedShellVersion && compareVersions(shellVersion, config.recommendedShellVersion) < 0;
  const showNotice = Boolean(config?.updateNotice?.enabled || showRecommendedUpdate);

  return (
    <>
      {showNotice ? (
        <div className="mb-4 rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm font-semibold leading-6 text-blue-800">
          <div className="font-black">{config?.updateNotice?.title || "Yeni sürüm hazır"}</div>
          <div>{config?.updateNotice?.message || "App deneyimini güncellemek için sayfayı yenileyebilirsiniz."}</div>
          <button type="button" onClick={() => window.location.reload()} className="mt-2 text-xs font-black uppercase tracking-[0.12em] text-blue-700">
            Yenile
          </button>
        </div>
      ) : null}
      {loading ? (
        <div className="mb-3 rounded-2xl border border-slate-200 bg-white/82 px-4 py-3 text-xs font-bold text-slate-500">
          App durumu kontrol ediliyor...
        </div>
      ) : null}
      {children}
    </>
  );
}
