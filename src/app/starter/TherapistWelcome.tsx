"use client";

import { useTherapistIdentity } from "@/app/components/therapist-identity";

type TherapistWelcomeProps = {
  surface: "app" | "web";
};

function Greeting({ name }: { name: string }) {
  return (
    <span className="inline-flex flex-wrap items-baseline gap-x-[0.22em] gap-y-1">
      <span className="text-[var(--sm-text)]">
        Merhaba{name ? "," : ""}
      </span>
      {name ? (
        <span className="sm-welcome-name">
          {name}
        </span>
      ) : null}
    </span>
  );
}

export default function TherapistWelcome({ surface }: TherapistWelcomeProps) {
  const { greetingName } = useTherapistIdentity();

  if (surface === "app") {
    return (
      <div aria-live="polite">
        <div className="dna-app-section-title">Bugünkü çalışma alanın</div>
        <h1 className="mt-2 text-[28px] font-black leading-tight tracking-[-0.025em] text-[var(--sm-text)]">
          <Greeting name={greetingName} />
        </h1>
        <p className="mt-2 text-sm font-medium leading-6 text-[var(--sm-text-soft)]">
          Bugün nereden devam etmek istersin?
        </p>
      </div>
    );
  }

  return (
    <div aria-live="polite">
      <h1 className="mt-4 text-4xl font-black leading-[1.05] tracking-[-0.035em] text-[var(--sm-text)] md:text-5xl">
        <Greeting name={greetingName} />
      </h1>
      <p className="mt-4 max-w-3xl text-[15px] leading-7 text-[var(--sm-text-soft)] md:text-base">
        Bugün nereden devam etmek istersin? Danışanlarını, değerlendirmelerini ve raporlarını aynı akışta
        yönetebilirsin.
      </p>
    </div>
  );
}
