"use client";

import { AGE_RANGE_OPTIONS } from "@/lib/selfmeta/ageUtils"
import {
  buildReportRelevantAnamnezSection,
} from "@/lib/selfmeta/anamnezUtils"
import {
  SUPPORTED_EXTERNAL_TESTS,
  analyzeExternalClinicalTests,
  findSupportedExternalTestByName,
  formatExternalTestAgeRange,
  getExternalTestInterpretationHint,
  getExternalTestResultHint,
} from "@/lib/selfmeta/externalTestRegistry"
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { AiOutlineDown } from "react-icons/ai";

const makeChildCode = () => `SM-${Math.floor(100000 + Math.random() * 900000)}`;
const makeExternalTestId = () => `ext-${Math.random().toString(36).slice(2, 10)}`;
import { supabase } from "@/lib/supabase/client";

type TabKey = "demo" | "medical" | "pregnancy" | "daily" | "goals" | "external";

type ExternalTestEntry = {
  id: string;
  testName: string;
  result: string;
  interpretation: string;
  notes: string;
};

type FormState = {
  // Kimlik / Demografik
  ad_soyad: string;
  client_code: string;
  record_date: string;
  ageRange: string;
  gender: string;
  sibling_count: string;
  birth_order: string;
  household_count: string;

  // Anne
  mother_age_at_birth: string;
  mother_education: string;
  mother_job_working: string;
  mother_work_hours: string;
  caregiver_if_working: string;

  // Baba
  father_education: string;
  father_job: string;
  father_work_hours: string;

  // Klinik / Tıbbi
  diagnosis: string;
  medical_history: string;
  allergy_epilepsy_gi_colic_seizure: string;
  current_therapies: string;
  past_therapies: string;
  medications: string;

  // Gebelik/Doğum
  prenatal_story: string;
  birth_story: string;
  postnatal_story: string;
  low_birth_history: string;

  // Günlük
  feeding_type: string;
  liked_foods: string;
  rejected_foods: string;
  liked_toys: string;
  strengths: string;

  // Hedefler
  parent_concerns_goals: string;
  parent_contact: string;
  referral_reason: string;
  therapist_comments: string;

  // Ek klinik bağlam
  external_test_name: string;
  external_test_score: string;
  external_test_interpretation: string;
  external_clinical_findings: string;
};

const inputBase =
  "w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 placeholder:text-slate-400 shadow-sm outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100";
const textareaBase =
  "w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 placeholder:text-slate-400 shadow-sm outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100";

const tabBtn = (active: boolean) =>
  `rounded-xl px-4 py-2 text-sm font-semibold transition ${
    active
      ? "bg-indigo-600 text-white"
      : "bg-white border border-slate-200 text-slate-700 hover:bg-slate-50"
  }`;

function Field({
  label,
  hint,
  required = true,
  children,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-2 block text-sm font-medium text-slate-700">
        {label}{" "}
        {required ? <span className="text-rose-600">*</span> : <span className="text-slate-400">(Opsiyonel)</span>}
      </label>
      {children}
      {hint ? <div className="mt-2 text-xs text-slate-400">{hint}</div> : null}
    </div>
  );
}

const REQUIRED: Array<{ key: keyof FormState; label: string }> = [
  { key: "ad_soyad", label: "Adı-soyadı" },
  { key: "client_code", label: "Danışan Kodu" },
  { key: "ageRange", label: "Yaş aralığı" },
  { key: "gender", label: "Cinsiyet" },
  { key: "sibling_count", label: "Kardeş sayısı" },
  { key: "birth_order", label: "Kaçıncı çocuk" },
  { key: "household_count", label: "Evde kaç kişi kalıyor" },

  { key: "mother_age_at_birth", label: "Çocuk doğduğunda annenin yaşı" },
  { key: "mother_education", label: "Annenin eğitim düzeyi" },
  { key: "mother_job_working", label: "Annenin mesleği / çalışıyor mu?" },
  { key: "mother_work_hours", label: "Annenin çalışma saatleri" },
  { key: "caregiver_if_working", label: "Çalışıyorsa, çocuğa kim bakıyor" },
  { key: "parent_contact", label: "Ebeveyn iletişim bilgileri" },

  { key: "father_education", label: "Babanın eğitim düzeyi" },
  { key: "father_job", label: "Babanın mesleği" },
  { key: "father_work_hours", label: "Babanın çalışma saatleri" },

  { key: "diagnosis", label: "Tanı" },
  { key: "medical_history", label: "Tıbbi geçmiş" },
  { key: "allergy_epilepsy_gi_colic_seizure", label: "Alerji/epilepsi/kabızlık-ishal/kolik/nöbet" },
  { key: "current_therapies", label: "Şu an aldığı tedavi ve terapiler" },
  { key: "past_therapies", label: "Daha önce aldığı ama bıraktığı tedaviler" },
  { key: "medications", label: "Medikal tedaviler (ilaçlar ve saatleri)" },

  { key: "prenatal_story", label: "Doğum öncesi hikâye" },
  { key: "birth_story", label: "Doğum hikayesi" },
  { key: "postnatal_story", label: "Doğum sonrası hikâye" },
  { key: "low_birth_history", label: "Düşük doğum hikayesi var mı" },

  { key: "feeding_type", label: "Beslenme şekli" },
  { key: "liked_foods", label: "Sevdiği yemekler" },
  { key: "rejected_foods", label: "Reddettiği yemekler" },
  { key: "liked_toys", label: "Sevdiği oyuncaklar" },
  { key: "strengths", label: "Çocuğun güçlü yanları" },

  { key: "parent_concerns_goals", label: "Birincil endişeler/hedefler" },
  { key: "parent_contact", label: "Ebeveyn iletişim bilgileri" },
  { key: "referral_reason", label: "Başvuru sebebi" },
];

const TAB_ORDER: TabKey[] = ["demo", "medical", "pregnancy", "daily", "goals", "external"];

