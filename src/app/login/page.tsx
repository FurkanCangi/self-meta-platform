import { Suspense } from "react";
import PageClient from "./PageClient";

export const dynamic = "force-dynamic";

export default function Page() {
  return (
    <Suspense fallback={<div className="p-6">Yükleniyor...</div>}>
      <PageClient />
    </Suspense>
  );
}
