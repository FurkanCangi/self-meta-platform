import Link from "next/link";
import Image from "next/image";
import type { ReactNode } from "react";
import styles from "./AuthLayout.module.css";

export default function AuthLayout({
  mode,
  children,
  surface = "web",
}: {
  mode: "login" | "signup";
  children: ReactNode;
  surface?: "web" | "app";
}) {
  const isLogin = mode === "login";
  const isApp = surface === "app";

  return (
    <div className={`${styles.page} ${isApp ? styles.appPage : ""}`}>
      <div className={`${styles.shell} ${isApp ? styles.appShell : ""}`}>
        {!isApp ? (
          <div className={styles.visualPane} aria-hidden="true">
            <div className={styles.pattern} />
            <div className={styles.orbit}>
              <span />
              <span />
              <span />
              <span />
              <span />
              <span />
            </div>

            <div className={styles.brandCenter}>
              <div className={styles.brandName}>DNA</div>
              <div className={styles.brandWord} lang="en">INTELLIGENCE</div>
              <div className={styles.brandSubtitle}>Dynamic Neuro-Regulation Approach</div>
            </div>
          </div>
        ) : null}

        <div className={`${styles.formPane} ${!isLogin ? styles.signupPane : ""}`}>
          <div className={styles.formCard}>
            {isApp ? (
              <div className={styles.appBrand}>
                <Image
                  src="/images/brand/dna-logo-wordmark.png"
                  alt="DNA Intelligence Dynamic Neuro-Regulation Approach"
                  width={835}
                  height={407}
                  priority
                  unoptimized
                  className={styles.appLogoImage}
                  sizes="300px"
                />
              </div>
            ) : null}

            <div className={styles.header}>
              <div className={styles.titleBlock}>
                {!isLogin ? <div className={styles.kicker}>Kayıt Ol</div> : null}
                <div className={styles.title}>
                  {isLogin ? "Hoş geldiniz." : "Terapist Hesabı Oluştur"}
                </div>
                {isLogin ? (
                  <p className={styles.subtitle}>
                    Klinik değerlendirme, analiz ve raporlama platformuna giriş yapın.
                  </p>
                ) : null}
              </div>
            </div>

            {children}

            <div className={`${styles.bottom} ${!isLogin ? styles.signupBottom : ""}`}>
              <div>Telif Hakkı © 2024 DNA Intelligence. Tüm Hakları Saklıdır.</div>
              <Link href="#" className={styles.termsLink}>
                Şartlar &amp; Koşullar
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