const TAB_LABELS: Record<TabKey, string> = {
  demo: "Demografik",
  medical: "Tıbbi Geçmiş",
  pregnancy: "Gebelik & Doğum",
  daily: "Günlük Yaşam",
  goals: "Hedefler",
  external: "Ek Bulgular",
};

const TAB_REQUIRED: Record<TabKey, Array<keyof FormState>> = {
  demo: [
    "ad_soyad",
    "client_code",
    "ageRange",
    "gender",
    "sibling_count",
    "birth_order",
    "household_count",
    "mother_age_at_birth",
    "mother_education",
    "mother_job_working",
    "mother_work_hours",
    "caregiver_if_working",
    "parent_contact",
    "father_education",
    "father_job",
    "father_work_hours",
  ],
  medical: [
    "diagnosis",
    "medical_history",
    "allergy_epilepsy_gi_colic_seizure",
    "current_therapies",
    "past_therapies",
    "medications",
  ],
  pregnancy: ["prenatal_story", "birth_story", "postnatal_story", "low_birth_history"],
  daily: ["feeding_type", "liked_foods", "rejected_foods", "liked_toys", "strengths"],
  goals: ["parent_concerns_goals", "referral_reason"],
  external: [],
};

function hasExternalTestContent(entry: Pick<ExternalTestEntry, "testName" | "result" | "interpretation" | "notes">): boolean {
  return Boolean(entry.testName.trim() || entry.result.trim() || entry.interpretation.trim() || entry.notes.trim())
}

function buildExternalClinicalEntry(entry: Pick<ExternalTestEntry, "testName" | "result" | "interpretation" | "notes">): string {
  const parts = [
    entry.testName.trim() ? `Test adı: ${entry.testName.trim()}` : "",
    entry.result.trim() ? `Puan / sonuç: ${entry.result.trim()}` : "",
    entry.interpretation.trim() ? `Klinik yorum: ${entry.interpretation.trim()}` : "",
    entry.notes.trim() ? `Ek notlar: ${entry.notes.trim()}` : "",
  ].filter(Boolean)

  return parts.join(" | ")
}

function isSupportedExternalTestEntry(entry: Pick<ExternalTestEntry, "testName">): boolean {
  return Boolean(findSupportedExternalTestByName(entry.testName))
}

function buildExternalClinicalFindings(entries: ExternalTestEntry[]): string {
  return entries
    .filter(isSupportedExternalTestEntry)
    .filter(hasExternalTestContent)
    .map((entry, index) => `Test ${index + 1}: ${buildExternalClinicalEntry(entry)}`)
    .join("\n")
}

function buildAnamnez(form: FormState, externalTests: ExternalTestEntry[]) {
  const externalClinicalBlock = buildExternalClinicalFindings(externalTests);
  const lines = [
    `Adı-soyadı: ${form.ad_soyad}`,
    `Danışan Kodu: ${form.client_code}`,
    `Kayıt Tarihi: ${form.record_date || "—"}`,
    `Yaş aralığı: ${form.ageRange}`,
    `Cinsiyet: ${form.gender}`,
    `Kardeş sayısı: ${form.sibling_count}`,
    `Kaçıncı çocuk: ${form.birth_order}`,
    `Evde kaç kişi kalıyor: ${form.household_count}`,
    ``,
    `Çocuk doğduğunda annenin yaşı: ${form.mother_age_at_birth}`,
    `Annenin eğitim düzeyi: ${form.mother_education}`,
    `Annenin mesleği / çalışıyor mu?: ${form.mother_job_working}`,
    `Annenin çalışma saatleri: ${form.mother_work_hours}`,
    `Çalışıyorsa, çocuğa kim bakıyor: ${form.caregiver_if_working}`,
    ``,
    `Babanın eğitim düzeyi: ${form.father_education}`,
    `Babanın mesleği: ${form.father_job}`,
    `Babanın çalışma saatleri: ${form.father_work_hours}`,
    ``,
    `Tanı: ${form.diagnosis}`,
    `Tıbbi geçmiş: ${form.medical_history}`,
    `Alerji/epilepsi/kronik kabızlık-ishal/kolik ağrı/nöbet: ${form.allergy_epilepsy_gi_colic_seizure}`,
    `Şu an aldığı tedavi ve terapiler: ${form.current_therapies}`,
    `Daha önce aldığı ama bıraktığı tedaviler: ${form.past_therapies}`,
    `Medikal tedaviler (ilaçlar ve saatleri): ${form.medications}`,
    ``,
    `Doğum öncesi hikâye (hamilelik süresi, doğum kilosu, doğum şekli): ${form.prenatal_story}`,
    `Doğum hikayesi: ${form.birth_story}`,
    `Doğum sonrası hikâye: ${form.postnatal_story}`,
    `Düşük doğum hikayesi var mı: ${form.low_birth_history}`,
    ``,
    `Beslenme şekli: ${form.feeding_type}`,
    `Sevdiği yemekler: ${form.liked_foods}`,
    `Reddettiği yemekler: ${form.rejected_foods}`,
    `Sevdiği oyuncaklar: ${form.liked_toys}`,
    `Çocuğun güçlü yanları: ${form.strengths}`,
    ``,
    `Birincil endişeler/hedefler: ${form.parent_concerns_goals}`,
    `Ebeveyn iletişim bilgileri: ${form.parent_contact}`,
    `Başvuru sebebi: ${form.referral_reason}`,
    `Terapist yorumları: ${form.therapist_comments}`,
    ...(externalClinicalBlock
      ? ["", `Ek klinik test / bulgular: ${externalClinicalBlock}`]
      : []),
  ];

  const reportRelevantSection = buildReportRelevantAnamnezSection({
    age_range: form.ageRange,
    diagnosis: form.diagnosis,
    referral_reason: form.referral_reason,
    parent_concerns_goals: form.parent_concerns_goals,
    strengths: form.strengths,
    therapist_comments: form.therapist_comments,
    medical_history: form.medical_history,
    allergy_epilepsy_gi_colic_seizure: form.allergy_epilepsy_gi_colic_seizure,
    current_therapies: form.current_therapies,
    past_therapies: form.past_therapies,
    medications: form.medications,
    prenatal_story: form.prenatal_story,
    birth_story: form.birth_story,
    postnatal_story: form.postnatal_story,
    low_birth_history: form.low_birth_history,
    feeding_type: form.feeding_type,
    liked_foods: form.liked_foods,
    rejected_foods: form.rejected_foods,
    external_clinical_findings: externalClinicalBlock,
  });

  return [lines.join("\n"), "", reportRelevantSection].filter(Boolean).join("\n");
}


