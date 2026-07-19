"use client";

import Link from "next/link";
import { Cookie, ShieldCheck, SlidersHorizontal, X } from "lucide-react";
import { useEffect, useState } from "react";
import styles from "./CookieConsent.module.css";

type ConsentPreferences = {
  necessary: true;
  analytics: boolean;
  marketing: boolean;
  version: 1;
  updatedAt: string;
};

const STORAGE_KEY = "dna_cookie_consent_v1";

function buildPreferences(analytics: boolean, marketing: boolean): ConsentPreferences {
  return {
    necessary: true,
    analytics,
    marketing,
    version: 1,
    updatedAt: new Date().toISOString(),
  };
}

function applyPreferences(preferences: ConsentPreferences) {
  document.documentElement.dataset.cookieAnalytics = preferences.analytics ? "granted" : "denied";
  document.documentElement.dataset.cookieMarketing = preferences.marketing ? "granted" : "denied";
  window.dispatchEvent(new CustomEvent("dna-cookie-consent-change", { detail: preferences }));
}

function readPreferences(): ConsentPreferences | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<ConsentPreferences>;
    if (parsed.version !== 1 || parsed.necessary !== true) return null;
    return {
      necessary: true,
      analytics: Boolean(parsed.analytics),
      marketing: Boolean(parsed.marketing),
      version: 1,
      updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

export default function CookieConsent() {
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);
  const [preferencesOpen, setPreferencesOpen] = useState(false);
  const [analytics, setAnalytics] = useState(false);
  const [marketing, setMarketing] = useState(false);

  useEffect(() => {
    const saved = readPreferences();
    if (saved) {
      setAnalytics(saved.analytics);
      setMarketing(saved.marketing);
      applyPreferences(saved);
      setVisible(false);
    } else {
      setVisible(true);
    }
    setMounted(true);
  }, []);

  const save = (nextAnalytics: boolean, nextMarketing: boolean) => {
    const preferences = buildPreferences(nextAnalytics, nextMarketing);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
    setAnalytics(nextAnalytics);
    setMarketing(nextMarketing);
    applyPreferences(preferences);
    setPreferencesOpen(false);
    setVisible(false);
  };

  if (!mounted || !visible) return null;

  return (
    <>
      <section className={styles.banner} aria-label="Çerez tercihleri">
        <div className={styles.iconWrap} aria-hidden="true">
          <Cookie size={24} strokeWidth={2.2} />
        </div>

        <div className={styles.copy}>
          <strong>Çerez tercihlerinizi yönetin</strong>
          <p>
            Zorunlu çerezler oturum, güvenlik ve temel site işleyişi için kullanılır. Analitik ve pazarlama çerezleri
            yalnızca onayınızla etkinleşir.
          </p>
          <div className={styles.links}>
            <Link href="/cerez-politikasi">Çerez Politikası</Link>
            <Link href="/kvkk">KVKK Aydınlatma Metni</Link>
          </div>
        </div>

        <div className={styles.actions}>
          <button type="button" className={styles.ghostButton} onClick={() => save(false, false)}>
            Reddet
          </button>
          <button type="button" className={styles.outlineButton} onClick={() => setPreferencesOpen(true)}>
            <SlidersHorizontal size={17} />
            Tercihleri Yönet
          </button>
          <button type="button" className={styles.primaryButton} onClick={() => save(true, true)}>
            Tümünü Kabul Et
          </button>
        </div>
      </section>

      {preferencesOpen ? (
        <div className={styles.modalBackdrop} role="presentation">
          <section className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="cookie-preferences-title">
            <div className={styles.modalHeader}>
              <div>
                <div className={styles.modalKicker}>
                  <ShieldCheck size={16} />
                  Çerezlerinizi seçin
                </div>
                <h2 id="cookie-preferences-title">Çerez Tercihleri</h2>
              </div>
              <button
                type="button"
                className={styles.closeButton}
                aria-label="Tercih penceresini kapat"
                onClick={() => setPreferencesOpen(false)}
              >
                <X size={20} />
              </button>
            </div>

            <div className={styles.preferenceList}>
              <article className={styles.preferenceItem}>
                <div>
                  <strong>Zorunlu Çerezler</strong>
                  <p>Oturum, güvenlik, yönlendirme ve temel site işleyişi için kullanılır. Devre dışı bırakılamaz.</p>
                </div>
                <span className={styles.alwaysOn}>Her zaman aktif</span>
              </article>

              <label className={styles.preferenceItem}>
                <div>
                  <strong>Analitik Çerezler</strong>
                  <p>Hangi sayfaların kullanıldığını ve sitenin nasıl çalıştığını anlamamıza yardımcı olur.</p>
                </div>
                <input
                  type="checkbox"
                  checked={analytics}
                  onChange={(event) => setAnalytics(event.target.checked)}
                />
              </label>

              <label className={styles.preferenceItem}>
                <div>
                  <strong>Pazarlama Çerezleri</strong>
                  <p>Tanıtım ve kampanyaların sonuçlarını ölçmek için kullanılır. Başlangıçta kapalıdır.</p>
                </div>
                <input
                  type="checkbox"
                  checked={marketing}
                  onChange={(event) => setMarketing(event.target.checked)}
                />
              </label>
            </div>

            <div className={styles.modalActions}>
              <button type="button" className={styles.ghostButton} onClick={() => save(false, false)}>
                Zorunlu Dışını Reddet
              </button>
              <button type="button" className={styles.outlineButton} onClick={() => save(analytics, marketing)}>
                Seçimi Kaydet
              </button>
              <button type="button" className={styles.primaryButton} onClick={() => save(true, true)}>
                Tümünü Kabul Et
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}
