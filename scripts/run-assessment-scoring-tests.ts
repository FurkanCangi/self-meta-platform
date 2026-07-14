import { calculateAssessment } from "../src/lib/assessment/assessmentEngine";
import {
  getConcernSeverity,
  scoreRawAnswer,
  validateRawAnswers,
} from "../src/lib/assessment/itemScoring";
import { classifyDomainScore, classifyTotalScore } from "../src/lib/dna/normativeBands";
import { analyzeItemLevelSignals } from "../src/lib/dna/itemSignals";
import { questions } from "../src/lib/dna/questions";
import { buildAdvancedReport } from "../src/lib/dna/reportEngine";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function assertThrows(run: () => unknown, message: string) {
  let threw = false;
  try {
    run();
  } catch {
    threw = true;
  }
  assert(threw, message);
}

function assertDomainScores(
  result: ReturnType<typeof calculateAssessment>,
  expected: number,
  label: string
) {
  const scores = [
    result.fizyolojik,
    result.duyusal,
    result.duygusal,
    result.bilissel,
    result.yurutucu,
    result.intero,
  ];
  assert(
    scores.every((score) => score === expected),
    `${label}: tüm alan skorları ${expected} olmalıdır; bulunan ${scores.join(", ")}`
  );
}

const favorableAnswers = [...Array(50).fill(1), ...Array(10).fill(5)];
const adverseAnswers = [...Array(50).fill(5), ...Array(10).fill(1)];
const sometimesAnswers = Array(60).fill(3);
const resultFieldByScale = {
  fizyolojik: "fizyolojik",
  duyusal: "duyusal",
  duygusal: "duygusal",
  bilissel: "bilissel",
  yurutucu: "yurutucu",
  intero: "intero",
} as const;
const resultFields = Object.values(resultFieldByScale);

assert(
  questions.slice(0, 50).every((question) => question.scoringDirection === "reverse"),
  "İlk 50 güçlük maddesinin tamamı ters puan olarak işaretlenmelidir"
);
assert(
  questions.slice(50).every((question) => question.scoringDirection === "direct"),
  "Son 10 beceri maddesinin tamamı doğrudan puan olarak işaretlenmelidir"
);

for (const question of questions) {
  const favorableRaw = question.scoringDirection === "reverse" ? 1 : 5;
  const adverseRaw = question.scoringDirection === "reverse" ? 5 : 1;
  const targetField = resultFieldByScale[question.scale];
  const answers = [...favorableAnswers];
  answers[question.id - 1] = adverseRaw;
  const result = calculateAssessment(answers);

  assert(
    scoreRawAnswer(question.id, favorableRaw) === 5,
    `${question.id}. madde olumlu uçta 5 puan üretmelidir: ${question.text}`
  );
  assert(
    scoreRawAnswer(question.id, adverseRaw) === 1,
    `${question.id}. madde güçlük ucunda 1 puan üretmelidir: ${question.text}`
  );
  assert(
    getConcernSeverity(question.id, favorableRaw) === 1 &&
      getConcernSeverity(question.id, adverseRaw) === 5,
    `${question.id}. maddenin klinik güçlük yönü puan yönünün tersi olmalıdır: ${question.text}`
  );
  assert(
    result[targetField] === 46,
    `${question.id}. madde yalnız ${question.scale} alanını dört puan düşürmelidir: ${question.text}`
  );
  assert(
    resultFields
      .filter((field) => field !== targetField)
      .every((field) => result[field] === 50),
    `${question.id}. madde başka bir alanın skorunu değiştirmemelidir: ${question.text}`
  );
  assert(
    result.toplam === 296,
    `${question.id}. maddenin tek başına güçlük ucuna geçmesi toplamı dört puan düşürmelidir`
  );
}

const reportDomainKeyByScale = {
  fizyolojik: "physiological",
  duyusal: "sensory",
  duygusal: "emotional",
  bilissel: "cognitive",
  yurutucu: "executive",
  intero: "interoception",
} as const;

const nonTypicalDomainContexts = Object.entries(reportDomainKeyByScale).map(
  ([scale, key]) => ({
    key,
    label: scale,
    level: "Atipik",
    score: 10,
  })
);

