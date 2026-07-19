export const DNA_INTELLIGENCE_INTENDED_USE_VERSION =
  "dna-intelligence-intended-use@1" as const

export const DNA_INTELLIGENCE_PRODUCT_NAME = "DNA Intelligence" as const
export const DNA_INTELLIGENCE_COMPONENT_NAME = "DNA Asistanı" as const

export const DNA_APPROACH_DESCRIPTION_TR =
  "Dynamic Neuro-Regulation Approach, terapistlere yönelik bir eğitim ve klinik düşünme çerçevesidir; yazılımın kendisi değildir." as const

export const DNA_INTELLIGENCE_PLATFORM_DESCRIPTION_TR =
  "DNA Intelligence, değerlendirme verilerini yapılandıran ve terapist incelemesine sunulan açıklanabilir, deterministik rapor taslakları oluşturan klinik çalışma platformudur." as const

export const DNA_INTELLIGENCE_PLATFORM_BOUNDARY_TR =
  "Platform klinik öncelik, müdahale, tedavi veya seans planına kendiliğinden karar vermez; nihai yorum, düzenleme ve klinik karar terapiste aittir." as const

export const DNA_INTELLIGENCE_SUPPORTED_CAPABILITY_IDS = [
  "explain_neurophysiology_and_regulation",
  "compare_curated_concepts",
  "describe_evidence_status",
  "show_age_and_sample_boundaries",
  "explain_bounded_dna_relationship",
  "discuss_owned_report_findings",
  "juxtapose_report_and_literature",
  "show_claim_linked_sources",
  "abstain_when_knowledge_is_missing",
] as const

export const DNA_INTELLIGENCE_PROHIBITED_CAPABILITY_IDS = [
  "diagnosis_and_differential_diagnosis",
  "treatment_or_session_planning",
  "medication_or_dose_advice",
  "individual_prognosis",
  "definitive_causality",
  "biological_state_inference_from_behavior",
  "raw_or_internal_data_disclosure",
  "cross_owner_case_access",
  "cross_report_clinical_comparison",
  "autonomous_learning_from_conversations",
] as const

export type DnaIntelligenceSupportedCapabilityId =
  (typeof DNA_INTELLIGENCE_SUPPORTED_CAPABILITY_IDS)[number]

export type DnaIntelligenceProhibitedCapabilityId =
  (typeof DNA_INTELLIGENCE_PROHIBITED_CAPABILITY_IDS)[number]

type IntendedUseCapability<Id extends string> = {
  readonly id: Id
  readonly statementTr: string
}

export const DNA_INTELLIGENCE_SUPPORTED_CAPABILITIES = Object.freeze([
  {
    id: "explain_neurophysiology_and_regulation",
    statementTr: "Katalogda bulunan nörofizyolojik ve düzenleme kavramlarını kaynak sınırlarıyla açıklar.",
  },
  {
    id: "compare_curated_concepts",
    statementTr: "Yalnız katalogda açıkça kayıtlı kavramları ve tek adımlı ilişkileri karşılaştırır.",
  },
  {
    id: "describe_evidence_status",
    statementTr: "Yanıtın kanıt düzeyini ve iddia sınırını gösterir.",
  },
  {
    id: "show_age_and_sample_boundaries",
    statementTr: "Kayıtlı yaş ve örneklem kapsamını gösterir; eksik örneklem bilgisini tamamlamaz.",
  },
  {
    id: "explain_bounded_dna_relationship",
    statementTr: "Genel kavramların DNA konseptiyle ilişkisini yalnız kayıtlı ilişkinin niteliği kadar açıklar.",
  },
  {
    id: "discuss_owned_report_findings",
    statementTr: "Terapistin seçtiği ve sahipliği doğrulanan rapordaki güvenli, yapılandırılmış bulguları tartışır.",
  },
  {
    id: "juxtapose_report_and_literature",
    statementTr: "Rapor bulgusunu genel literatürden ayırarak yan yana gösterir ve biyolojik mekanizmanın vakada ölçülmediğini belirtir.",
  },
  {
    id: "show_claim_linked_sources",
    statementTr: "Yanıtta kullanılan iddialara bağlı kaynak kayıtlarını gösterir.",
  },
  {
    id: "abstain_when_knowledge_is_missing",
    statementTr: "Doğrulanmış katalogda yeterli bilgi olmadığında tahmin yürütmeden bunu açıkça söyler.",
  },
] as const satisfies readonly IntendedUseCapability<DnaIntelligenceSupportedCapabilityId>[])

