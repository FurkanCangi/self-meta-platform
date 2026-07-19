"use client"

import Link from "next/link"
import { ArrowRight, Mail, MapPin, Phone, UsersRound } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import type { PublicTherapist } from "@/lib/therapists/directory"
import styles from "./TherapistDirectoryPreview.module.css"

export default function TherapistDirectoryPreview() {
  const [therapists, setTherapists] = useState<PublicTherapist[]>([])

  useEffect(() => {
    let active = true

    fetch("/api/public/therapists", { cache: "no-store" })
      .then((response) => response.json())
      .then((payload) => {
        if (active && payload?.ok && Array.isArray(payload.therapists)) {
          setTherapists(payload.therapists)
        }
      })
      .catch(() => undefined)

    return () => {
      active = false
    }
  }, [])

  const topCities = useMemo(() => {
    const counts = therapists.reduce<Record<string, number>>((acc, therapist) => {
      if (therapist.city) acc[therapist.city] = (acc[therapist.city] || 0) + 1
      return acc
    }, {})

    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "tr"))
      .slice(0, 6)
  }, [therapists])

  const previewTherapists = therapists.slice(0, 3)

  return (
    <section className={styles.wrap} id="terapist-bul-preview">
      <div className={styles.panel}>
        <div className={styles.copy}>
          <div className={styles.badge}>
            <UsersRound size={18} />
            Terapist Bul
          </div>
          <h2>Eğitimi tamamlayan terapistleri bulun.</h2>
          <p>
            Şehir, meslek ve uzmanlık alanına göre arama yapın. Listede yalnızca eğitimini tamamlayan ve bilgilerinin
            yayımlanmasına izin veren terapistler yer alır.
          </p>

          <div className={styles.stats}>
            <span>
              <strong>{therapists.length}</strong>
              Yayındaki uzman
            </span>
            <span>
              <strong>{topCities.length}</strong>
              Şehir
            </span>
          </div>

          <Link className={styles.cta} href="/terapist-bul">
            Terapist Bul sayfasına git
            <ArrowRight size={19} />
          </Link>
        </div>

        <div className={styles.preview}>
          <div className={styles.cityCloud}>
            {topCities.length > 0 ? (
              topCities.map(([city, count]) => (
                <Link href={`/terapist-bul`} key={city}>
                  <MapPin size={15} />
                  {city}
                  <span>{count}</span>
                </Link>
              ))
            ) : (
              <span className={styles.emptyCity}>Terapistler eklendikçe şehirler burada görünecek.</span>
            )}
          </div>

          <div className={styles.cards}>
            {previewTherapists.length > 0 ? (
              previewTherapists.map((therapist) => (
                <article className={styles.card} key={therapist.id}>
                  <strong>{therapist.fullName}</strong>
                  <span>{therapist.title || therapist.profession}</span>
                  <small>
                    <MapPin size={14} />
                    {[therapist.city, therapist.workplace].filter(Boolean).join(" · ")}
                  </small>
                  <div>
                    {therapist.phone ? <Phone size={15} /> : null}
                    {therapist.email ? <Mail size={15} /> : null}
                  </div>
                </article>
              ))
            ) : (
              <div className={styles.empty}>
                İlk terapistler eklendiğinde burada kısa bir liste göreceksiniz.
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}