async function ensureUniqueChildCode(supabase: any, preferredCode?: string) {
  const normalize = (value?: string) => (value || "").trim().toUpperCase();
  let candidate = normalize(preferredCode) || makeChildCode();

  for (let i = 0; i < 20; i += 1) {
    const { data: existing, error } = await supabase
      .from("clients")
      .select("id")
      .eq("child_code", candidate)
      .maybeSingle();

    if (error) {
      return { code: candidate, error };
    }

    if (!existing) {
      return { code: candidate, error: null };
    }

    candidate = makeChildCode();
  }

  return { code: makeChildCode(), error: null };
}

export default function NewClientPage() {
  const router = useRouter();
  const [tab, setTab] = useState<TabKey>("demo");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [externalTests, setExternalTests] = useState<ExternalTestEntry[]>([]);

  const [form, setForm] = useState<FormState>({
    ad_soyad: "",
    client_code: "",
    record_date: "",
    ageRange: "",
    gender: "",
    sibling_count: "",
    birth_order: "",
    household_count: "",

    mother_age_at_birth: "",
    mother_education: "",
    mother_job_working: "",
    mother_work_hours: "",
    caregiver_if_working: "",

    father_education: "",
    father_job: "",
    father_work_hours: "",

    diagnosis: "",
    medical_history: "",
    allergy_epilepsy_gi_colic_seizure: "",
    current_therapies: "",
    past_therapies: "",
    medications: "",

    prenatal_story: "",
    birth_story: "",
    postnatal_story: "",
    low_birth_history: "",

    feeding_type: "",
    liked_foods: "",
    rejected_foods: "",
    liked_toys: "",
    strengths: "",

    parent_concerns_goals: "",
    parent_contact: "",
    referral_reason: "",
    therapist_comments: "",
    external_test_name: "",
    external_test_score: "",
    external_test_interpretation: "",
    external_clinical_findings: "",
  });

  const setVal = (k: keyof FormState, v: string) => setForm((p) => ({ ...p, [k]: v }));

  const missing = useMemo(() => {
    const m: string[] = [];
    for (const r of REQUIRED) {
      const v = String(form[r.key] ?? "").trim();
      if (!v) m.push(r.label);
    }
    return m;
  }, [form]);

  const completion = useMemo(() => {
    const total = REQUIRED.length;
    const filled = total - missing.length;
    return Math.round((filled / total) * 100);
  }, [missing]);

  const externalDraft: ExternalTestEntry = useMemo(
    () => ({
      id: "draft",
      testName: form.external_test_name,
      result: form.external_test_score,
      interpretation: form.external_test_interpretation,
      notes: form.external_clinical_findings,
    }),
    [form.external_test_name, form.external_test_score, form.external_test_interpretation, form.external_clinical_findings]
  );

  const selectedAgeMonths = useMemo(
    () => AGE_RANGE_OPTIONS.find((option) => option.label === form.ageRange)?.valueMonths ?? null,
    [form.ageRange]
  );

  const externalTestAnalysis = useMemo(
    () => analyzeExternalClinicalTests(buildExternalClinicalEntry(externalDraft), selectedAgeMonths),
    [externalDraft, selectedAgeMonths]
  );
  const selectedExternalTest = useMemo(
    () => findSupportedExternalTestByName(form.external_test_name),
    [form.external_test_name]
  );

  const externalScoreNeedsInterpretation = useMemo(() => {
    const hasScore = Boolean(externalDraft.result.trim())
    const hasName = Boolean(externalDraft.testName.trim())
    const hasInterpretation = Boolean(externalDraft.interpretation.trim())
    return hasName && hasScore && !hasInterpretation
  }, [externalDraft])

  const externalDraftHasContent = useMemo(() => hasExternalTestContent(externalDraft), [externalDraft])

  const externalPreviewEntries = useMemo(() => {
    if (!externalDraftHasContent) {
      return externalTests
    }

    return [...externalTests, externalDraft]
  }, [externalDraft, externalDraftHasContent, externalTests])

  const externalPreviewText = useMemo(
    () => buildExternalClinicalFindings(externalPreviewEntries),
    [externalPreviewEntries]
  )

  const missingByTab = useMemo(() => {
    const next = {} as Record<TabKey, string[]>;

    for (const key of TAB_ORDER) {
      next[key] = TAB_REQUIRED[key]
        .filter((field) => !String(form[field] ?? "").trim())
        .map((field) => REQUIRED.find((item) => item.key === field)?.label || String(field));
    }

    return next;
  }, [form]);

  const currentTabMissing = missingByTab[tab];
  const currentTabComplete = currentTabMissing.length === 0;
  const currentTabIndex = TAB_ORDER.indexOf(tab);
  const prevTab = currentTabIndex > 0 ? TAB_ORDER[currentTabIndex - 1] : null;
  const nextTab = currentTabIndex < TAB_ORDER.length - 1 ? TAB_ORDER[currentTabIndex + 1] : null;

  const canCreate = useMemo(() => missing.length === 0, [missing]);

  const createButtonClass = canCreate && !saving
    ? "inline-flex items-center justify-center rounded-2xl border-2 border-blue-500 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700 shadow-sm transition hover:bg-blue-100"
    : "inline-flex items-center justify-center rounded-2xl border-2 border-slate-200 bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-400 transition disabled:cursor-not-allowed disabled:opacity-100";

  const clearExternalDraft = () => {
    setForm((prev) => ({
      ...prev,
      external_test_name: "",
      external_test_score: "",
      external_test_interpretation: "",
      external_clinical_findings: "",
    }))
  }

  const addExternalTestDraft = (): ExternalTestEntry[] | null => {
    const hasDraft = hasExternalTestContent(externalDraft)

    if (!hasDraft) {
      return externalTests
    }

    if (!externalDraft.testName.trim()) {
      setErr("Ek test eklemek için önce test adını girin.")
      setTab("external")
      return null
    }

    if (!selectedExternalTest) {
      setErr("Yalnız desteklenen testler eklenebilir. Lütfen listeden bir test seçin.")
      setTab("external")
      return null
    }

    if (externalScoreNeedsInterpretation) {
      setErr("Ham puan tek başına kaydedilmez. Lütfen kısa klinik yorumu da ekleyin.")
      setTab("external")
      return null
    }

    const nextEntry: ExternalTestEntry = {
      id: makeExternalTestId(),
      testName: selectedExternalTest.name,
      result: externalDraft.result.trim(),
      interpretation: externalDraft.interpretation.trim(),
      notes: externalDraft.notes.trim(),
    }

    const nextList = [...externalTests, nextEntry]
    setExternalTests(nextList)
    clearExternalDraft()
    return nextList
  }

  const removeExternalTest = (id: string) => {
    setExternalTests((prev) => prev.filter((entry) => entry.id !== id))
  }

  const onReset = () => {
    setErr(null);
    setSaving(false);
    setExternalTests([]);
    setForm({
      ad_soyad: "",
      client_code: "",
      record_date: "",
      ageRange: "",
      gender: "",
      sibling_count: "",
      birth_order: "",
      household_count: "",

      mother_age_at_birth: "",
      mother_education: "",
      mother_job_working: "",
      mother_work_hours: "",
      caregiver_if_working: "",

      father_education: "",
      father_job: "",
      father_work_hours: "",

      diagnosis: "",
      medical_history: "",
      allergy_epilepsy_gi_colic_seizure: "",
      current_therapies: "",
      past_therapies: "",
      medications: "",

      prenatal_story: "",
      birth_story: "",
      postnatal_story: "",
      low_birth_history: "",

      feeding_type: "",
      liked_foods: "",
      rejected_foods: "",
      liked_toys: "",
      strengths: "",

      parent_concerns_goals: "",
      parent_contact: "",
      referral_reason: "",
      therapist_comments: "",
      external_test_name: "",
      external_test_score: "",
      external_test_interpretation: "",
      external_clinical_findings: "",
    });
    setTab("demo");
  };

  const onCreate = async () => {
    setErr(null);

    const finalExternalTests = addExternalTestDraft()
    if (finalExternalTests === null) {
      return
    }

    if (!canCreate) {
      setErr("Zorunlu alanlar eksik: " + missing.join(", "));
      return;
    }

    try {
      setSaving(true);

      const { data: ures, error: uerr } = await supabase.auth.getUser();
      if (uerr || !ures?.user?.id) {
        throw new Error("Oturum bulunamadı. Lütfen tekrar giriş yapın.");
      }

      const normalizedChildCode = form.client_code.trim().toUpperCase();
      const { code, error: uniqueCodeError } = await ensureUniqueChildCode(supabase, normalizedChildCode);
      if (uniqueCodeError) {
        throw new Error("Danışan kodu kontrol edilemedi: " + uniqueCodeError.message);
      }
      if (code !== normalizedChildCode) {
        throw new Error("Bu danışan kodu zaten kullanılıyor. Lütfen farklı bir danışan kodu girin.");
      }

      const payload = {
        owner_id: ures.user.id,
        child_code: normalizedChildCode,
        anamnez: buildAnamnez(form, finalExternalTests || externalTests),
      };

      const { data, error } = await supabase
        .from("clients")
        .insert(payload)
        .select("id, child_code")
        .single();

      if (error) {
        throw new Error("Kayıt oluşturulamadı: " + error.message);
      }

      const qs = new URLSearchParams({
        client: data.child_code,
        client_id: data.id,
      }).toString();

      router.push(`/assessments?${qs}`);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Beklenmeyen bir hata oluştu.";
      setErr(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="selfmeta-card p-5 mt-4">
        <div className="text-xs font-medium text-slate-400">Danışan Yönetimi / Yeni Kayıt</div>
        <div className="mt-1 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Yeni Danışan Ekle</h1>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-500">
              Ek klinik test alanı dışında tüm anamnez alanları zorunludur. Kayıt oluşturulduktan sonra değerlendirme ve skor girişine geçilir.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/clients"
              className="selfmeta-btn-ghost px-4 py-2 text-sm font-semibold inline-flex items-center justify-center"
            >
              Listeye Dön
            </Link>
            <button type="button" onClick={onReset} className="selfmeta-btn-ghost px-4 py-2 text-sm font-semibold">
              Temizle
            </button>
            <button
              type="button"
              onClick={onCreate}
              disabled={!canCreate || saving}
              className={createButtonClass}
              title={!canCreate ? `Eksik alanlar: ${missing.join(", ")}` : ""}
            >
              {saving ? "Kaydediliyor..." : "Kaydı Oluştur → Skor Girişi"}
            </button>
          </div>
        </div>

        {err ? <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{err}</div> : null}
        {!err && missing.length > 0 ? (
          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            Eksik alan sayısı: <b>{missing.length}</b> (Buton aktif olması için hepsi dolmalı)
          </div>
        ) : null}
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="selfmeta-card p-6">
          <div className="flex flex-wrap gap-2">
            {TAB_ORDER.map((key) => {
              const isActive = tab === key;
              const isComplete = missingByTab[key].length === 0;

              return (
                <button
                  key={key}
                  className={`${tabBtn(isActive)} inline-flex items-center gap-2`}
                  onClick={() => setTab(key)}
                  type="button"
                  title={
                    isComplete
                      ? "Bu bölüm tamamlandı"
                      : `${missingByTab[key].length} alan eksik`
                  }
                >
                  <span>{TAB_LABELS[key]}</span>
                  <span
                    className={`inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-bold ${
                      isActive
                        ? "bg-white/20 text-white"
                        : isComplete
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-slate-100 text-slate-500"
                    }`}
                  >
                    {isComplete ? "✓" : missingByTab[key].length}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="mt-6 space-y-6">
            {tab === "demo" && (
              <div className="space-y-6">
                <div className="grid gap-4 md:grid-cols-2">
                  <Field label="Adı-soyadı">
                    <input value={form.ad_soyad} onChange={(e) => setVal("ad_soyad", e.target.value)} className={inputBase} placeholder="Ad Soyad" />
                  </Field>
                  <Field label="Danışan Kodu" hint="Örn: Oluşturulurken benzersiz kod verilir">
                    <input value={form.client_code} onChange={(e) => setVal("client_code", e.target.value)} className={inputBase} placeholder="SM-014" />
                  </Field>
                  <Field label="Kayıt Tarihi" hint="Boş bırakılabilir" required={false}>
                    <input value={form.record_date} onChange={(e) => setVal("record_date", e.target.value)} className={inputBase} type="date" />
                  </Field>
                  <div className="md:col-span-2">
                    <Field label="Yaş aralığı">
                      <div className="flex flex-wrap gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
                        {AGE_RANGE_OPTIONS.map((option) => {
                          const label = option.label
                          const isSelected = form.ageRange === label
                          return (
                            <label
                              key={label}
                              className={`inline-flex cursor-pointer items-center gap-2 rounded-full border px-3 py-2 text-sm font-medium transition ${
                                isSelected
                                  ? "border-indigo-600 bg-indigo-50 text-indigo-700"
                                  : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50"
                              }`}
                            >
                              <input
                                type="radio"
                                name="ageRange"
                                value={label}
                                checked={isSelected}
                                onChange={(e) => setVal("ageRange", e.target.value)}
                                className="h-4 w-4 border-slate-300 text-indigo-600 focus:ring-indigo-500"
                              />
                              {label}
                            </label>
                          )
                        })}
                      </div>
                    </Field>
                  </div>

                  <Field label="Cinsiyet">
                    <input value={form.gender} onChange={(e) => setVal("gender", e.target.value)} className={inputBase} placeholder="Kız / Erkek" />
                  </Field>
                  <Field label="Kardeş sayısı">
                    <input value={form.sibling_count} onChange={(e) => setVal("sibling_count", e.target.value)} className={inputBase} placeholder="0, 1, 2..." />
                  </Field>
                  <Field label="Kaçıncı çocuk">
                    <input value={form.birth_order} onChange={(e) => setVal("birth_order", e.target.value)} className={inputBase} placeholder="1., 2., 3." />
                  </Field>
                  <Field label="Evde kaç kişi kalıyor">
                    <input value={form.household_count} onChange={(e) => setVal("household_count", e.target.value)} className={inputBase} placeholder="Toplam kişi" />
                  </Field>

                  <Field label="Çocuk doğduğunda annenin yaşı">
                    <input value={form.mother_age_at_birth} onChange={(e) => setVal("mother_age_at_birth", e.target.value)} className={inputBase} placeholder="Yıl" />
                  </Field>
                  <Field label="Annenin eğitim düzeyi">
                    <input value={form.mother_education} onChange={(e) => setVal("mother_education", e.target.value)} className={inputBase} placeholder="İlk/Lise/Üni..." />
                  </Field>
                  <Field label="Annenin mesleği / çalışıyor mu?">
                    <input value={form.mother_job_working} onChange={(e) => setVal("mother_job_working", e.target.value)} className={inputBase} placeholder="Meslek + Evet/Hayır" />
                  </Field>
                  <Field label="Annenin çalışma saatleri">
                    <input value={form.mother_work_hours} onChange={(e) => setVal("mother_work_hours", e.target.value)} className={inputBase} placeholder="Örn. 09:00-18:00" />
                  </Field>
                  <Field label="Çalışıyorsa, çocuğa kim bakıyor">
                    <input value={form.caregiver_if_working} onChange={(e) => setVal("caregiver_if_working", e.target.value)} className={inputBase} placeholder="Anneanne/bakıcı..." />
                  </Field>
                  <Field label="Ebeveyn iletişim bilgileri">
                    <textarea value={form.parent_contact} onChange={(e) => setVal("parent_contact", e.target.value)} className={textareaBase} rows={3} placeholder="Telefon / e-posta" />
                  </Field>

                  <Field label="Babanın eğitim düzeyi">
                    <input value={form.father_education} onChange={(e) => setVal("father_education", e.target.value)} className={inputBase} placeholder="İlk/Lise/Üni..." />
                  </Field>
                  <Field label="Babanın mesleği">
                    <input value={form.father_job} onChange={(e) => setVal("father_job", e.target.value)} className={inputBase} placeholder="Meslek" />
                  </Field>
                  <Field label="Babanın çalışma saatleri">
                    <input value={form.father_work_hours} onChange={(e) => setVal("father_work_hours", e.target.value)} className={inputBase} placeholder="Örn. 09.00-18.00" />
                  </Field>
                </div>
              </div>
            )}

            {tab === "medical" && (
              <div className="space-y-6">
                <Field label="Tanı">
                  <textarea value={form.diagnosis} onChange={(e) => setVal("diagnosis", e.target.value)} className={textareaBase} rows={3}  />
                </Field>
                <Field label="Tıbbi geçmiş">
                  <textarea value={form.medical_history} onChange={(e) => setVal("medical_history", e.target.value)} className={textareaBase} rows={4}  />
                </Field>
                <Field label="Alerji, epilepsi, kronik kabızlık/ishal, kolik ağrı, nöbet var mı">
                  <textarea value={form.allergy_epilepsy_gi_colic_seizure} onChange={(e) => setVal("allergy_epilepsy_gi_colic_seizure", e.target.value)} className={textareaBase} rows={4}  />
                </Field>
                <Field label="Şu an aldığı tedavi ve terapiler">
                  <textarea value={form.current_therapies} onChange={(e) => setVal("current_therapies", e.target.value)} className={textareaBase} rows={4}  />
                </Field>
                <Field label="Daha önce aldığı ama bıraktığı tedaviler">
                  <textarea value={form.past_therapies} onChange={(e) => setVal("past_therapies", e.target.value)} className={textareaBase} rows={4}  />
                </Field>
                <Field label="Medikal tedaviler (ilaçlar ve saatleri)">
                  <textarea value={form.medications} onChange={(e) => setVal("medications", e.target.value)} className={textareaBase} rows={4}  />
                </Field>
              </div>
            )}

            {tab === "pregnancy" && (
              <div className="space-y-6">
                <Field label="Doğum öncesi hikâye (hamilelik süresi, doğum kilosu, doğum şekli)">
                  <textarea value={form.prenatal_story} onChange={(e) => setVal("prenatal_story", e.target.value)} className={textareaBase} rows={5}  />
                </Field>
                <Field label="Doğum hikayesi">
                  <textarea value={form.birth_story} onChange={(e) => setVal("birth_story", e.target.value)} className={textareaBase} rows={5}  />
                </Field>
                <Field label="Doğum sonrası hikâye">
                  <textarea value={form.postnatal_story} onChange={(e) => setVal("postnatal_story", e.target.value)} className={textareaBase} rows={5}  />
                </Field>
                <Field label="Düşük doğum hikayesi var mı">
                  <textarea value={form.low_birth_history} onChange={(e) => setVal("low_birth_history", e.target.value)} className={textareaBase} rows={3}  />
                </Field>
              </div>
            )}

            {tab === "daily" && (
              <div className="space-y-6">
                <Field label="Beslenme şekli">
                  <textarea value={form.feeding_type} onChange={(e) => setVal("feeding_type", e.target.value)} className={textareaBase} rows={3}  />
                </Field>
                <Field label="Sevdiği yemekler">
                  <textarea value={form.liked_foods} onChange={(e) => setVal("liked_foods", e.target.value)} className={textareaBase} rows={3}  />
                </Field>
                <Field label="Reddettiği yemekler">
                  <textarea value={form.rejected_foods} onChange={(e) => setVal("rejected_foods", e.target.value)} className={textareaBase} rows={3}  />
                </Field>
                <Field label="Sevdiği oyuncaklar">
                  <textarea value={form.liked_toys} onChange={(e) => setVal("liked_toys", e.target.value)} className={textareaBase} rows={3}  />
                </Field>
                <Field label="Çocuğunuzun güçlü yanları nelerdir?">
                  <textarea value={form.strengths} onChange={(e) => setVal("strengths", e.target.value)} className={textareaBase} rows={4}  />
                </Field>
              </div>
            )}

            {tab === "goals" && (
              <div className="space-y-6">
                <Field label="Çocuğunuzla ilgili birincil endişeleriniz/hedefleriniz nelerdir?">
                  <textarea value={form.parent_concerns_goals} onChange={(e) => setVal("parent_concerns_goals", e.target.value)} className={textareaBase} rows={6}  />
                </Field>
                <Field label="Başvuru sebebi">
                  <textarea value={form.referral_reason} onChange={(e) => setVal("referral_reason", e.target.value)} className={textareaBase} rows={4}  />
                </Field>
                <Field
                  label="Terapist yorumları"
                  required={false}
                  hint="Gözlem, klinik izlenim veya rapora yansımasını istediğin kısa profesyonel notları buraya ekleyebilirsin."
                >
                  <textarea
                    value={form.therapist_comments}
                    onChange={(e) => setVal("therapist_comments", e.target.value)}
                    className={textareaBase}
                    rows={4}
                    placeholder="Örn. Seans içinde geçişlerde zorlandı, yapılandırılmış yönlendirmeden belirgin fayda gördü."
                  />
                </Field>
              </div>
            )}

            {tab === "external" && (
              <div className="space-y-6">
                <div className="rounded-2xl border border-indigo-100 bg-indigo-50/60 p-4 text-sm leading-6 text-slate-600">
                  Ek bir değerlendirme varsa burada kısaca ekle. Test adı, sonuç ve kısa klinik yorum yeterli.
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <Field label="Test adı" required={false} hint="Yalnız desteklenen testler eklenebilir.">
                    <div className="relative">
                      <select
                        value={selectedExternalTest?.id ?? ""}
                        onChange={(e) => {
                          const value = e.target.value
                          if (!value) {
                            setVal("external_test_name", "")
                            return
                          }
                          const test = SUPPORTED_EXTERNAL_TESTS.find((item) => item.id === value)
                          setVal("external_test_name", test?.name || "")
                        }}
                        className={`${inputBase} appearance-none pr-11`}
                      >
                        <option value="">Desteklenen test seç</option>
                        {SUPPORTED_EXTERNAL_TESTS.map((test) => (
                          <option key={test.id} value={test.id}>
                            {test.name}
                          </option>
                        ))}
                      </select>
                      <AiOutlineDown className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" />
                    </div>
                  </Field>

                  <Field
                    label="Puan / sonuç"
                    required={false}
                    hint={selectedExternalTest ? getExternalTestResultHint(selectedExternalTest.id) : undefined}
                  >
                    <input
                      value={form.external_test_score}
                      onChange={(e) => setVal("external_test_score", e.target.value)}
                      className={inputBase}
                      placeholder={
                        selectedExternalTest?.id === "brief_p" || selectedExternalTest?.id === "brief2"
                          ? "Örn. Emosyonel kontrol T=72, klinik yüksek"
                          : selectedExternalTest?.id === "sipt"
                          ? "Örn. Praxis alt testlerinde düşük performans"
                          : "Örn. 30 puan / düşük / sınırda / percentile 12"
                      }
                    />
                  </Field>
                </div>

                <Field
                  label="Klinik yorum / resmi bulgu özeti"
                  required={false}
                  hint={selectedExternalTest ? getExternalTestInterpretationHint(selectedExternalTest.id) : "Sonucun kısa klinik anlamını yaz."}
                >
                  <textarea
                    value={form.external_test_interpretation}
                    onChange={(e) => setVal("external_test_interpretation", e.target.value)}
                    className={textareaBase}
                    rows={4}
                    placeholder={
                      selectedExternalTest?.id === "sipt"
                        ? "Örn. Somatodispraksi ile uyumlu bulgular gözlendi. Motor planlama ve beden organizasyonu zorlanıyor."
                        : "Testin yorum kısmı, resmi rapor özeti veya klinik anlamı"
                    }
                  />
                </Field>

                <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <div className="text-sm text-slate-600">
                    {externalTests.length > 0 ? (
                      <>
                        Listede <span className="font-semibold text-slate-900">{externalTests.length}</span> ek test var.
                        {externalDraftHasContent ? " Mevcut taslak da rapora eklenmeye hazır." : ""}
                      </>
                    ) : externalDraftHasContent ? (
                      "Taslak hazır. İstersen önce listeye ekle, istersen kayıt oluştururken otomatik eklensin."
                    ) : (
                      "Henüz eklenmiş dış test yok. Bu alan tamamen opsiyonel."
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setErr(null)
                        addExternalTestDraft()
                      }}
                      className="selfmeta-btn px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50"
                      disabled={!externalDraftHasContent}
                    >
                      Testi Listeye Ekle
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setErr(null)
                        clearExternalDraft()
                      }}
                      className="selfmeta-btn-ghost px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50"
                      disabled={!externalDraftHasContent}
                    >
                      Taslağı Temizle
                    </button>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="text-sm font-semibold text-slate-900">Eklenen testler</div>
                  {externalTests.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-5 text-sm leading-6 text-slate-500">
                      Henüz listeye eklenmiş dış test yok. Bir test doldurup <b>Testi Listeye Ekle</b> ile sabitleyebilirsin.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {externalTests.map((entry, index) => {
                        const entryAnalysis = analyzeExternalClinicalTests(buildExternalClinicalEntry(entry), selectedAgeMonths)
                        const isCompatible = entryAnalysis.compatible.length > 0
                        const isIncompatible = entryAnalysis.incompatible.length > 0
                        const isUnknown = entryAnalysis.hasUnrecognizedContent

                        return (
                          <div key={entry.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                              <div className="space-y-2">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-600">
                                    Test {index + 1}
                                  </span>
                                  <span className="text-sm font-semibold text-slate-900">{entry.testName || "Adsız test"}</span>
                                  {isCompatible ? (
                                    <span className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                                      Yaşa uygun
                                    </span>
                                  ) : null}
                                  {isIncompatible ? (
                                    <span className="inline-flex rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">
                                      Yaş uyumsuz
                                    </span>
                                  ) : null}
                                  {isUnknown ? (
                                    <span className="inline-flex rounded-full border border-rose-200 bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-700">
                                      Desteklenmeyen test
                                    </span>
                                  ) : null}
                                </div>

                                {entry.result ? (
                                  <div className="text-sm leading-6 text-slate-700">
                                    <span className="font-medium text-slate-900">Puan / sonuç:</span> {entry.result}
                                  </div>
                                ) : null}
                                {entry.interpretation ? (
                                  <div className="text-sm leading-6 text-slate-700">
                                    <span className="font-medium text-slate-900">Klinik yorum:</span> {entry.interpretation}
                                  </div>
                                ) : null}
                                {entry.notes ? (
                                  <div className="text-sm leading-6 text-slate-700">
                                    <span className="font-medium text-slate-900">Ek notlar:</span> {entry.notes}
                                  </div>
                                ) : null}

                                {entryAnalysis.warningLines.length > 0 ? (
                                  <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-900">
                                    {entryAnalysis.warningLines[0]}
                                  </div>
                                ) : null}

                                {entryAnalysis.validatedSupportLines.length > 0 ? (
                                  <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs leading-5 text-emerald-900">
                                    {entryAnalysis.validatedSupportLines[0]}
                                  </div>
                                ) : null}
                              </div>

                              <button
                                type="button"
                                onClick={() => removeExternalTest(entry.id)}
                                className="selfmeta-btn-ghost px-3 py-2 text-sm font-semibold text-rose-600 hover:bg-rose-50"
                              >
                                Testi Sil
                              </button>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>

                {selectedExternalTest ? (
                  <div className="rounded-2xl border border-indigo-100 bg-indigo-50/70 p-4 text-sm leading-6 text-slate-700">
                    <div className="font-semibold text-slate-900">{selectedExternalTest.name}</div>
                    <div className="mt-1">
                      Yaş: {formatExternalTestAgeRange(selectedExternalTest)}{" "}
                      <span className="text-slate-400">•</span> {selectedExternalTest.supportedUse}
                    </div>
                  </div>
                ) : null}

                <Field
                  label="Ek notlar"
                  required={false}
                  hint="İstersen tarih, uygulama koşulu veya terapistin kısa notunu ekleyebilirsin."
                >
                  <textarea
                    value={form.external_clinical_findings}
                    onChange={(e) => setVal("external_clinical_findings", e.target.value)}
                    className={textareaBase}
                    rows={4}
                    placeholder="Örn. Test gürültüsüz ortamda uygulandı. Bulgular aile gözlemiyle de uyumluydu."
                  />
                </Field>

                {externalPreviewEntries.length > 0 ? (
                  <div className="rounded-2xl border border-slate-200 bg-white p-4">
                    <div className="text-sm font-semibold text-slate-900">Rapora gidecek standart özet</div>
                    <div className="mt-2 text-sm leading-6 text-slate-700">
                      {externalPreviewText || "Henüz rapora gidecek yapılandırılmış veri oluşmadı."}
                    </div>
                  </div>
                ) : null}

                {externalScoreNeedsInterpretation ? (
                  <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
                    Ham puan tek başına rapora karar girdisi olarak alınmayacak. Lütfen bu puanın kısa klinik anlamını da yaz.
                  </div>
                ) : null}

                {externalTestAnalysis.compatible.length > 0 ? (
                  <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                    <div className="text-sm font-semibold text-emerald-900">Yaşla uyumlu tanınan dış testler</div>
                    <div className="mt-2 space-y-2 text-sm leading-6 text-emerald-800">
                      {externalTestAnalysis.compatible.map((test) => (
                        <div key={test.id}>
                          <div className="font-medium">{test.name}</div>
                          <div>{formatExternalTestAgeRange(test)}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}

                {externalTestAnalysis.incompatible.length > 0 ? (
                  <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                    <div className="text-sm font-semibold text-amber-900">Yaş uyumsuzluğu uyarısı</div>
                    <div className="mt-2 space-y-3 text-sm leading-6 text-amber-900">
                      {externalTestAnalysis.incompatible.map((test) => (
                        <div key={test.id}>
                          <div className="font-medium">{test.name}</div>
                          <div>
                            Bu testin resmi yaş aralığı {formatExternalTestAgeRange(test)}. Seçili vaka yaş aralığı ile uyumlu görünmediği için rapor karar mekanizmasına dahil edilmeyecek.
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}

                {externalTestAnalysis.hasUnrecognizedContent ? (
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-700">
                    Girilen dış test adı mevcut doğrulama kataloğunda tanınmadı. Bu nedenle sistem yaş uygunluğu kontrolü yapmadan yalnız serbest klinik bağlam olarak değerlendirecektir.
                  </div>
                ) : null}
              </div>
            )}
          </div>

          <div className="mt-8 flex flex-col gap-3 border-t border-slate-200 pt-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm text-slate-500">
              {currentTabComplete
                ? "Bu bölüm tamamlandı. İsterseniz üst başlıklardan ya da sağ alttaki butondan ilerleyebilirsiniz."
                : `Bu bölümde ${currentTabMissing.length} zorunlu alan eksik. Bölümü tamamlayınca sonraki adıma geçebilirsiniz.`}
            </div>
            <div className="flex items-center justify-end gap-2">
              {prevTab ? (
                <button
                  type="button"
                  onClick={() => setTab(prevTab)}
                  className="selfmeta-btn-ghost px-4 py-2 text-sm font-semibold"
                >
                  ← Geri: {TAB_LABELS[prevTab]}
                </button>
              ) : (
                <span className="hidden sm:block" />
              )}

              {nextTab ? (
                <button
                  type="button"
                  onClick={() => setTab(nextTab)}
                  disabled={!currentTabComplete}
                  className="selfmeta-btn px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50"
                  title={
                    currentTabComplete
                      ? `${TAB_LABELS[nextTab]} bölümüne geç`
                      : `Önce bu bölümdeki eksikleri tamamlayın: ${currentTabMissing.join(", ")}`
                  }
                >
                  Sonraki Bölüm: {TAB_LABELS[nextTab]} →
                </button>
              ) : (
                <button
                  type="button"
                  onClick={onCreate}
                  disabled={!canCreate || saving}
                  className="selfmeta-btn px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50"
                  title={!canCreate ? `Eksik alanlar: ${missing.join(", ")}` : ""}
                >
                  {saving ? "Kaydediliyor..." : "Kaydı Oluştur → Skor Girişi"}
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="selfmeta-card p-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900">Anamnez Durumu</h2>
              <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700">
                {completion}%
              </span>
            </div>
            <div className="mt-4">
              <div className="h-2 w-full rounded-full bg-slate-100">
                <div className="h-2 rounded-full bg-indigo-600" style={{ width: `${completion}%` }} />
              </div>
              <div className="mt-3 text-xs text-slate-500">Doluluk oranı yalnızca doldurulan anamnez alanlarına göre hesaplanır.</div>
            </div>
          </div>
<div className="selfmeta-card p-6">
            <h2 className="text-lg font-semibold text-slate-900">Hızlı Geçiş</h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              Akış: danışan kaydı → skor girişi → rapor görüntüleme.
            </p>
            <div className="mt-4 grid gap-2">
              <Link href="/assessments" className="inline-flex items-center justify-center rounded-xl border border-indigo-600 bg-white px-4 py-2 text-sm font-semibold text-indigo-700 transition hover:bg-indigo-50">
                Skor Girişine Git
              </Link>
              <Link href="/reports" className="selfmeta-btn-ghost px-4 py-2 text-sm font-semibold inline-flex items-center justify-center">
                Raporları Gör
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="sticky bottom-0 z-10 -mx-4 border-t border-slate-200 bg-white/80 p-3 backdrop-blur md:hidden">
        <div className="mx-auto flex max-w-3xl gap-2">
          <button type="button" onClick={onReset} className="selfmeta-btn-ghost flex-1 px-4 py-2 text-sm font-semibold">
            Temizle
          </button>
          <button
            type="button"
            onClick={onCreate}
            disabled={!canCreate || saving}
            className="selfmeta-btn flex-1 px-4 py-2 text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? "Kaydediliyor..." : "Kaydı Oluştur"}
          </button>
        </div>
      </div>
    </div>
  );
}