export const DNA_INTELLIGENCE_PROHIBITED_CAPABILITIES = Object.freeze([
  {
    id: "diagnosis_and_differential_diagnosis",
    statementTr: "Tanı koymaz ve ayırıcı tanı seçeneklerini daraltmaz.",
  },
  {
    id: "treatment_or_session_planning",
    statementTr: "Tedavi, terapi, müdahale, ev programı veya seans planı üretmez.",
  },
  {
    id: "medication_or_dose_advice",
    statementTr: "İlaç, preparat veya doz önermez.",
  },
  {
    id: "individual_prognosis",
    statementTr: "Bireysel prognoz, iyileşme süresi veya gelecekteki işlev düzeyi tahmini yapmaz.",
  },
  {
    id: "definitive_causality",
    statementTr: "Kesin neden, etiyoloji veya nedensellik sonucu üretmez.",
  },
  {
    id: "biological_state_inference_from_behavior",
    statementTr: "Davranıştan veya DNA raporundan beyin bölgesi, HRV, kortizol ya da otonom durum çıkarmaz.",
  },
  {
    id: "raw_or_internal_data_disclosure",
    statementTr: "Ham cevap, anamnez, snapshot, trace, audit içeriği, dahili eşik veya gizli kural göstermez.",
  },
  {
    id: "cross_owner_case_access",
    statementTr: "Başka terapistin vakasını veya raporunu görüntülemez.",
  },
  {
    id: "cross_report_clinical_comparison",
    statementTr: "Birden çok raporu karşılaştırarak klinik profil çıkarmaz.",
  },
  {
    id: "autonomous_learning_from_conversations",
    statementTr: "Kullanıcı mesajlarından kendiliğinden öğrenmez ve canlı kataloğu değiştirmez.",
  },
] as const satisfies readonly IntendedUseCapability<DnaIntelligenceProhibitedCapabilityId>[])

export const DNA_INTELLIGENCE_PUBLIC_INTENDED_USE = Object.freeze({
  version: DNA_INTELLIGENCE_INTENDED_USE_VERSION,
  productName: DNA_INTELLIGENCE_PRODUCT_NAME,
  componentName: DNA_INTELLIGENCE_COMPONENT_NAME,
  descriptionTr:
    "Terapistlerin kaynak bağlı nörofizyoloji ve düzenleme bilgisini incelemesine; yalnız kendi seçtikleri DNA raporundaki güvenli bulguları genel literatürden ayrı tartışmasına yardımcı olan deterministik bilgi asistanıdır.",
  boundaryTr:
    "Tanı ve ayırıcı tanı, tedavi veya seans planı, ilaç veya doz, prognoz ya da kesin nedensellik üretmez; davranıştan veya rapordan beyin bölgesi, HRV, kortizol ya da otonom durum çıkarmaz.",
  privacyTr:
    "Yalnız oturum sahibinin seçtiği raporun güvenli yapılandırılmış bağlamını kullanır. Sohbet metni kalıcı geçmişe kaydedilmez; güvenlik ve erişim için sınırlı işlem ve kaynak metadatası tutulabilir. Bu metadata soru veya cevap metni, danışan kodu, rapor kimliği, skor ya da vaka bulgusu içermez. Ham cevap, anamnez, trace ve gizli kuralları göstermez, raporlar arası klinik profil karşılaştırmaz ve mesajlardan kendiliğinden öğrenmez.",
  evidenceTr:
    "Kaynak, kanıt, yaş ve örneklem sınırı katalogda yapılandırıldığı ölçüde gösterilir; bulunmayan bilgi tahmin edilmez.",
  runtimeTr:
    "Çalışma zamanında haricî LLM, model API'si, embedding, vektör veritabanı veya internetten bilgi arama kullanılmaz; yanıt yalnız sürümlü yerel katalog ve izinli rapor bağlamından oluşturulur.",
} as const)

