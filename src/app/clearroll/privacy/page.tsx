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
  Sparkles,
  Lock,
  Users,
} from "lucide-react";

const supportEmail = "self.metacognition.institute@gmail.com";
const supportUrl = "https://self-meta-platform.vercel.app/#iletisim";
const privacyUrl = "https://self-meta-platform.vercel.app/clearroll/privacy/";

export const metadata: Metadata = {
  metadataBase: new URL("https://self-meta-platform.vercel.app"),
  title: "ClearRoll Privacy Policy",
  description: "ClearRoll privacy policy for local-first gallery cleanup.",
  alternates: {
    canonical: "/clearroll/privacy/",
  },
};

const sections = [
  {
    title: "What ClearRoll does",
    icon: Sparkles,
    content: [
      "ClearRoll helps users review and clean media inside their gallery.",
      "The product focuses on exact duplicates, screenshots, similar photos, large videos, blur candidates, and month-based cleanup sessions.",
      "Cleanup is review-first: the user confirms every delete decision before anything is removed.",
    ],
  },
  {
    title: "What stays on-device",
    icon: HardDrive,
    content: [
      "Gallery indexing and cleanup candidate preparation.",
      "Review queue state, cleanup history, and savings summaries.",
      "App settings, reminder preferences, protection rules, and scan cache data.",
    ],
  },
  {
    title: "What may be processed off-device",
    icon: Users,
    content: [
      "In-app purchase and restore events handled by Apple or Google billing.",
      "Rewarded ad delivery when rewarded unlock is enabled and requested.",
      "Crash and diagnostics reporting when those features are enabled in production.",
      "Aggregate analytics events when analytics is enabled in production.",
    ],
  },
  {
    title: "What ClearRoll does not require",
    icon: Lock,
    content: [
      "No account is required for the core cleanup flow.",
      "No gallery upload to a ClearRoll cloud backend is needed to prepare cleanup suggestions.",
      "No social posting, chat, or public sharing features are part of the core product.",
    ],
  },
  {
    title: "Your control",
    icon: BadgeCheck,
    content: [
      "Photo access can be denied, limited, or revoked in system settings.",
      "Cleanup suggestions are reviewed before delete.",
      "Recent, favorite, and edited media can be protected automatically.",
      "Local app data can be reset in app or removed by uninstalling the app.",
    ],
  },
  {
    title: "Retention and sharing",
    icon: ShieldCheck,
    content: [
      "ClearRoll does not sell gallery media.",
      "Local app state remains on-device until it is cleared, reset, or removed with the app.",
      "Where purchases, ads, analytics, or crash reporting are enabled, limited technical data may be processed under the policies of the corresponding platform providers.",
    ],
  },
];

export default function PrivacyPolicyPage() {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(37,99,235,0.12),_transparent_36%),radial-gradient(circle_at_85%_10%,_rgba(14,165,233,0.12),_transparent_28%),linear-gradient(180deg,#f8fafc_0%,#eef2ff_100%)] text-slate-900">
      <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-4 py-6 sm:px-6 lg:px-8 lg:py-10">
        <div className="mb-6 flex items-center justify-between gap-4">
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-full border border-slate-200/80 bg-white/80 px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm backdrop-blur transition hover:border-slate-300 hover:text-slate-950"
          >
            <ArrowLeft size={16} />
            Back to site
          </Link>
          <div className="hidden rounded-full border border-slate-200/80 bg-white/70 px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-slate-500 shadow-sm backdrop-blur sm:block">
            ClearRoll Privacy
          </div>
        </div>

        <section className="overflow-hidden rounded-[32px] border border-white/70 bg-white/85 p-6 shadow-[0_30px_80px_rgba(15,23,42,0.10)] backdrop-blur sm:p-8 lg:p-10">
          <div className="grid gap-10 lg:grid-cols-[1.2fr_0.8fr] lg:items-start">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-sky-100 bg-sky-50 px-4 py-2 text-sm font-semibold text-sky-700">
                <ShieldCheck size={16} />
                Local-first gallery cleanup
              </div>
              <h1 className="mt-6 max-w-3xl text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl lg:text-6xl">
                ClearRoll Privacy Policy
              </h1>
              <p className="mt-5 max-w-2xl text-base leading-7 text-slate-600 sm:text-lg">
                ClearRoll is designed around on-device media review. Your photo and video files are
                not uploaded to a ClearRoll cloud service to prepare cleanup suggestions. This page
                explains what stays local, what may be processed by platform SDKs, and how users
                stay in control.
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
                <div className="mt-2 text-lg font-semibold text-slate-950">2026-04-23</div>
              </div>
              <div className="rounded-2xl bg-white p-4 shadow-sm">
                <div className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                  Privacy URL
                </div>
                <a href={privacyUrl} className="mt-2 block break-all text-sm font-medium text-slate-700 underline decoration-slate-300 underline-offset-4 hover:text-slate-950">
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

        <section className="mt-6 overflow-hidden rounded-[32px] border border-slate-950/5 bg-slate-950 px-6 py-7 text-white shadow-[0_24px_60px_rgba(15,23,42,0.20)] sm:px-8">
          <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-300">
                Contact
              </div>
              <h2 className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">
                For privacy questions, reach us directly.
              </h2>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300 sm:text-base">
                If you are publishing ClearRoll in the stores, make sure the developer identity shown
                in the listing also appears in the publicly hosted privacy policy.
              </p>
            </div>
            <div className="rounded-[24px] border border-white/10 bg-white/5 p-5 backdrop-blur">
              <div className="space-y-3 text-sm text-slate-200">
                <div className="flex items-center gap-2">
                  <Mail size={16} className="text-sky-300" />
                  <a href={`mailto:${supportEmail}`} className="font-medium text-white">
                    {supportEmail}
                  </a>
                </div>
                <div className="flex items-center gap-2">
                  <ExternalLink size={16} className="text-sky-300" />
                  <a href={supportUrl} className="font-medium text-white">
                    {supportUrl}
                  </a>
                </div>
                <div className="flex items-center gap-2">
                  <PhoneCall size={16} className="text-sky-300" />
                  <a href="tel:+905306766654" className="font-medium text-white">
                    +90 530 676 6654
                  </a>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
