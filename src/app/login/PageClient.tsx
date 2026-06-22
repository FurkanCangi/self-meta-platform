"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import AuthLayout from "../components/auth/AuthLayout";

function sanitizeNextPath(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/starter";
  }
  if (value.startsWith("/legal/accept")) {
    return "/starter";
  }
  return value;
}

function isAppSurfaceRequest(nextPath: string, currentSearch: URLSearchParams) {
  if (currentSearch.get("surface") === "app") return true;
  try {
    const parsed = new URL(nextPath, window.location.origin);
    return parsed.searchParams.get("surface") === "app";
  } catch {
    return nextPath.includes("surface=app");
  }
}

function formatLoginErrorCode(code?: string | null) {
  if (!code) return null;
  if (code === "missing") return "E-posta ve şifre alanlarını doldurun.";
  if (code === "invalid") return "E-posta veya şifre hatalı.";
  if (code === "email_not_confirmed") return "E-posta adresiniz henüz doğrulanmamış. Gelen kutunuzu ve spam klasörünü kontrol edin.";
  if (code === "confirm_invalid") return "Doğrulama bağlantısı eksik veya geçersiz.";
  if (code === "confirm_failed") return "Doğrulama bağlantısı süresi dolmuş veya daha önce kullanılmış olabilir.";
  if (code === "origin") return "Giriş isteği güvenlik kontrolünden geçemedi. Sayfayı yenileyip tekrar deneyin.";
  if (code === "network") return "Giriş servisine ulaşılamadı. Bağlantıyı kontrol edip tekrar deneyin.";
  if (code === "google_failed") return "Google ile giriş tamamlanamadı. Lütfen tekrar deneyin.";
  if (code === "google_unavailable") return "Google ile giriş şu anda yapılandırılmamış.";
  if (code === "google_legal_required") {
    return "Google hesabınız için kayıt onayları tamamlanmamış. Lütfen kayıt ekranından onayları tamamlayın.";
  }
  if (code === "rate_limited") return "Çok sık giriş denemesi yapıldı. Lütfen birkaç dakika sonra tekrar deneyin.";
  if (code === "device_limit_exceeded") {
    return "Bu hesap 1 bilgisayar, 1 telefon ve 1 tablet hakkıyla kullanılabilir. Yeni cihaz eklemek için önce mevcut cihazlardan biri kaldırılmalıdır.";
  }
  if (code === "device_slot_unavailable") {
    return "Bu cihaz türü için hak dolu. Devam etmek için önce aynı türdeki eski cihazı kaldırın.";
  }
  if (code === "device_revoked") return "Bu cihaz için erişim kapatılmış görünüyor.";
  if (code === "account_temporarily_locked") return "Şüpheli kullanım nedeniyle hesap geçici olarak kilitlendi.";
  if (code === "account_suspended") return "Hesap güvenlik nedeniyle askıya alınmış görünüyor.";
  if (code === "device_id_invalid") {
    return "Bu tarayıcı cihaz bilgisini oluşturamadı. Sayfayı yenileyip tekrar deneyin.";
  }
  if (code === "device_count_failed") {
    return "Cihaz kayıtları kontrol edilemedi. Lütfen tekrar deneyin; sorun devam ederse destek talebi oluşturun.";
  }
  if (
    code === "device_lookup_failed" ||
    code === "device_create_failed" ||
    code === "session_create_failed" ||
    code === "session_failed"
  ) {
    return "Giriş güvenlik kaydı oluşturulamadı. Lütfen tekrar deneyin; sorun devam ederse bize haber verin.";
  }
  if (code === "Unauthorized") return "Oturum doğrulanamadı. Lütfen tekrar giriş yapmayı deneyin.";
  if (code.startsWith("payment_exempt_")) {
    return "Test hesabı erişimi hazırlanırken teknik bir sorun oluştu. Lütfen tekrar deneyin.";
  }
  return "Giriş sırasında bir hata oluştu.";
}

function getOrCreateDeviceId() {
  const key = "dna_device_id";
  const existing = window.localStorage.getItem(key);
  if (existing && existing.length >= 16) return existing;

  const next =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;

  window.localStorage.setItem(key, next);
  return next;
}

function detectDeviceType() {
  const ua = navigator.userAgent || "";
  if (/ipad|tablet|playbook|silk/i.test(ua)) return "tablet";
  if (/mobi|iphone|android/i.test(ua)) return "mobile";
  return "desktop";
}

