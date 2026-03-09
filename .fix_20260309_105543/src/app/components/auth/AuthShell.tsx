import Link from "next/link";
import { HelpCircle } from "lucide-react";

type Props = {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  rightTop?: React.ReactNode;
};

export default function AuthShell({ title, subtitle, children, rightTop }: Props) {
  return (
    <div className="min-h-screen w-full bg-white">
      <div className="grid min-h-screen grid-cols-1 lg:grid-cols-2">
        <div className="relative hidden lg:block">
          <div className="absolute inset-0 bg-slate-100" />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="h-[78%] w-[78%] rounded-2xl border border-slate-200 bg-white/40" />
          </div>
        </div>

        <div className="relative flex items-center justify-center px-6 py-10">
          <div className="absolute right-6 top-6">
            <button
              type="button"
              className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200"
              aria-label="Yardım"
            >
              <HelpCircle className="h-5 w-5" />
            </button>
          </div>

          <div className="w-full max-w-md">
            <div className="mb-6 text-center">
              <div className="mx-auto mb-4 text-5xl font-semibold tracking-tight text-slate-800">
                self<span className="align-super text-xs text-teal-600">+</span>
              </div>
              <div className="text-base font-semibold text-slate-800">{title}</div>
              {subtitle ? <div className="mt-1 text-sm text-slate-500">{subtitle}</div> : null}
              {rightTop ? <div className="mt-3 text-sm">{rightTop}</div> : null}
            </div>

            {children}

            <div className="mt-10 flex items-center justify-between text-xs text-slate-400">
              <div>Telif Hakkı © 2024 Self Metacognition Institute. Tüm Hakları Saklıdır.</div>
              <Link href="#" className="text-slate-500 hover:text-slate-700">Şartlar &amp; Koşullar</Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
