'use client';

import Link from "next/link";
import { IconType } from "react-icons";
import {
  FiActivity,
  FiArrowRight,
  FiBarChart2,
  FiBookOpen,
  FiCheck,
  FiCheckCircle,
  FiClipboard,
  FiClock,
  FiFileText,
  FiLayers,
  FiLock,
  FiMail,
  FiShield,
  FiUsers,
  FiX,
} from "react-icons/fi";

type ModuleCard = {
  icon: IconType;
  title: string;
  text: string;
};

type TechCard = {
  icon: IconType;
  title: string;
  text: string;
};

type StepItem = {
  no: string;
  title: string;
  text: string;
};

type Plan = {
  name: string;
  price: string;
  meta: string;
  badge?: string;
  highlight?: boolean;
  points: string[];
  cta: string;
};

type ComparisonRow = {
  label: string;
  values: Array<string | boolean>;
};

const modules: ModuleCard[] = [
  {
    icon: FiClipboard,
    title: "Yapılandırılmış Anamnez",
    text: "Demografik bilgiler, günlük yaşam, tıbbi öykü ve klinik gözlemleri serbest metin karmaşası olmadan tek akışta toplar.",
  },
  {
    icon: FiBarChart2,
    title: "Alt Boyut ve Toplam Skor Girişi",
    text: "Ölçek maddelerini tek tek göstermeden, terapistin klinik işleyişine uygun hızlı ve kontrollü skor girişi sağlar.",
  },
  {
    icon: FiFileText,
    title: "Versiyonlu Klinik Raporlama",
    text: "Her değerlendirme ayrı sürüm olarak tutulur; rapor geçmişi korunur, önceki kayıtların üstüne yazılmaz.",
  },
  {
    icon: FiBookOpen,
    title: "Teorik Eğitim ve Klinik Kaynak",
    text: "Panel içinden erişilen metodoloji, raporlama dili ve uygulama notlarıyla ekip standardizasyonunu destekler.",
  },
];

const techCards: TechCard[] = [
  {
    icon: FiLayers,
    title: "Structured Input Layer",
    text: "Anamnez, vaka alanları ve skor bilgileri şematik yapıda tutulur; düzensiz veri akışı azaltılır.",
  },
  {
    icon: FiShield,
    title: "Deterministik Klinik Çekirdek",
    text: "Skor doğrulama, sınıflama, risk işaretleme ve rapor iskeleti sabit kurallarla çalışır.",
  },
  {
    icon: FiLock,
    title: "LLM Guardrail",
    text: "Üretken katman varsa yalnızca dil akıcılığını iyileştirir; klinik karar ve etiketleme kuralları değişmez.",
  },
];

const steps: StepItem[] = [
  {
    no: "01",
    title: "Danışan kaydı oluşturulur",
    text: "Anonim kod, anamnez ve klinik bağlam tek akışta kaydedilir.",
  },
  {
    no: "02",
    title: "Alt boyut skorları girilir",
    text: "Madde düzeyi değil; klinik operasyona uygun alt boyut + toplam skor mantığı kullanılır.",
  },
  {
    no: "03",
    title: "Deterministik rapor üretilir",
    text: "Sınıflama, bayraklama ve rapor iskeleti kural tabanlı çekirdekten gelir.",
  },
  {
    no: "04",
    title: "Sürüm geçmişi korunur",
    text: "Her yeni rapor ayrı sürüm olur; önceki kayıtların üstüne yazılmaz.",
  },
];

const plans: Plan[] = [
  {
    name: "Başlangıç",
    price: "0 TL",
    meta: "Kurulum ve pilot kullanım",
    points: [
      "Temel panel erişimi",
      "Sınırlı klinik kaynak alanı",
      "Sunum ve pilot kurulum için uygun",
    ],
    cta: "İncele",
  },
  {
    name: "Uzman",
    price: "1.490 TL / ay",
    meta: "Tek terapist / tek panel",
    points: [
      "Yapılandırılmış anamnez",
      "Skor girişi ve rapor geçmişi",
      "Aylık 25 aktif danışan kapasitesi",
    ],
    cta: "Başlat",
  },
  {
    name: "Profesyonel",
    price: "2.990 TL / ay",
    meta: "Klinik ekipler için ölçeklenebilir",
    badge: "Önerilen",
    highlight: true,
    points: [
      "Çoklu kullanıcı erişimi",
      "Genişletilmiş eğitim alanı",
      "Daha yüksek vaka hacmi ve rapor akışı",
    ],
    cta: "En Güçlü Paket",
  },
  {
    name: "Kurumsal",
    price: "Özel Teklif",
    meta: "Kurum, merkez ve çoklu ekip yapısı",
    points: [
      "Admin rolü",
      "Klinik onboarding",
      "Özel uyarlama ve entegrasyon",
    ],
    cta: "Görüşme Planla",
  },
];

const comparisonRows: ComparisonRow[] = [
  {
    label: "Yapılandırılmış anamnez",
    values: [true, true, true, true],
  },
  {
    label: "Tek ölçek skor girişi",
    values: [true, true, true, true],
  },
  {
    label: "Versiyonlu rapor geçmişi",
    values: [true, true, true, true],
  },
  {
    label: "Teorik eğitim alanı",
    values: ["Sınırlı", "Aylık 10 saat", "Aylık 25 saat", "Sınırsız"],
  },
  {
    label: "Aylık aktif danışan",
    values: ["5", "25", "75", "Sınırsız"],
  },
  {
    label: "Uzman kullanıcı erişimi",
    values: ["1", "1", "3", "Çoklu"],
  },
  {
    label: "Admin rolü",
    values: [false, false, true, true],
  },
  {
    label: "Klinik onboarding",
    values: [false, false, true, true],
  },
  {
    label: "Özel uyarlama / entegrasyon",
    values: [false, false, false, true],
  },
];

