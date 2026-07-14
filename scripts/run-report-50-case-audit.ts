import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

import { calculateAssessment } from "../src/lib/assessment/assessmentEngine";
import { validateRawAnswers } from "../src/lib/assessment/itemScoring";
import { questions, type QuestionScale } from "../src/lib/dna/questions";
import { classifyTotalScore } from "../src/lib/dna/normativeBands";
import { analyzeReportLanguageQuality } from "../src/lib/dna/reportLanguageQuality";
import { CANONICAL_REPORT_HEADINGS, splitClinicalReportSections } from "../src/lib/dna/reportText";
import { runSingleFixture, type FixturePayload } from "./run-dna-report";

const OUTPUT_ROOT = "/tmp/dna-report-output/50-case-audit";
const GENERATED_FIXTURE_DIR = path.join(OUTPUT_ROOT, "fixtures");
const SUMMARY_PATH = path.join(OUTPUT_ROOT, "50-case-audit-summary.md");
const JSON_PATH = path.join(OUTPUT_ROOT, "50-case-audit-results.json");

type CaseGroup = "Yaş ve uç örüntüler" | "Seçici alan" | "İkili alan" | "Yaygın profil" | "Kanıt ve bağlam";
type AnswerPattern = "even" | "alternating";
type ExpectedMode = "balanced" | "selective" | "paired" | "widespread" | "contextual";
type AuditDimension =
  | "technical"
  | "direction"
  | "calibration"
  | "language"
  | "decision"
  | "specificity"
  | "professionalism";

type DomainTargets = Record<QuestionScale, number>;

type CaseSpec = {
  key: string;
  title: string;
  group: CaseGroup;
  ageMonths: number;
  domainScores: DomainTargets;
  expectedMode: ExpectedMode;
  description: string;
  answerPattern?: AnswerPattern;
  anamnez?: FixturePayload["anamnez"];
  expectedTerms?: RegExp[];
  forbiddenTerms?: RegExp[];
  expectsDirectConflict?: boolean;
};

type AuditIssue = {
  dimension: AuditDimension;
  severity: "high" | "medium" | "low";
  code: string;
  message: string;
};

const RESULT_FIELD_BY_SCALE = {
  fizyolojik: "fizyolojik",
  duyusal: "duyusal",
  duygusal: "duygusal",
  bilissel: "bilissel",
  yurutucu: "yurutucu",
  intero: "intero",
} as const;

const REPORT_KEY_BY_SCALE = {
  fizyolojik: "physiological",
  duyusal: "sensory",
  duygusal: "emotional",
  bilissel: "cognitive",
  yurutucu: "executive",
  intero: "interoception",
} as const;

const DOMAIN_TERM_BY_SCALE: Record<QuestionScale, RegExp> = {
  fizyolojik: /fizyolojik|beden(?:sel)?|toparlanma/i,
  duyusal: /duyusal|uyaran/i,
  duygusal: /duygusal|duygu düzenleme/i,
  bilissel: /bilişsel|zihinsel|çalışma belleği/i,
  yurutucu: /yürütücü|görev organizasyonu|planlama/i,
  intero: /İnterosepsiyon|interosepsiyon|interoseptif|bedensel farkındalık|bedensel sinyal|İçsel sinyal|içsel sinyal/i,
};

const PROFESSIONALISM_FORBIDDEN: Array<[string, RegExp]> = [
  ["internal_token", /\b(?:ITEM|fallback|lowest[- ]score|raw score|watch range)\b/i],
  ["internal_identifier", /\b(?:motor_praxis|adaptive_daily_living|social_pragmatic|language_communication)\b/i],
  ["diagnostic_certainty", /\b(?:kesin tanı|tanıyı doğrular|kanıtlamaktadır|kesin olarak gösterir)\b/i],
  ["treatment_directive", /\b(?:tedavi edilmelidir|ilaç başlanmalıdır|terapiye başlanmalıdır)\b/i],
  ["normative_disclosure", /\b(?:standardize edilmiş norm|tanı eşiği|sistem içi eşik|normatif değer)\b/i],
];

const CORRECTED_FINDINGS = [
  "Olumsuzluk içeren anamnez cümlelerinin güçlük kanıtı gibi okunması engellendi; korunmuş işlev ve gerçek sorun bildirimleri cümle düzeyinde ayrıldı.",
  "Destekle performansın toparlanması doğrudan kaynak çelişkisi olmaktan çıkarıldı; klinik yorumun bağlam sınırı olarak ele alındı.",
  "Yalnız 'toparlanma' sözcüğünden bedensel/interoseptif bağlam çıkarılması engellendi; bedensel kanıt için özgül sinyal arandı.",
  "Korunmuş ölçek puanları yanında belirgin anamnez güçlüğü bulunan vakalarda seçici günlük yaşam sorununun hafifletilmesi önlendi.",
  "Korunmuş dış test sonuçlarının yanlışlıkla dış test çelişkisi sayılması engellendi; destekleyici ve sınırlayıcı dış test yönleri ayrıldı.",
  "Eşit şiddetteki iki veya daha fazla alanın kanıtsız biçimde birincil-ikincil sıralanması kaldırıldı; birlikte önceliklendirme kullanıldı.",
];

function domainTargets(value: number): DomainTargets {
  return {
    fizyolojik: value,
    duyusal: value,
    duygusal: value,
    bilissel: value,
    yurutucu: value,
    intero: value,
  };
}

function targets(overrides: Partial<DomainTargets>, base = 50): DomainTargets {
  return { ...domainTargets(base), ...overrides };
}

function scoreValuesForTotal(total: number, pattern: AnswerPattern): number[] {
  if (!Number.isInteger(total) || total < 10 || total > 50) {
    throw new Error(`Alan toplamı 10-50 arasında tam sayı olmalıdır: ${total}`);
  }
  if (pattern === "alternating" && total === 30) return [1, 5, 1, 5, 1, 5, 1, 5, 1, 5];

  const base = Math.floor(total / 10);
  const remainder = total % 10;
  return Array.from({ length: 10 }, (_, index) => base + (index < remainder ? 1 : 0));
}

function buildAnswers(scores: DomainTargets, pattern: AnswerPattern = "even"): number[] {
  const answers = Array(questions.length).fill(3);
  (Object.keys(scores) as QuestionScale[]).forEach((scale) => {
    const domainQuestions = questions.filter((question) => question.scale === scale);
    const scoredValues = scoreValuesForTotal(scores[scale], pattern);
    domainQuestions.forEach((question, index) => {
      const scoredValue = scoredValues[index];
      answers[question.id - 1] = question.scoringDirection === "reverse" ? 6 - scoredValue : scoredValue;
    });
  });
  return answers;
}

function buildTamperedScores(target: DomainTargets): Record<string, number> {
  return Object.fromEntries(
    (Object.keys(target) as QuestionScale[]).map((scale) => [
      REPORT_KEY_BY_SCALE[scale],
      target[scale] >= 31 ? 10 : 50,
    ])
  );
}

function baseAnamnez(description: string, mode: ExpectedMode): Record<string, string> {
  const preserved = mode === "balanced";
  return {
    referral_reason: preserved
      ? "Günlük rutinler, geçişler ve oyun katılımının genel görünümü değerlendirilmek isteniyor."
      : description,
    parent_concerns_goals: preserved
      ? "Aile yaşına uygun katılımın sürmesini ve güçlü alanların izlenmesini önemsiyor."
      : "Aile günlük yaşamda zorlanmanın hangi koşullarda arttığının netleştirilmesini istiyor.",
    therapist_comments: preserved
      ? "Yapılandırılmış ve doğal etkinliklerde katılım, geçiş ve toparlanma genel olarak korunuyor."
      : "Zorlanma görev talebi arttığında görünür oluyor; yapı ve kısa ipucu ile performans kısmen toparlanıyor.",
    strengths: "İlişki kurma, ilgi duyduğu etkinliğe yönelme ve uygun destekle göreve geri dönme güçlü yönler arasında.",
  };
}