for (const question of questions) {
  const answers = [...favorableAnswers];
  answers[question.id - 1] = question.scoringDirection === "reverse" ? 5 : 1;
  const itemAnalysis = analyzeItemLevelSignals({
    answers,
    domainResults: nonTypicalDomainContexts,
  });
  const targetKey = reportDomainKeyByScale[question.scale];

  assert(
    itemAnalysis?.criticalItems.some((item) => item.questionId === question.id),
    `${question.id}. madde güçlük ucundayken doğru klinik kanıt olarak seçilmelidir: ${question.text}`
  );
  assert(
    Boolean(itemAnalysis?.domainLines[targetKey]?.length),
    `${question.id}. madde raporda ${targetKey} alanına klinik cümle sağlamalıdır: ${question.text}`
  );
}

assert(
  analyzeItemLevelSignals({
    answers: favorableAnswers,
    domainResults: nonTypicalDomainContexts,
  }) === null,
  "Olumlu uçtaki 60 yanıtın hiçbiri yanlış klinik kanıt üretmemelidir"
);

for (const scale of Object.keys(resultFieldByScale) as Array<keyof typeof resultFieldByScale>) {
  const answers = [...favorableAnswers];
  questions
    .filter((question) => question.scale === scale)
    .forEach((question) => {
      answers[question.id - 1] = question.scoringDirection === "reverse" ? 5 : 1;
    });

  const report = buildAdvancedReport({
    clientCode: `ALAN-YON-${scale}`,
    ageMonths: 54,
    anamnez: "",
    answers,
    scores: {},
  });
  const targetKey = reportDomainKeyByScale[scale];
  const targetDomain = report.domainResults.find((domain) => domain.key === targetKey);
  const otherDomains = report.domainResults.filter((domain) => domain.key !== targetKey);

  assert(
    targetDomain?.score === 10 && targetDomain.level === "Atipik",
    `${scale} alanı güçlük ucundayken rapor bu alanı 10/50 ve Atipik göstermelidir`
  );
  assert(
    otherDomains.every((domain) => domain.score === 50 && domain.level === "Tipik"),
    `${scale} alanı güçlük ucundayken diğer beş rapor alanı etkilenmemelidir`
  );
  assert(
    report.weakDomains.some((domain) => domain.key === targetKey),
    `${scale} alanı raporun zayıf alan listesinde görünmelidir`
  );
  assert(
    report.profileType.toLocaleLowerCase("tr-TR").includes(targetDomain.label.toLocaleLowerCase("tr-TR")),
    `${scale} alanı raporun seçici profil adında doğru alan olarak görünmelidir`
  );
}

const favorable = calculateAssessment(favorableAnswers);
assertDomainScores(favorable, 50, "Olumlu uç profil");
assert(favorable.toplam === 300, "Olumlu uç profil toplamı 300 olmalıdır");
assert(favorable.siniflama === "Tipik", "Olumlu uç profil Tipik olmalıdır");

const adverse = calculateAssessment(adverseAnswers);
assertDomainScores(adverse, 10, "Güçlük uç profili");
assert(adverse.toplam === 60, "Güçlük uç profili toplamı 60 olmalıdır");
assert(adverse.siniflama === "Atipik", "Güçlük uç profili Atipik olmalıdır");

const sometimes = calculateAssessment(sometimesAnswers);
assertDomainScores(sometimes, 30, "Bazen profili");
assert(sometimes.toplam === 180, "Bazen profili toplamı 180 olmalıdır");
assert(sometimes.siniflama === "Riskli", "Bazen profili Riskli olmalıdır");

assert(scoreRawAnswer(1, 5) === 1, "Güçlük maddesinde 5 yanıtı ters puanlanmalıdır");
assert(scoreRawAnswer(1, 1) === 5, "Güçlük maddesinde 1 yanıtı ters puanlanmalıdır");
assert(getConcernSeverity(1, 5) === 5, "Güçlük maddesinde yüksek sıklık yüksek güçlük olmalıdır");
assert(getConcernSeverity(1, 1) === 1, "Güçlük maddesinde düşük sıklık düşük güçlük olmalıdır");
assert(scoreRawAnswer(51, 1) === 1, "Beceri maddesinde 1 yanıtı doğrudan puanlanmalıdır");
assert(scoreRawAnswer(51, 5) === 5, "Beceri maddesinde 5 yanıtı doğrudan puanlanmalıdır");
assert(getConcernSeverity(51, 1) === 5, "Beceri maddesinde düşük sıklık yüksek güçlük olmalıdır");
assert(getConcernSeverity(51, 5) === 1, "Beceri maddesinde yüksek sıklık düşük güçlük olmalıdır");

