"use client";

import { useState, useTransition } from "react";
import { AlertCircle, CheckCircle2, ListFilter, Mail, PenLine, Send, ShieldCheck, UserRound } from "lucide-react";
import styles from "../marketing-pages.module.css";

function supportErrorMessage(code?: string) {
  if (code === "support_tables_missing") return "Mesaj alanı hazırlanıyor. Lütfen biraz sonra tekrar deneyin.";
  if (code === "support_subject_invalid") return "Lütfen konu alanını doldurun.";
  if (code === "support_description_invalid") return "Lütfen mesajınızı birkaç cümleyle açıklayın.";
  if (code === "support_email_invalid" || code === "email_required") return "Lütfen geçerli bir e-posta adresi yazın.";
  if (code === "Too many requests") return "Çok kısa sürede fazla deneme yapıldı. Lütfen birkaç dakika sonra tekrar deneyin.";
  return "Mesaj gönderilemedi. Lütfen bilgileri kontrol edip tekrar deneyin.";
}

function detectDeviceType() {
  const ua = navigator.userAgent || "";
  if (/ipad|tablet|playbook|silk/i.test(ua)) return "tablet";
  if (/mobi|iphone|android/i.test(ua)) return "mobile";
  return "desktop";
}

export default function ContactForm() {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setError("");

    const form = event.currentTarget;
    const data = new FormData(form);
    const name = String(data.get("requesterName") || "").trim();
    const categoryLabel = String(data.get("categoryLabel") || "").trim();
    const description = String(data.get("description") || "").trim();

    const ticketData = new FormData();
    ticketData.set("requesterName", name);
    ticketData.set("email", String(data.get("email") || "").trim());
    ticketData.set("category", "other");
    ticketData.set("priority", "normal");
    ticketData.set("subject", categoryLabel || "İletişim formu");
    ticketData.set("description", [categoryLabel ? `Konu: ${categoryLabel}` : "", description].filter(Boolean).join("\n\n"));
    ticketData.set("pageUrl", window.location.href);
    ticketData.set("browserInfo", `${navigator.userAgent || "unknown"} | ${window.innerWidth}x${window.innerHeight}`);
    ticketData.set("deviceType", detectDeviceType());

    startTransition(async () => {
      try {
        const response = await fetch("/api/support/tickets", {
          method: "POST",
          headers: {
            "x-dna-request": "same-origin",
          },
          body: ticketData,
        });
        const payload = await response.json().catch(() => null);
        if (!response.ok || !payload?.ok) {
          setError(supportErrorMessage(payload?.error));
          return;
        }

        setMessage("Mesajınız alındı. Ekibimiz en kısa sürede sizinle iletişime geçecek.");
        form.reset();
      } catch {
        setError("Bağlantı kurulamadı. Lütfen internet bağlantınızı kontrol edip tekrar deneyin.");
      }
    });
  }

  return (
    <form className={styles.contactFormPanel} onSubmit={submit}>
      <div className={styles.contactFormIntro}>
        <span className={styles.contactFormIcon}>
          <Send size={34} strokeWidth={2.2} />
        </span>
        <span>
          <strong>Mesajınızı bize iletin</strong>
          <small>Konunuzu paylaşın, doğru ekip size dönüş yapsın.</small>
        </span>
      </div>

      <div className={styles.contactFormGrid}>
        <label className={styles.contactFieldGroup}>
          <span className={styles.contactFieldLabel}>Ad Soyad</span>
          <span className={styles.contactField}>
            <UserRound size={21} />
            <input name="requesterName" type="text" placeholder="Adınız ve soyadınız" autoComplete="name" maxLength={120} />
          </span>
        </label>

        <label className={styles.contactFieldGroup}>
          <span className={styles.contactFieldLabel}>E-posta</span>
          <span className={styles.contactField}>
            <Mail size={21} />
            <input name="email" type="email" placeholder="ornek@eposta.com" autoComplete="email" required maxLength={180} />
          </span>
        </label>

        <label className={`${styles.contactFieldGroup} ${styles.contactFieldFull}`}>
          <span className={styles.contactFieldLabel}>Konu</span>
          <span className={styles.contactField}>
            <ListFilter size={21} />
            <select name="categoryLabel" defaultValue="" required>
              <option value="" disabled>
                İletişim konusunu seçin
              </option>
              <option>Kurumsal kullanım</option>
              <option>Eğitim programı</option>
              <option>AI destekli raporlama</option>
              <option>Akademik iş birliği</option>
              <option>Diğer</option>
            </select>
          </span>
        </label>

        <label className={`${styles.contactFieldGroup} ${styles.contactFieldFull}`}>
          <span className={styles.contactFieldLabel}>Mesajınız</span>
          <span className={`${styles.contactField} ${styles.contactTextarea}`}>
            <PenLine size={21} />
            <textarea
              name="description"
              placeholder="Size nasıl yardımcı olabiliriz?"
              required
              minLength={10}
              maxLength={4000}
            />
          </span>
        </label>
      </div>

      {message ? (
        <div className={`${styles.contactStatus} ${styles.contactStatusSuccess}`} role="status" aria-live="polite">
          <CheckCircle2 size={19} />
          {message}
        </div>
      ) : null}
      {error ? (
        <div className={`${styles.contactStatus} ${styles.contactStatusError}`} role="alert" aria-live="assertive">
          <AlertCircle size={19} />
          {error}
        </div>
      ) : null}

      <button className={styles.contactSubmit} type="submit" disabled={pending}>
        <Send size={21} strokeWidth={2.2} />
        <span>{pending ? "Gönderiliyor..." : "Gönder"}</span>
      </button>

      <p className={styles.contactPrivacyNote}>
        <ShieldCheck size={16} />
        Bilgileriniz yalnızca talebinize dönüş yapmak için kullanılır.
      </p>
    </form>
  );
}