const CASES: CaseSpec[] = [
  {
    key: "age-24-fully-preserved",
    title: "24 ay - tamamen korunmuş profil",
    group: "Yaş ve uç örüntüler",
    ageMonths: 24,
    domainScores: domainTargets(50),
    expectedMode: "balanced",
    description: "Alt yaş sınırında tüm alanlar korunmuş.",
  },
  {
    key: "age-35-fully-preserved",
    title: "35 ay - korunmuş profil üst sınırı",
    group: "Yaş ve uç örüntüler",
    ageMonths: 35,
    domainScores: domainTargets(50),
    expectedMode: "balanced",
    description: "İlk yaş bandının üst sınırında tüm alanlar korunmuş.",
    anamnez: {
      referral_reason: "Gelişimsel ve günlük yaşam görünümü genel kontrol amacıyla değerlendiriliyor.",
      parent_concerns_goals: "Aile geçiş, uyku ve beslenmede belirgin bir zorlanma gözlemlemiyor.",
      therapist_comments: "Katılım, dikkat ve toparlanma yaşa uygun ve korunmuş görünüyor.",
      medical_history: "Uyku düzenli; nöbet öyküsü yok; beslenme sorunsuz.",
      strengths: "Doğal ve yapılandırılmış etkinliklerde katılımını sürdürebiliyor.",
    },
    forbiddenTerms: [
      /Bedensel\/fizyolojik bağlama ilişkin anamnez verileri mevcuttur/i,
      /Geçiş, ayrılma.*self-regülasyon güçlüğünün arttığı/i,
      /Görevi başlatma, sürdürme.*yürütücü yük/i,
      /Alan puanı bir güçlük olasılığına işaret ederken/i,
      /skor temelli güçlük yorumunu sınırlar/i,
    ],
  },
  {
    key: "age-36-all-sometimes",
    title: "36 ay - tüm yanıtlar Bazen",
    group: "Yaş ve uç örüntüler",
    ageMonths: 36,
    domainScores: domainTargets(30),
    expectedMode: "widespread",
    description: "Tüm alanlarda orta sıklıkta güçlük ve beceri bildirimi.",
  },
  {
    key: "age-47-all-sometimes",
    title: "47 ay - tüm yanıtlar Bazen",
    group: "Yaş ve uç örüntüler",
    ageMonths: 47,
    domainScores: domainTargets(30),
    expectedMode: "widespread",
    description: "İkinci yaş bandı üst sınırında orta düzey yaygın örüntü.",
  },
  {
    key: "age-48-all-severe",
    title: "48 ay - bütün alanlarda belirgin güçlük",
    group: "Yaş ve uç örüntüler",
    ageMonths: 48,
    domainScores: domainTargets(10),
    expectedMode: "widespread",
    description: "Bütün alanlarda en yüksek güçlük ucu.",
  },
  {
    key: "age-59-all-severe",
    title: "59 ay - bütün alanlarda belirgin güçlük",
    group: "Yaş ve uç örüntüler",
    ageMonths: 59,
    domainScores: domainTargets(10),
    expectedMode: "widespread",
    description: "Üçüncü yaş bandı üst sınırında yaygın ağır örüntü.",
  },
  {
    key: "age-60-all-sometimes",
    title: "60 ay - tüm yanıtlar Bazen",
    group: "Yaş ve uç örüntüler",
    ageMonths: 60,
    domainScores: domainTargets(30),
    expectedMode: "widespread",
    description: "Dördüncü yaş bandı başlangıcında orta düzey yaygın örüntü.",
  },
  {
    key: "age-71-alternating-extremes",
    title: "71 ay - aynı toplamda dönüşümlü uç yanıtlar",
    group: "Yaş ve uç örüntüler",
    ageMonths: 71,
    domainScores: domainTargets(30),
    expectedMode: "widespread",
    answerPattern: "alternating",
    description: "Her alanda iyi ve güçlük uçları dönüşümlü; toplam skor orta düzeyde.",
  },

  ...(["fizyolojik", "duyusal", "duygusal", "bilissel", "yurutucu", "intero"] as QuestionScale[]).map(
    (scale, index): CaseSpec => ({
      key: `selective-severe-${scale}`,
      title: `${index + 1}. seçici belirgin alan - ${scale}`,
      group: "Seçici alan",
      ageMonths: 54,
      domainScores: targets({ [scale]: 10 }),
      expectedMode: "selective",
      description: `Yalnız ${scale} alanında belirgin güçlük; diğer alanlar korunmuş.`,
    })
  ),
  ...(["fizyolojik", "duyusal", "duygusal", "bilissel", "yurutucu", "intero"] as QuestionScale[]).map(
    (scale, index): CaseSpec => ({
      key: `selective-risk-${scale}`,
      title: `${index + 1}. seçici orta alan - ${scale}`,
      group: "Seçici alan",
      ageMonths: 54,
      domainScores: targets({ [scale]: 30 }),
      expectedMode: "selective",
      description: `Yalnız ${scale} alanında orta düzey zorlanma; diğer alanlar korunmuş.`,
    })
  ),

  {
    key: "paired-physio-intero-severe",
    title: "Fizyolojik + interoseptif belirgin güçlük",
    group: "İkili alan",
    ageMonths: 54,
    domainScores: targets({ fizyolojik: 10, intero: 10 }),
    expectedMode: "paired",
    description: "Bedensel toparlanma ve içsel sinyal farkındalığı birlikte zorlanıyor.",
  },
  {
    key: "paired-sensory-emotional-severe",
    title: "Duyusal + duygusal belirgin güçlük",
    group: "İkili alan",
    ageMonths: 54,
    domainScores: targets({ duyusal: 10, duygusal: 10 }),
    expectedMode: "paired",
    description: "Duyusal yüklenme ve duygusal toparlanma birlikte zorlanıyor.",
  },
  {
    key: "paired-cognitive-executive-severe",
    title: "Bilişsel + yürütücü belirgin güçlük",
    group: "İkili alan",
    ageMonths: 54,
    domainScores: targets({ bilissel: 10, yurutucu: 10 }),
    expectedMode: "paired",
    description: "Görevi anlama, planlama ve sürdürme aynı hatta zorlanıyor.",
  },
  {
    key: "paired-physio-sensory-atypical",
    title: "Fizyolojik + duyusal düşük profil",
    group: "İkili alan",
    ageMonths: 42,
    domainScores: targets({ fizyolojik: 20, duyusal: 20 }),
    expectedMode: "paired",
    description: "Uyaran yüküyle bedensel uyarılma birlikte artıyor.",
  },
  {
    key: "paired-emotional-executive-atypical",
    title: "Duygusal + yürütücü düşük profil",
    group: "İkili alan",
    ageMonths: 66,
    domainScores: targets({ duygusal: 20, yurutucu: 20 }),
    expectedMode: "paired",
    description: "Engellenme sonrası toparlanma ve görev kontrolü birlikte zorlanıyor.",
  },
  {
    key: "paired-sensory-cognitive-risk",
    title: "Duyusal + bilişsel risk örüntüsü",
    group: "İkili alan",
    ageMonths: 50,
    domainScores: targets({ duyusal: 30, bilissel: 30 }),
    expectedMode: "paired",
    description: "Yoğun uyaran altında dikkat ve görev çözümleme daralıyor.",
  },
  {
    key: "paired-executive-intero-risk",
    title: "Yürütücü + interoseptif risk örüntüsü",
    group: "İkili alan",
    ageMonths: 58,
    domainScores: targets({ yurutucu: 30, intero: 30 }),
    expectedMode: "paired",
    description: "Görev organizasyonu ve beden sinyallerini zamanında kullanma birlikte zorlanıyor.",
  },
  {
    key: "paired-emotional-cognitive-mixed",
    title: "Duygusal + bilişsel karma düşük profil",
    group: "İkili alan",
    ageMonths: 34,
    domainScores: targets({ duygusal: 25, bilissel: 25 }),
    expectedMode: "paired",
    description: "Yeni görev ve hayal kırıklığı aynı anda olduğunda katılım düşüyor.",
  },
  {
    key: "paired-physio-executive-mixed",
    title: "Fizyolojik + yürütücü karma düşük profil",
    group: "İkili alan",
    ageMonths: 46,
    domainScores: targets({ fizyolojik: 25, yurutucu: 25 }),
    expectedMode: "paired",
    description: "Yorgunluk ve stres arttığında görev sürdürme kapasitesi daralıyor.",
  },
  {
    key: "paired-sensory-intero-mixed",
    title: "Duyusal + interoseptif karma düşük profil",
    group: "İkili alan",
    ageMonths: 70,
    domainScores: targets({ duyusal: 25, intero: 25 }),
    expectedMode: "paired",
    description: "Dış uyaranlar ile içsel beden sinyallerini ayırt etme birlikte zorlanıyor.",
  },

  {
    key: "widespread-all-20",
    title: "Bütün alanlarda düşük profil",
    group: "Yaygın profil",
    ageMonths: 54,
    domainScores: domainTargets(20),
    expectedMode: "widespread",
    description: "Altı alanın tamamında belirgin ve yaygın zorlanma.",
  },
  {
    key: "widespread-five-domains-intero-preserved",
    title: "Beş alan düşük, interosepsiyon korunmuş",
    group: "Yaygın profil",
    ageMonths: 54,
    domainScores: targets({ fizyolojik: 20, duyusal: 20, duygusal: 20, bilissel: 20, yurutucu: 20 }),
    expectedMode: "widespread",
    description: "İçsel sinyal farkındalığı korunurken diğer alanlarda yaygın güçlük.",
  },
  {
    key: "widespread-exec-cognitive-emotional",
    title: "Yürütücü-bilişsel-duygusal ağır profil",
    group: "Yaygın profil",
    ageMonths: 54,
    domainScores: targets({ yurutucu: 15, bilissel: 15, duygusal: 15 }, 42),
    expectedMode: "widespread",
    description: "Görev talebi, çalışma belleği ve duygusal toparlanma üçlü eksende zorlanıyor.",
  },
  {
    key: "widespread-sensory-emotional-physio",
    title: "Duyusal-duygusal-fizyolojik ağır profil",
    group: "Yaygın profil",
    ageMonths: 40,
    domainScores: targets({ duyusal: 15, duygusal: 15, fizyolojik: 15 }, 42),
    expectedMode: "widespread",
    description: "Uyaran yükü bedensel uyarılma ve toparlanma süresini birlikte etkiliyor.",
  },
  {
    key: "widespread-body-plus-moderate-others",
    title: "Beden temelli ağır, diğer alanlar orta",
    group: "Yaygın profil",
    ageMonths: 62,
    domainScores: targets({ fizyolojik: 15, intero: 15 }, 30),
    expectedMode: "widespread",
    description: "Fizyolojik ve interoseptif eksen ağır; diğer alanlarda orta düzey zorlanma.",
  },
  {
    key: "widespread-near-atypical-boundary",
    title: "Yaş bandı eşiklerine yakın yaygın profil",
    group: "Yaygın profil",
    ageMonths: 60,
    domainScores: { fizyolojik: 24, duyusal: 23, duygusal: 23, bilissel: 24, yurutucu: 24, intero: 22 },
    expectedMode: "widespread",
    description: "Her alan kendi yaş bandındaki alt sınıra yakın.",
  },
  {
    key: "widespread-four-risk-domains",
    title: "Dört risk alanı, iki korunmuş alan",
    group: "Yaygın profil",
    ageMonths: 54,
    domainScores: targets({ duyusal: 30, duygusal: 30, bilissel: 30, yurutucu: 30 }),
    expectedMode: "widespread",
    description: "Duyusal, duygusal, bilişsel ve yürütücü alanlarda orta düzey yayılım.",
  },
  {
    key: "widespread-three-severe-domains",
    title: "Üç belirgin, üç korunmuş alan",
    group: "Yaygın profil",
    ageMonths: 54,
    domainScores: targets({ duyusal: 10, bilissel: 10, yurutucu: 10 }),
    expectedMode: "widespread",
    description: "Duyusal, bilişsel ve yürütücü alanlarda belirgin; diğerlerinde korunmuş örüntü.",
  },
  {
    key: "widespread-irregular-gradient",
    title: "Düzensiz şiddet basamakları",
    group: "Yaygın profil",
    ageMonths: 54,
    domainScores: { fizyolojik: 12, duyusal: 18, duygusal: 26, bilissel: 34, yurutucu: 42, intero: 48 },
    expectedMode: "widespread",
    description: "Şiddet fizyolojik alandan interosepsiyona doğru kademeli azalıyor.",
  },
  {
    key: "widespread-one-severe-two-risk",
    title: "Bir belirgin, iki risk alanı",
    group: "Yaygın profil",
    ageMonths: 54,
    domainScores: targets({ yurutucu: 10, bilissel: 30, duygusal: 30 }),
    expectedMode: "widespread",
    description: "Yürütücü alan ana güçlük; bilişsel ve duygusal alanlar ikincil riskte.",
  },

  {
    key: "context-sensory-aligned",
    title: "Ses duyarlılığı ile uyumlu anamnez",
    group: "Kanıt ve bağlam",
    ageMonths: 54,
    domainScores: targets({ duyusal: 18, duygusal: 30 }),
    expectedMode: "contextual",
    description: "Ani ses ve arka plan gürültüsünde görevden kopma bildiriliyor.",
    anamnez: {
      referral_reason: "Ani sesler ve arka plan gürültüsü olduğunda görevden kopuyor ve ortamdan uzaklaşıyor.",
      parent_concerns_goals: "Kalabalık sesli ortamlarda katılımın daha sürdürülebilir olması isteniyor.",
      therapist_comments: "Sessiz ortamda katılım korunuyor; ses yükü artınca toparlanma uzuyor.",
      strengths: "Öngörülebilir ve düşük uyaranlı ortamda görevi tamamlıyor.",
    },
    expectedTerms: [/ses ve arka plan gürültüsü|işitsel/i, /duyusal/i],
  },
  {
    key: "context-sensory-conflict",
    title: "Duyusal skor ile gözlem çelişkisi",
    group: "Kanıt ve bağlam",
    ageMonths: 54,
    domainScores: targets({ duyusal: 18 }),
    expectedMode: "contextual",
    expectsDirectConflict: true,
    description: "Skor düşükken aile ve terapist doğal ortamlarda duyusal zorlanma görmüyor.",
    anamnez: {
      referral_reason: "Ölçek sonucunun günlük performansla uyumlu olup olmadığı değerlendiriliyor.",
      parent_concerns_goals: "Aile ev ve kalabalık ortamlarda belirgin ses, ışık veya dokunma zorlanması gözlemlemiyor.",
      therapist_comments: "Doğal ve yapılandırılmış gözlemde uyaran toleransı korunmuş görünüyor.",
      strengths: "Farklı ortamlara uyum sağlıyor ve etkinliğe geri dönebiliyor.",
    },
    expectedTerms: [/ayrış|kaynaklar arası/i, /hedefli görev karşılaştırması|doğrulan/i],
    forbiddenTerms: [
      /kesin olarak duyusal/i,
      /Anamnezde çevresel veya dokunsal uyaranlara verilen yanıtta belirgin duyusal reaktivite/i,
      /Duyusal Regülasyon alanı bu anlatımla doğrudan uyum/i,
      /Birden fazla kaynak aynı işlevsel örüntüyü desteklemekte/i,
      /En güçlü klinik hipotez:\s*Görev ve bağlam talebi arttığında/i,
      /İşlevsel karşılık:\s*Zorlanmanın günlük işlevdeki başlıca karşılığı/i,
    ],
  },
  {
    key: "context-executive-support-response",
    title: "Görsel destekle toparlanan yürütücü profil",
    group: "Kanıt ve bağlam",
    ageMonths: 54,
    domainScores: targets({ yurutucu: 18, bilissel: 28 }),
    expectedMode: "contextual",
    description: "Çok basamaklı görevde zorlanma görsel program ve kısa yönergeyle azalıyor.",
    anamnez: {
      referral_reason: "Çok basamaklı görevlerde sırayı kaybediyor ve tamamlamadan ayrılıyor.",
      parent_concerns_goals: "Göreve daha bağımsız başlayıp tamamlaması hedefleniyor.",
      therapist_comments: "Görsel program, tek basamaklı yönerge ve öngörülebilir sıra ile performans belirgin toparlanıyor.",
      strengths: "Model sunulduğunda ve görev bölündüğünde hızla öğreniyor.",
    },
    expectedTerms: [/görsel/i, /yönerge|görev/i],
  },
  {
    key: "context-intero-selfcare",
    title: "İnterosepsiyon ve öz bakım bağlantısı",
    group: "Kanıt ve bağlam",
    ageMonths: 54,
    domainScores: targets({ intero: 16, fizyolojik: 28 }),
    expectedMode: "contextual",
    description: "Açlık, tuvalet ve yorgunluk sinyalleri geç fark ediliyor.",
    anamnez: {
      referral_reason: "Açlık, tuvalet ihtiyacı ve yorgunluk sinyallerini geç fark ettiği için günlük rutin aksıyor.",
      parent_concerns_goals: "Temel beden sinyallerini öz bakım akışında daha zamanında kullanması isteniyor.",
      therapist_comments: "Beden durumu sözelleştirildiğinde ihtiyacını ayırt etmesi kolaylaşıyor.",
      strengths: "Somut seçenek verildiğinde beden durumunu ifade edebiliyor.",
    },
    expectedTerms: [/bedensel ihtiyaç sinyalleri|içsel sinyal/i, /öz bakım|günlük/i],
  },
  {
    key: "context-language-external-test",
    title: "Dilsel yük ve PLS-5 kanıtı",
    group: "Kanıt ve bağlam",
    ageMonths: 54,
    domainScores: targets({ bilissel: 24, yurutucu: 28, duygusal: 30 }),
    expectedMode: "contextual",
    description: "Sözel yönerge karmaşıklığı arttığında performans düşüyor.",
    anamnez: {
      referral_reason: "Uzun sözel yönergelerde ne yapacağını anlamakta ve sırayı korumakta zorlanıyor.",
      parent_concerns_goals: "Sözel talep altında görevi daha bağımsız sürdürmesi hedefleniyor.",
      therapist_comments: "Kısa yönerge ve görsel modelle performans artıyor.",
      external_clinical_findings: "Test adı: PLS-5\nPuan / sonuç: Dil yaş eşdeğeri 42 ay; standart skor 78.\nKlinik yorum / resmi bulgu özeti: Alıcı dil ve çok basamaklı sözel işlemleme yaş beklentisinin altında.",
    },
    expectedTerms: [/PLS-5/i, /dilsel|sözel/i],
  },
  {
    key: "context-motor-external-test",
    title: "Motor planlama ve PDMS-3 kanıtı",
    group: "Kanıt ve bağlam",
    ageMonths: 54,
    domainScores: targets({ yurutucu: 24, bilissel: 28, duyusal: 30 }),
    expectedMode: "contextual",
    description: "Yeni hareket dizisini kurma ve giyinme adımlarında zorlanma.",
    anamnez: {
      referral_reason: "Yeni hareket dizilerini kurma, giyinme ve araç kullanımı adımlarında zorlanıyor.",
      parent_concerns_goals: "Günlük motor görevlerde daha bağımsız olması hedefleniyor.",
      therapist_comments: "Model ve fiziksel ipucu ile beden pozisyonunu daha iyi organize ediyor.",
      external_clinical_findings: "Test adı: PDMS-3\nPuan / sonuç: İnce motor kompozit standart skoru 76, percentil 5.\nKlinik yorum / resmi bulgu özeti: Motor koordinasyon ve hareket sıralama yaş beklentisinin altında.",
    },
    expectedTerms: [/PDMS-3/i, /motor planlama|beden organizasyonu/i],
  },
  {
    key: "context-age-mismatch-external",
    title: "Yaş uyumsuz dış test",
    group: "Kanıt ve bağlam",
    ageMonths: 42,
    domainScores: targets({ yurutucu: 29 }),
    expectedMode: "contextual",
    description: "Yaşa uygun BRIEF-P yanında daha büyük yaş grubuna ait test sonucu sunulmuş.",
    anamnez: {
      referral_reason: "Geçiş, bekleme ve uzun yönergelerde dağılma değerlendiriliyor.",
      therapist_comments: "Kısa görevlerde katılım korunuyor; uzun görevde ipucu gereksinimi artıyor.",
      external_clinical_findings: "Test adı: BRIEF2\nPuan / sonuç: Global Executive Composite yüksek.\nEk notlar: Test daha büyük yaş grubu için uygulanmış olabilir.\n\nTest adı: BRIEF-P\nPuan / sonuç: İnhibisyon T skoru 66.\nKlinik yorum / resmi bulgu özeti: Okul öncesi yürütücü işlev zorlanması için destekleyici veri.",
    },
    expectedTerms: [/ana klinik değerlendirmeyi desteklemez|ana klinik karar.*dahil edilme/i, /BRIEF-P/i],
  },
  {
    key: "context-heavy-anamnesis-preserved-scale",
    title: "Korunmuş ölçek, güçlü anamnez endişesi",
    group: "Kanıt ve bağlam",
    ageMonths: 56,
    domainScores: domainTargets(42),
    expectedMode: "contextual",
    description: "Ölçek korunmuşken aile evde belirgin geçiş ve öz bakım zorlanması bildiriyor.",
    anamnez: {
      referral_reason: "Evde geçişler, giyinme ve bekleme sırasında yoğun zorlanma bildiriliyor.",
      parent_concerns_goals: "Günlük rutinlerde yetişkin yardımının azalması hedefleniyor.",
      therapist_comments: "Yapılandırılmış bire bir ortamda performans ve toparlanma korunmuş.",
      strengths: "Görsel plan ve öngörülebilir sırada bağımsızlığı artıyor.",
    },
    expectedTerms: [/korunmuş skor örüntüsü|alan puanları korunmuş/i, /seçici|bağlama duyarlı/i],
    forbiddenTerms: [
      /belirgin bir sorun yoktur/i,
      /Skorlar, anamnez ve gözlem genel olarak korunmuş işleyişte yakınsamaktadır/i,
    ],
  },
  {
    key: "context-severe-sparse-evidence",
    title: "Belirgin skor, sınırlı bağlamsal veri",
    group: "Kanıt ve bağlam",
    ageMonths: 54,
    domainScores: domainTargets(15),
    expectedMode: "contextual",
    description: "Skorlar belirgin düşük; anamnez ve gözlem verisi çok sınırlı.",
    anamnez: {
      referral_reason: "Genel değerlendirme istenmiştir.",
      therapist_comments: "Kısa görüşme yapıldı.",
    },
    expectedTerms: [/sınırlı|genellenebilir|veri güven/i],
    forbiddenTerms: [/yüksek veri güveni|kesin olarak/i],
  },
  {
    key: "context-preserved-external-tests",
    title: "Korunmuş ölçek ve korunmuş dış testler",
    group: "Kanıt ve bağlam",
    ageMonths: 57,
    domainScores: domainTargets(42),
    expectedMode: "contextual",
    description: "DNA alanları ile Vineland-3 ve ABAS-3 sonuçları birlikte korunmuş.",
    anamnez: {
      referral_reason: "Kalabalık ortamlarda kısa süreli zorlanma dışında genel işlevsellik değerlendiriliyor.",
      therapist_comments: "Bire bir ve doğal etkinlikte iş birliği, dikkat ve rutin takip korunmuş.",
      external_clinical_findings: "Test adı: Vineland-3\nPuan / sonuç: Adaptive Behavior Composite standart skoru 101.\nKlinik yorum / resmi bulgu özeti: Genel uyumsal işlev yaş beklentisi içinde korunmuş.\n\nTest adı: ABAS-3\nPuan / sonuç: Genel uyumsal bileşik standart skoru 98.\nKlinik yorum / resmi bulgu özeti: Kavramsal, sosyal ve pratik alanlar ortalama.",
    },
    expectedTerms: [/Vineland-3/i, /ABAS-3/i, /korunmuş/i],
    forbiddenTerms: [
      /yüksek klinik yük|yaygın regülasyon yükü/i,
      /dış test veya doğal bağlamda bildirilen seçici güçlüğü/i,
    ],
  },
];

