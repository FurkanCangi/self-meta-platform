"use client";

import { useState, useTransition } from "react";
import { ListFilter, Mail, PenLine, Send, UserRound } from "lucide-react";
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

      setMessage("Mesajınız güvenli şekilde alındı. En kısa sürede size dönüş yapacağız.");
      form.reset();
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
          <small>Formu doldurun, size dönüş yapalım.</small>
        </span>
      </div>

      <div className={styles.contactFormGrid}>
        <label className={styles.contactField}>
          <UserRound size={22} />
          <input name="requesterName" type="text" placeholder="Ad Soyad" autoComplete="name" maxLength={120} />
        </label>

        <label className={styles.contactField}>
          <Mail size={22} />
          <input name="email" type="email" placeholder="E-posta" autoComplete="email" required maxLength={180} />
        </label>

        <label className={`${styles.contactField} ${styles.contactFieldFull}`}>
          <ListFilter size={22} />
          <select name="categoryLabel" defaultValue="" required>
            <option value="" disabled>
              Konu seçin
            </option>
            <option>Kurumsal kullanım</option>
            <option>Eğitim programı</option>
            <option>AI raporlama</option>
            <option>Akademik iş birliği</option>
            <option>Diğer</option>
          </select>
        </label>

        <label className={`${styles.contactField} ${styles.contactTextarea} ${styles.contactFieldFull}`}>
          <PenLine size={22} />
          <textarea name="description" placeholder="Mesajınız" required minLength={10} maxLength={4000} />
        </label>
      </div>

      {message ? (
        <div className="mt-5 rounded-2xl border border-cyan-200 bg-cyan-50 px-4 py-3 text-sm font-bold text-cyan-800">
          {message}
        </div>
      ) : null}
      {error ? (
        <div className="mt-5 rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-900">
          {error}
        </div>
      ) : null}

      <button className={styles.contactSubmit} type="submit" disabled={pending}>
        <Send size={21} strokeWidth={2.2} />
        <span>{pending ? "Gönderiliyor..." : "Gönder"}</span>
      </button>
    </form>
  );
}
