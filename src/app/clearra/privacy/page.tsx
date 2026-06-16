import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowLeft,
  BadgeCheck,
  ExternalLink,
  HardDrive,
  Mail,
  PhoneCall,
  ShieldCheck,
  Lock,
  Users,
} from "lucide-react";

const supportEmail = "self.metacognition.institute@gmail.com";
const supportUrl = "https://self-meta-platform.vercel.app/#iletisim";
const privacyUrl = "https://self-meta-platform.vercel.app/clearra/privacy/";

export const metadata: Metadata = {
  metadataBase: new URL("https://self-meta-platform.vercel.app"),
  title: "Clearra Privacy Policy",
  description: "Clearra privacy policy for local-first gallery cleanup.",
  alternates: {
    canonical: "/clearra/privacy/",
  },
};

const sections = [
  {
    title: "What Clearra does",
    icon: BadgeCheck,
    content: [
      "Clearra helps users review duplicates, screenshots, similar photos, large videos, blur candidates, and month-based cleanup sessions.",
      "Cleanup is review-first: the user confirms delete decisions before media is removed.",
    ],
  },
  {
    title: "What stays on-device",
    icon: HardDrive,
    content: [
      "Gallery indexing and cleanup candidate preparation.",
      "Review state, cleanup history, app settings, protection rules, and scan cache data.",
      "Photo and video files are not uploaded to a Clearra cloud service for cleanup suggestions.",
    ],
  },
  {
    title: "What may be processed off-device",
    icon: Users,
    content: [
      "In-app purchase and restore events may be handled by Apple or Google billing when premium features are used.",
      "Advertising, analytics, and crash SDKs are not part of the current private release path.",
    ],
  },
  {
    title: "What Clearra does not require",
    icon: Lock,
    content: [
      "No account, email, or password is required for the core cleanup flow.",
      "No social posting, chat, or public sharing features are part of the core product.",
    ],
  },
  {
    title: "User control",
    icon: ShieldCheck,
    content: [
      "Photo access can be denied, limited, or revoked in system settings.",
      "Recent, favorite, and edited media can be protected automatically.",
      "Local app data can be reset inside the app or removed by uninstalling.",
    ],
  },
];

export default function ClearraPrivacyPolicyPage() {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(45,212,191,0.16),_transparent_36%),radial-gradient(circle_at_85%_10%,_rgba(132,204,22,0.12),_transparent_28%),linear-gradient(180deg,#f8fafc_0%,#eef7f4_100%)] text-slate-900">
      <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-4 py-6 sm:px-6 lg:px-8 lg:py-10">
        <div className="mb-6 flex items-center justify-between gap-4">
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-full border border-slate-200/80 bg-white/80 px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm backdrop-blur transition hover:border-slate-300 hover:text-slate-950"
          >
            <ArrowLeft size={16} />
            Back to site
          </Link>
          <div className="hidden rounded-full border border-emerald-200/80 bg-white/70 px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-emerald-700 shadow-sm backdrop-blur sm:block">
            Clearra Privacy
          </div>
        </div>

        <section className="overflow-hidden rounded-[32px] border border-white/70 bg-white/85 p-6 shadow-[0_30px_80px_rgba(15,23,42,0.10)] backdrop-blur sm:p-8 lg:p-10">
          <div className="grid gap-10 lg:grid-cols-[1.2fr_0.8fr] lg:items-start">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-100 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700">
                <ShieldCheck size={16} />
                Local-first gallery cleanup
              </div>
              <h1 className="mt-6 max-w-3xl text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl lg:text-6xl">
                Clearra Privacy Policy
              </h1>
              <p className="mt-5 max-w-2xl text-base leading-7 text-slate-600 sm:text-lg">
                Clearra is designed around on-device media review. Your photo and video files are
                not uploaded to a Clearra cloud service to prepare cleanup suggestions.
              </p>

              <div className="mt-8 flex flex-wrap gap-3">
                <a
                  href={`mailto:${supportEmail}`}
                  className="inline-flex items-center gap-2 rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-slate-950/15 transition hover:-translate-y-0.5 hover:bg-slate-800"
                >
                  <Mail size={16} />
                  Contact support
                </a>
                <a
                  href={supportUrl}
                  className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300 hover:text-slate-950"
                >
                  <ExternalLink size={16} />
                  Support page
                </a>
              </div>
            </div>

            <aside className="grid gap-4 rounded-[28px] border border-slate-200/80 bg-slate-50/80 p-5 shadow-sm">
              <div className="rounded-2xl bg-white p-4 shadow-sm">
                <div className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                  Last updated
                </div>
                <div className="mt-2 text-lg font-semibold text-slate-950">2026-04-27</div>
              </div>
              <div className="rounded-2xl bg-white p-4 shadow-sm">
                <div className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                  Privacy URL
                </div>
                <a
                  href={privacyUrl}
                  className="mt-2 block break-all text-sm font-medium text-slate-700 underline decoration-slate-300 underline-offset-4 hover:text-slate-950"
                >
                  {privacyUrl}
                </a>
              </div>
              <div className="rounded-2xl bg-white p-4 shadow-sm">
                <div className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                  Support contact
                </div>
                <div className="mt-3 space-y-2 text-sm text-slate-700">
                  <div className="flex items-center gap-2">
                    <Mail size={15} className="text-slate-500" />
                    <a href={`mailto:${supportEmail}`} className="hover:text-slate-950">
                      {supportEmail}
                    </a>
                  </div>
                  <div className="flex items-center gap-2">
                    <PhoneCall size={15} className="text-slate-500" />
                    <a href="tel:+905306766654" className="hover:text-slate-950">
                      +90 530 676 6654
                    </a>
                  </div>
                </div>
              </div>
            </aside>
          </div>
        </section>

        <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {sections.map(({ title, icon: Icon, content }) => (
            <article
              key={title}
              className="rounded-[28px] border border-slate-200/80 bg-white/85 p-5 shadow-[0_14px_30px_rgba(15,23,42,0.05)] backdrop-blur"
            >
              <div className="flex items-start gap-3">
                <div className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-slate-950 text-white shadow-lg shadow-slate-950/10">
                  <Icon size={18} />
                </div>
                <div>
                  <h2 className="text-lg font-semibold tracking-tight text-slate-950">{title}</h2>
                  <div className="mt-3 space-y-3 text-sm leading-6 text-slate-600">
                    {content.map((line) => (
                      <p key={line}>{line}</p>
                    ))}
                  </div>
                </div>
              </div>
            </article>
          ))}
        </section>
      </div>
    </main>
  );
}