function assertCaseCount(): void {
  if (CASES.length !== 50) throw new Error(`50 vaka bekleniyordu; bulunan ${CASES.length}`);
  const keys = new Set(CASES.map((item) => item.key));
  if (keys.size !== CASES.length) throw new Error("50 vaka matrisinde yinelenen anahtar var");
}

function getSections(text: string): Map<string, string> {
  return new Map(splitClinicalReportSections(text).map((section) => [section.heading, section.body]));
}

function sectionByPrefix(sections: Map<string, string>, prefix: string): string {
  for (const [heading, body] of sections) {
    if (heading.startsWith(prefix)) return body;
  }
  return "";
}

function expectedAssessmentScore(result: ReturnType<typeof calculateAssessment>, scale: QuestionScale): number {
  return result[RESULT_FIELD_BY_SCALE[scale]];
}

function hash(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function addIssue(
  issues: AuditIssue[],
  dimension: AuditDimension,
  severity: AuditIssue["severity"],
  code: string,
  message: string
): void {
  issues.push({ dimension, severity, code, message });
}

function dimensionScore(dimension: AuditDimension, max: number, issues: AuditIssue[]): number {
  const relevant = issues.filter((issue) => issue.dimension === dimension);
  const penalty = relevant.reduce(
    (sum, issue) => sum + (issue.severity === "high" ? max : issue.severity === "medium" ? Math.ceil(max * 0.45) : Math.ceil(max * 0.18)),
    0
  );
  return Math.max(0, max - penalty);
}

function caseSpecificStrengths(
  spec: CaseSpec,
  domainResults: Array<{ label: string; score: number; level: string }>
): string[] {
  const nonTypical = domainResults.filter((domain) => domain.level !== "Tipik");
  const labels = nonTypical.map((domain) => domain.label);

  const contextualStrengths: Record<string, string> = {
    "context-sensory-aligned": "Duyusal puan, gürültüde zorlanma ve düşük uyaranlı ortamda toparlanma aynı işlevsel örüntü içinde birleştirildi.",
    "context-sensory-conflict": "Duyusal skor ile korunmuş doğal gözlem arasındaki gerçek çelişki açıkça gösterildi; işlevsel etki doğrulanmış gibi sunulmadı.",
    "context-executive-support-response": "Görsel destekle iyileşme doğrudan çelişki sayılmadı; yürütücü güçlüğün hangi koşulda azaldığını belirleyen sınır olarak kullanıldı.",
    "context-intero-selfcare": "İçsel beden sinyali güçlüğü öz bakım ve günlük rutin üzerindeki somut işlevsel karşılığıyla ilişkilendirildi.",
    "context-language-external-test": "PLS-5 bulgusu sözel yük mekanizmasına bağlandı; dış test adı ve işlevsel anlamı görünür kaldı.",
    "context-motor-external-test": "PDMS-3 bulgusu motor planlama ve beden organizasyonu odağını destekledi; genel kapasite hükmüne genişletilmedi.",
    "context-age-mismatch-external": "Yaşla uyumsuz dış test ana karardan çıkarılırken yaşa uygun BRIEF-P bulgusu kanıt olarak korundu.",
    "context-heavy-anamnesis-preserved-scale": "Korunmuş ölçek zemini ile evde bildirilen belirgin işlevsel güçlük ayrı düzeylerde tutuldu; sorun ne yok sayıldı ne yaygınlaştırıldı.",
    "context-severe-sparse-evidence": "Ağır skor örüntüsü hafifletilmedi; bağlamsal veri azlığı nedeniyle güven ve genellenebilirlik açıkça sınırlandı.",
    "context-preserved-external-tests": "Korunmuş DNA, Vineland-3 ve ABAS-3 sonuçları aynı genel profile yerleştirildi; kalabalıktaki kısa hassasiyet ayrıca izlendi.",
  };
  if (contextualStrengths[spec.key]) return [contextualStrengths[spec.key]];

  if (spec.key === "age-71-alternating-extremes") {
    return ["Aynı alan toplamını üreten dönüşümlü uç yanıtlar doğru yönde hesaplandı; istemci skoruna güvenmeden ham 60 yanıt kullanıldı."];
  }
  if (spec.expectedMode === "balanced") {
    return ["Korunmuş alan dağılımı risk diliyle büyütülmedi; genel işleyiş korunmuş profil sınırında tutuldu."];
  }
  if (spec.expectedMode === "selective") {
    return [`${labels[0] || "Tek risk alanı"} seçici klinik odak olarak ayrıldı; diğer alanlar korunmuş bırakıldı.`];
  }
  if (spec.expectedMode === "paired") {
    return [`${labels.slice(0, 2).join(" ve ")} birlikte görünür kaldı; eşit şiddetteki alanlardan biri kanıtsız biçimde ana neden ilan edilmedi.`];
  }
  if (spec.expectedMode === "widespread") {
    return [`${nonTypical.length} alana yayılan örüntü hafifletilmedi; profil kapsamı ve sonuç şiddeti puan dağılımıyla uyumlu kaldı.`];
  }
  return ["Vaka bağlamı, skor örüntüsü ve kanıt sınırları aynı klinik kararda tutarlı biçimde birleştirildi."];
}

function defaultStrengths(
  spec: CaseSpec,
  domainResults: Array<{ label: string; score: number; level: string }>,
  issues: AuditIssue[],
  languageScore: number
): string[] {
  const strengths: string[] = [];
  strengths.push(...caseSpecificStrengths(spec, domainResults));
  if (!issues.some((issue) => issue.dimension === "direction" || issue.dimension === "technical")) {
    strengths.push("Ham yanıt, ters/doğrudan puan ve alan toplamları eksiksiz eşleşti.");
  }
  if (!issues.some((issue) => issue.dimension === "calibration")) {
    strengths.push("Sonuç şiddeti ve profil kapsamı vaka dağılımıyla dengeli kaldı.");
  }
  if (!issues.some((issue) => issue.dimension === "decision")) {
    strengths.push("Klinik karar özeti ana ekseni ve veri güvenini görünür biçimde taşıdı.");
  }
  if (!issues.some((issue) => issue.dimension === "specificity")) {
    strengths.push("Vaka bağlamı ve öncelikli alanlar raporda hedefli biçimde karşılık buldu.");
  }
  if (!issues.some((issue) => issue.dimension === "professionalism")) {
    strengths.push("Tanısal kesinlik, teknik jargon ve yönlendirici tedavi dili sızmadı.");
  }
  if (languageScore >= 95) strengths.push(`Dil akıcılığı güçlü bulundu (${languageScore}/100).`);
  return strengths;
}

async function runCase(spec: CaseSpec, index: number) {
  const answers = buildAnswers(spec.domainScores, spec.answerPattern || "even");
  const payload: FixturePayload = {
    clientCode: `QA50-${String(index + 1).padStart(2, "0")}`,
    clientName: `Sentetik Vaka ${String(index + 1).padStart(2, "0")}`,
    ageMonths: spec.ageMonths,
    anamnez: spec.anamnez || baseAnamnez(spec.description, spec.expectedMode),
    answers,
    scores: buildTamperedScores(spec.domainScores),
  };
  const fixturePath = path.join(GENERATED_FIXTURE_DIR, `${String(index + 1).padStart(2, "0")}-${spec.key}.json`);
  await fs.writeFile(fixturePath, JSON.stringify(payload, null, 2), "utf8");

  const first = await runSingleFixture(fixturePath, true);
  const second = await runSingleFixture(fixturePath, true);
  const expected = calculateAssessment(answers);
  const expectedGlobalLevel = classifyTotalScore(expected.toplam, { ageMonths: spec.ageMonths });
  const issues: AuditIssue[] = [];
  const resultDomainMap = new Map(first.domainResults.map((domain) => [domain.key, domain]));
  const nonTypicalScales = (Object.keys(spec.domainScores) as QuestionScale[]).filter((scale) => {
    return resultDomainMap.get(REPORT_KEY_BY_SCALE[scale])?.level !== "Tipik";
  });
  const sections = getSections(first.finalText);
  const decisionText = sectionByPrefix(sections, "1.");
  const patternText = sectionByPrefix(sections, "4.");
  const priorityText = sectionByPrefix(sections, "6.");
  const conclusionText = sectionByPrefix(sections, "7.");
  const decisionCore = [first.profileType, decisionText, patternText, priorityText, conclusionText].join("\n");
  const language = analyzeReportLanguageQuality(first.finalText);

  if (first.totalScore !== expected.toplam) {
    addIssue(issues, "direction", "high", "total_mismatch", `Beklenen toplam ${expected.toplam}, rapor toplamı ${first.totalScore}.`);
  }
  if (first.globalLevel !== expectedGlobalLevel) {
    addIssue(issues, "direction", "high", "global_level_mismatch", `Beklenen genel düzey ${expectedGlobalLevel}, raporda ${first.globalLevel}.`);
  }
  for (const scale of Object.keys(spec.domainScores) as QuestionScale[]) {
    const expectedScore = expectedAssessmentScore(expected, scale);
    const domain = resultDomainMap.get(REPORT_KEY_BY_SCALE[scale]);
    if (!domain || domain.score !== expectedScore || expectedScore !== spec.domainScores[scale]) {
      addIssue(
        issues,
        "direction",
        "high",
        `domain_mismatch_${scale}`,
        `${scale} için hedef ${spec.domainScores[scale]}, hesap ${expectedScore}, rapor ${domain?.score ?? "yok"}.`
      );
    }
  }

  if (hash(first.finalText) !== hash(second.finalText) || first.profileType !== second.profileType) {
    addIssue(issues, "technical", "high", "nondeterministic_output", "Aynı vaka iki çalıştırmada farklı çıktı üretti.");
  }
  if (first.narrativeGuardViolations.length > 0) {
    addIssue(
      issues,
      "technical",
      "high",
      "narrative_guard_violation",
      `${first.narrativeGuardViolations.length} narrative guard ihlali oluştu.`
    );
  }
  const missingHeadings = CANONICAL_REPORT_HEADINGS.filter((heading) => !sections.has(heading));
  if (missingHeadings.length > 0) {
    addIssue(issues, "technical", "high", "missing_sections", `Eksik rapor bölümleri: ${missingHeadings.join(", ")}`);
  }

  const decisionHasAnchor = /(öncelikli klinik hipotez|en güçlü klinik hipotez|ana klinik eksen|ana klinik yorum|bu vaka|bu vakada|mevcut veriler)/i.test(
    decisionText
  );
  if (!decisionHasAnchor) {
    addIssue(issues, "decision", "medium", "weak_decision_anchor", "Klinik karar özeti ana hipotezi doğrudan adlandırmıyor.");
  }
  if (!/(veri güven|kanıt güven|kanıt düzeyi)/i.test(priorityText)) {
    addIssue(issues, "decision", "medium", "confidence_not_visible", "Önceliklendirme bölümünde veri güveni görünür değil.");
  }
  if (decisionText.length < 100 || conclusionText.length < 70) {
    addIssue(issues, "decision", "low", "decision_too_brief", "Karar veya sonuç bölümü klinik gerekçeyi taşımak için fazla kısa.");
  }

  const overstatementText = `${decisionText}\n${conclusionText}`;
  if (nonTypicalScales.length === 0) {
    if (!/dengeli|korunmuş/i.test(first.profileType)) {
      addIssue(issues, "calibration", "high", "balanced_profile_overcalled", "Korunmuş dağılım dengeli/korunmuş profil olarak adlandırılmadı.");
    }
    if (/yaygın çok alanlı|yüksek klinik yük|belirgin regülasyon güçlüğü/i.test(overstatementText)) {
      addIssue(issues, "calibration", "high", "balanced_case_overstated", "Korunmuş vaka gereğinden ağır dille yorumlandı.");
    }
  } else if (nonTypicalScales.length === 1 && spec.expectedMode !== "contextual") {
    const target = nonTypicalScales[0];
    if (!/seçici/i.test(first.profileType) || !DOMAIN_TERM_BY_SCALE[target].test(decisionCore)) {
      addIssue(issues, "calibration", "medium", "selective_focus_blurred", `Tekil ${target} riski seçici ve alan özgü adlandırılmadı.`);
    }
    if (/yaygın çok alanlı|genellenmiş kapasite/i.test(overstatementText)) {
      addIssue(issues, "calibration", "high", "selective_case_overstated", "Seçici vaka yaygın güçlük gibi büyütüldü.");
    }
  } else if (nonTypicalScales.length === 2 && spec.expectedMode !== "contextual") {
    const mentioned = nonTypicalScales.filter((scale) => DOMAIN_TERM_BY_SCALE[scale].test(decisionCore));
    if (mentioned.length < 2) {
      addIssue(issues, "calibration", "medium", "paired_axis_incomplete", "İkili risk örüntüsünün iki alanı da karar ekseninde görünmüyor.");
    }
    const profileMentions = nonTypicalScales.filter((scale) => DOMAIN_TERM_BY_SCALE[scale].test(first.profileType));
    if (profileMentions.length < 2) {
      addIssue(issues, "specificity", "medium", "paired_profile_incomplete", "İkili risk örüntüsünün iki alanı da profil adında görünmüyor.");
    }
    if (/dengeli \/ korunmuş/i.test(first.profileType)) {
      addIssue(issues, "calibration", "high", "paired_case_minimized", "İkili risk örüntüsü korunmuş profil olarak hafifletildi.");
    }
  } else if (nonTypicalScales.length >= 3) {
    if (/dengeli \/ korunmuş|seçici.*regülasyon/i.test(first.profileType)) {
      addIssue(issues, "calibration", "high", "widespread_case_minimized", "Yaygın örüntü seçici veya korunmuş profil olarak hafifletildi.");
    }
    const profileDomainMentions = nonTypicalScales.filter((scale) => DOMAIN_TERM_BY_SCALE[scale].test(first.profileType));
    if (!/yaygın|çok alanlı|öncelikli|belirgin/i.test(first.profileType) && profileDomainMentions.length < 3) {
      addIssue(issues, "calibration", "medium", "widespread_scope_unclear", "Yaygın örüntünün kapsamı profil adında yeterince görünür değil.");
    }
  }
  if (first.globalLevel === "Atipik" && /hafif|küçük bir zorlanma/i.test(overstatementText)) {
    addIssue(issues, "calibration", "high", "atypical_case_minimized", "Atipik genel sonuç gereğinden hafif ifade edildi.");
  }
  if (nonTypicalScales.length >= 2) {
    const lowestNonTypicalScore = Math.min(
      ...first.domainResults.filter((domain) => domain.level !== "Tipik").map((domain) => domain.score)
    );
    const equallyLowestDomains = first.domainResults.filter(
      (domain) => domain.level !== "Tipik" && domain.score - lowestNonTypicalScore <= 1
    );
    if (equallyLowestDomains.length >= 2 && /Bu alan birincil güçlük alanıdır/i.test(first.finalText)) {
      addIssue(
        issues,
        "calibration",
        "high",
        "equal_axes_artificially_ranked",
        "Eşit şiddetteki risk alanlarından biri kanıtsız biçimde birincil ilan edildi."
      );
    }
  }

  if (language.classification === "problem" || language.issues.some((issue) => issue.severity === "high")) {
    addIssue(issues, "language", "high", "language_problem", `Dil QA skoru ${language.score}/100; yüksek önem düzeyinde sorun var.`);
  } else if (language.classification === "needs_review") {
    addIssue(issues, "language", "medium", "language_needs_review", `Dil QA skoru ${language.score}/100; gözden geçirme gerekiyor.`);
  }
  if (language.metrics.longSentenceCount > 0) {
    addIssue(
      issues,
      "language",
      "low",
      "long_sentences",
      `${language.metrics.longSentenceCount} cümle 42 kelimeyi aşıyor.`
    );
  }
  if (language.metrics.averageSentenceWords > 27) {
    addIssue(
      issues,
      "language",
      "low",
      "dense_sentences",
      `Ortalama cümle uzunluğu ${language.metrics.averageSentenceWords} kelime.`
    );
  }

  for (const pattern of spec.expectedTerms || []) {
    if (!pattern.test(first.finalText)) {
      addIssue(issues, "specificity", "medium", "expected_context_missing", `Beklenen bağlam raporda görünmedi: ${pattern}`);
    }
  }
  for (const pattern of spec.forbiddenTerms || []) {
    if (pattern.test(first.finalText)) {
      addIssue(issues, "calibration", "high", "forbidden_case_claim", `Vaka için sakıncalı ifade üretildi: ${pattern}`);
    }
  }
  const directConflictNarrative = /Alan puanı bir güçlük olasılığına işaret ederken|günlük işlevsel karşılığını doğrulamamaktadır/i;
  if (spec.expectsDirectConflict && !directConflictNarrative.test(first.finalText)) {
    addIssue(issues, "calibration", "high", "direct_conflict_missing", "Açık kaynak çelişkisi karar diline yansımadı.");
  }
  if (!spec.expectsDirectConflict && directConflictNarrative.test(first.finalText)) {
    addIssue(issues, "calibration", "high", "false_direct_conflict", "Destekle toparlanma veya genel güçlü yön, doğrudan kaynak çelişkisi gibi yorumlandı.");
  }
  if (nonTypicalScales.length > 0) {
    const concernMentions = nonTypicalScales.filter((scale) => DOMAIN_TERM_BY_SCALE[scale].test(decisionCore));
    const requiredCount = Math.min(nonTypicalScales.length, nonTypicalScales.length >= 3 ? 2 : nonTypicalScales.length);
    if (concernMentions.length < requiredCount) {
      addIssue(issues, "specificity", "medium", "priority_domain_missing", "Öncelikli alanlar karar/formülasyon metninde yeterince görünür değil.");
    }
  }

  for (const [code, pattern] of PROFESSIONALISM_FORBIDDEN) {
    if (pattern.test(first.finalText)) {
      addIssue(issues, "professionalism", "high", code, `Profesyonel rapora uygun olmayan ifade bulundu: ${pattern}`);
    }
  }
  if (!/tek başına tanı koymaz/i.test(first.finalText)) {
    addIssue(issues, "professionalism", "high", "diagnostic_boundary_missing", "Tanısal sınır cümlesi görünmüyor.");
  }

  const scores = {
    technical: dimensionScore("technical", 20, issues),
    direction: dimensionScore("direction", 20, issues),
    calibration: dimensionScore("calibration", 15, issues),
    language: dimensionScore("language", 15, issues),
    decision: dimensionScore("decision", 15, issues),
    specificity: dimensionScore("specificity", 10, issues),
    professionalism: dimensionScore("professionalism", 5, issues),
  };
  const totalAuditScore = Object.values(scores).reduce((sum, score) => sum + score, 0);
  const hasHighIssue = issues.some((issue) => issue.severity === "high");
  const status = totalAuditScore >= 92 && !hasHighIssue ? "Güçlü" : totalAuditScore >= 82 && !hasHighIssue ? "Kabul edilebilir" : "Geliştirilmeli";

  return {
    caseNo: index + 1,
    key: spec.key,
    title: spec.title,
    group: spec.group,
    description: spec.description,
    ageMonths: spec.ageMonths,
    totalScore: first.totalScore,
    globalLevel: first.globalLevel,
    profileType: first.profileType,
    domainResults: first.domainResults.map((domain) => ({
      key: domain.key,
      label: domain.label,
      score: domain.score,
      level: domain.level,
    })),
    nonTypicalScales,
    languageScore: language.score,
    languageMetrics: language.metrics,
    totalAuditScore,
    status,
    scores,
    strengths: defaultStrengths(spec, first.domainResults, issues, language.score),
    improvements: issues.map((issue) => `${issue.message} [${issue.code}]`),
    issues,
    outputDir: first.outputDir,
  };
}

function escapeTable(value: unknown): string {
  return String(value ?? "").replace(/\|/g, "\\|").replace(/\s+/g, " ").trim();
}

function mean(values: number[]): number {
  if (!values.length) return 0;
  return Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 10) / 10;
}

