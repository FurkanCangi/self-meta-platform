import { Suspense } from "react";
import AssessmentWizardClient from "@/components/assessment/AssessmentWizardClient";

function AssessmentNewPageFallback() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm text-slate-500">Yükleniyor...</p>
      </div>
    </div>
  );
}

export default function AssessmentsNewPage() {
  return (
    <Suspense fallback={<AssessmentNewPageFallback />}>
      <AssessmentWizardClient />
    </Suspense>
  );
}
