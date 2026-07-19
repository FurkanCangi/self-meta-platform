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
    title: "Araştırma sonuçlarının günlük uygulamada ne anlattığını görün.",
    eyebrow: "Araştırma Notları",
    description:
      "Seçilen çalışmaların kısa özetleri, araştırma yöntemine ilişkin açıklamalar ve dikkat edilmesi gereken sınırlılıklar burada yer alır.",
    icon: FileText,
    accent: "#2563EB",
    sections: [
      {
        title: "Araştırma özetleri",
        text: "Self-regülasyon, çocuk gelişimi ve klinik değerlendirmeyle ilgili seçilmiş çalışmalar kısa ve anlaşılır biçimde özetlenir.",
        icon: BookOpenCheck,
      },
      {
        title: "Araştırma yöntemi",
        text: "Çalışmanın nasıl yapıldığı, hangi ölçümlerin kullanıldığı ve sonuçların hangi sınırlar içinde yorumlanabileceği açıklanır.",
        icon: ClipboardCheck,
      },
      {
        title: "Sonuçlar ne kadar güçlü?",
        text: "Çalışmanın güçlü yönleri ve sınırlılıkları, sonuçların nasıl yorumlanacağını belirler. Tek bir araştırmaya dayanarak kesin yargıya varılmaz.",
        icon: ScanLine,
      },
      {
        title: "Uygulamada nasıl kullanılır?",
        text: "Araştırma sonuçlarının değerlendirme ve takip sırasında nasıl kullanılabileceği anlatılır. Tanı ve tedavi kararları, ilgili yetki kapsamına sahip sağlık profesyonelinin mesleki değerlendirmesine dayanır.",
        icon: FileText,
      },
    ],
    callout: {
      title: "Yanıtını aradığınız konuyu bize iletin.",
      text: "Klinikte merak ettiğiniz konuyu paylaşın; güvenilir araştırmaları inceleyip anlaşılır bir özet hazırlayalım.",
      href: "/iletisim",
      label: "Konu önerisi gönder",
    },
  },
  {
    slug: "is-birlikleri",
    title: "Üniversiteler, araştırma grupları ve klinik ekiplerle birlikte çalışın.",
    eyebrow: "İş Birlikleri",
    description:
      "Çalışmaya başlamadan araştırmanın amacını, görevleri, veri güvenliği kurallarını ve yayın planını birlikte kararlaştırırız.",
    icon: Handshake,
    accent: "#7C3AED",
    sections: [
      {
        title: "Üniversite iş birlikleri",
        text: "Lisansüstü araştırmalar, ölçek çalışmaları ve klinik eğitim uygulamaları için ortak projeler planlanabilir.",
        icon: GraduationCap,
      },
      {
        title: "Araştırma grupları",
        text: "Araştırma sorusunu, yöntemi, katılımcıları ve yayın planını birlikte kararlaştırırız.",
        icon: BookOpenCheck,
      },
      {
        title: "Klinik ekipler",
        text: "Klinikte karşılaşılan konular için açık bir araştırma sorusu hazırlanır. Bütün ekipler verileri aynı yöntemle toplar.",
        icon: Handshake,
      },
      {
        title: "Çalışma başlamadan önce",
        text: "Çalışma başlamadan veri güvenliği kurallarını, katılımcı onamını, etik izinleri ve yayın sorumluluklarını açıkça yazarız.",
        icon: ClipboardCheck,
      },
    ],
    callout: {
      title: "Birlikte çalışmak istediğiniz konuyu anlatın.",
      text: "Kurumunuzu, çalışma amacınızı, katılımcı grubunu ve araştırma sorunuzu paylaşın; görevleri ve çalışma planını birlikte belirleyelim.",
      href: "/iletisim",
      label: "İş birliği için iletişime geç",
    },
  },
  {
    slug: "tez-ve-proje-destegi",
    title: "Tez ve araştırma projenizin her aşaması için destek alın.",
    eyebrow: "Tez ve Proje Desteği",
    description:
      "Araştırma sorusunu belirleme, yöntem seçme, veri toplama, sonuçları yorumlama ve çalışmayı yazma aşamalarında destek verilir.",
    icon: GraduationCap,
    accent: "#00C8D7",
    sections: [
      {
        title: "Araştırma sorusu",
        text: "İncelemek istediğiniz konuyu, kapsamı ve sınırları açık bir araştırma sorusuna dönüştürürüz.",
        icon: FileText,
      },
      {
        title: "Araştırma yöntemi",
        text: "Araştırmanın amacına uygun katılımcıları, ölçüm araçlarını, veri toplama adımlarını ve değerlendirme yöntemini birlikte seçeriz.",
        icon: ClipboardCheck,
      },
      {
        title: "Sonuçların yorumu",
        text: "Sonuçların ne gösterdiği ve hangi sorulara yanıt vermediği açıkça yazılır. Çalışmanın sınırlılıkları ayrıca belirtilir.",
        icon: BarChart3,
      },
      {
        title: "Çalışmanın yazılması",
        text: "Tez, proje raporu, makale taslağı veya sunumun bölümleri açık ve tutarlı bir sırayla hazırlanır.",
        icon: BookOpenCheck,
      },
    ],
    callout: {
      title: "Tez veya proje fikrinizi birlikte geliştirelim.",
      text: "Araştırma sorunuzu, çalışmanızın kapsamını ve hangi aşamada desteğe ihtiyaç duyduğunuzu paylaşın.",
      href: "/iletisim",
      label: "Proje desteği için iletişime geç",
    },
  },
  {
    slug: "veri-agi",
    title: "Farklı merkezlerde aynı yöntemle veri toplayın.",
    eyebrow: "Veri Ağı",
    description:
      "Farklı kurumlar aynı formları, değişkenleri ve veri güvenliği kurallarını kullanarak birlikte çalışır.",
    icon: Database,
    accent: "#2563EB",
    sections: [
      {
        title: "Birden fazla merkez",
        text: "Farklı klinik ve araştırma merkezlerinden gelen veriler aynı kurallara göre toplanır ve karşılaştırılabilir hale getirilir.",
        icon: Database,
      },
      {
        title: "Ortak ölçüm planı",
        text: "Bütün merkezler aynı formları, değişken adlarını ve veri giriş kurallarını kullanır.",
        icon: ClipboardCheck,
      },
      {
        title: "Veri güvenliği",
        text: "Çalışma başlamadan verilerin nasıl saklanacağını, kimlerin erişebileceğini ve hangi amaçlarla kullanılacağını açıkça yazarız.",
        icon: ScanLine,
      },
      {
        title: "Birlikte değerlendirme",
        text: "Merkezlerden gelen veriler kişisel karar vermek için değil, araştırma sorusunu toplu veriler üzerinden incelemek için kullanılır.",
        icon: BarChart3,
      },
    ],
    callout: {
      title: "Birden fazla merkezle çalışmak istiyorsanız bize ulaşın.",
      text: "Kaç kurumla çalışacağınızı, hangi verileri toplayacağınızı ve araştırma sorunuzu paylaşın; ortak planı birlikte hazırlayalım.",
      href: "/iletisim",
      label: "Veri ağı için iletişime geç",
    },
  },
];

export function getResearchPage(slug: string) {
  return researchPages.find((page) => page.slug === slug);
}