function buildMarkdown(results: Awaited<ReturnType<typeof runCase>>[], robustnessChecks: string[]): string {
  const strong = results.filter((result) => result.status === "Güçlü").length;
  const acceptable = results.filter((result) => result.status === "Kabul edilebilir").length;
  const needsWork = results.filter((result) => result.status === "Geliştirilmeli").length;
  const highIssues = results.flatMap((result) => result.issues).filter((issue) => issue.severity === "high");
  const issueCounts = results
    .flatMap((result) => result.issues)
    .reduce<Record<string, number>>((acc, issue) => {
      acc[issue.code] = (acc[issue.code] || 0) + 1;
      return acc;
    }, {});
  const groupLines = Array.from(new Set(results.map((result) => result.group))).map((group) => {
    const rows = results.filter((result) => result.group === group);
    return `- ${group}: ${rows.length} vaka, ortalama ${mean(rows.map((row) => row.totalAuditScore))}/100, geliştirilmeli ${rows.filter((row) => row.status === "Geliştirilmeli").length}`;
  });

  const lines = [
    "# DNA Intelligence 50 Vaka Kapsamlı Klinik Rapor Denetimi",
    "",
    "Tarih: 13.07.2026",
    "",
    "Bu matris sentetik vakalarla puan yönü, teknik bütünlük, klinik kalibrasyon, anlaşılırlık, karar gücü, vaka özgüllüğü ve profesyonel dil kalitesini birlikte değerlendirir. Klinik geçerlik çalışmasının veya uzmanlar arası gerçek vaka uzlaşmasının yerine geçmez.",
    "",
    "## Genel Sonuç",
    "",
    `- Toplam vaka: ${results.length}`,
    `- Ortalama denetim puanı: ${mean(results.map((result) => result.totalAuditScore))}/100`,
    `- Güçlü: ${strong}`,
    `- Kabul edilebilir: ${acceptable}`,
    `- Geliştirilmeli: ${needsWork}`,
    `- Yüksek önem düzeyinde bulgu: ${highIssues.length}`,
    `- Ortalama dil puanı: ${mean(results.map((result) => result.languageScore))}/100`,
    "",
    "## Teknik Dayanıklılık",
    "",
    ...robustnessChecks.map((item) => `- ${item}`),
    "",
    "## Grup Özeti",
    "",
    ...groupLines,
    "",
    "## Denetim Sırasında Yakalanıp Düzeltilen Konular",
    "",
    ...CORRECTED_FINDINGS.map((item) => `- ${item}`),
    "",
    "## Geliştirme Sinyalleri",
    "",
    ...(Object.keys(issueCounts).length
      ? Object.entries(issueCounts)
          .sort((a, b) => b[1] - a[1])
          .map(([code, count]) => `- ${code}: ${count} vaka`)
      : ["- Otomatik denetimde geliştirme sinyali bulunmadı."]),
    "",
    "## Bilimsel ve Klinik İzlem Gerektiren Konular",
    "",
    "- Bu çalışma yazılımın kendi puanlama ve raporlama kuralları içindeki tutarlılığı sınar; duyarlılık, özgüllük, klinik kesme noktası veya tanısal geçerlik kanıtı üretmez.",
    "- Toplam puan Tipik düzeyde kalırken tek bir alanda belirgin güçlük görülebilir. Rapor seçici alanı görünür tutuyor; ancak toplam sınıflama ile alan düzeyi kararın gerçek vaka verisi ve uzman uzlaşmasıyla ayrıca izlenmesi gerekir.",
    "- Sentetik vakaların beklenen sonuçları mevcut karar kurallarından bağımsız bir norm örneklemi değildir. Bu nedenle 100/100 sonucu dış bilimsel doğrulamayı değil, tanımlı yazılım sözleşmesinin eksiksiz çalışmasını gösterir.",
    "- Çelişkili anamnez, doğal gözlem ve dış test kombinasyonlarında nihai klinik anlamın uzman incelemesiyle doğrulanması gerekir; otomatik sistem kanıt yönünü ve belirsizliği düzenler, klinisyenin karar sorumluluğunu devralmaz.",
    "",
    "## 50 Vaka Kısa Tablo",
    "",
    "| # | Vaka | Yaş | Sonuç | Profil | QA | Durum | İyi çıkan | Geliştirilecek |",
    "|---:|---|---:|---|---|---:|---|---|---|",
    ...results.map((result) =>
      [
        `| ${result.caseNo}`,
        escapeTable(result.title),
        result.ageMonths,
        `${result.totalScore}/300 ${result.globalLevel}`,
        escapeTable(result.profileType),
        `${result.totalAuditScore}/100`,
        result.status,
        escapeTable(result.strengths.slice(0, 2).join(" ") || "Belirgin güçlü sinyal yok."),
        escapeTable(result.improvements.slice(0, 2).join(" ") || "Belirgin sorun bulunmadı."),
      ].join(" | ") + " |"
    ),
    "",
    "## Vaka Bazlı Ayrıntılar",
    "",
  ];

  for (const result of results) {
    lines.push(
      `### ${result.caseNo}. ${result.title}`,
      "",
      `- Senaryo: ${result.description}`,
      `- Sonuç: ${result.totalScore}/300, ${result.globalLevel}; profil: ${result.profileType}`,
      `- Alanlar: ${result.domainResults.map((domain) => `${domain.label} ${domain.score}/50 ${domain.level}`).join("; ")}`,
      `- Denetim: ${result.totalAuditScore}/100 (${result.status}); dil ${result.languageScore}/100`,
      `- İyi çıkanlar: ${result.strengths.join(" ") || "Belirgin güçlü sinyal kaydedilmedi."}`,
      `- Geliştirilecekler: ${result.improvements.join(" ") || "Belirgin sorun bulunmadı."}`,
      `- Rapor klasörü: ${result.outputDir}`,
      ""
    );
  }

  return lines.join("\n");
}