export type DnaIntelligencePublicIntendedUse =
  typeof DNA_INTELLIGENCE_PUBLIC_INTENDED_USE

export const DNA_INTELLIGENCE_TAGLINE_TR =
  "Kaynak bağlı · Deterministik · Klinik kararın yerine geçmez" as const

export const DNA_INTELLIGENCE_ENTRY_DESCRIPTION_TR =
  "Kaynak bağlı genel bilgiyi inceleyin veya yalnız kendi seçtiğiniz DNA raporundaki güvenli bulguları literatürden ayrı tartışın." as const

export const DNA_INTELLIGENCE_COMPOSER_NOTICE_TR =
  "Kişisel kimlik bilgisi yazmayın. Tanı, tedavi veya seans planı, ilaç veya doz ve prognoz kapsam dışıdır." as const

export const DNA_INTELLIGENCE_REPORT_OWNERSHIP_NOTICE_TR =
  "Yalnız hesabınıza ait son 10 aktif DNA raporunun kimliği, danışan kodu, tarihi, sürümü ve yaş bandı listelenir. Kullanıcı seçiminden önce raporun yapılandırılmış klinik bağlamı sohbet motoruna aktarılmaz." as const

export const DNA_INTELLIGENCE_AUDIT_NOTICE_TR =
  "Sohbet metni kalıcı geçmişe kaydedilmez. Audit; istek kimliği, mod, intent etiketi, yanıt sınıfı, motor ve sözleşme sürümü, ret durumu ve kaynak kimlikleriyle sınırlıdır; soru veya cevap metni, danışan kodu, rapor kimliği, skor ya da vaka bulgusu içermez." as const

export const DNA_INTELLIGENCE_INTENDED_USE_CONTRACT = Object.freeze({
  schemaVersion: "dna-intelligence-intended-use-contract@1",
  version: DNA_INTELLIGENCE_INTENDED_USE_VERSION,
  productName: DNA_INTELLIGENCE_PRODUCT_NAME,
  componentName: DNA_INTELLIGENCE_COMPONENT_NAME,
  brandArchitecture: {
    approach: {
      name: "Dynamic Neuro-Regulation Approach",
      kind: "therapist_education_and_clinical_reasoning_framework",
      descriptionTr: DNA_APPROACH_DESCRIPTION_TR,
    },
    platform: {
      name: DNA_INTELLIGENCE_PRODUCT_NAME,
      kind: "deterministic_assessment_and_report_drafting_platform",
      descriptionTr: DNA_INTELLIGENCE_PLATFORM_DESCRIPTION_TR,
      boundaryTr: DNA_INTELLIGENCE_PLATFORM_BOUNDARY_TR,
    },
    assistant: {
      name: DNA_INTELLIGENCE_COMPONENT_NAME,
      kind: "deterministic_source_controlled_information_assistant",
      descriptionTr: DNA_INTELLIGENCE_PUBLIC_INTENDED_USE.descriptionTr,
      boundaryTr: DNA_INTELLIGENCE_PUBLIC_INTENDED_USE.boundaryTr,
    },
  },
  productKind: "deterministic_source_controlled_information_assistant",
  intendedUsers: ["Terapist paneline erişimi olan, oturumu doğrulanmış kullanıcılar"],
  userQualificationBoundaryTr:
    "DNA eğitiminin tamamlanması mesleki kullanım beklentisidir; mevcut sohbet rotası eğitim tamamlama durumunu teknik bir erişim koşulu olarak doğrulamaz.",
  supported: DNA_INTELLIGENCE_SUPPORTED_CAPABILITIES,
  prohibited: DNA_INTELLIGENCE_PROHIBITED_CAPABILITIES,
  publicDescriptor: DNA_INTELLIGENCE_PUBLIC_INTENDED_USE,
  oversightTr:
    "Yanıtlar klinik kararın yerine geçmez. Kullanıcı kaynakları, sınırları ve rapor bağlamını kendi mesleki sorumluluğu içinde değerlendirmelidir.",
  learningPolicy: "no_runtime_or_conversation_learning",
  runtimePolicy: "no_external_llm_no_runtime_internet",
} as const)
