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
    eyebrow: "Eğitim modeli ve deterministik sistem",
    title: "Eğitimden açıklanabilir raporlamaya net bir klinik hat.",
    intro:
      "Dynamic Neuro-Regulation Approach, self-regülasyon eğitim modelidir. DNA Intelligence ise bu modeli değerlendirme, analiz ve deterministik raporlama akışına taşıyan klinik sistemdir.",
    icon: BrainCircuit,
    accent: "#2563EB",
    sections: [
      {
        title: "Eğitim modeli",
        text: "Dynamic Neuro-Regulation Approach, çocuğun davranışını tek bir belirti üzerinden değil; fizyolojik, duyusal, duygusal, bilişsel ve yürütücü sistemlerin etkileşimi içinde ele alır.",
      },
      {
        title: "Deterministik sistem katmanı",
        text: "DNA Intelligence, eğitim modelinden gelen klinik dili dijital değerlendirme, veri düzenleme ve açıklanabilir raporlama sürecine taşır.",
      },
      {
        title: "Klinik çıktı",
        text: "Sonuç, terapistin değerlendirme ve karar sürecini görünür kılan; eğitimden rapora kadar aynı kavramsal çizgiyi koruyan bir klinik akıştır.",
      },
    ],
  },
  "egitim-programi": {
    slug: "egitim-programi",
    route: "/dna-nedir/egitim-programi",
    eyebrow: "Eğitim Programı",
    title: "Dynamic Neuro-Regulation Approach Eğitim Programı",
    intro:
      "Klinik akla, fizyolojik temele ve uygulamaya dayalı kapsamlı bir eğitim.",
    icon: GraduationCap,
    accent: "#7C3AED",
    sections: [
      {
        title: "Regülasyon alanlarını birlikte okuma",
        text: "Uyku, enerji, duyusal yük, duygu yoğunluğu, dikkat ve yürütücü işlevler ayrı başlıklar olarak değil; aynı klinik haritanın bağlantılı parçaları olarak çalışılır.",
      },
      {
        title: "Vaka formülasyonu ve klinik dil",
        text: "Katılımcı; gözlem, anamnez ve ölçek verilerini vaka formülasyonu içinde düzenlemeyi ve öncelikli regülasyon alanlarını ayırt etmeyi öğrenir.",
      },
      {
        title: "Video temelli müdahale laboratuvarı",
        text: "Video örnekleri üzerinden çocuğun sinyalleri, terapistin müdahale seçimi, zamanlama, tempo, çevresel düzenleme ve seans içi geri bildirim ayrıntılı biçimde ele alınır.",
      },
      {
        title: "Planlama ve uygulamaya aktarım",
        text: "Eğitim, değerlendirme çıktısını hedef belirleme, seans planı, müdahale gerekçesi ve takip edilebilir klinik not diline bağlar.",
      },
    ],
  },
  "degerlendirme-sistemi": {
    slug: "degerlendirme-sistemi",
    route: "/dna-nedir/degerlendirme-sistemi",
    eyebrow: "Çok Boyutlu Değerlendirme",
    title: "Regülasyon profilini çok boyutlu değerlendirme yapısı.",
    intro:
      "DNA Intelligence, farklı regülasyon alanlarından gelen verileri tek bir klinik profil altında düzenler, anlamlandırır ve bütüncül bir bakış sunar.",
    icon: ClipboardCheck,
    accent: "#00C8D7",
    sections: [
      {
        title: "Alan bazlı profil",
        text: "İnterosepsiyon, fizyolojik regülasyon, duyusal regülasyon, duygusal regülasyon, bilişsel regülasyon ve yürütücü işlevler birlikte ele alınır.",
      },
      {
        title: "Veri sentezi",
        text: "Skor, anamnez ve terapist gözlemi bir araya getirilerek klinik hipotez için anlamlı bir örüntü oluşturulur.",
      },
      {
        title: "Karar desteği",
        text: "Sistem, terapistin hangi alanları önceliklendireceğini daha net görmesine destek olur.",
      },
    ],
  },
  "mudahale-yaklasimi": {
    slug: "mudahale-yaklasimi",
    route: "/dna-nedir/mudahale-yaklasimi",
    eyebrow: "Müdahale Yaklaşımı",
    title: "Bilime dayalı. Kişiye özel. Regülasyonu hedefleyen müdahale yaklaşımı.",
    intro:
      "Dynamic Neuro-Regulation Approach, fizyolojiden bilişsel organizasyona uzanan regülasyon sistemini bütüncül olarak ele alır ve müdahale planını bu anlayış üzerine inşa eder.",
    icon: Layers3,
    accent: "#7C3AED",
    sections: [
      {
        title: "Bottom-up yaklaşım",
        text: "Fizyolojik ve duyusal düzenleme ihtiyaçları klinik planlamada görünür hale getirilir.",
      },
      {
        title: "Top-down yaklaşım",
        text: "Bilişsel, yürütücü ve çevresel düzenleme stratejileri işlevsel hedeflerle ilişkilendirilir.",
      },
      {
        title: "Vaka formülasyonu",
        text: "Amaç hazır reçete sunmak değil, terapistin vaka özelinde karar vermesini güçlendirmektir.",
      },
    ],
  },
  "ai-raporlama": {
    slug: "ai-raporlama",
    route: "/dna-nedir/ai-raporlama",
    eyebrow: "AI Destekli Klinik Raporlama",
    title: "Klinik veriyi AI ile anlamlandırın, raporu netleştirin.",
    intro:
      "DNA Intelligence AI; anamnez, ölçüm, gözlem ve terapist notlarını aynı klinik bağlamda birleştirir, örüntüleri görünür kılar ve profesyonel rapor taslağı hazırlar.",
    icon: FileText,
    accent: "#2563EB",
    sections: [
      {
        title: "AI klinik sentezi",
        text: "Farklı kaynaklardan gelen klinik verileri birlikte okuyarak güçlü alanları, destek ihtiyaçlarını ve öncelikleri görünür kılar.",
      },
      {
        title: "Profesyonel rapor taslağı",
        text: "Klinik özeti, öncelikli alanları, hedefleri ve takip göstergelerini okunabilir bir rapor yapısında düzenler.",
      },
      {
        title: "Terapist kontrolü",
        text: "AI tarafından hazırlanan taslak terapist tarafından incelenir, düzenlenir ve yalnızca uzman onayıyla tamamlanır.",
      },
    ],
  },
  "gelecek-moduller": {
    slug: "gelecek-moduller",
    route: "/dna-nedir/gelecek-moduller",
    eyebrow: "DNA Labs",
    title: "Klinik akışı geleceğe hazırlayan yeni modüller.",
    intro:
      "DNA Labs; seans gözlemini yapılandıran, değişimi zaman içinde izleyen ve elde edilen veriyi mevcut rapor akışına bağlayan klinik teknoloji yol haritasıdır.",
    icon: Sparkles,
    accent: "#00C8D7",
    sections: [
      {
        title: "Video gözlem",
        text: "Seans içi davranış, regülasyon tepkileri ve katılım örüntülerinin yapılandırılmış biçimde kaydedilmesini hedefler.",
      },
      {
        title: "Görüntü işleme",
        text: "Postür, hareket ve motor yanıt gibi gözlemsel işaretleri klinik bağlamla ilişkilendirecek altyapı planlanır.",
      },
      {
        title: "Gelişim takibi",
        text: "Değerlendirme, rapor ve gözlem kayıtlarını zaman çizgisinde birleştirerek değişimi görünür kılmayı hedefler.",
      },
    ],
  },
} as const;

export const dnaChildSlugs = Object.keys(dnaPages).filter((slug) => slug !== "dna-yaklasimi");

export type DnaPageKey = keyof typeof dnaPages;
