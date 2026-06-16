import {
  BarChart3,
  BookOpenCheck,
  ClipboardCheck,
  Database,
  FileText,
  GraduationCap,
  Handshake,
  LucideIcon,
  ScanLine,
} from "lucide-react";

export type ResearchPageContent = {
  slug: string;
  title: string;
  eyebrow: string;
  description: string;
  icon: LucideIcon;
  accent: string;
  sections: {
    title: string;
    text: string;
    icon: LucideIcon;
  }[];
  callout: {
    title: string;
    text: string;
    href: string;
    label: string;
  };
};

export const researchPages: ResearchPageContent[] = [
  {
    slug: "arastirma-notlari",
    title: "Klinik uygulamaya dönük araştırma notları.",
    eyebrow: "Araştırma Notları",
    description:
      "Klinik uygulamaya dönük kısa literatür özetleri, metodoloji notları ve bilimsel değerlendirmeler bu alanda sade ve okunabilir biçimde düzenlenir.",
    icon: FileText,
    accent: "#2563EB",
    sections: [
      {
        title: "Literatür özetleri",
        text: "Self-regülasyon, gelişimsel nörobilim ve klinik değerlendirme alanındaki seçili yayınlar kısa uygulama notlarına dönüştürülür.",
        icon: BookOpenCheck,
      },
      {
        title: "Metodoloji notları",
        text: "Araştırma deseni, ölçüm yaklaşımı, veri kalitesi ve yorum sınırları anlaşılır bir dille özetlenir.",
        icon: ClipboardCheck,
      },
      {
        title: "Bilimsel değerlendirme",
        text: "Amaç hızlı iddialar üretmek değil; klinik uygulamayı destekleyen kanıt düzeyini ve sınırlılıkları netleştirmektir.",
        icon: ScanLine,
      },
      {
        title: "Klinik aktarım",
        text: "Araştırma bulguları tanı ya da otomatik karar iddiasına dönüşmeden, klinisyenin düşünme sürecini besleyen notlar olarak sunulur.",
        icon: FileText,
      },
    ],
    callout: {
      title: "Araştırma notları için konu önerinizi paylaşın.",
      text: "Klinik uygulamada yanıt aradığınız başlıkları literatür, metodoloji ve etik sınırlar içinde birlikte değerlendirebiliriz.",
      href: "/iletisim",
      label: "Konu Önerisi Gönder",
    },
  },
  {
    slug: "is-birlikleri",
    title: "Üniversiteler, araştırma grupları ve klinik ekiplerle ortak çalışmalar.",
    eyebrow: "İş Birlikleri",
    description:
      "Üniversiteler, araştırma grupları ve klinik ekiplerle yürütülebilecek ortak çalışmalar; bilimsel amaç, etik çerçeve ve veri kullanımı netleştirilerek değerlendirilir.",
    icon: Handshake,
    accent: "#7C3AED",
    sections: [
      {
        title: "Üniversite iş birlikleri",
        text: "Lisansüstü araştırma, ölçek çalışmaları ve klinik eğitim uygulamaları için yapılandırılmış akademik iş birlikleri değerlendirilebilir.",
        icon: GraduationCap,
      },
      {
        title: "Araştırma grupları",
        text: "Ortak soru, yöntem, örneklem ve çıktı planı net olan bilimsel ekiplerle kontrollü çalışma modelleri kurulabilir.",
        icon: BookOpenCheck,
      },
      {
        title: "Klinik ekipler",
        text: "Klinik uygulama deneyimini araştırma sorularına dönüştürmek isteyen ekiplerle veri kalitesi ve uygulama tutarlılığı çalışılır.",
        icon: Handshake,
      },
      {
        title: "Etik çerçeve",
        text: "Her çalışma veri gizliliği, onam, etik izin ve yayın sorumlulukları netleşmeden başlatılmaz.",
        icon: ClipboardCheck,
      },
    ],
    callout: {
      title: "İş birliği başvurunuzu iletin.",
      text: "Kurum, amaç, hedef grup ve araştırma sorusunu paylaşın; uygun iş birliği modelini kontrollü bir görüşmeyle netleştirebiliriz.",
      href: "/iletisim",
      label: "İş Birliği İçin İletişime Geç",
    },
  },
  {
    slug: "tez-ve-proje-destegi",
    title: "Tez ve araştırma projeleri için metodolojik destek.",
    eyebrow: "Tez ve Proje Desteği",
    description:
      "Yüksek lisans, doktora, TÜBİTAK ve araştırma projeleri için araştırma sorusu, yöntem, ölçüm planı ve veri yorumlama süreçlerinde metodolojik destek sunulur.",
    icon: GraduationCap,
    accent: "#00C8D7",
    sections: [
      {
        title: "Araştırma sorusu",
        text: "Klinik gözlemden gelen sorular bilimsel olarak çalışılabilir, sınırları belirgin araştırma sorularına dönüştürülür.",
        icon: FileText,
      },
      {
        title: "Yöntem planı",
        text: "Örneklem, ölçüm araçları, uygulama akışı ve analiz yaklaşımı proje hedefiyle uyumlu şekilde yapılandırılır.",
        icon: ClipboardCheck,
      },
      {
        title: "Veri yorumlama",
        text: "Bulgular klinik anlam, metodolojik sınırlılık ve etik kullanım dengesi korunarak değerlendirilir.",
        icon: BarChart3,
      },
      {
        title: "Proje çıktısı",
        text: "Tez, proje raporu, makale taslağı veya sunum çıktısı için bilimsel anlatım ve yapı desteği sağlanabilir.",
        icon: BookOpenCheck,
      },
    ],
    callout: {
      title: "Tez veya proje fikrinizi birlikte netleştirelim.",
      text: "Araştırma sorunuz, proje kapsamınız ve ihtiyaç duyduğunuz metodolojik destek başlıklarını paylaşabilirsiniz.",
      href: "/iletisim",
      label: "Proje Desteği İçin İletişime Geç",
    },
  },
  {
    slug: "veri-agi",
    title: "Çok merkezli veri üretimi ve araştırma altyapısı.",
    eyebrow: "Veri Ağı",
    description:
      "Çok merkezli veri toplama, ortak veri üretimi ve araştırma altyapısı geliştirme çalışmaları; standardizasyon, gizlilik ve etik kullanım ilkeleriyle planlanır.",
    icon: Database,
    accent: "#2563EB",
    sections: [
      {
        title: "Çok merkezli veri",
        text: "Farklı klinik ve araştırma merkezlerinden gelen verilerin karşılaştırılabilir, düzenli ve etik biçimde toplanması hedeflenir.",
        icon: Database,
      },
      {
        title: "Ortak veri üretimi",
        text: "Ölçüm dili, form yapısı ve veri giriş standartları ortak araştırma sorularına uygun şekilde uyumlandırılır.",
        icon: ClipboardCheck,
      },
      {
        title: "Araştırma altyapısı",
        text: "Veri kalitesi, güvenli saklama, erişim sınırları ve analiz planı araştırma başlamadan önce netleştirilir.",
        icon: ScanLine,
      },
      {
        title: "Toplulaştırılmış analiz",
        text: "Veri ağı bireysel tanı veya otomatik karar üretimi için değil, toplulaştırılmış bilimsel değerlendirme için yapılandırılır.",
        icon: BarChart3,
      },
    ],
    callout: {
      title: "Veri ağı çalışmaları için görüşelim.",
      text: "Çok merkezli veri toplama, ortak ölçüm standardı veya araştırma altyapısı ihtiyacınızı birlikte değerlendirebiliriz.",
      href: "/iletisim",
      label: "Veri Ağı İçin İletişime Geç",
    },
  },
];

export function getResearchPage(slug: string) {
  return researchPages.find((page) => page.slug === slug);
}
