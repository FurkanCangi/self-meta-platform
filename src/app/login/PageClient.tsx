"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import AuthLayout from "../components/auth/AuthLayout";
import { supabase } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const sp = useSearchParams();
  const nextPath = sp.get("next") || "/starter";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }: { data: any }) => {
      if (data.session?.user?.id) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("plan")
          .eq("user_id", data.session.user.id)
          .maybeSingle();
        const plan = profile?.plan ?? "none";
        router.replace(plan === "none" ? "/pricing#paketler" : nextPath);
      }
    });
  }, [router, nextPath]);

  async function onSubmit() {
    setErr(null);
    setLoading(true);
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) {
      setLoading(false);
      setErr(error.message);
      return;
    }

    const uid = data.user?.id;
    if (!uid) {
      setLoading(false);
      setErr("Giriş yapılamadı.");
      return;
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("plan")
      .eq("user_id", uid)
      .maybeSingle();

    const plan = profile?.plan ?? "none";
    setLoading(false);

    router.replace(plan === "none" ? "/pricing#paketler" : nextPath);
  }

  return (
    <AuthLayout mode="login">
      <div className="w-full max-w-md">
        <div className="mt-3 space-y-3">
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            type="email"
            placeholder="E-Posta"
            className="w-full rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 placeholder:text-slate-500 focus:border-sky-400 focus:ring-4 focus:ring-sky-100 focus:outline-none"
          />
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            type="password"
            placeholder="Şifre"
            className="w-full rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 placeholder:text-slate-500 focus:border-sky-400 focus:ring-4 focus:ring-sky-100 focus:outline-none"
          />

          {err ? <div className="text-sm text-rose-600">{err}</div> : null}

          <button
            type="button"
            disabled={loading}
            onClick={onSubmit}
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
        </div>
      </div>
    </AuthLayout>
  );
}
