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
          Self-regülasyon, çocuğun bedensel uyarılma düzeyini, duyusal
          tepkilerini, duygularını, dikkatini ve davranışını bulunduğu duruma
          göre ayarlayabilmesidir. Bu beceri yalnızca davranışı kontrol etmekten
          ibaret değildir. Çocuğun bedeninden gelen sinyalleri, çevredeki
          uyaranları ve yaptığı işin gereklerini birlikte yönetebilmesini kapsar.
          Erken çocuklukta gelişen bu beceriler; öğrenme, oyun, sosyal ilişkiler
          ve günlük yaşamla yakından ilişkilidir.
        </p>

        <section className="mt-12 space-y-6 text-slate-700 leading-8">
          <h2 className="text-2xl font-semibold text-slate-900">
            Self-Regülasyon Günlük Yaşamı Nasıl Etkiler?
          </h2>

          <p>
            Self-regülasyon; dikkati sürdürme, dürtüyü erteleme, yoğun bir
            duygudan sonra sakinleşme, etkinlikler arasında geçiş yapma ve
            çevredeki uyaranlarla baş etme gibi günlük becerilerde rol oynar.
            Bu alanlarda zorlanan bir çocuk öğrenme, oyun, arkadaş ilişkileri
            ve günlük rutinlerde de güçlük yaşayabilir.
          </p>

          <p>
            Güçlükler her çocukta aynı görünmez. Bir çocukta uyku ve enerji
            düzeyi, başka bir çocukta ses veya dokunmaya verilen tepki, bir
            diğerinde dikkat ve planlama güçlüğü daha belirgin olabilir. Bu
            nedenle değerlendirmede yalnız görünen davranış değil, davranışın
            hangi koşullarda ortaya çıktığı da incelenir.
          </p>
        </section>

        <section className="mt-12 space-y-6 text-slate-700 leading-8">
          <h2 className="text-2xl font-semibold text-slate-900">
            Self-Regülasyonun Temel Bileşenleri
          </h2>

          <p>
            Self-regülasyon tek bir beceri değildir. Birbiriyle ilişkili birkaç
            alan birlikte çalışır.
          </p>

          <ul className="list-disc space-y-3 pl-6">
            <li>
              <strong>Fizyolojik Regülasyon:</strong> Uyku, enerji, açlık-tokluk
              ve uyanıklık düzeyini ayarlama.
            </li>
            <li>
              <strong>Duyusal Regülasyon:</strong> Ses, dokunma, hareket, ışık
              ve diğer uyaranlara verilen tepkileri ayarlama.
            </li>
            <li>
              <strong>Duygusal Regülasyon:</strong> Duyguların yoğunluğunu
              yönetme ve zor bir durumdan sonra sakinleşebilme.
            </li>
            <li>
              <strong>Bilişsel Regülasyon:</strong> Dikkati sürdürme, göreve
              odaklanma ve zihinsel yük arttığında işi sürdürebilme.
            </li>
            <li>
              <strong>Yürütücü İşlev:</strong> Planlama, başlama, durma, esnek
              davranma ve bir etkinlikten diğerine geçme.
            </li>
            <li>
              <strong>İnterosepsiyon:</strong> Açlık, susuzluk, yorgunluk, ağrı
              ve tuvalet ihtiyacı gibi beden sinyallerini fark etme.
            </li>
          </ul>

          <p>
            Bu alanlar birbirini etkileyebilir. Örneğin uykusuzluk dikkati
            sürdürmeyi zorlaştırabilir; yoğun ses veya dokunma çocuğun daha
            çabuk gerilmesine yol açabilir. Ancak bu ilişkiler her çocukta aynı
            değildir. Değerlendirmede çocuğun verdiği tepkiler ve bu tepkilerin
            ortaya çıktığı koşullar birlikte incelenir.
          </p>
        </section>

        <section className="mt-12 space-y-6 text-slate-700 leading-8">
          <h2 className="text-2xl font-semibold text-slate-900">
            Aynı Davranışın Farklı Nedenleri Olabilir
          </h2>

          <p>
            Bir çocuğun çok hareketli olması, öfkelenmesi, dikkatini
            sürdürememesi veya belirli seslere yoğun tepki vermesi farklı
            koşullarla ilişkili olabilir. Test sonuçları ve gözlem notları bu
            davranışların ne zaman ve nerede ortaya çıktığını anlamaya yardımcı
            olur; tek başına kesin neden göstermez.
          </p>

          <p>
            Bu nedenle yalnızca tek bir alana bakmak yeterli olmaz. Çocuğun
            hangi alanlarda zorlandığı, hangi alanlarda daha rahat olduğu ve bu
            durumun günlük yaşamda nasıl görüldüğü birlikte değerlendirilir.
          </p>
        </section>

        <section className="mt-12 space-y-6 text-slate-700 leading-8">
          <h2 className="text-2xl font-semibold text-slate-900">
            Ergoterapide Nasıl Ele Alınır?
          </h2>

          <p>
            Ergoterapide self-regülasyon, çocuğun oyun, öz bakım, öğrenme ve
            sosyal yaşama katılımıyla birlikte değerlendirilir. Amaç yalnızca
            zorlanmayı belirlemek değil, çocuğun günlük yaşamda hangi işleri
            yapabildiğini ve nerede desteğe ihtiyaç duyduğunu anlamaktır.
          </p>

          <p>
            Test sonuçları ve gözlemler terapistin daha geniş değerlendirmesinin
            bir parçasıdır. Bir alandaki güçlüğün diğer alanın nedeni olduğu bu
            sonuçlardan tek başına çıkarılamaz. Müdahale hedeflerini ve uygulama
            planını terapist belirler.
          </p>
        </section>

        <section className="mt-12 space-y-6 text-slate-700 leading-8">
          <h2 className="text-2xl font-semibold text-slate-900">
            DNA Intelligence Ne Yapar?
          </h2>

          <p>
            DNA Intelligence, farklı alanlardan gelen test sonuçlarını, anamnez
            bilgilerini ve gözlem notlarını aynı yerde toplar. Sistem bu
            bilgileri kayıtlı kurallara göre düzenler ve terapistin
            inceleyebileceği bir rapor taslağı hazırlar.
          </p>

          <p>
            Böylece terapist yalnızca toplam puanı değil, çocuğun hangi
            alanlarda daha çok zorlandığını, hangi alanlarda daha iyi durumda
            olduğunu ve test sonuçlarıyla anamnez bilgilerinin birbiriyle
            uyumlu olup olmadığını görebilir.
          </p>

          <p>
            Amaç terapistin yerine karar vermek değildir. Sistem bilgileri
            düzenler ve rapor hazırlamayı kolaylaştırır; klinik değerlendirme
            ve müdahale planı terapiste aittir.
          </p>
        </section>

        <section className="mt-12 rounded-3xl border border-slate-200 bg-slate-50 p-8">
          <h2 className="text-2xl font-semibold text-slate-900">
            Sonuç
          </h2>

          <p className="mt-4 text-slate-700 leading-8">
            Self-regülasyon; uyku, duyusal tepkiler, duygular, dikkat, planlama
            ve beden sinyalleri gibi birbiriyle ilişkili alanları kapsar. Bu
            nedenle değerlendirme de tek bir davranışa veya tek bir puana
            dayanmaz. DNA Intelligence, farklı kaynaklardan gelen bilgileri bir
            araya getirerek terapistin inceleyebileceği düzenli bir rapor
            taslağı sunar. Son değerlendirmeyi ve kararı terapist verir.
          </p>
        </section>
      </main>

      <FooterContact />
    </div>
  );
}
