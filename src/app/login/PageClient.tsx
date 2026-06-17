"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import AuthLayout from "../components/auth/AuthLayout";
import { supabase } from "@/lib/supabase/client";

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

function formatLoginError(message?: string | null) {
  const raw = String(message || "").trim();
  const normalized = raw.toLowerCase();

  if (normalized.includes("email not confirmed")) {
    return "E-posta adresiniz henüz doğrulanmamış. Gelen kutunuzu ve spam klasörünü kontrol edin.";
  }

  if (normalized.includes("invalid login credentials")) {
    return "E-posta veya şifre hatalı.";
  }

  if (normalized.includes("signup disabled")) {
    return "Giriş geçici olarak kullanılamıyor. Lütfen daha sonra tekrar deneyin.";
  }

  return raw || "Giriş sırasında bir hata oluştu.";
}

function resolvePostLoginPath(plan: string, nextPath: string, appSurface: boolean) {
  if (plan === "none") return appSurface ? "/report-packages?surface=app" : "/fiyatlandirma";
  if (appSurface && !nextPath.includes("surface=app")) {
    const glue = nextPath.includes("?") ? "&" : "?";
    return `${nextPath}${glue}surface=app`;
  }
  return nextPath;
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

async function registerAppSession() {
  const response = await fetch("/api/security/session/register", {
    method: "POST",
    headers: { "content-type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify({
      deviceId: getOrCreateDeviceId(),
      deviceType: detectDeviceType(),
    }),
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok || !payload?.ok) {
    const code = String(payload?.error || "");
    if (code === "device_limit_exceeded") {
      throw new Error("Bu hesap için en fazla 2 cihaz kullanılabilir. Yeni cihaz eklemek için önce mevcut cihazlardan biri kaldırılmalıdır.");
    }
    if (code === "device_slot_unavailable") {
      throw new Error(payload?.message || "Bu cihaz türü için hesap limiti dolu.");
    }
    if (code === "device_revoked") {
      throw new Error("Bu cihaz için erişim kapatılmış görünüyor. Lütfen farklı bir cihazla giriş yapın veya destek isteyin.");
    }
    if (code === "account_temporarily_locked") {
      throw new Error(payload?.message || "Şüpheli kullanım nedeniyle hesap geçici olarak kilitlendi. Lütfen daha sonra tekrar deneyin.");
    }
    if (code === "account_suspended") {
      throw new Error("Hesap güvenlik nedeniyle askıya alınmış görünüyor. Lütfen destek ile iletişime geçin.");
    }
    throw new Error("Oturum güvenlik kaydı oluşturulamadı. Lütfen tekrar deneyin.");
  }
}

export default function LoginPage() {
  const router = useRouter();
  const sp = useSearchParams();
  const nextPath = sanitizeNextPath(sp.get("next"));
  const appSurface = isAppSurfaceRequest(nextPath, sp);

  const formRef = useRef<HTMLFormElement | null>(null);
  const emailRef = useRef<HTMLInputElement | null>(null);
  const passwordRef = useRef<HTMLInputElement | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }: { data: any }) => {
      if (data.session?.user?.id) {
        try {
          await registerAppSession();
        } catch (error) {
          await supabase.auth.signOut();
          setErr(error instanceof Error ? error.message : "Oturum güvenlik kaydı oluşturulamadı.");
          return;
        }

        const { data: profile } = await supabase
          .from("profiles")
          .select("plan")
          .eq("user_id", data.session.user.id)
          .maybeSingle();
        const plan = profile?.plan ?? "none";
        router.replace(resolvePostLoginPath(plan, nextPath, appSurface));
        return;
      }
    });
  }, [router, nextPath, appSurface]);

  async function performLogin(submittedEmail: string, submittedPassword: string) {
    setErr(null);
    setLoading(true);
    try {
      if (!submittedEmail || !submittedPassword) {
        setErr("E-posta ve şifre alanlarını doldurun.");
        return;
      }

      const { data, error } = await supabase.auth.signInWithPassword({
        email: submittedEmail,
        password: submittedPassword,
      });

      if (error) {
        setErr(formatLoginError(error.message));
        return;
      }

      const uid = data.user?.id;
      if (!uid) {
        setErr("Giriş yapılamadı.");
        return;
      }

      try {
        await registerAppSession();
      } catch (error) {
        await supabase.auth.signOut();
        setErr(error instanceof Error ? error.message : "Oturum güvenlik kaydı oluşturulamadı.");
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("plan")
        .eq("user_id", uid)
        .maybeSingle();

      if (profileError) {
        setErr("Hesap bilgileri alınamadı. Lütfen tekrar deneyin.");
        return;
      }

      const plan = profile?.plan ?? "none";
      router.replace(resolvePostLoginPath(plan, nextPath, appSurface));
    } catch (error: any) {
      console.error("[login] signIn failed", error);
      setErr("Giriş isteği tamamlanamadı. İnternet bağlantınızı kontrol edip tekrar deneyin.");
    } finally {
      setLoading(false);
    }
  }

  async function onSubmit(e?: React.FormEvent<HTMLFormElement>) {
    e?.preventDefault();
    const formData = e?.currentTarget ? new FormData(e.currentTarget) : null;
    const submittedEmail = String(
      emailRef.current?.value || formData?.get("email") || email
    ).trim();
    const submittedPassword = String(
      passwordRef.current?.value || formData?.get("password") || password
    );

    await performLogin(submittedEmail, submittedPassword);
  }

  return (
    <AuthLayout mode="login">
      <div className="w-full max-w-md">
        <form ref={formRef} className="mt-3 space-y-3" onSubmit={onSubmit}>
          {sp.get("next") ? (
            <div className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm font-medium text-blue-700">
              Devam etmek istediğiniz sayfaya geçmek için giriş yapın.
            </div>
          ) : null}

          <input
            ref={emailRef}
            name="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            type="email"
            autoComplete="email"
            placeholder="E-posta adresiniz"
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-4 text-sm font-medium text-slate-900 shadow-sm shadow-slate-200/40 placeholder:text-slate-400 focus:border-blue-400 focus:ring-4 focus:ring-blue-100 focus:outline-none"
          />
          <input
            ref={passwordRef}
            name="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            type="password"
            autoComplete="current-password"
            placeholder="Şifreniz"
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-4 text-sm font-medium text-slate-900 shadow-sm shadow-slate-200/40 placeholder:text-slate-400 focus:border-blue-400 focus:ring-4 focus:ring-blue-100 focus:outline-none"
          />

          {err ? <div className="rounded-xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-600">{err}</div> : null}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-gradient-to-r from-cyan-400 via-blue-600 to-violet-600 px-4 py-4 text-sm font-bold text-white shadow-lg shadow-blue-600/20 transition hover:-translate-y-0.5 hover:shadow-blue-600/30 disabled:translate-y-0 disabled:opacity-60"
          >
            Giriş Yap
          </button>

          <div className="pt-2 text-center text-sm font-medium text-slate-500">
            Hesabınız yok mu?{" "}
            <a className="font-bold text-blue-700 hover:text-violet-700" href={appSurface ? "/signup?surface=app" : "/signup"}>
              Kayıt olun.
            </a>
          </div>
        </form>
      </div>
    </AuthLayout>
  );
}
