"use client";

import { AGE_RANGE_OPTIONS } from "@/lib/selfmeta/ageUtils"
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

const makeChildCode = () => `SM-${Math.floor(100000 + Math.random() * 900000)}`;
import { supabase } from "@/lib/supabase/client";

type TabKey = "demo" | "medical" | "pregnancy" | "daily" | "goals";

type FormState = {
  // Kimlik / Demografik
  ad_soyad: string;
  client_code: string;
  record_date: string;
  age: string;
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
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-2 block text-sm font-medium text-slate-700">
        {label} <span className="text-rose-600">*</span>
      </label>
      {children}
      {hint ? <div className="mt-2 text-xs text-slate-400">{hint}</div> : null}
    </div>
  );
}

const REQUIRED: Array<{ key: keyof FormState; label: string }> = [
  { key: "ad_soyad", label: "Adı-soyadı" },
  { key: "client_code", label: "Danışan Kodu" },
  { key: "age", label: "Yaş" },
  { key: "gender", label: "Cinsiyet" },
  { key: "sibling_count", label: "Kardeş sayısı" },
  { key: "birth_order", label: "Kaçıncı çocuk" },
  { key: "household_count", label: "Evde kaç kişi kalıyor" },

  { key: "mother_age_at_birth", label: "Çocuk doğduğunda annenin yaşı" },
  { key: "mother_education", label: "Annenin eğitim düzeyi" },
  { key: "mother_job_working", label: "Annenin mesleği / çalışıyor mu?" },
  { key: "mother_work_hours", label: "Annenin çalışma saatleri" },
  { key: "caregiver_if_working", label: "Çalışıyorsa, çocuğa kim bakıyor" },

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

function buildAnamnez(form: FormState) {
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
  ];
  return lines.join("\n");
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

  const [form, setForm] = useState<FormState>({
    ad_soyad: "",
    client_code: "",
    record_date: "",
    age: "",
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

  const canCreate = useMemo(() => missing.length === 0, [missing]);

  const onReset = () => {
    setErr(null);
    setSaving(false);
    setForm({
      ad_soyad: "",
      client_code: "",
      record_date: "",
      age: "",
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
    });
    setTab("demo");
  };

  const onCreate = async () => {
    setErr(null);

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

      const payload = {
        owner_id: ures.user.id,
        child_code: form.client_code.trim(),
        anamnez: buildAnamnez(form),
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
              Tüm anamnez alanları zorunludur. Kayıt oluşturulduktan sonra değerlendirme ve skor girişine geçilir.
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
              className="selfmeta-btn px-4 py-2 text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
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
            <button className={tabBtn(tab === "demo")} onClick={() => setTab("demo")} type="button">
              Demografik
            </button>
            <button className={tabBtn(tab === "medical")} onClick={() => setTab("medical")} type="button">
              Tıbbi Geçmiş
            </button>
            <button className={tabBtn(tab === "pregnancy")} onClick={() => setTab("pregnancy")} type="button">
              Gebelik & Doğum
            </button>
            <button className={tabBtn(tab === "daily")} onClick={() => setTab("daily")} type="button">
              Günlük Yaşam
            </button>
            <button className={tabBtn(tab === "goals")} onClick={() => setTab("goals")} type="button">
              Hedefler
            </button>
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
                  <Field label="Kayıt Tarihi" hint="Boş bırakılabilir (ama zorunlu alan listesinden çıkarmadık)">
                    <input value={form.record_date} onChange={(e) => setVal("record_date", e.target.value)} className={inputBase} type="date" />
                  </Field>
                  
<div className="mb-4 rounded-xl border border-blue-200 bg-blue-50 p-4">
  <div className="text-sm font-semibold text-slate-800">Yaş Aralığı</div>
  <div className="mt-1 text-xs text-slate-600">
    Lütfen çocuğun yaş aralığını seçin (zorunlu).
  </div>

  <div className="mt-3 space-y-2">
    {["24-35 ay","36-47 ay","48-59 ay","60-71 ay"].map((label) => (
      <label key={label} className="flex items-center gap-2 text-sm">
        <input
          type="radio"
          name="ageRange"
          value={label}
          onChange={(e) => setForm((prev:any)=>({...prev, ageRange:e.target.value}))}
        />
        {label}
      </label>
    ))}
  </div>
</div>
<Field label="Yaş">
                    <input value={form.age} onChange={(e) => setVal("age", e.target.value)} className={inputBase} placeholder="Ay / yıl" />
                  </Field>

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
                <Field label="Ebeveyn iletişim bilgileri">
                  <textarea value={form.parent_contact} onChange={(e) => setVal("parent_contact", e.target.value)} className={textareaBase} rows={3} placeholder="Telefon/e-posta" />
                </Field>
                <Field label="Başvuru sebebi">
                  <textarea value={form.referral_reason} onChange={(e) => setVal("referral_reason", e.target.value)} className={textareaBase} rows={4}  />
                </Field>
              </div>
            )}
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
