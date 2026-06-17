"use client"

import { Filter, Mail, MapPin, Phone, Search, ShieldCheck, UserRoundCheck } from "lucide-react"
import type { FormEvent } from "react"
import { useEffect, useMemo, useState } from "react"
import type { PublicTherapist } from "@/lib/therapists/directory"
import styles from "./page.module.css"

const defaultCities = [
  "İstanbul",
  "Ankara",
  "İzmir",
  "Bursa",
  "Antalya",
  "Adana",
  "Gaziantep",
  "Konya",
  "Samsun",
  "Trabzon",
  "Diyarbakır",
  "Erzurum",
]

const cityPoints: Record<string, { x: number; y: number; labelX?: number; labelY?: number }> = {
  İstanbul: { x: 24, y: 34, labelX: -24, labelY: -16 },
  Ankara: { x: 49, y: 47, labelX: -12, labelY: -18 },
  İzmir: { x: 21, y: 58, labelX: -18, labelY: 16 },
  Bursa: { x: 30, y: 44, labelX: -26, labelY: 4 },
  Antalya: { x: 39, y: 76, labelX: -16, labelY: 18 },
  Adana: { x: 61, y: 72, labelX: -10, labelY: 18 },
  Gaziantep: { x: 72, y: 69, labelX: 10, labelY: 18 },
  Konya: { x: 47, y: 64, labelX: -14, labelY: 18 },
  Samsun: { x: 59, y: 31, labelX: -12, labelY: -18 },
  Trabzon: { x: 78, y: 32, labelX: 8, labelY: -16 },
  Diyarbakır: { x: 79, y: 61, labelX: 10, labelY: 4 },
  Erzurum: { x: 85, y: 45, labelX: 10, labelY: -8 },
  Kayseri: { x: 59, y: 57, labelX: 8, labelY: -12 },
  Eskişehir: { x: 39, y: 49, labelX: -28, labelY: -8 },
  Mersin: { x: 57, y: 76, labelX: -22, labelY: 18 },
}

const fallbackPoints = [
  { x: 27, y: 50 },
  { x: 35, y: 38 },
  { x: 45, y: 56 },
  { x: 55, y: 39 },
  { x: 66, y: 53 },
  { x: 76, y: 47 },
  { x: 70, y: 74 },
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
  const [draftQuery, setDraftQuery] = useState("")
  const [query, setQuery] = useState("")
  const [selectedCity, setSelectedCity] = useState("Tümü")
  const [selectedProfession, setSelectedProfession] = useState("Tümü")

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
    const allCities = new Set([...defaultCities, ...therapists.map((item) => item.city).filter(Boolean)])
    return ["Tümü", ...Array.from(allCities).sort((a, b) => a.localeCompare(b, "tr"))]
  }, [therapists])

  const professions = useMemo(() => {
    return [
      "Tümü",
      ...Array.from(new Set(therapists.map((item) => item.profession || item.title).filter(Boolean))).sort((a, b) =>
        a.localeCompare(b, "tr"),
      ),
    ]
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
      const professionMatch =
        selectedProfession === "Tümü" ||
        therapist.profession === selectedProfession ||
        therapist.title === selectedProfession
      if (!professionMatch) return false
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
  }, [query, selectedCity, selectedProfession, therapists])

  const visibleCities = cities.filter((city) => city !== "Tümü")
  const selectedCityCount = selectedCity === "Tümü" ? therapists.length : cityCounts[selectedCity] || 0

  function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setQuery(draftQuery)
  }

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

      <form className={styles.filters} onSubmit={handleSearch}>
        <label className={styles.searchBox}>
          <Search size={18} />
          <input
            value={draftQuery}
            onChange={(event) => setDraftQuery(event.target.value)}
            placeholder="İsim, meslek, kurum veya şehir ara..."
          />
        </label>
        <label className={styles.selectBox}>
          <MapPin size={18} />
          <select value={selectedCity} onChange={(event) => setSelectedCity(event.target.value)}>
            {cities.map((city) => (
              <option key={city} value={city}>
                {city === "Tümü" ? "Tüm şehirler" : city}
              </option>
            ))}
          </select>
        </label>
        <label className={styles.selectBox}>
          <Filter size={18} />
          <select value={selectedProfession} onChange={(event) => setSelectedProfession(event.target.value)}>
            {professions.map((profession) => (
              <option key={profession} value={profession}>
                {profession === "Tümü" ? "Tüm meslekler" : profession}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className={styles.searchButton}>
          Ara
        </button>
      </form>

      <div className={styles.mapGrid}>
        <div className={styles.mapPanel} aria-label="DNA şehir haritası">
          <div className={styles.mapTopbar}>
            <div>
              <span>DNA şehir haritası</span>
              <strong>{selectedCity === "Tümü" ? "Türkiye geneli" : selectedCity}</strong>
            </div>
            <small>{selectedCityCount} uzman</small>
          </div>
          <div className={styles.mapCanvas}>
            <div className={styles.mapGlow} />
            <svg viewBox="0 0 100 64" role="img" aria-label="Türkiye şehir yoğunluk haritası">
              <defs>
                <linearGradient id="turkeyStroke" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#00c8d7" />
                  <stop offset="48%" stopColor="#2563eb" />
                  <stop offset="100%" stopColor="#7c3aed" />
                </linearGradient>
              </defs>
              <path
                className={styles.mapShape}
                d="M7 35 L12 29 L20 28 L27 31 L35 29 L42 24 L51 24 L58 27 L66 25 L76 29 L88 31 L94 37 L90 44 L81 47 L73 45 L65 49 L56 48 L49 53 L39 51 L31 47 L24 50 L16 47 L10 42 Z"
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
              const count = cityCounts[city] || 0
              return (
                <button
                  type="button"
                  key={city}
                  className={`${styles.pin} ${active ? styles.pinActive : ""} ${count === 0 ? styles.pinMuted : ""}`}
                  style={{ left: `${point.x}%`, top: `${point.y}%` }}
                  onClick={() => setSelectedCity(city)}
                  title={`${city} (${count})`}
                >
                  <span>{count}</span>
                  <em
                    style={{
                      transform: `translate(${point.labelX || 8}px, ${point.labelY || -18}px)`,
                    }}
                  >
                    {city}
                  </em>
                </button>
              )
            })}
          </div>

          <div className={styles.cityFilters} aria-label="Hızlı şehir filtresi">
            {cities.map((city) => (
              <button
                type="button"
                key={city}
                className={selectedCity === city ? styles.cityActive : ""}
                onClick={() => setSelectedCity(city)}
              >
                {city}
                {city !== "Tümü" ? <span>{cityCounts[city] || 0}</span> : null}
              </button>
            ))}
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