export default function LoginPage() {
  const sp = useSearchParams();
  const nextPath = sanitizeNextPath(sp.get("next"));
  const appSurface = isAppSurfaceRequest(nextPath, sp);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [deviceId, setDeviceId] = useState("");
  const [deviceType, setDeviceType] = useState("desktop");
  const [err, setErr] = useState<string | null>(() => formatLoginErrorCode(sp.get("error")));
  const [notice, setNotice] = useState<string | null>(() =>
    sp.get("confirmed") === "1" ? "E-postanız doğrulandı. Şimdi giriş yapabilirsiniz." : null
  );
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  useEffect(() => {
    setDeviceId(getOrCreateDeviceId());
    setDeviceType(detectDeviceType());
  }, []);

  function onSubmit() {
    setErr(null);
    setNotice(null);
    setLoading(true);
  }

  function onGoogleSubmit() {
    setErr(null);
    setNotice(null);
    setGoogleLoading(true);
  }

  return (
    <AuthLayout mode="login" surface={appSurface ? "app" : "web"}>
      <div className="w-full max-w-md">
        <form className="mt-3 space-y-3" action="/api/auth/login" method="post" onSubmit={onSubmit}>
          <input type="hidden" name="surface" value={appSurface ? "app" : "web"} />
          <input type="hidden" name="next" value={nextPath} />
          <input type="hidden" name="deviceId" value={deviceId} />
          <input type="hidden" name="deviceType" value={deviceType} />
          {sp.get("next") ? (
            <div className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm font-medium text-blue-700">
              Devam etmek istediğiniz sayfaya geçmek için giriş yapın.
            </div>
          ) : null}

          {notice ? (
            <div className="rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
              {notice}
            </div>
          ) : null}

          <input
            name="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            type="email"
            autoComplete="email"
            placeholder="E-posta adresiniz"
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-4 text-sm font-medium text-slate-900 shadow-sm shadow-slate-200/40 placeholder:text-slate-400 focus:border-blue-400 focus:ring-4 focus:ring-blue-100 focus:outline-none"
          />
          <input
            name="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            type="password"
            autoComplete="current-password"
            placeholder="Şifreniz"
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-4 text-sm font-medium text-slate-900 shadow-sm shadow-slate-200/40 placeholder:text-slate-400 focus:border-blue-400 focus:ring-4 focus:ring-blue-100 focus:outline-none"
          />

          {err ? (
            <div className="rounded-xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-600">
              <div>{err}</div>
              <a
                href={`/support?category=login&email=${encodeURIComponent(email)}`}
                className="mt-3 inline-flex rounded-xl bg-white px-3 py-2 text-xs font-bold text-rose-700 ring-1 ring-rose-100 transition hover:bg-rose-100"
              >
                Ekran görüntüsüyle sorun bildir
              </a>
            </div>
          ) : null}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-gradient-to-r from-cyan-400 via-blue-600 to-violet-600 px-4 py-4 text-sm font-bold text-white shadow-lg shadow-blue-600/20 transition hover:-translate-y-0.5 hover:shadow-blue-600/30 disabled:translate-y-0 disabled:opacity-60"
          >
            Giriş Yap
          </button>
        </form>

        <div className="my-4 flex items-center gap-3 text-xs font-bold uppercase tracking-[0.18em] text-slate-400">
          <span className="h-px flex-1 bg-slate-200" />
          veya
          <span className="h-px flex-1 bg-slate-200" />
        </div>

        <form action="/api/auth/google/start" method="post" onSubmit={onGoogleSubmit}>
          <input type="hidden" name="mode" value="login" />
          <input type="hidden" name="surface" value={appSurface ? "app" : "web"} />
          <input type="hidden" name="next" value={nextPath} />
          <input type="hidden" name="deviceId" value={deviceId} />
          <input type="hidden" name="deviceType" value={deviceType} />
          <button
            type="submit"
            disabled={googleLoading}
            className="inline-flex w-full items-center justify-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-4 text-sm font-bold text-slate-800 shadow-sm shadow-slate-200/60 transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-blue-100/70 disabled:translate-y-0 disabled:opacity-60"
          >
            <span className="grid h-6 w-6 place-items-center rounded-full bg-white text-base shadow-sm">G</span>
            {googleLoading ? "Google’a yönlendiriliyor..." : "Google ile giriş yap"}
          </button>
        </form>

        <div className="pt-4 text-center text-sm font-medium text-slate-500">
          Hesabınız yok mu?{" "}
          <a className="font-bold text-blue-700 hover:text-violet-700" href={appSurface ? "/signup?surface=app" : "/signup"}>
            Kayıt olun.
          </a>
        </div>
      </div>
    </AuthLayout>
  );
}