const outcomes = [
  "Danışan listesi ve kayıt akışı",
  "Yapılandırılmış anamnez alanları",
  "Tek ölçek skor girişi",
  "Anlık risk etiketi",
  "Versiyonlu rapor görüntüleme",
  "Klinik eğitim ve metodoloji alanı",
];

export default function Home() {
  return (
    <>
      <main className="lpPage">
        <header className="lpHeader">
          <div className="lpShell lpHeaderInner">
            <a href="#ust" className="lpBrand">
              <span className="lpBrandMark">self</span>
              <span className="lpBrandText">Self Meta AI</span>
            </a>

            <nav className="lpNav">
              <a href="#platform">Platform</a>
              <a href="#moduller">Çözümler</a>
              <a href="#teknik">Teknik Mimari</a>
              <a href="#terapistler">Terapistler İçin</a>
              <a href="#paketler">Paketler</a>
              <a href="#iletisim">İletişim</a>
            </nav>

            <div className="lpHeaderActions">
              <Link href="/auth-login" className="lpGhostBtn lpHeaderBtn">
                Panele Giriş
              </Link>
              <Link href="/starter" className="lpPrimaryBtn lpHeaderBtn">
                Terapist Paneli
              </Link>
            </div>
          </div>
        </header>

        <section id="ust" className="lpHeroWrap">
          <div className="lpShell">
            <div className="lpHero">
              <div className="lpHeroContent">
                <div className="lpEyebrow">AI destekli klinik operasyon</div>
                <h1>
                  Yapay zeka destekli
                  <br />
                  klinik değerlendirme ve
                  <br />
                  raporlama çekirdeği
                </h1>
                <p>
                  Self Meta AI; yapılandırılmış anamnez, alt boyut skor girişi,
                  deterministik risk bayraklama ve versiyonlu rapor üretimini
                  tek panel içinde birleştiren modern bir klinik SaaS
                  altyapısıdır.
                </p>

                <div className="lpHeroActions">
                  <a href="#platform" className="lpPrimaryBtn">
                    Platformu İncele <FiArrowRight />
                  </a>
                  <Link href="/auth-signup" className="lpGhostBtn">
                    Kayıt Oluştur
                  </Link>
                </div>

                <div className="lpMiniGrid">
                  <div className="lpMiniCard">
                    <span>Structured anamnez</span>
                    <strong>Deterministic core</strong>
                  </div>
                  <div className="lpMiniCard">
                    <span>Immutable reports</span>
                    <strong>Expert/Admin role</strong>
                  </div>
                </div>
              </div>

              <div className="lpVisual">
                <div className="lpVisualPanel">
                  <div className="lpVisualTop">
                    <span className="lpWindowDots">
                      <i />
                      <i />
                      <i />
                    </span>
                    <strong>Self Meta Engine</strong>
                    <span className="lpWindowState">Stabil</span>
                  </div>

                  <div className="lpVisualBody">
                    <div className="lpVisualBlock">
                      <div className="lpBlockTitle">Klinik Akış Önizleme</div>
                      <div className="lpFlowStep">
                        <span>1. Yapılandırılmış Anamnez</span>
                        <small>
                          Demografik, tıbbi geçmiş, gebelik/doğum, günlük yaşam
                          ve hedef alanları
                        </small>
                      </div>
                      <div className="lpFlowStep">
                        <span>2. Alt Boyut Skor Girişi</span>
                        <div className="lpScoreRow">
                          <b>Alt 1</b>
                          <b>18</b>
                          <b>Alt 2</b>
                          <b>24</b>
                          <b>Alt 3</b>
                          <b>16</b>
                          <b>Alt 4</b>
                          <b>20</b>
                        </div>
                      </div>
                      <div className="lpFlowStep">
                        <span>3. Deterministik Çekirdek</span>
                        <small>Orta Risk</small>
                      </div>
                      <div className="lpFlowStep">
                        <span>4. Versiyonlu Rapor</span>
                        <small>Genel özet · Klinik yorum · Risk alanları</small>
                      </div>
                    </div>

                    <div className="lpVisualAside">
                      <div className="lpSignalCard">
                        <div className="lpSignalHead">LLM katmanı</div>
                        <div className="lpSignalText">
                          Sadece dil iyileştirme
                        </div>
                      </div>
                      <div className="lpSignalCard solid">
                        <div className="lpSignalHead">Klinik çekirdek</div>
                        <div className="lpSignalText">Sabit kalır</div>
                      </div>
                      <div className="lpSignalCard accent">
                        <div className="lpSignalHead">Rapor Motoru</div>
                        <div className="lpSignalText">
                          Versiyon: v4 · Immutable
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="lpFloat lpFloatA">
                  <FiShield />
                  <div>
                    <strong>Önceki kayıtların üstüne yazılmaz</strong>
                    <span>Her değerlendirme ayrı sürüm olur</span>
                  </div>
                </div>

                <div className="lpFloat lpFloatB">
                  <FiCheckCircle />
                  <div>
                    <strong>Kural tabanlı klinik iskelet</strong>
                    <span>Yalnızca dil akıcılığı esneyebilir</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="platform" className="lpTrustWrap">
          <div className="lpShell">
            <div className="lpTrustGrid">
              <div className="lpTrustCard">
                <span>Klinik operasyon katmanı</span>
                <strong>Tek panel</strong>
                <p>
                  Self Meta AI, klinik değerlendirmenin en kritik bölümlerini
                  yapılandırılmış veri toplama, skor kontrollü karar desteği ve
                  versiyonlu raporlama ile tek bir operasyon katmanına taşır.
                </p>
              </div>
              <div className="lpStatCard">
                <div className="lpStatLabel">Aktif Modül</div>
                <div className="lpStatValue">04</div>
                <div className="lpStatHint">Kayıt, skor, rapor, eğitim</div>
              </div>
              <div className="lpStatCard">
                <div className="lpStatLabel">Klinik Yapı</div>
                <div className="lpStatValue">Sabit</div>
                <div className="lpStatHint">Deterministik kurallar korunur</div>
              </div>
              <div className="lpStatCard">
                <div className="lpStatLabel">Rapor Mantığı</div>
                <div className="lpStatValue">İzlenebilir</div>
                <div className="lpStatHint">Her sürüm geri dönük görünür</div>
              </div>
            </div>
          </div>
        </section>

        <section id="moduller" className="lpSection">
          <div className="lpShell">
            <div className="lpSectionHead">
              <span>Çözümler</span>
              <h2>Klinik akışta gerçekten kullanılan modüller</h2>
              <p>
                Şişirilmiş özellik listesi yerine; demo ve gerçek klinik işleyişte
                kritik olan veri toplama, skorlama, raporlama ve bilgi desteği
                modülleri.
              </p>
            </div>

            <div className="lpModuleGrid">
              {modules.map((item) => {
                const Icon = item.icon;
                return (
                  <article key={item.title} className="lpModuleCard">
                    <div className="lpIconBox">
                      <Icon />
                    </div>
                    <h3>{item.title}</h3>
                    <p>{item.text}</p>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        <section id="teknik" className="lpSection">
          <div className="lpShell">
            <div className="lpTechPanel">
              <div className="lpSectionHead left">
                <span>Teknik Mimari</span>
                <h2>Klinik AI karar desteğinde kontrol kaybı olmadan otomasyon</h2>
                <p>
                  Üretken AI tek başına karar vermez. Self Meta AI; skor
                  doğrulama, sınıflama, risk işaretleme ve rapor iskeletini
                  deterministik katmanda tutar. LLM varsa, yalnızca klinik dilin
                  akıcılığını iyileştirir.
                </p>
              </div>

              <div className="lpTechGrid">
                {techCards.map((item) => {
                  const Icon = item.icon;
                  return (
                    <article key={item.title} className="lpTechCard">
                      <div className="lpTechIcon">
                        <Icon />
                      </div>
                      <h3>{item.title}</h3>
                      <p>{item.text}</p>
                    </article>
                  );
                })}
              </div>

              <div className="lpSpecGrid">
                <div className="lpSpecCard">
                  <strong>Veri Katmanı</strong>
                  <ul>
                    <li>Demografik bilgiler</li>
                    <li>Tıbbi geçmiş</li>
                    <li>Gebelik / doğum öyküsü</li>
                    <li>Günlük yaşam notları</li>
                  </ul>
                </div>
                <div className="lpSpecCard">
                  <strong>Kural Katmanı</strong>
                  <ul>
                    <li>Skor doğrulama</li>
                    <li>Alt boyut farklılaşma kontrolü</li>
                    <li>Tipik / atipik / riskli etiketleme</li>
                    <li>Bayrak üretimi ve rapor iskeleti</li>
                  </ul>
                </div>
                <div className="lpSpecCard">
                  <strong>Çıktı Katmanı</strong>
                  <ul>
                    <li>Kopyalanabilir, versiyonlu klinik rapor</li>
                    <li>Rapor v4</li>
                    <li>Uzman paneli içi görüntüleme</li>
                    <li>İzlenebilir geçmiş kaydı</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="terapistler" className="lpSection">
          <div className="lpShell">
            <div className="lpOpsGrid">
              <div className="lpOpsText">
                <div className="lpSectionHead left compact">
                  <span>Terapistler İçin</span>
                  <h2>Panel içinde veri, rapor, eğitim ve akış yönetimi</h2>
                  <p>
                    Klinik operasyonu bölen çoklu araçlar yerine; kayıt, skor,
                    rapor, ilerleme takibi ve teknik içerikleri tek yerde toplayan
                    sade ama güçlü bir uzman arayüzü.
                  </p>
                </div>

                <div className="lpOpsFeatureList">
                  <div className="lpOpsFeature">
                    <strong>Terapist Paneli</strong>
                    <span>Günlük operasyon görünümü</span>
                  </div>
                  <div className="lpOpsFeature">
                    <strong>Canlı Akış</strong>
                    <span>Toplam danışan, riskli bayrak ve yeni raporlar</span>
                  </div>
                  <div className="lpOpsFeature">
                    <strong>Kaynak Alanı</strong>
                    <span>Teorik eğitim ve akademik içerik desteği</span>
                  </div>
                </div>
              </div>

              <div className="lpOpsBoard">
                <div className="lpOpsBoardTop">
                  <span className="lpOpsBadge">Uzman Paneli</span>
                  <span className="lpOpsMuted">Günlük operasyon görünümü</span>
                </div>

                <div className="lpOpsStats">
                  <div className="lpOpsStat">
                    <span>Toplam Danışan</span>
                    <strong>24</strong>
                    <small>3 yeni kayıt bu hafta</small>
                  </div>
                  <div className="lpOpsStat">
                    <span>Riskli Bayrak</span>
                    <strong>5</strong>
                    <small>Yakın takip önerilir</small>
                  </div>
                </div>

                <div className="lpOpsList">
                  <div className="lpOpsListItem">
                    <b>SM-014</b>
                    <span>Rapor v4 görüntülendi</span>
                    <small>Orta risk</small>
                  </div>
                  <div className="lpOpsListItem">
                    <b>SM-032</b>
                    <span>Skor girişi bekleniyor</span>
                    <small>Yüksek öncelik</small>
                  </div>
                  <div className="lpOpsListItem">
                    <b>SM-021</b>
                    <span>Versiyon karşılaştırması açıldı</span>
                    <small>Düşük risk</small>
                  </div>
                </div>

                <div className="lpOutcomeList">
                  {outcomes.map((item) => (
                    <div key={item} className="lpOutcomeItem">
                      <FiCheckCircle />
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="lpSection">
          <div className="lpShell">
            <div className="lpSectionHead">
              <span>İş Akışı</span>
              <h2>Sunumda anlatması kolay, klinikte kullanması mantıklı akış</h2>
            </div>

            <div className="lpStepGrid">
              {steps.map((item) => (
                <article key={item.no} className="lpStepCard">
                  <div className="lpStepNo">{item.no}</div>
                  <h3>{item.title}</h3>
                  <p>{item.text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="paketler" className="lpSection lpPackageSection">
          <div className="lpShell">
            <div className="lpSectionHead">
              <span>Fiyatlandırma</span>
              <h2>Ölçeklenebilir paketler, klinik mantığa uygun erişim modeli</h2>
              <p>
                Demo gösteriminden profesyonel kullanıma kadar, aynı ürün
                çekirdeği üzerinde farklı kapasite ve erişim seviyeleri.
              </p>
            </div>

            <div className="lpPlanGrid">
              {plans.map((plan) => (
                <article
                  key={plan.name}
                  className={`lpPlanCard ${plan.highlight ? "highlight" : ""}`}
                >
                  {plan.badge ? <span className="lpPlanBadge">{plan.badge}</span> : null}
                  <div className="lpPlanHead">
                    <h3>{plan.name}</h3>
                    <p>{plan.meta}</p>
                  </div>

                  <div className="lpPlanPrice">{plan.price}</div>

                  <ul className="lpPlanPoints">
                    {plan.points.map((point) => (
                      <li key={point}>
                        <FiCheckCircle />
                        <span>{point}</span>
                      </li>
                    ))}
                  </ul>

                  <a href="#iletisim" className="lpPrimaryBtn lpPlanBtn">
                    {plan.cta}
                  </a>
                </article>
              ))}
            </div>

            <div className="lpTableWrap">
              <table className="lpTable">
                <thead>
                  <tr>
                    <th>Özellik</th>
                    <th>Başlangıç</th>
                    <th>Uzman</th>
                    <th>Profesyonel</th>
                    <th>Kurumsal</th>
                  </tr>
                </thead>
                <tbody>
                  {comparisonRows.map((row) => (
                    <tr key={row.label}>
                      <td>{row.label}</td>
                      {row.values.map((value, idx) => (
                        <td key={`${row.label}-${idx}`}>
                          {typeof value === "boolean" ? (
                            value ? (
                              <span className="lpBool ok">
                                <FiCheck />
                              </span>
                            ) : (
                              <span className="lpBool no">
                                <FiX />
                              </span>
                            )
                          ) : (
                            <span>{value}</span>
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <section id="iletisim" className="lpSection">
          <div className="lpShell">
            <div className="lpCtaPanel">
              <div className="lpCtaText">
                <span>İletişim</span>
                <h2>Klinik akışı sadeleştiren bir platforma ihtiyacın varsa, başlangıç burası</h2>
                <p>
                  Self Meta AI; özellikle teknopark sunumu, pilot klinik kurulum
                  ve uzman odaklı değerlendirme akışları için tasarlandı. Danışan
                  listesi, skor girişi ve rapor ekranı aynı ürün omurgasında
                  gösterilir.
                </p>
              </div>

              <div className="lpCtaActions">
                <Link href="/starter" className="lpPrimaryBtn">
                  Panele Geç <FiArrowRight />
                </Link>
                <Link href="/auth-login" className="lpGhostBtn">
                  Giriş Ekranı
                </Link>
                <div className="lpContactBox">
                  <FiMail />
                  <span>selfmeta.ai.demo@gmail.com</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <footer className="lpFooter">
          <div className="lpShell lpFooterInner">
            <div className="lpFooterBrand">Self Meta AI</div>
            <div className="lpFooterText">
              Klinik değerlendirme, skor girişi ve versiyonlu raporlama altyapısı
            </div>
          </div>
        </footer>
      </main>

      <style jsx global>{`
        :root {
          --lp-bg: #f4f7fb;
          --lp-surface: #ffffff;
          --lp-surface-2: #eef5fb;
          --lp-line: #dbe5f0;
          --lp-line-strong: #c8d7e7;
          --lp-text: #14263d;
          --lp-muted: #60748d;
          --lp-primary: #234a74;
          --lp-primary-2: #2f6b8d;
          --lp-accent: #dff1f5;
          --lp-accent-2: #ecf8fb;
          --lp-shadow: 0 24px 60px rgba(21, 43, 69, 0.08);
        }

        html {
          scroll-behavior: smooth;
        }

        body {
          margin: 0;
          background: var(--lp-bg);
          color: var(--lp-text);
          font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        }

        a {
          color: inherit;
          text-decoration: none;
        }

        * {
          box-sizing: border-box;
        }
      `}</style>

      <style jsx>{`
        .lpPage {
          min-height: 100vh;
        }

        .lpShell {
          width: min(1220px, calc(100% - 32px));
          margin: 0 auto;
        }

        .lpHeader {
          position: sticky;
          top: 0;
          z-index: 50;
          backdrop-filter: blur(16px);
          background: rgba(244, 247, 251, 0.78);
          border-bottom: 1px solid rgba(219, 229, 240, 0.9);
        }

        .lpHeaderInner {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 24px;
          min-height: 84px;
        }

        .lpBrand {
          display: flex;
          align-items: center;
          gap: 14px;
          min-width: fit-content;
        }

        .lpBrandMark {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 64px;
          height: 44px;
          border-radius: 999px;
          background: linear-gradient(135deg, #dff1f5, #eef5fb);
          border: 1px solid var(--lp-line);
          color: var(--lp-primary);
          font-size: 1.55rem;
          font-weight: 800;
          letter-spacing: -0.04em;
          text-transform: lowercase;
        }

        .lpBrandText {
          font-size: 1.06rem;
          font-weight: 700;
          color: var(--lp-text);
          letter-spacing: -0.02em;
        }

        .lpNav {
          display: flex;
          align-items: center;
          gap: 28px;
          font-size: 0.98rem;
          color: var(--lp-muted);
        }

        .lpNav a:hover {
          color: var(--lp-primary);
        }

        .lpHeaderActions {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .lpHeaderBtn {
          min-height: 46px;
        }

        .lpHeroWrap {
          padding: 52px 0 24px;
        }

        .lpHero {
          display: grid;
          grid-template-columns: 1.02fr 0.98fr;
          gap: 28px;
          align-items: stretch;
        }

        .lpHeroContent,
        .lpVisual {
          background: linear-gradient(180deg, rgba(255, 255, 255, 0.96), rgba(245, 249, 253, 0.96));
          border: 1px solid var(--lp-line);
          border-radius: 32px;
          box-shadow: var(--lp-shadow);
        }

        .lpHeroContent {
          padding: 42px;
        }

        .lpEyebrow {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 10px 16px;
          border-radius: 999px;
          background: #edf4fb;
          color: var(--lp-primary);
          font-size: 0.9rem;
          font-weight: 700;
          margin-bottom: 18px;
        }

        .lpHeroContent h1 {
          margin: 0;
          font-size: clamp(2.5rem, 5vw, 4.5rem);
          line-height: 1.02;
          letter-spacing: -0.05em;
        }

        .lpHeroContent p {
          margin: 22px 0 0;
          max-width: 640px;
          color: var(--lp-muted);
          font-size: 1.08rem;
          line-height: 1.8;
        }

        .lpHeroActions {
          display: flex;
          align-items: center;
          gap: 14px;
          margin-top: 28px;
          flex-wrap: wrap;
        }

        .lpPrimaryBtn,
        .lpGhostBtn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          min-height: 54px;
          padding: 0 22px;
          border-radius: 16px;
          font-weight: 700;
          transition: transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease, background 0.18s ease;
        }

        .lpPrimaryBtn {
          background: linear-gradient(135deg, var(--lp-primary), var(--lp-primary-2));
          color: #ffffff;
          box-shadow: 0 18px 32px rgba(35, 74, 116, 0.18);
          border: 1px solid transparent;
        }

        .lpGhostBtn {
          background: #ffffff;
          color: var(--lp-primary);
          border: 1px solid var(--lp-line-strong);
        }

        .lpPrimaryBtn:hover,
        .lpGhostBtn:hover {
          transform: translateY(-1px);
        }

        .lpMiniGrid {
          margin-top: 28px;
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 14px;
        }

        .lpMiniCard {
          padding: 18px 20px;
          border-radius: 20px;
          background: #f8fbfe;
          border: 1px solid var(--lp-line);
        }

        .lpMiniCard span {
          display: block;
          color: var(--lp-muted);
          font-size: 0.86rem;
          margin-bottom: 8px;
        }

        .lpMiniCard strong {
          display: block;
          font-size: 1rem;
          color: var(--lp-text);
        }

        .lpVisual {
          position: relative;
          padding: 26px;
          overflow: hidden;
          background:
            radial-gradient(circle at top right, rgba(223, 241, 245, 0.95), transparent 32%),
            radial-gradient(circle at bottom left, rgba(236, 248, 251, 0.95), transparent 40%),
            linear-gradient(180deg, rgba(255, 255, 255, 0.98), rgba(246, 250, 253, 0.98));
        }

        .lpVisualPanel {
          position: relative;
          z-index: 2;
          height: 100%;
          border-radius: 26px;
          background: rgba(255, 255, 255, 0.9);
          border: 1px solid rgba(219, 229, 240, 0.95);
          box-shadow: 0 20px 40px rgba(20, 38, 61, 0.08);
          padding: 22px;
        }

        .lpVisualTop {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 18px;
        }

        .lpWindowDots {
          display: inline-flex;
          align-items: center;
          gap: 6px;
        }

        .lpWindowDots i {
          width: 10px;
          height: 10px;
          border-radius: 50%;
          background: #d1dbe6;
          display: block;
        }

        .lpWindowState {
          padding: 8px 12px;
          border-radius: 999px;
          background: #edf7f2;
          color: #21784f;
          font-size: 0.82rem;
          font-weight: 700;
        }

        .lpVisualBody {
          display: grid;
          grid-template-columns: 1.25fr 0.75fr;
          gap: 16px;
        }

        .lpVisualBlock,
        .lpSignalCard {
          border: 1px solid var(--lp-line);
          border-radius: 22px;
        }

        .lpVisualBlock {
          padding: 18px;
          background: #fbfdff;
        }

        .lpBlockTitle {
          font-size: 0.95rem;
          font-weight: 700;
          color: var(--lp-primary);
          margin-bottom: 14px;
        }

        .lpFlowStep {
          padding: 14px 0;
          border-bottom: 1px solid #e7eef5;
        }

        .lpFlowStep:last-child {
          border-bottom: none;
          padding-bottom: 0;
        }

        .lpFlowStep span {
          display: block;
          font-size: 0.95rem;
          font-weight: 700;
          margin-bottom: 6px;
        }

        .lpFlowStep small {
          display: block;
          color: var(--lp-muted);
          line-height: 1.55;
          font-size: 0.86rem;
        }

        .lpScoreRow {
          display: grid;
          grid-template-columns: repeat(4, max-content);
          gap: 8px 10px;
          align-items: center;
        }

        .lpScoreRow b {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-width: 56px;
          height: 34px;
          padding: 0 10px;
          border-radius: 12px;
          background: #eef5fb;
          border: 1px solid #d8e4ef;
          color: var(--lp-primary);
          font-size: 0.84rem;
        }

        .lpVisualAside {
          display: grid;
          gap: 12px;
        }

        .lpSignalCard {
          padding: 16px;
          background: #f8fbfe;
        }

        .lpSignalCard.solid {
          background: linear-gradient(135deg, #234a74, #2f6b8d);
          border-color: transparent;
          color: #ffffff;
        }

        .lpSignalCard.accent {
          background: #eef7fa;
        }

        .lpSignalHead {
          font-size: 0.82rem;
          font-weight: 700;
          opacity: 0.9;
        }

        .lpSignalText {
          margin-top: 10px;
          font-size: 1rem;
          font-weight: 800;
          line-height: 1.4;
        }

        .lpFloat {
          position: absolute;
          z-index: 3;
          display: flex;
          align-items: center;
          gap: 12px;
          max-width: 270px;
          padding: 14px 16px;
          border-radius: 18px;
          background: rgba(255, 255, 255, 0.96);
          border: 1px solid var(--lp-line);
          box-shadow: 0 18px 30px rgba(20, 38, 61, 0.08);
        }

        .lpFloat svg {
          flex: 0 0 18px;
          font-size: 1.1rem;
          color: var(--lp-primary);
        }

        .lpFloat strong,
        .lpFloat span {
          display: block;
        }

        .lpFloat strong {
          font-size: 0.86rem;
          line-height: 1.35;
        }

        .lpFloat span {
          font-size: 0.78rem;
          color: var(--lp-muted);
          margin-top: 4px;
          line-height: 1.35;
        }

        .lpFloatA {
          top: 16px;
          right: 16px;
        }

        .lpFloatB {
          left: 18px;
          bottom: 18px;
        }

        .lpTrustWrap {
          padding: 14px 0 8px;
        }

        .lpTrustGrid {
          display: grid;
          grid-template-columns: 1.3fr repeat(3, minmax(0, 1fr));
          gap: 16px;
        }

        .lpTrustCard,
        .lpStatCard {
          border-radius: 24px;
          background: #ffffff;
          border: 1px solid var(--lp-line);
          box-shadow: var(--lp-shadow);
        }

        .lpTrustCard {
          padding: 28px;
        }

        .lpTrustCard span {
          display: inline-flex;
          padding: 8px 12px;
          border-radius: 999px;
          background: #edf5fb;
          color: var(--lp-primary);
          font-size: 0.82rem;
          font-weight: 700;
          margin-bottom: 12px;
        }

        .lpTrustCard strong {
          display: block;
          font-size: 1.34rem;
          letter-spacing: -0.03em;
          margin-bottom: 10px;
        }

        .lpTrustCard p {
          margin: 0;
          color: var(--lp-muted);
          line-height: 1.7;
        }

        .lpStatCard {
          padding: 24px;
          display: flex;
          flex-direction: column;
          justify-content: center;
        }

        .lpStatLabel {
          font-size: 0.85rem;
          font-weight: 700;
          color: var(--lp-muted);
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }

        .lpStatValue {
          font-size: 2rem;
          font-weight: 800;
          letter-spacing: -0.04em;
          margin-top: 8px;
        }

        .lpStatHint {
          margin-top: 8px;
          color: var(--lp-muted);
          line-height: 1.5;
        }

        .lpSection {
          padding: 42px 0;
        }

        .lpSectionHead {
          text-align: center;
          margin: 0 auto 28px;
          max-width: 820px;
        }

        .lpSectionHead.left {
          text-align: left;
          margin-left: 0;
          margin-right: 0;
        }

        .lpSectionHead.compact {
          margin-bottom: 18px;
        }

        .lpSectionHead span {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 8px 12px;
          border-radius: 999px;
          background: #edf5fb;
          color: var(--lp-primary);
          font-size: 0.84rem;
          font-weight: 700;
          margin-bottom: 14px;
        }

        .lpSectionHead h2 {
          margin: 0;
          font-size: clamp(2rem, 3.6vw, 3.1rem);
          line-height: 1.08;
          letter-spacing: -0.04em;
        }

        .lpSectionHead p {
          margin: 14px 0 0;
          color: var(--lp-muted);
          font-size: 1.02rem;
          line-height: 1.8;
        }

        .lpModuleGrid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 18px;
        }

        .lpModuleCard,
        .lpTechCard,
        .lpStepCard {
          background: #ffffff;
          border: 1px solid var(--lp-line);
          border-radius: 26px;
          box-shadow: var(--lp-shadow);
        }

        .lpModuleCard {
          padding: 24px;
        }

        .lpIconBox,
        .lpTechIcon {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 58px;
          height: 58px;
          border-radius: 18px;
          background: linear-gradient(135deg, #edf5fb, #eef7fa);
          color: var(--lp-primary);
          font-size: 1.35rem;
          margin-bottom: 18px;
          border: 1px solid var(--lp-line);
        }

        .lpModuleCard h3,
        .lpTechCard h3,
        .lpStepCard h3 {
          margin: 0;
          font-size: 1.24rem;
          line-height: 1.35;
          letter-spacing: -0.03em;
        }

        .lpModuleCard p,
        .lpTechCard p,
        .lpStepCard p {
          margin: 12px 0 0;
          color: var(--lp-muted);
          line-height: 1.75;
        }

        .lpTechPanel {
          padding: 34px;
          border-radius: 32px;
          background: linear-gradient(180deg, #ffffff, #f8fbfe);
          border: 1px solid var(--lp-line);
          box-shadow: var(--lp-shadow);
        }

        .lpTechGrid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 18px;
          margin-top: 24px;
        }

        .lpTechCard {
          padding: 24px;
        }

        .lpSpecGrid {
          margin-top: 22px;
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 18px;
        }

        .lpSpecCard {
          padding: 22px;
          border-radius: 24px;
          background: #f8fbfe;
          border: 1px solid var(--lp-line);
        }

        .lpSpecCard strong {
          display: block;
          font-size: 1rem;
          margin-bottom: 12px;
        }

        .lpSpecCard ul {
          list-style: none;
          padding: 0;
          margin: 0;
          display: grid;
          gap: 10px;
          color: var(--lp-muted);
          line-height: 1.6;
        }

        .lpSpecCard li {
          position: relative;
          padding-left: 20px;
        }

        .lpSpecCard li::before {
          content: "";
          position: absolute;
          left: 0;
          top: 9px;
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: linear-gradient(135deg, var(--lp-primary), var(--lp-primary-2));
        }

        .lpOpsGrid {
          display: grid;
          grid-template-columns: 0.96fr 1.04fr;
          gap: 22px;
          align-items: start;
        }

        .lpOpsFeatureList {
          display: grid;
          gap: 14px;
          margin-top: 22px;
        }

        .lpOpsFeature {
          padding: 18px 20px;
          border-radius: 20px;
          background: #ffffff;
          border: 1px solid var(--lp-line);
          box-shadow: var(--lp-shadow);
        }

        .lpOpsFeature strong,
        .lpOpsFeature span {
          display: block;
        }

        .lpOpsFeature strong {
          font-size: 1rem;
          margin-bottom: 6px;
        }

        .lpOpsFeature span {
          color: var(--lp-muted);
          line-height: 1.55;
        }

        .lpOpsBoard {
          padding: 24px;
          border-radius: 30px;
          background: linear-gradient(180deg, #ffffff, #f8fbfe);
          border: 1px solid var(--lp-line);
          box-shadow: var(--lp-shadow);
        }

        .lpOpsBoardTop {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 16px;
        }

        .lpOpsBadge {
          display: inline-flex;
          padding: 8px 12px;
          border-radius: 999px;
          background: #edf5fb;
          color: var(--lp-primary);
          font-size: 0.84rem;
          font-weight: 700;
        }

        .lpOpsMuted {
          color: var(--lp-muted);
          font-size: 0.92rem;
        }

        .lpOpsStats {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 14px;
        }

        .lpOpsStat {
          padding: 18px;
          border-radius: 22px;
          background: #ffffff;
          border: 1px solid var(--lp-line);
        }

        .lpOpsStat span,
        .lpOpsStat small {
          display: block;
        }

        .lpOpsStat span {
          color: var(--lp-muted);
          font-size: 0.88rem;
          margin-bottom: 10px;
        }

        .lpOpsStat strong {
          font-size: 2rem;
          letter-spacing: -0.05em;
        }

        .lpOpsStat small {
          margin-top: 8px;
          color: var(--lp-muted);
          line-height: 1.45;
        }

        .lpOpsList {
          display: grid;
          gap: 12px;
          margin-top: 16px;
        }

        .lpOpsListItem {
          padding: 16px 18px;
          border-radius: 20px;
          background: #f8fbfe;
          border: 1px solid var(--lp-line);
        }

        .lpOpsListItem b,
        .lpOpsListItem span,
        .lpOpsListItem small {
          display: block;
        }

        .lpOpsListItem b {
          font-size: 1rem;
          margin-bottom: 4px;
        }

        .lpOpsListItem span {
          color: var(--lp-text);
          font-size: 0.95rem;
        }

        .lpOpsListItem small {
          color: var(--lp-muted);
          margin-top: 6px;
        }

        .lpOutcomeList {
          margin-top: 18px;
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 12px;
        }

        .lpOutcomeItem {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 14px 16px;
          border-radius: 18px;
          background: #ffffff;
          border: 1px solid var(--lp-line);
          color: var(--lp-text);
        }

        .lpOutcomeItem svg {
          color: #21784f;
          flex: 0 0 auto;
        }

        .lpStepGrid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 18px;
        }

        .lpStepCard {
          padding: 24px;
        }

        .lpStepNo {
          width: 56px;
          height: 56px;
          border-radius: 16px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          background: linear-gradient(135deg, #edf5fb, #eef7fa);
          color: var(--lp-primary);
          border: 1px solid var(--lp-line);
          font-weight: 800;
          margin-bottom: 16px;
        }

        .lpPackageSection {
          padding-bottom: 22px;
        }

        .lpPlanGrid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 18px;
        }

        .lpPlanCard {
          position: relative;
          padding: 24px;
          border-radius: 28px;
          background: #ffffff;
          border: 1px solid var(--lp-line);
          box-shadow: var(--lp-shadow);
        }

        .lpPlanCard.highlight {
          background: linear-gradient(180deg, #ffffff, #eef7fa);
          border-color: #b9d4df;
          transform: translateY(-4px);
        }

        .lpPlanBadge {
          position: absolute;
          top: 18px;
          right: 18px;
          padding: 8px 12px;
          border-radius: 999px;
          background: linear-gradient(135deg, var(--lp-primary), var(--lp-primary-2));
          color: #ffffff;
          font-size: 0.8rem;
          font-weight: 800;
        }

        .lpPlanHead h3 {
          margin: 0;
          font-size: 1.28rem;
        }

        .lpPlanHead p {
          margin: 8px 0 0;
          color: var(--lp-muted);
          min-height: 48px;
          line-height: 1.55;
        }

        .lpPlanPrice {
          margin-top: 18px;
          font-size: 2rem;
          font-weight: 800;
          letter-spacing: -0.05em;
        }

        .lpPlanPoints {
          list-style: none;
          padding: 0;
          margin: 18px 0 0;
          display: grid;
          gap: 12px;
        }

        .lpPlanPoints li {
          display: flex;
          align-items: flex-start;
          gap: 10px;
          color: var(--lp-muted);
          line-height: 1.55;
        }

        .lpPlanPoints svg {
          color: #21784f;
          margin-top: 2px;
          flex: 0 0 auto;
        }

        .lpPlanBtn {
          width: 100%;
          margin-top: 22px;
        }

        .lpTableWrap {
          margin-top: 24px;
          overflow-x: auto;
          border-radius: 28px;
          background: #ffffff;
          border: 1px solid var(--lp-line);
          box-shadow: var(--lp-shadow);
        }

        .lpTable {
          width: 100%;
          min-width: 920px;
          border-collapse: collapse;
        }

        .lpTable th,
        .lpTable td {
          padding: 18px 20px;
          text-align: center;
          border-bottom: 1px solid var(--lp-line);
        }

        .lpTable th:first-child,
        .lpTable td:first-child {
          text-align: left;
        }

        .lpTable thead th {
          background: #f4f9fd;
          color: var(--lp-text);
          font-size: 0.94rem;
        }

        .lpTable tbody td {
          color: var(--lp-muted);
        }

        .lpTable tbody tr:last-child td {
          border-bottom: none;
        }

        .lpBool {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 34px;
          height: 34px;
          border-radius: 50%;
          font-size: 1rem;
          margin: 0 auto;
        }

        .lpBool.ok {
          background: #edf7f2;
          color: #21784f;
        }

        .lpBool.no {
          background: #f6f8fb;
          color: #8b98ab;
        }

        .lpCtaPanel {
          padding: 30px;
          border-radius: 32px;
          background: linear-gradient(135deg, #1d3f63, #2f6b8d);
          color: #ffffff;
          display: grid;
          grid-template-columns: 1.2fr 0.8fr;
          gap: 20px;
          align-items: center;
          box-shadow: 0 24px 60px rgba(29, 63, 99, 0.24);
        }

        .lpCtaText span {
          display: inline-flex;
          padding: 8px 12px;
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.14);
          font-size: 0.82rem;
          font-weight: 700;
          margin-bottom: 12px;
        }

        .lpCtaText h2 {
          margin: 0;
          font-size: clamp(2rem, 3.3vw, 3rem);
          line-height: 1.1;
          letter-spacing: -0.04em;
        }

        .lpCtaText p {
          margin: 14px 0 0;
          color: rgba(255, 255, 255, 0.84);
          line-height: 1.8;
        }

        .lpCtaActions {
          display: flex;
          flex-direction: column;
          gap: 14px;
          align-items: stretch;
        }

        .lpContactBox {
          display: flex;
          align-items: center;
          gap: 10px;
          min-height: 56px;
          padding: 0 18px;
          border-radius: 18px;
          background: rgba(255, 255, 255, 0.12);
          border: 1px solid rgba(255, 255, 255, 0.18);
        }

        .lpFooter {
          padding: 18px 0 36px;
        }

        .lpFooterInner {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          color: var(--lp-muted);
          font-size: 0.95rem;
        }

        .lpFooterBrand {
          font-weight: 800;
          color: var(--lp-text);
        }

        @media (max-width: 1180px) {
          .lpNav {
            display: none;
          }

          .lpHero,
          .lpOpsGrid,
          .lpCtaPanel,
          .lpTrustGrid,
          .lpTechGrid,
          .lpSpecGrid,
          .lpModuleGrid,
          .lpStepGrid,
          .lpPlanGrid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .lpVisualBody {
            grid-template-columns: 1fr;
          }

          .lpOutcomeList {
            grid-template-columns: 1fr;
          }

          .lpCtaPanel {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 860px) {
          .lpHeaderInner {
            flex-wrap: wrap;
            justify-content: center;
            padding: 14px 0;
          }

          .lpHeaderActions {
            width: 100%;
            justify-content: center;
          }

          .lpHero,
          .lpTrustGrid,
          .lpModuleGrid,
          .lpTechGrid,
          .lpSpecGrid,
          .lpOpsGrid,
          .lpStepGrid,
          .lpPlanGrid {
            grid-template-columns: 1fr;
          }

          .lpMiniGrid,
          .lpOpsStats {
            grid-template-columns: 1fr;
          }

          .lpHeroContent,
          .lpVisual,
          .lpTechPanel,
          .lpCtaPanel {
            padding: 22px;
          }

          .lpFloat {
            position: static;
            max-width: none;
            margin-top: 12px;
          }

          .lpVisual {
            display: grid;
            gap: 12px;
          }

          .lpShell {
            width: min(1220px, calc(100% - 20px));
          }

          .lpFooterInner {
            flex-direction: column;
            text-align: center;
          }
        }

        @media (max-width: 560px) {
          .lpHeroContent h1 {
            font-size: 2.5rem;
          }

          .lpPrimaryBtn,
          .lpGhostBtn {
            width: 100%;
          }

          .lpBrand {
            width: 100%;
            justify-content: center;
          }

          .lpHeaderActions {
            flex-direction: column;
          }
        }
      `}</style>
    </>
  );
}
