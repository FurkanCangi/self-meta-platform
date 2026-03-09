import Link from "next/link";

export default function LandingHeader() {
  return (
    <header className="smiHeaderWrap">
      <div className="smiHeaderInner">
        <div className="smiHeaderLeft">
          <div className="smiLeftPill">Self Metacognition Institute</div>
        </div>

        <nav className="smiNav" aria-label="Landing navigation">
          <a href="/self-regulasyon-nedir" className="smiNavLink">Self-Regülasyon Nedir</a>
          <a href="#solutions" className="smiNavLink">Çözümler</a>
          <a href="#terapistler" className="smiNavLink">Terapistler için</a>
          <a href="#paketler" className="smiNavLink">Fiyatlandırma</a>
          <a href="#iletisim" className="smiNavLink">İletişim</a>
        </nav>

        <div className="smiHeaderRight">
          <Link href="/login" className="smiRightPill">Terapist Paneli</Link>
        </div>
      </div>
    </header>
  );
}
