"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import AuthLayout from "../components/auth/AuthLayout";
import { supabase } from "@/lib/supabase/client";

function sanitizeNextPath(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/starter";
  }
  return value;
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

export default function LoginPage() {
  const router = useRouter();
  const sp = useSearchParams();
  const nextPath = sanitizeNextPath(sp.get("next"));

  const formRef = useRef<HTMLFormElement | null>(null);
  const emailRef = useRef<HTMLInputElement | null>(null);
  const passwordRef = useRef<HTMLInputElement | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [debugStatus, setDebugStatus] = useState<string | null>(null);

  useEffect(() => {
    setDebugStatus("Mevcut oturum kontrol ediliyor...");
    supabase.auth.getSession().then(async ({ data }: { data: any }) => {
      if (data.session?.user?.id) {
        setDebugStatus("Mevcut oturum bulundu. Hesap planı kontrol ediliyor...");
        const { data: profile } = await supabase
          .from("profiles")
          .select("plan")
          .eq("user_id", data.session.user.id)
          .maybeSingle();
        const plan = profile?.plan ?? "none";
        setDebugStatus("Yönlendiriliyor...");
        router.replace(plan === "none" ? "/pricing#paketler" : nextPath);
        return;
      }
      setDebugStatus(null);
    });
  }, [router, nextPath]);

  async function performLogin(submittedEmail: string, submittedPassword: string) {
    setErr(null);
    setLoading(true);
    setDebugStatus("Giriş isteği hazırlanıyor...");
    try {
      if (!submittedEmail || !submittedPassword) {
        setErr("E-posta ve şifre alanlarını doldurun.");
        return;
      }

      setDebugStatus("Supabase oturum isteği gönderildi...");
      const { data, error } = await supabase.auth.signInWithPassword({
        email: submittedEmail,
        password: submittedPassword,
      });

      if (error) {
        setErr(formatLoginError(error.message));
        setDebugStatus("Giriş reddedildi.");
        return;
      }

      const uid = data.user?.id;
      if (!uid) {
        setErr("Giriş yapılamadı.");
        setDebugStatus("Kullanıcı bilgisi alınamadı.");
        return;
      }

      setDebugStatus("Oturum açıldı. Hesap planı kontrol ediliyor...");
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("plan")
        .eq("user_id", uid)
        .maybeSingle();

      if (profileError) {
        setErr("Hesap bilgileri alınamadı. Lütfen tekrar deneyin.");
        setDebugStatus("Profil bilgisi alınamadı.");
        return;
      }

      const plan = profile?.plan ?? "none";
      setDebugStatus(plan === "none" ? "Plan bulunamadı. Fiyatlandırma sayfasına yönlendiriliyor..." : "Terapist paneline yönlendiriliyor...");
      router.replace(plan === "none" ? "/pricing#paketler" : nextPath);
    } catch (error: any) {
      console.error("[login] signIn failed", error);
      setErr("Giriş isteği tamamlanamadı. İnternet bağlantınızı kontrol edip tekrar deneyin.");
      setDebugStatus("Giriş isteği hata ile sonlandı.");
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
            <div className="rounded-lg border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-700">
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
            placeholder="E-Posta"
            className="w-full rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 placeholder:text-slate-500 focus:border-sky-400 focus:ring-4 focus:ring-sky-100 focus:outline-none"
          />
          <input
            ref={passwordRef}
            name="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            type="password"
            autoComplete="current-password"
            placeholder="Şifre"
            className="w-full rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 placeholder:text-slate-500 focus:border-sky-400 focus:ring-4 focus:ring-sky-100 focus:outline-none"
          />

          {err ? <div className="text-sm text-rose-600">{err}</div> : null}

          {debugStatus ? (
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
              Durum: {debugStatus}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-sky-600 px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-sky-700 disabled:opacity-60"
          >
            {loading ? "Giriş Yapılıyor..." : "Giriş Yap"}
          </button>

          <div className="text-center text-xs text-slate-500">
            Hesabınız yok mu?{" "}
            <a className="text-sky-600 hover:text-sky-700" href="/signup">
              Kayıt olun.
            </a>
          </div>
        </form>
      </div>
    </AuthLayout>
  );
}
