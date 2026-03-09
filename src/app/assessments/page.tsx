import { Suspense } from "react";
import AssessmentsClient from "./AssessmentsClient";

export const dynamic = "force-dynamic";

export default function AssessmentsPage() {
  return (
    <Suspense fallback={<div className="p-6">Yükleniyor...</div>}>
      <AssessmentsClient />
    </Suspense>
  );
}
