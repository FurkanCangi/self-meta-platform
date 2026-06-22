import { NextResponse } from "next/server";
import { checkRateLimit, rateLimitResponse } from "@/lib/security/rateLimit";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type ClientRow = {
  id: string;
  owner_id: string | null;
  child_code: string | null;
  anamnez: string | null;
  created_at: string | null;
  deleted_at: string | null;
};

type AssessmentRow = {
  id: string;
  client_id: string | null;
  created_at: string | null;
  deleted_at: string | null;
};

type ReportRow = {
  id: string;
  version: number | null;
  report_text: string | null;
  created_at: string | null;
  snapshot_json: any;
  assessment_id: string | null;
};

function isAdminRole(role?: string | null) {
  return ["admin", "owner", "super_admin", "yonetici", "yönetici"].includes(String(role || "").toLowerCase());
}

function formatDate(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("tr-TR");
}

function calcRisk(anamnez: string): "Yüksek" | "Orta" | "Düşük" | "İzlem" | "—" {
  const n = (anamnez || "").trim().length;
  if (n >= 900) return "Orta";
  if (n >= 300) return "İzlem";
  return "—";
}

function normalizeReportText(value?: string | null) {
  return String(
    value ||
      "Alanlar arası teknik örüntü, mevcut skor dağılımı ve anamnez temaları birlikte değerlendirilerek oluşturulmuştur."
  )
    .replace(/\s+/g, " ")
    .trim();
}

function compactText(value?: string | null, maxLength = 140) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  if (!text) return "—";
  return text.length > maxLength ? text.slice(0, maxLength) + "..." : text;
}

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user?.id) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const rateLimit = await checkRateLimit({
    key: `clinical-workspace:${user.id}`,
    limit: 120,
    windowMs: 60 * 60 * 1000,
  });
  if (!rateLimit.ok) return rateLimitResponse(rateLimit.resetAt);

  const admin = createSupabaseAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("role, plan")
    .eq("user_id", user.id)
    .maybeSingle();

  const adminScope = isAdminRole(profile?.role);

  let clientsQuery = admin
    .from("clients")
    .select("id, owner_id, child_code, anamnez, created_at, deleted_at")
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  if (!adminScope) {
    clientsQuery = clientsQuery.eq("owner_id", user.id);
  }

  const { data: clientsData, error: clientsError } = await clientsQuery;
  if (clientsError) {
    return NextResponse.json({ ok: false, error: "clinical_workspace_clients_failed" }, { status: 500 });
  }

  const clients = ((clientsData || []) as ClientRow[]).filter((row) => row.id);
  const clientIds = clients.map((row) => row.id);

  let assessments: AssessmentRow[] = [];
  if (clientIds.length > 0) {
    const { data, error } = await admin
      .from("assessments_v2")
      .select("id, client_id, created_at, deleted_at")
      .in("client_id", clientIds)
      .is("deleted_at", null);

    if (error) {
      return NextResponse.json({ ok: false, error: "clinical_workspace_assessments_failed" }, { status: 500 });
    }
    assessments = (data || []) as AssessmentRow[];
  }

  const assessmentIds = assessments.map((row) => row.id).filter(Boolean);
  let reports: ReportRow[] = [];
  if (assessmentIds.length > 0) {
    const { data, error } = await admin
      .from("reports")
      .select("id, version, report_text, created_at, snapshot_json, assessment_id")
      .in("assessment_id", assessmentIds)
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ ok: false, error: "clinical_workspace_reports_failed" }, { status: 500 });
    }
    reports = (data || []) as ReportRow[];
  }

  const assessmentsByClient = new Map<string, AssessmentRow[]>();
  for (const assessment of assessments) {
    if (!assessment.client_id) continue;
    const list = assessmentsByClient.get(assessment.client_id) || [];
    list.push(assessment);
    assessmentsByClient.set(assessment.client_id, list);
  }

  const reportsByAssessment = new Map<string, ReportRow[]>();
  for (const report of reports) {
    if (!report.assessment_id) continue;
    const list = reportsByAssessment.get(report.assessment_id) || [];
    list.push(report);
    reportsByAssessment.set(report.assessment_id, list);
  }

  const clientRows = clients.map((client) => {
    const clientAssessments = assessmentsByClient.get(client.id) || [];
    const clientReports = clientAssessments.flatMap((assessment) => reportsByAssessment.get(assessment.id) || []);
    const lastAssessmentAt = clientAssessments
      .map((item) => item.created_at || "")
      .filter(Boolean)
      .sort()
      .at(-1);
    const lastReportAt = clientReports
      .map((item) => item.created_at || "")
      .filter(Boolean)
      .sort()
      .at(-1);

    return {
      id: client.id,
      code: client.child_code || "—",
      status: "Aktif",
      lastAssessment: formatDate(lastAssessmentAt),
      lastReport: formatDate(lastReportAt),
      note: compactText(client.anamnez, 80),
      risk: calcRisk(client.anamnez || ""),
      needsScore: clientReports.length === 0,
      hasReport: clientReports.length > 0,
    };
  });

  const reportRows = reports.map((report) => {
    const assessment = assessments.find((item) => item.id === report.assessment_id);
    const client = assessment?.client_id ? clients.find((item) => item.id === assessment.client_id) : null;
    const text = normalizeReportText(report.report_text);

    return {
      id: report.id,
      version: report.version,
      report_text: report.report_text,
      created_at: report.created_at,
      snapshot_json: report.snapshot_json,
      assessment_id: report.assessment_id,
      clientId: client?.id || null,
      clientCode:
        client?.child_code ||
        report?.snapshot_json?.client_code ||
        report?.snapshot_json?.scores?.client_code ||
        "—",
      assessmentDate:
        report?.snapshot_json?.assessment_date ||
        report?.snapshot_json?.scores?.assessment_date ||
        assessment?.created_at ||
        report.created_at ||
        null,
      preview: compactText(text, 140) || "Rapor metni bulunamadı.",
    };
  });

  const riskCount = clientRows.filter((row) => row.risk === "Yüksek" || row.risk === "Orta").length;
  const pendingScore = clientRows.filter((row) => row.needsScore).length;
  const activeCount = clientRows.filter((row) => row.status === "Aktif").length;

  return NextResponse.json(
    {
      ok: true,
      scope: adminScope ? "admin" : "owner",
      user: { id: user.id, email: user.email || null, role: profile?.role || null, plan: profile?.plan || null },
      summary: {
        totalClients: clientRows.length,
        activeClients: activeCount,
        pendingScore,
        riskCount,
        reports: reportRows.length,
      },
      clients: clientRows,
      reports: reportRows,
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    }
  );
}
