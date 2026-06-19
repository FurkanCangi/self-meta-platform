import { Suspense } from "react";
import { redirect } from "next/navigation";
import { verifyCurrentAppSession } from "@/lib/security/appSession";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import PageClient from "./PageClient";

export const dynamic = "force-dynamic";

function sanitizeNextPath(value?: string | string[] | null) {
  const raw = Array.isArray(value) ? value[0] : value;
  if (!raw || !raw.startsWith("/") || raw.startsWith("//") || raw.startsWith("/legal/accept")) {
    return "/starter";
  }
  return raw;
}

function resolvePostLoginPath(plan: string, nextPath: string, appSurface: boolean) {
  if (plan === "none") return appSurface ? "/report-packages?surface=app" : "/fiyatlandirma";
  if (appSurface && !nextPath.includes("surface=app")) {
    const glue = nextPath.includes("?") ? "&" : "?";
    return `${nextPath}${glue}surface=app`;
  }
  return nextPath;
}

export default async function Page({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = searchParams ? await searchParams : {};
  const nextPath = sanitizeNextPath(params.next);
  const appSurface =
    params.surface === "app" ||
    nextPath.includes("surface=app");

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

        redirect(resolvePostLoginPath(profile?.plan ?? "none", nextPath, appSurface));
      }
    }
  }

  return (
    <Suspense fallback={<div className="p-6">Yükleniyor...</div>}>
      <PageClient />
    </Suspense>
  );
}
