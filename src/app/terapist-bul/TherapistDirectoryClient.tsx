"use client"

import { Mail, MapPin, Phone, Search, ShieldCheck, UserRoundCheck } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import type { PublicTherapist } from "@/lib/therapists/directory"
import styles from "./page.module.css"

const cityPoints: Record<string, { x: number; y: number }> = {
  İstanbul: { x: 26, y: 31 },
  Ankara: { x: 48, y: 45 },
  İzmir: { x: 21, y: 55 },
  Bursa: { x: 30, y: 43 },
  Antalya: { x: 37, y: 74 },
  Adana: { x: 61, y: 70 },
  Gaziantep: { x: 73, y: 69 },
  Konya: { x: 47, y: 63 },
  Samsun: { x: 59, y: 29 },
  Trabzon: { x: 78, y: 31 },
  Diyarbakır: { x: 79, y: 61 },
  Erzurum: { x: 84, y: 43 },
  Kayseri: { x: 59, y: 57 },
  Eskişehir: { x: 39, y: 48 },
  Mersin: { x: 57, y: 74 },
}

const fallbackPoints = [
  { x: 24, y: 45 },
  { x: 34, y: 36 },
  { x: 42, y: 56 },
  { x: 54, y: 38 },
  { x: 66, y: 52 },
  { x: 76, y: 46 },
  { x: 70, y: 72 },
]

function normalize(value: string) {
  return value.toLocaleLowerCase("tr-TR").trim()
}

function getCityPoint(city: string, index: number) {
  return cityPoints[city] || fallbackPoints[index % fallbackPoints.length]
}

function TherapistCard({ therapist }: { therapist: PublicTherapist }) {
  const location = [therapist.district, therapist.city].filter(Boolean).join(" / ")

  return (
    <article className={styles.therapistCard}>
      <div className={styles.cardTop}>
        <div className={styles.avatar} aria-hidden="true">
          {therapist.firstName.charAt(0)}
          {therapist.lastName.charAt(0)}
        </div>
        <div>
          <h3>{therapist.fullName}</h3>
          <p>{therapist.title || therapist.profession || "DNA eğitim katılımcısı"}</p>
        </div>
      </div>

      <div className={styles.cardMeta}>
        {therapist.workplace ? (
          <span>
            <UserRoundCheck size={16} />
            {therapist.workplace}
          </span>
        ) : null}
        {location ? (
          <span>
            <MapPin size={16} />
            {location}
          </span>
        ) : null}
      </div>

      {therapist.specialties.length > 0 ? (
        <div className={styles.tags}>
          {therapist.specialties.slice(0, 3).map((tag) => (
            <span key={tag}>{tag}</span>
          ))}
        </div>
      ) : null}

      <div className={styles.contactRows}>
        {therapist.phone ? (
          <a href={`tel:${therapist.phone.replace(/\s/g, "")}`}>
            <Phone size={16} />
            {therapist.phone}
          </a>
        ) : null}
        {therapist.email ? (
          <a href={`mailto:${therapist.email}`}>
            <Mail size={16} />
            {therapist.email}
          </a>
        ) : null}
      </div>
    </article>
  )
}

