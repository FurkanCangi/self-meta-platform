"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import AuthLayout from "../components/auth/AuthLayout";
import { supabase } from "@/lib/supabase/client";

export default function SignupPage() {
  const router = useRouter();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [ok, setOk] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit() {
    setErr(null);
    if (!email || !password) {
      setErr("E-posta ve şifre zorunlu.");
      return;
    }
    if (password !== password2) {
      setErr("Şifreler eşleşmiyor.");
      return;
    }

    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { name, phone },
      },
    });

    if (error) {
      setLoading(false);
      setErr(error.message);
      return;
    }

    setLoading(false);
    setOk(true);

    const uid = data.user?.id;
    if (uid) {
      await supabase.from("profiles").upsert({ user_id: uid, role: "expert", plan: "none" });
    }

    router.replace("/pricing#paketler");
  }

  return (
    <AuthLayout mode="signup">
      <div className="w-full max-w-md">
        <div className="mt-3 space-y-3">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            type="text"
            placeholder="Ad Soyad"
            className="w-full rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 placeholder:text-slate-500 focus:border-sky-400 focus:ring-4 focus:ring-sky-100 focus:outline-none"
          />
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            type="email"
            placeholder="E-Posta"
            className="w-full rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 placeholder:text-slate-500 focus:border-sky-400 focus:ring-4 focus:ring-sky-100 focus:outline-none"
          />
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            type="tel"
            placeholder="Telefon Numarası"
            className="w-full rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 placeholder:text-slate-500 focus:border-sky-400 focus:ring-4 focus:ring-sky-100 focus:outline-none"
          />
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            type="password"
            placeholder="Şifre"
            className="w-full rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 placeholder:text-slate-500 focus:border-sky-400 focus:ring-4 focus:ring-sky-100 focus:outline-none"
          />
          <input
            value={password2}
            onChange={(e) => setPassword2(e.target.value)}
            type="password"
            placeholder="Şifre Tekrar"
            className="w-full rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 placeholder:text-slate-500 focus:border-sky-400 focus:ring-4 focus:ring-sky-100 focus:outline-none"
          />

          {err ? <div className="text-sm text-rose-600">{err}</div> : null}
          {ok ? <div className="text-sm text-emerald-700">Kayıt alındı.</div> : null}

          <button
            type="button"
            disabled={loading}
            onClick={onSubmit}
            className="w-full rounded-lg bg-sky-600 px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-sky-700 disabled:opacity-60"
          >
            {loading ? "Kayıt Yapılıyor..." : "Kayıt Ol"}
          </button>

          <div className="text-center text-xs text-slate-500">
            Halihazırda kayıtlı mısınız?{" "}
            <a className="text-sky-600 hover:text-sky-700" href="/login">
              Giriş yapın.
            </a>
          </div>
        </div>
      </div>
    </AuthLayout>
  );
}