function runInputRobustnessChecks(): string[] {
  const expectedIds = Array.from({ length: 60 }, (_, index) => index + 1);
  const actualIds = questions.map((question) => question.id);
  if (JSON.stringify(actualIds) !== JSON.stringify(expectedIds)) {
    throw new Error("Madde kimlikleri 1-60 arasında kesintisiz değil.");
  }

  const scaleCounts = questions.reduce<Record<QuestionScale, number>>(
    (counts, question) => ({ ...counts, [question.scale]: counts[question.scale] + 1 }),
    { fizyolojik: 0, duyusal: 0, duygusal: 0, bilissel: 0, yurutucu: 0, intero: 0 }
  );
  if (Object.values(scaleCounts).some((count) => count !== 10)) {
    throw new Error(`Her alanda 10 madde bulunmalı: ${JSON.stringify(scaleCounts)}`);
  }

  if (!questions.slice(0, 50).every((question) => question.scoringDirection === "reverse")) {
    throw new Error("1-50. maddelerin tamamı ters puanlı olmalı.");
  }
  if (!questions.slice(50).every((question) => question.scoringDirection === "direct")) {
    throw new Error("51-60. maddelerin tamamı doğrudan puanlı olmalı.");
  }

  const favorableByIndependentIdRule = expectedIds.map((id) => (id <= 50 ? 1 : 5));
  const adverseByIndependentIdRule = expectedIds.map((id) => (id <= 50 ? 5 : 1));
  const neutralAnswers = expectedIds.map(() => 3);
  const favorableResult = calculateAssessment(favorableByIndependentIdRule);
  const neutralResult = calculateAssessment(neutralAnswers);
  const adverseResult = calculateAssessment(adverseByIndependentIdRule);
  if (favorableResult.toplam !== 300 || neutralResult.toplam !== 180 || adverseResult.toplam !== 60) {
    throw new Error(
      `Puan yönü uç değer testi başarısız: olumlu=${favorableResult.toplam}, nötr=${neutralResult.toplam}, güçlük=${adverseResult.toplam}`
    );
  }

  const checks: Array<[string, () => unknown]> = [
    ["59 yanıt reddedildi", () => validateRawAnswers(Array(59).fill(3))],
    ["61 yanıt reddedildi", () => validateRawAnswers(Array(61).fill(3))],
    ["0 değeri reddedildi", () => validateRawAnswers([...Array(59).fill(3), 0])],
    ["6 değeri reddedildi", () => validateRawAnswers([...Array(59).fill(3), 6])],
    ["ondalıklı değer reddedildi", () => validateRawAnswers([...Array(59).fill(3), 2.5])],
    ["metin yanıt reddedildi", () => validateRawAnswers([...Array(59).fill(3), "Bazen"])],
  ];
  return [
    "PASS: 60 madde 1-60 arasında kesintisiz ve her alanda 10 madde var.",
    "PASS: 1-50 ters, 51-60 doğrudan puanlama yönünde tanımlı.",
    "PASS: Bağımsız ham yanıt kuralı olumlu=300, nötr=180, güçlük=60 sonuçlarını üretti.",
    ...checks.map(([label, run]) => {
    let rejected = false;
    try {
      run();
    } catch {
      rejected = true;
    }
    if (!rejected) throw new Error(`Teknik dayanıklılık testi başarısız: ${label}`);
    return `PASS: ${label}.`;
    }),
  ];
}

