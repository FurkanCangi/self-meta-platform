import { z } from "zod";

export const DOMAIN_KEYS = [
  "fizyolojik",
  "duyusal",
  "duygusal",
  "bilissel",
  "yurutucu",
  "intero",
] as const;

export type DomainKey = (typeof DOMAIN_KEYS)[number];

const EvidenceItemSchema = z.string().min(1).max(180);

const DomainAnalysisSchema = z.object({
  interpretation: z.string().min(1).max(520),
  evidence: z.array(EvidenceItemSchema).max(3),
  caution: z.string().min(1).max(220),
});

export const AIReportAnalysisSchema = z.object({
  profileType: z.string().min(1).max(90),
  generalSummary: z.string().min(1).max(700),
  homogeneityStatement: z.string().min(1).max(260),
  patternSummary: z.string().min(1).max(350),
  patterns: z.array(z.string().min(1).max(220)).max(4),
  anamnezFitSummary: z.string().min(1).max(420),
  anamnezMatches: z.array(z.string().min(1).max(180)).max(4),
  anamnezLimitations: z.array(z.string().min(1).max(180)).max(4),
  domains: z.object({
    fizyolojik: DomainAnalysisSchema,
    duyusal: DomainAnalysisSchema,
    duygusal: DomainAnalysisSchema,
    bilissel: DomainAnalysisSchema,
    yurutucu: DomainAnalysisSchema,
    intero: DomainAnalysisSchema,
  }),
  conclusion: z.string().min(1).max(320),
});

export type AIReportAnalysis = z.infer<typeof AIReportAnalysisSchema>;
