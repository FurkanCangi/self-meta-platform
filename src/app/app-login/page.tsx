import { Suspense } from "react";
import { redirect } from "next/navigation";
import { verifyCurrentAppSession } from "@/lib/security/appSession";
import { ensurePaymentExemptAccess, resolveEffectivePlan } from "@/lib/security/paymentExemptions";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import PageClient from "../login/PageClient";

export const dynamic = "force-dynamic";

function sanitizeNextPath(value?: string | string[] | null) {
  const raw = Array.isArray(value) ? value[0] : value;
  if (!raw || !raw.startsWith("/") || raw.startsWith("//") || raw.startsWith("/legal/accept")) {
    return "/starter";
  }
  return raw;
}

function withAppSurface(path: string) {
  if (path.includes("surface=app")) return path;
  const glue = path.includes("?") ? "&" : "?";
  return `${path}${glue}surface=app`;
}

function resolvePostLoginPath(plan: string, nextPath: string) {
  if (plan === "none") return "/report-packages?surface=app";
  return withAppSurface(nextPath);
}

export default async function AppLoginPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = searchParams ? await searchParams : {};
  const nextPath = sanitizeNextPath(params.next);

  if (!params.error && !params.confirmed) {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user?.id && user.email_confirmed_at) {
      const appSession = await verifyCurrentAppSession(user.id);
      if (appSession.ok) {
        const admin = createSupabaseAdminClient();
        const { data: profile } = await admin
          .from("profiles")
          .select("plan")
          .eq("user_id", user.id)
          .maybeSingle();

        await ensurePaymentExemptAccess({ admin, userId: user.id, email: user.email });

        redirect(resolvePostLoginPath(resolveEffectivePlan(profile?.plan, user.email), nextPath));
      }
    }
  }

  return (
    <Suspense fallback={<div className="p-6">Yükleniyor...</div>}>
      <PageClient forcedSurface="app" />
    </Suspense>
  );
}
