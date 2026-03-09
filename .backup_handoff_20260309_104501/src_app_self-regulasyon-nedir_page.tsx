import LandingHeader from "../components/LandingHeader";

export default function Page() {
  return (
    <>
      <LandingHeader />
      <main className="mx-auto max-w-5xl px-6 py-16">
        <h1 className="text-4xl font-extrabold tracking-tight text-slate-900">
          Self-Regülasyon Nedir?
        </h1>
        <p className="mt-4 text-lg leading-8 text-slate-600">
          (Buraya uzun içerik gelecek. Şimdilik sayfa iskeleti.)
        </p>

        <div className="mt-10 space-y-6 text-slate-700 leading-7">
          <p>• Tanım</p>
          <p>• Klinik önemi</p>
          <p>• Ölçme yaklaşımı</p>
          <p>• Müdahale mantığı</p>
          <p>• Örnek senaryolar</p>
        </div>
      </main>
    </>
  );
}