async function run(): Promise<void> {
  assertCaseCount();
  await fs.rm(OUTPUT_ROOT, { recursive: true, force: true });
  await fs.mkdir(GENERATED_FIXTURE_DIR, { recursive: true });

  const robustnessChecks = runInputRobustnessChecks();
  const results = [];
  for (let index = 0; index < CASES.length; index += 1) {
    results.push(await runCase(CASES[index], index));
  }

  const markdown = buildMarkdown(results, robustnessChecks);
  await fs.writeFile(SUMMARY_PATH, markdown, "utf8");
  await fs.writeFile(
    JSON_PATH,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        caseCount: results.length,
        averageAuditScore: mean(results.map((result) => result.totalAuditScore)),
        averageLanguageScore: mean(results.map((result) => result.languageScore)),
        results,
      },
      null,
      2
    ),
    "utf8"
  );

  const strong = results.filter((result) => result.status === "Güçlü").length;
  const acceptable = results.filter((result) => result.status === "Kabul edilebilir").length;
  const needsWork = results.filter((result) => result.status === "Geliştirilmeli").length;
  const highIssues = results.flatMap((result) => result.issues).filter((issue) => issue.severity === "high");

  console.log("=== DNA 50 VAKA KAPSAMLI RAPOR DENETIMI ===");
  console.log(`Vaka: ${results.length}`);
  console.log(`Ortalama QA: ${mean(results.map((result) => result.totalAuditScore))}/100`);
  console.log(`Ortalama dil: ${mean(results.map((result) => result.languageScore))}/100`);
  console.log(`Guclu: ${strong} | Kabul edilebilir: ${acceptable} | Gelistirilmeli: ${needsWork}`);
  console.log(`Yuksek onemli bulgu: ${highIssues.length}`);
  console.log(`Ozet: ${SUMMARY_PATH}`);
  console.log(`JSON: ${JSON_PATH}`);

  if (process.argv.includes("--strict") && (highIssues.length > 0 || needsWork > 0)) {
    process.exitCode = 1;
  }
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
