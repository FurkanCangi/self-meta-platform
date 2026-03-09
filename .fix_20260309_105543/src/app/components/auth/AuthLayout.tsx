import Link from "next/link";
import Image from "next/image";
import type { ReactNode } from "react";

export default function AuthLayout({
  mode,
  children,
}: {
  mode: "login" | "signup";
  children: ReactNode;
}) {
  const isLogin = mode === "login";

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <div className="grid flex-1 grid-cols-1 lg:grid-cols-2">
        <div className="relative hidden lg:block">
          <Image
            src="/images/sign.png"
            alt="Auth visual"
            fill
            priority
            className="object-cover"
          />
          <div className="absolute inset-0 bg-sky-900/10" />
        </div>

        <div className="relative flex items-center justify-center px-6 py-10">
          <div className="absolute right-6 top-6">
            <button
              type="button"
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 text-slate-500 hover:bg-slate-100"
              aria-label="Yardım"
            >
              ?
            </button>
          </div>

          <div className="w-full max-w-md">
            <div className="mb-6 text-center">
              <div className="mx-auto mb-5 flex items-center justify-center">
                <Image
                  src="/images/logo.png"
                  alt="Self Metacognition Institute"
                  width={190}
                  height={80}
                  priority
                  className="h-auto w-auto"
                />
              </div>

              <div className="text-slate-900">
                <div className="text-lg font-medium">Self Metacognition Institute</div>
                <div className="text-2xl font-semibold mt-1">
                  {isLogin ? "Hoş geldin." : "Kayıt ol."}
                </div>
              </div>
            </div>

            {children}

            <div className="pt-12 flex items-center justify-between text-[11px] text-slate-400">
              <div>Telif Hakkı © 2024 Self Metacognition Institute. Tüm Hakları Saklıdır.</div>
              <Link href="#" className="text-slate-500 hover:text-slate-700">
                Şartlar &amp; Koşullar
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