assertThrows(() => validateRawAnswers(Array(59).fill(3)), "Eksik yanıt dizisi reddedilmelidir");
assertThrows(
  () => validateRawAnswers([...Array(59).fill(3), 6]),
  "Likert sınırı dışındaki yanıt reddedilmelidir"
);

assert(
  classifyTotalScore(219, { ageMonths: 54 }) === "Tipik",
  "Toplam sonuç kendi sınıflama kuralıyla hesaplanmalıdır"
);
assert(
  classifyDomainScore("sensory", 21, { ageMonths: 54 }) === "Atipik",
  "Seçici alan sonucu toplam sonuçtan bağımsız korunmalıdır"
);

const report = buildAdvancedReport({
  clientCode: "PUANLAMA-TESTI",
  anamnez: "",
  answers: favorableAnswers,
  scores: {
    physiological: 10,
    sensory: 10,
    emotional: 10,
    cognitive: 10,
    executive: 10,
    interoception: 10,
  },
});

assert(report.totalScore === 300, "Rapor, istemciden gelen sahte skor yerine ham yanıtı hesaplamalıdır");
assert(report.globalLevel === "Tipik", "Raporun sınıflaması sunucu hesabına dayanmalıdır");
assert(
  /tek başına tanı koymaz/i.test(report.reportText),
  "Final rapor güvenli tanı sınırı cümlesi içermelidir"
);
assert(
  !/\b(?:normatif|standardize edilmiş norm(?:atif)?|tanı eşiği|yaş-duyarlı yorum|sistem içi (?:sabit )?eşik|sistem içi yorum bandı)\b/i.test(
    report.reportText
  ),
  "Final rapora normatif teknik açıklama sızmamalıdır"
);

const auditoryAnswers = [...favorableAnswers];
auditoryAnswers[14] = 5;
const auditoryReport = buildAdvancedReport({
  clientCode: "ISITSEL-YON-TESTI",
  anamnez: {
    referral_reason: "Ani sesler ve arka plan gürültüsü altında görevden kopuyor.",
  },
  answers: auditoryAnswers,
  scores: {},
});
assert(
  auditoryReport.domainResults.find((domain) => domain.key === "sensory")?.score === 46,
  "15. maddedeki yüksek güçlük sıklığı Duyusal Regülasyon skorunu düşürmelidir"
);
assert(
  (auditoryReport.clinicalAnalysis?.criticalItemLines || []).some((line) =>
    /ses ve arka plan gürültüsü/i.test(line)
  ),
  "15. maddedeki güçlük rapora işitsel reaktivite yönünde katkı vermelidir"
);

const interoceptiveAnswers = [...favorableAnswers];
interoceptiveAnswers[50] = 1;
const interoceptiveReport = buildAdvancedReport({
  clientCode: "INTERO-YON-TESTI",
  anamnez: {
    referral_reason: "Açlık ve temel beden sinyallerini fark etmekte zorlanıyor.",
  },
  answers: interoceptiveAnswers,
  scores: {},
});
assert(
  interoceptiveReport.domainResults.find((domain) => domain.key === "interoception")?.score === 46,
  "51. maddedeki düşük beceri sıklığı İnterosepsiyon skorunu düşürmelidir"
);
assert(
  (interoceptiveReport.clinicalAnalysis?.criticalItemLines || []).some((line) =>
    /temel bedensel ihtiyaç sinyalleri/i.test(line)
  ),
  "51. maddedeki güçlük rapora temel beden sinyali yönünde katkı vermelidir"
);

const favorableContextReport = buildAdvancedReport({
  clientCode: "OLUMLU-YON-TESTI",
  anamnez: {
    referral_reason: "Sesli ortamlarda katılım sürüyor ve temel beden sinyallerini zamanında fark ediyor.",
  },
  answers: favorableAnswers,
  scores: {},
});
assert(
  (favorableContextReport.clinicalAnalysis?.criticalItemLines || []).length === 0,
  "Olumlu uçtaki yanıtlar yalnız bağlam kelimesi geçtiği için güçlük kanıtına dönüşmemelidir"
);

console.log(
  "Assessment scoring tests passed (60/60 semantic polarity, domain isolation, report contribution, integrity, language)."
);
