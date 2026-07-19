import FooterContact from "../components/FooterContact";
import LandingHeader from "../components/LandingHeader";

export default function Page() {
  return (
    <div className="fixed inset-0 z-[9999] overflow-y-auto bg-white">
      <LandingHeader />

      <main className="mx-auto max-w-5xl px-6 py-16">
        <h1 className="text-4xl font-extrabold tracking-tight text-slate-900">
          Self-Regülasyon Nedir?
        </h1>

        <p className="mt-6 text-lg leading-8 text-slate-600">
          Self-regülasyon, bireyin fizyolojik uyarılmışlık düzeyini, duyusal
          yanıtlarını, duygusal tepkilerini, dikkat süreçlerini ve davranışsal
          organizasyonunu bağlama uygun şekilde düzenleyebilme kapasitesidir.
          Bu kavram yalnızca davranış kontrolünü değil; beden, beyin, çevre ve
          görev talepleri arasındaki dinamik uyumu da kapsar. Erken çocukluk
          döneminde self-regülasyon becerilerinin gelişimi; öğrenme, sosyal
          etkileşim, oyun, günlük yaşam becerileri ve akademik hazırlık üzerinde
          önemli bir işleve sahiptir; tek başına bu sonuçları belirlediği varsayılmaz.
        </p>

        <section className="mt-12 space-y-6 text-slate-700 leading-8">
          <h2 className="text-2xl font-semibold text-slate-900">
            Self-Regülasyonun Klinik Önemi
          </h2>

          <p>
            Çocuk gelişiminde self-regülasyon becerileri; dikkat sürdürme,
            dürtü kontrolü, duygusal toparlanma, geçişlere uyum sağlama ve
            çevresel uyaranlarla baş etme kapasitesinin temelinde yer alır.
            Bu beceriler zayıf olduğunda çocukta yalnızca davranışsal sorunlar
            değil, aynı zamanda öğrenme güçlükleri, sosyal katılım kısıtlılığı,
            günlük rutinlerde zorlanma ve bakım veren yükünde artış da
            görülebilir.
          </p>

          <p>
            Klinik uygulamada self-regülasyon güçlükleri çoğu zaman tek bir
            belirti kümesi olarak ortaya çıkmaz. Bazı çocuklarda fizyolojik
            kırılganlık, bazılarında duyusal aşırı yüklenme, bazılarında ise
            bilişsel ve yürütücü işlev zorlanmaları ön planda olabilir. Bu
            nedenle self-regülasyonun değerlendirilmesi, yalnızca semptomları
            saymak değil; farklı regülasyon sistemleri arasındaki örüntüyü
            anlamak anlamına gelir.
          </p>
        </section>

        <section className="mt-12 space-y-6 text-slate-700 leading-8">
          <h2 className="text-2xl font-semibold text-slate-900">
            Self-Regülasyonun Temel Bileşenleri
          </h2>

          <p>
            Güncel gelişimsel ve nöropsikolojik yaklaşımlar, self-regülasyonu
            çok boyutlu bir yapı olarak ele alır. Bu yapı tek bir beceriden
            değil, birbiriyle ilişkili sistemlerden oluşur.
          </p>

          <ul className="list-disc space-y-3 pl-6">
            <li>
              <strong>Fizyolojik Regülasyon:</strong> Uykunun, açlık-tokluk
              ritminin, uyarılmışlık düzeyinin ve temel bedensel dengenin
              düzenlenmesi.
            </li>
            <li>
              <strong>Duyusal Regülasyon:</strong> Çevresel uyaranlara verilen
              yanıtların modülasyonu; ses, dokunma, hareket, görsel uyaran ve
              diğer duyusal girdilere uyum sağlama.
            </li>
            <li>
              <strong>Duygusal Regülasyon:</strong> Duygusal tepkilerin
              yoğunluğunu, süresini ve toparlanma hızını yönetebilme.
            </li>
            <li>
              <strong>Bilişsel Regülasyon:</strong> Dikkati sürdürme, göreve
              odaklanma ve bilişsel yük altında işlevi koruyabilme.
            </li>
            <li>
              <strong>Yürütücü İşlev:</strong> Planlama, esneklik, ketleme,
              geçiş yapabilme ve hedefe yönelik davranışı organize etme.
            </li>
            <li>
              <strong>İnterosepsiyon:</strong> Açlık, susuzluk, yorgunluk,
              ağrı ve tuvalet ihtiyacı gibi içsel beden sinyallerini fark etme
              ve anlamlandırma.
            </li>
          </ul>

          <p>
            Bu alanlar birbirinden bağımsız değildir. Örneğin bedensel
            uyarılmışlık düzeyindeki düzensizlikler dikkat kontrolünü
            zorlaştırabilir; duyusal yüklenme duygusal tepkileri artırabilir;
            interoseptif farkındalıktaki yetersizlik ise davranışsal
            organizasyonu ve öz bakım rutinlerini etkileyebilir.
          </p>
        </section>

        <section className="mt-12 space-y-6 text-slate-700 leading-8">
          <h2 className="text-2xl font-semibold text-slate-900">
            Neden Çok Boyutlu Değerlendirme Gerekir?
          </h2>

          <p>
            Self-regülasyon güçlükleri klinikte sıklıkla “hareketlilik”,
            “öfke”, “dikkatsizlik” ya da “uyaranlara aşırı tepki” gibi yüzeyde
            görülen belirtiler üzerinden tarif edilir. Aynı davranış farklı
            işlevsel bağlamlarda görülebilir. Ölçek ve gözlem örüntüsü bu bağlamları
            tartışmaya yardımcı olur; altta yatan biyolojik mekanizmayı, fizyolojik
            durumu veya kesin nedeni ölçmez.
          </p>

          <p>
            Bu nedenle yalnızca tek boyutlu tarama yaklaşımı çoğu zaman yetersiz
            kalır. Klinik olarak anlamlı olan, alanlar arası dağılımı ve bu
            alanların aynı işlevsel tabloda nasıl dağıldığını görebilmektir. Çok
            boyutlu değerlendirme, raporlanan alanlarda görece korunmuş kapasite
            ve zorlanma örüntülerini görünür kılar; bunların nedeni hakkında kesin
            sonuç üretmez.
          </p>
        </section>

        <section className="mt-12 space-y-6 text-slate-700 leading-8">
          <h2 className="text-2xl font-semibold text-slate-900">
            Ergoterapi ve Rehabilitasyon Açısından Anlamı
          </h2>

          <p>
            Ergoterapi perspektifinde self-regülasyon yalnızca içsel bir süreç
            değil; çocuğun aktiviteye katılımını, oyun performansını, öz bakım
            becerilerini ve sosyal çevreyle etkileşimini belirleyen işlevsel bir
            yapıdır. Bu nedenle değerlendirme süreci, yalnızca problem alanlarını
            saptamayı değil, çocuğun gündelik yaşam içindeki performans
            örüntüsünü anlamayı hedefler.
          </p>

          <p>
            Klinik karar verme sürecinde raporlanan zorlanma ve korunmuş kapasite
            alanları, terapistin daha geniş değerlendirmesi içinde ele alınır.
            Bir alanın diğerinin tetikleyicisi, ikincil sonucu veya biyolojik
            nedeni olduğu yalnız bu değerlendirmeden çıkarılamaz; müdahale kararı
            terapiste aittir.
          </p>
        </section>

        <section className="mt-12 space-y-6 text-slate-700 leading-8">
          <h2 className="text-2xl font-semibold text-slate-900">
            DNA Intelligence Platform Bu Sürece Nasıl Katkı Sağlar?
          </h2>

          <p>
            DNA Intelligence Platform, self-regülasyonun farklı bileşenlerini birlikte ele
            alan açıklanabilir, deterministik bir klinik çalışma platformudur.
            Sistem, farklı alanlardan gelen puanları yalnızca toplamaz; aynı
            zamanda kayıtlı kurallarla bunların dağılımını özetleyerek terapist
            incelemesine açık bir rapor taslağı oluşturur.
          </p>

          <p>
            Bu yapı sayesinde terapist, yalnızca “riskli” veya “tipik” gibi
            yüzeysel sınıflamalara değil; alanlar arası ilişkinin niteliğine,
            göreli zorlanma alanlarına, korunmuş kapasitelere ve anamnez ile
            ölçüm bulguları arasındaki uyuma da erişir. Böylece değerlendirme
            raporu daha tutarlı, daha sistematik ve daha veri temelli hale gelir.
          </p>

          <p>
            Amaç, terapistin klinik karar verme sürecini ikame etmek değildir.
            Amaç, çok boyutlu verinin düzenlenmesini, örüntü analizini ve rapor
            taslağını güçlendirerek daha standardize bir değerlendirme altyapısı
            sunmaktır. Sistem klinik öncelik veya müdahale planı üretmez.
          </p>
        </section>

        <section className="mt-12 rounded-3xl border border-slate-200 bg-slate-50 p-8">
          <h2 className="text-2xl font-semibold text-slate-900">
            Sonuç
          </h2>

          <p className="mt-4 text-slate-700 leading-8">
            Self-regülasyon, erken çocukluk gelişiminin merkezinde yer alan,
            çok katmanlı ve klinik açıdan yüksek öneme sahip bir yapıdır.
            Fizyolojik, duyusal, duygusal, bilişsel ve yürütücü süreçlerin
            birbirinden bağımsız değil; sürekli etkileşim içinde işlediği kabul
            edildiğinde, değerlendirme yaklaşımının da bu karmaşıklığı
            yansıtması gerekir. DNA Intelligence Platform bu ihtiyaca yanıt vermek için,
            self-regülasyon alanlarındaki değerlendirme verisini deterministik
            kurallarla yapılandıran bir klinik çalışma zemini sunar. Platform
            davranıştan biyolojik mekanizma çıkarmaz; nihai klinik yorum terapiste aittir.
          </p>
        </section>
      </main>

      <FooterContact />
    </div>
  );
}
