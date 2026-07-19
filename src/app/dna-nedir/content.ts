import {
  BrainCircuit,
  ClipboardCheck,
  FileText,
  GraduationCap,
  Layers3,
  Sparkles,
} from "lucide-react";

export const dnaPages = {
  "dna-yaklasimi": {
    slug: "dna-yaklasimi",
    route: "/dna-nedir",
    eyebrow: "Eğitim programı ve klinik çalışma platformu",
    title: "Eğitimde öğrendiğiniz yaklaşımı değerlendirme ve raporlama sırasında da kullanın.",
    intro:
      "Dynamic Neuro-Regulation Approach, self-regülasyonu değerlendirmeyi ve müdahale planlamayı öğretir. DNA Intelligence ise test sonuçlarını, anamnez bilgilerini ve gözlem notlarını aynı yerde toplar; rapor hazırlamayı kolaylaştırır.",
    icon: BrainCircuit,
    accent: "#2563EB",
    sections: [
      {
        title: "Eğitimde öğrenilen yaklaşım",
        text: "Dynamic Neuro-Regulation Approach, çocuğun davranışını uyku, enerji, duyusal yük, duygusal tepkiler, dikkat ve planlama becerileriyle birlikte değerlendirmeyi öğretir.",
      },
      {
        title: "Değerlendirme ve rapor hazırlama",
        text: "DNA Intelligence, test sonuçlarını, anamnez bilgilerini ve gözlem notlarını bir araya getirir; terapistin inceleyebileceği bir rapor taslağı hazırlar.",
      },
      {
        title: "Aynı yaklaşım, baştan sona",
        text: "Terapist eğitimde öğrendiği yaklaşımı değerlendirme, rapor hazırlama ve takip sırasında da kullanır.",
      },
    ],
  },
  "egitim-programi": {
    slug: "egitim-programi",
    route: "/dna-nedir/egitim-programi",
    eyebrow: "Eğitim Programı",
    title: "Dynamic Neuro-Regulation Approach Eğitim Programı",
    intro:
      "Self-regülasyonu değerlendirmeyi ve müdahale planlamayı adım adım öğrenin.",
    icon: GraduationCap,
    accent: "#7C3AED",
    sections: [
      {
        title: "Regülasyon alanlarını birlikte okuma",
        text: "Uyku, enerji, duyusal yük, duygusal tepkiler, dikkat ve planlama becerileri birlikte değerlendirilir.",
      },
      {
        title: "Vaka değerlendirme ve sonuçları yazma",
        text: "Gözlem, anamnez ve test sonuçlarından hareketle vaka değerlendirmeyi ve bulguları açık biçimde anlatmayı öğrenin.",
      },
      {
        title: "Video örnekleriyle müdahale çalışması",
        text: "Video örneklerinde çocuğun verdiği işaretleri, uygun müdahaleyi, zamanlamayı, tempoyu, çevre düzenlemesini ve seans içindeki geri bildirimi incelersiniz.",
      },
      {
        title: "Planlama ve uygulama",
        text: "Değerlendirme sonuçlarını hedef belirleme, seans planlama ve klinik not hazırlama sırasında kullanmayı öğrenin.",
      },
    ],
  },
  "degerlendirme-sistemi": {
    slug: "degerlendirme-sistemi",
    route: "/dna-nedir/degerlendirme-sistemi",
    eyebrow: "Kapsamlı Değerlendirme",
    title: "Test, anamnez ve gözlem bilgilerini birlikte değerlendirin.",
    intro:
      "DNA Intelligence farklı kaynaklardan gelen bilgileri aynı yerde toplar. Terapist sonuçları birlikte inceler ve klinik önceliği belirler.",
    icon: ClipboardCheck,
    accent: "#00C8D7",
    sections: [
      {
        title: "Alanlara göre değerlendirme",
        text: "İnterosepsiyon, fizyolojik, duyusal, duygusal ve bilişsel regülasyon ile yürütücü işlevler birlikte değerlendirilir.",
      },
      {
        title: "Bilgileri bir araya getirme",
        text: "Platform test sonuçlarını, anamnez bilgilerini ve terapist gözlemlerini kaynaklarıyla birlikte gösterir. Bu özet tek başına biyolojik bir mekanizma veya kesin neden göstermez.",
      },
      {
        title: "Terapist değerlendirmesi",
        text: "Sistem, bulguların alanlara göre dağılımını gösterir; klinik önceliği ve sonraki adımı terapist kendi değerlendirmesiyle belirler.",
      },
    ],
  },
  "mudahale-yaklasimi": {
    slug: "mudahale-yaklasimi",
    route: "/dna-nedir/mudahale-yaklasimi",
    eyebrow: "Müdahale Yaklaşımı",
    title: "Müdahaleyi çocuğun ihtiyaçlarına göre planlayın.",
    intro:
      "Dynamic Neuro-Regulation Approach; bedensel durum, duyusal ihtiyaçlar, duygusal tepkiler ve düşünme becerilerini birlikte değerlendirir. Müdahale planı bu bilgilere göre hazırlanır.",
    icon: Layers3,
    accent: "#7C3AED",
    sections: [
      {
        title: "Bedensel ve duyusal ihtiyaçlar",
        text: "Uyku, enerji, bedensel sinyaller ve duyusal ihtiyaçlar müdahale planında dikkate alınır.",
      },
      {
        title: "Düşünme becerileri ve çevre",
        text: "Terapist dikkat, planlama ve esneklikle ilgili ihtiyaçları günlük yaşam hedeflerine göre değerlendirir; çevreyi buna göre düzenler.",
      },
      {
        title: "Vaka değerlendirmesi",
        text: "Amaç hazır reçete sunmak değil, terapistin vaka özelinde karar vermesini güçlendirmektir.",
      },
    ],
  },
  "ai-raporlama": {
    slug: "ai-raporlama",
    route: "/dna-nedir/ai-raporlama",
    eyebrow: "Deterministik ve Açıklanabilir Raporlama",
    title: "Değerlendirme bilgilerinden rapor taslağı hazırlayın.",
    intro:
      "DNA Intelligence; anamnez bilgilerini, test sonuçlarını, gözlem ve terapist notlarını bir araya getirir. Kayıtlı kurallara göre bir özet ve rapor taslağı hazırlar. Terapist taslağı inceler, düzenler ve son halini verir.",
    icon: FileText,
    accent: "#2563EB",
    sections: [
      {
        title: "Bulguların özeti",
        text: "Farklı kaynaklardan gelen bilgilerdeki zorlanmaları ve güçlü yönleri özetler. Klinik önceliğe karar vermez.",
      },
      {
        title: "Düzenlenebilir rapor taslağı",
        text: "Bulguları açık ve düzenli bir raporda birleştirir. Hedefleri ve takip kararlarını terapist ekler.",
      },
      {
        title: "Terapist kontrolü",
        text: "Terapist taslağı inceler, gerekli düzeltmeleri yapar ve raporun son halini verir.",
      },
    ],
  },
  "gelecek-moduller": {
    slug: "gelecek-moduller",
    route: "/dna-nedir/gelecek-moduller",
    eyebrow: "DNA Labs",
    title: "Üzerinde çalıştığımız yeni özellikler.",
    intro:
      "DNA Labs; seans gözlemlerini kaydetmeyi, değişimi zaman içinde izlemeyi ve bu bilgileri raporlara eklemeyi kolaylaştıracak özelliklerin geliştirme alanıdır.",
    icon: Sparkles,
    accent: "#00C8D7",
    sections: [
      {
        title: "Video gözlem",
        text: "Seans sırasında görülen davranışların, regülasyon tepkilerinin ve katılımdaki değişimlerin düzenli biçimde kaydedilmesi amaçlanır.",
      },
      {
        title: "Video ve görüntü inceleme",
        text: "Postür, hareket ve motor yanıtla ilgili görüntüleri diğer değerlendirme bilgileriyle birlikte inceleyecek özellikler planlanır.",
      },
      {
        title: "Gelişim takibi",
        text: "Değerlendirme, rapor ve gözlem kayıtlarını tarih sırasıyla göstererek değişimi izlemeyi kolaylaştırır.",
      },
    ],
  },
} as const;

export const dnaChildSlugs = Object.keys(dnaPages).filter((slug) => slug !== "dna-yaklasimi");

export type DnaPageKey = keyof typeof dnaPages;