export default function TherapistDirectoryClient() {
  const [therapists, setTherapists] = useState<PublicTherapist[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [query, setQuery] = useState("")
  const [selectedCity, setSelectedCity] = useState("Tümü")

  useEffect(() => {
    let active = true

    async function loadTherapists() {
      try {
        const response = await fetch("/api/public/therapists", { cache: "no-store" })
        const payload = await response.json().catch(() => ({}))
        if (!response.ok || payload?.ok === false) {
          throw new Error(payload?.error || "Terapist listesi alınamadı.")
        }
        if (active) {
          setTherapists(Array.isArray(payload?.therapists) ? payload.therapists : [])
        }
      } catch (err) {
        if (active) {
          setError(err instanceof Error ? err.message : "Terapist listesi alınamadı.")
        }
      } finally {
        if (active) {
          setLoading(false)
        }
      }
    }

    loadTherapists()

    return () => {
      active = false
    }
  }, [])

  const cities = useMemo(() => {
    return ["Tümü", ...Array.from(new Set(therapists.map((item) => item.city).filter(Boolean))).sort((a, b) => a.localeCompare(b, "tr"))]
  }, [therapists])

  const cityCounts = useMemo(() => {
    return therapists.reduce<Record<string, number>>((acc, therapist) => {
      if (therapist.city) {
        acc[therapist.city] = (acc[therapist.city] || 0) + 1
      }
      return acc
    }, {})
  }, [therapists])

  const filtered = useMemo(() => {
    const q = normalize(query)
    return therapists.filter((therapist) => {
      const cityMatch = selectedCity === "Tümü" || therapist.city === selectedCity
      if (!cityMatch) return false
      if (!q) return true

      return [
        therapist.fullName,
        therapist.profession,
        therapist.title,
        therapist.workplace,
        therapist.city,
        therapist.district,
        therapist.specialties.join(" "),
      ]
        .map(normalize)
        .some((field) => field.includes(q))
    })
  }, [query, selectedCity, therapists])

  const visibleCities = cities.filter((city) => city !== "Tümü")

  return (
    <section className={styles.directoryPanel}>
      <div className={styles.directoryHeader}>
        <div>
          <div className={styles.eyebrow}>Terapist Bul</div>
          <h2>DNA eğitimini tamamlayan uzmanlar</h2>
          <p>
            Liste, eğitim bilgisi tamamlanan ve public görünürlük için açık rıza/onay süreci tamamlanan uzmanları
            gösterir.
          </p>
        </div>
        <div className={styles.safetyNote}>
          <ShieldCheck size={22} />
          Liste bilgilendirme amaçlıdır; hizmet seçimi ve klinik süreç kişinin kendi değerlendirmesine bağlıdır.
        </div>
      </div>

      <div className={styles.filters}>
        <label className={styles.searchBox}>
          <Search size={18} />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="İsim, meslek, kurum veya şehir ara..."
          />
        </label>
        <div className={styles.cityFilters} aria-label="Şehre göre filtrele">
          {cities.map((city) => (
            <button
              type="button"
              key={city}
              className={selectedCity === city ? styles.cityActive : ""}
              onClick={() => setSelectedCity(city)}
            >
              {city}
              {city !== "Tümü" ? <span>{cityCounts[city]}</span> : null}
            </button>
          ))}
        </div>
      </div>

      <div className={styles.mapGrid}>
        <div className={styles.mapPanel} aria-label="DNA şehir haritası">
          <div className={styles.mapCanvas}>
            <div className={styles.mapGlow} />
            <svg viewBox="0 0 100 64" role="img" aria-label="Türkiye şehir yoğunluk haritası">
              <path
                className={styles.mapShape}
                d="M9 34 C14 24 25 19 38 21 C47 12 62 14 70 22 C80 20 90 27 91 38 C88 50 74 55 62 53 C52 60 39 55 32 51 C22 54 12 48 9 34 Z"
              />
              <path
                className={styles.mapLine}
                d="M15 36 C26 30 38 33 47 28 C59 22 71 30 86 37"
              />
              <path
                className={styles.mapLineAlt}
                d="M18 44 C33 40 44 46 58 41 C68 38 77 43 86 46"
              />
            </svg>

            {visibleCities.map((city, index) => {
              const point = getCityPoint(city, index)
              const active = selectedCity === city
              return (
                <button
                  type="button"
                  key={city}
                  className={`${styles.pin} ${active ? styles.pinActive : ""}`}
                  style={{ left: `${point.x}%`, top: `${point.y}%` }}
                  onClick={() => setSelectedCity(city)}
                  title={`${city} (${cityCounts[city] || 0})`}
                >
                  <span>{cityCounts[city] || 0}</span>
                </button>
              )
            })}
          </div>

          <div className={styles.mapStats}>
            <span>
              <strong>{therapists.length}</strong>
              Uzman
            </span>
            <span>
              <strong>{visibleCities.length}</strong>
              Şehir
            </span>
            <span>
              <strong>{filtered.length}</strong>
              Sonuç
            </span>
          </div>
        </div>

        <div className={styles.listPanel}>
          {loading ? (
            <div className={styles.empty}>Terapist listesi yükleniyor...</div>
          ) : error ? (
            <div className={styles.empty}>{error}</div>
          ) : filtered.length === 0 ? (
            <div className={styles.empty}>
              Bu filtreyle yayında olan terapist bulunamadı. Yeni uzmanlar onaylandıkça liste güncellenecek.
            </div>
          ) : (
            filtered.map((therapist) => <TherapistCard therapist={therapist} key={therapist.id} />)
          )}
        </div>
      </div>
    </section>
  )
}
