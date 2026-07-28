"use client";

import { useTherapistIdentity } from "@/app/components/therapist-identity";

type TherapistWelcomeProps = {
  surface: "app" | "web";
};

function Greeting({ name }: { name: string }) {
  return (
    <>
      Merhaba{name ? ", " : ""}
      {name ? (
        <span className="bg-gradient-to-r from-cyan-600 via-blue-600 to-violet-600 bg-clip-text text-transparent">
          {name}
        </span>
      ) : null}
    </>
  );
}

export default function TherapistWelcome({ surface }: TherapistWelcomeProps) {
  const { greetingName } = useTherapistIdentity();

  if (surface === "app") {
    return (
      <div aria-live="polite">
        <div className="dna-app-section-title">Bugünkü çalışma alanın</div>
        <h1 className="mt-2 text-[28px] font-black leading-tight tracking-[-0.025em] text-[#071b3a] dark:text-slate-100">
          <Greeting name={greetingName} />
        </h1>
        <p className="mt-2 text-sm font-medium leading-6 text-slate-600 dark:text-slate-300">
          Bugün nereden devam etmek istersin?
        </p>
      </div>
    );
  }

  return (
    <div aria-live="polite">
      <h1 className="mt-4 text-4xl font-black tracking-[-0.035em] text-[#071b3a] dark:text-slate-100 md:text-5xl">
        <Greeting name={greetingName} />
      </h1>
      <p className="mt-4 max-w-3xl text-[15px] leading-7 text-slate-600 dark:text-slate-300 md:text-base">
        Bugün nereden devam etmek istersin? Danışanlarını, değerlendirmelerini ve raporlarını aynı akışta
        yönetebilirsin.
      </p>
    </div>
  );
}
