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
          doğrudan belirleyici rol oynar.
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
            görülen belirtiler üzerinden tarif edilir. Oysa aynı davranış,
            farklı altta yatan mekanizmalardan kaynaklanabilir. Bir çocukta
            dikkat sorunu fizyolojik düzensizlikle ilişkiliyken, başka bir
            çocukta duyusal yüklenme veya yürütücü işlev zorluğu temel belirleyici
            olabilir.
          </p>

          <p>
            Bu nedenle yalnızca tek boyutlu tarama yaklaşımı çoğu zaman yetersiz
            kalır. Klinik olarak anlamlı olan, alanlar arası dağılımı ve bu
            alanların birbirini nasıl etkilediğini görebilmektir. Çok boyutlu
            değerlendirme, hangi alanların görece korunmuş olduğunu, hangi
            sistemlerin kırılgan olduğunu ve çocuğun işlevselliğini hangi
            örüntünün sınırladığını ortaya koyar.
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
            Klinik karar verme sürecinde hangi alanın tetikleyici, hangisinin
            ikincil etkilenim alanı, hangisinin göreli koruyucu alan olduğunun
            anlaşılması müdahale planlamasını doğrudan etkiler. Örneğin duyusal
            regülasyonu korunmuş fakat fizyolojik düzenleme kırılgan olan bir
            çocuk ile; duyusal yüklenmesi belirgin fakat fizyolojik yapısı daha
            dengeli olan bir çocuk için aynı klinik yaklaşım uygun olmayabilir.
          </p>
        </section>

        <section className="mt-12 space-y-6 text-slate-700 leading-8">
          <h2 className="text-2xl font-semibold text-slate-900">
            Self Meta AI Bu Sürece Nasıl Katkı Sağlar?
          </h2>

          <p>
            Self Meta AI, self-regülasyonun farklı bileşenlerini birlikte ele
            alan yapay zeka destekli bir klinik karar destek platformudur.
            Sistem, farklı alanlardan gelen puanları yalnızca toplamaz; aynı
            zamanda bunlar arasındaki örüntüyü analiz ederek klinik açıdan anlamlı
            bir profil oluşturur.
          </p>

          <p>
            Bu yapı sayesinde terapist, yalnızca “riskli” veya “tipik” gibi
            yüzeysel sınıflamalara değil; alanlar arası ilişkinin niteliğine,
            öncelikli zorlanma alanlarına, korunmuş sistemlere ve anamnez ile
            ölçüm bulguları arasındaki uyuma da erişir. Böylece değerlendirme
            raporu daha tutarlı, daha sistematik ve daha veri temelli hale gelir.
          </p>

          <p>
            Amaç, terapistin klinik karar verme sürecini ikame etmek değildir.
            Amaç, çok boyutlu verinin düzenlenmesini, örüntü analizini ve rapor
            üretimini güçlendirerek daha güvenli ve daha standardize bir
            değerlendirme altyapısı sunmaktır.
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
            yansıtması gerekir. Self Meta AI bu ihtiyaca yanıt vermek için,
            self-regülasyon alanlarını bütüncül biçimde analiz eden ve klinik
            karar destek mantığıyla çalışan yeni nesil bir değerlendirme zemini
            sunar.
          </p>
        </section>
      </main>

      <FooterContact />
    </div>
  );
}
