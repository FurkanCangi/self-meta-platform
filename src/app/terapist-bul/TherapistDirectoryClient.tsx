"use client"

import dynamic from "next/dynamic"
import {
  Building2,
  Filter,
  LocateFixed,
  Mail,
  MapPin,
  Phone,
  RotateCcw,
  Search,
} from "lucide-react"
import type { FormEvent } from "react"
import { useEffect, useMemo, useState } from "react"
import type { PublicTherapist } from "@/lib/therapists/directory"
import type { TherapistMapPoint } from "./TherapistMap"
import styles from "./page.module.css"

const TherapistMap = dynamic(() => import("./TherapistMap"), {
  ssr: false,
  loading: () => <div className={styles.mapLoading}>Harita hazırlanıyor...</div>,
})

type DirectoryTherapist = PublicTherapist & {
  isExample: boolean
}

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
  "Kayseri",
  "Eskişehir",
  "Mersin",
]

const cityCoordinates: Record<string, [number, number]> = {
  İstanbul: [41.0082, 28.9784],
  Ankara: [39.9334, 32.8597],
  İzmir: [38.4237, 27.1428],
  Bursa: [40.195, 29.06],
  Antalya: [36.8969, 30.7133],
  Adana: [37.0001, 35.3213],
  Gaziantep: [37.0662, 37.3833],
  Konya: [37.8746, 32.4932],
  Samsun: [41.2867, 36.33],
  Trabzon: [41.0027, 39.7168],
  Diyarbakır: [37.9144, 40.2306],
  Erzurum: [39.9043, 41.2679],
  Kayseri: [38.7205, 35.4826],
  Eskişehir: [39.7767, 30.5206],
  Mersin: [36.8121, 34.6415],
}

const demoTherapists: DirectoryTherapist[] = [
  {
    id: "demo-istanbul",
    firstName: "Selin",
    lastName: "Acar",
    fullName: "Uzm. Ergoterapist Selin Acar",
    profession: "Ergoterapist",
    title: "Uzm. Ergoterapist",
    workplace: "DNA Uygulama Ağı",
    city: "İstanbul",
    district: "Kadıköy",
    phone: "",
    email: "",
    shortAddress: "",
    specialties: ["Duyu bütünleme", "Öz düzenleme", "Pediatrik uygulama"],
    isExample: true,
  },
  {
    id: "demo-ankara",
    firstName: "Mert",
    lastName: "Yalın",
    fullName: "Uzm. Fizyoterapist Mert Yalın",
    profession: "Fizyoterapist",
    title: "Uzm. Fizyoterapist",
    workplace: "DNA Uygulama Ağı",
    city: "Ankara",
    district: "Çankaya",
    phone: "",
    email: "",
    shortAddress: "",
    specialties: ["Motor planlama", "Postüral kontrol", "Gelişimsel destek"],
    isExample: true,
  },
  {
    id: "demo-izmir",
    firstName: "Derya",
    lastName: "Işık",
    fullName: "Psikolojik Danışman Derya Işık",
    profession: "Psikolojik Danışman",
    title: "Psikolojik Danışman",
    workplace: "DNA Uygulama Ağı",
    city: "İzmir",
    district: "Bornova",
    phone: "",
    email: "",
    shortAddress: "",
    specialties: ["Duygusal düzenleme", "Ebeveyn danışmanlığı", "Okul uyumu"],
    isExample: true,
  },
  {
    id: "demo-bursa",
    firstName: "Elif",
    lastName: "Demir",
    fullName: "Çocuk Gelişim Uzmanı Elif Demir",
    profession: "Çocuk Gelişim Uzmanı",
    title: "Çocuk Gelişim Uzmanı",
    workplace: "DNA Uygulama Ağı",
    city: "Bursa",
    district: "Nilüfer",
    phone: "",
    email: "",
    shortAddress: "",
    specialties: ["Erken çocukluk", "Gelişimsel izlem", "Aile rehberliği"],
    isExample: true,
  },
  {
    id: "demo-antalya",
    firstName: "Can",
    lastName: "Eren",
    fullName: "Dil ve Konuşma Terapisti Can Eren",
    profession: "Dil ve Konuşma Terapisti",
    title: "Dil ve Konuşma Terapisti",
    workplace: "DNA Uygulama Ağı",
    city: "Antalya",
    district: "Muratpaşa",
    phone: "",
    email: "",
    shortAddress: "",
    specialties: ["Dil gelişimi", "İletişim becerileri", "Sosyal katılım"],
    isExample: true,
  },
]

function normalize(value: string) {
  return value.toLocaleLowerCase("tr-TR").trim()
}

function getCoordinates(city: string, index: number): [number, number] {
  const base = cityCoordinates[city] || [39.05, 35.15]
  const offset = ((index % 5) - 2) * 0.035
  return [base[0] + offset, base[1] - offset]
}

function TherapistRow({
  therapist,
  selected,
  onLocate,
}: {
  therapist: DirectoryTherapist
  selected: boolean
  onLocate: () => void
}) {
  const cityLabel = [therapist.district, therapist.city].filter(Boolean).join(" / ")
  const location = [therapist.shortAddress, cityLabel].filter(Boolean).join(" · ")

  return (
    <article
      className={`${styles.therapistRow} ${selected ? styles.therapistRowSelected : ""}`}
      id={`therapist-${therapist.id}`}
    >
      <div className={styles.rowHeading}>
        <div className={styles.avatar} aria-hidden="true">
          {therapist.firstName.charAt(0)}
          {therapist.lastName.charAt(0)}
        </div>
        <div>
          <div className={styles.rowBadges}>
            {therapist.isExample ? <span>Örnek profil</span> : <span className={styles.approvedBadge}>Onaylı profil</span>}
          </div>
          <h3>{therapist.fullName}</h3>
          <p>{therapist.title || therapist.profession || "DNA eğitim katılımcısı"}</p>
        </div>
      </div>

      <div className={styles.rowMeta}>
        {therapist.workplace ? (
          <span>
            <Building2 size={15} />
            {therapist.workplace}
          </span>
        ) : null}
        {location ? (
          <span>
            <MapPin size={15} />
            {location}
          </span>
        ) : null}
      </div>

      {therapist.specialties.length > 0 ? (
        <div className={styles.tags}>
          {therapist.specialties.map((tag) => (
            <span key={tag}>{tag}</span>
          ))}
        </div>
      ) : null}

      <div className={styles.rowActions}>
        <button type="button" onClick={onLocate} aria-label={`${therapist.fullName} haritada göster`}>
          <LocateFixed size={16} />
          Haritada göster
        </button>
        {!therapist.isExample && therapist.phone ? (
          <a href={`tel:${therapist.phone.replace(/\s/g, "")}`} aria-label={`${therapist.fullName} telefon numarası`}>
            <Phone size={16} />
            Ara
          </a>
        ) : null}
        {!therapist.isExample && therapist.email ? (
          <a href={`mailto:${therapist.email}`} aria-label={`${therapist.fullName} e-posta adresi`}>
            <Mail size={16} />
            E-posta
          </a>
        ) : null}
      </div>
    </article>
  )
}

export default function TherapistDirectoryClient() {
  const [liveTherapists, setLiveTherapists] = useState<DirectoryTherapist[]>([])
  const [draftQuery, setDraftQuery] = useState("")
  const [query, setQuery] = useState("")
  const [selectedCity, setSelectedCity] = useState("Tümü")
  const [selectedProfession, setSelectedProfession] = useState("Tümü")
  const [selectedTherapistId, setSelectedTherapistId] = useState("")

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
          const rows = Array.isArray(payload?.therapists) ? payload.therapists : []
          setLiveTherapists(rows.map((therapist: PublicTherapist) => ({ ...therapist, isExample: false })))
        }
      } catch {
        if (active) {
          setLiveTherapists([])
        }
      }
    }

    loadTherapists()

    return () => {
      active = false
    }
  }, [])

  const usingExamples = liveTherapists.length === 0
  const therapists = useMemo(
    () => (usingExamples ? demoTherapists : liveTherapists),
    [liveTherapists, usingExamples],
  )

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

  const populatedCities = useMemo(
    () => Object.keys(cityCounts).sort((a, b) => a.localeCompare(b, "tr")),
    [cityCounts],
  )

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
        therapist.shortAddress,
        therapist.city,
        therapist.district,
        therapist.specialties.join(" "),
      ]
        .map(normalize)
        .some((field) => field.includes(q))
    })
  }, [query, selectedCity, selectedProfession, therapists])

  const mapPoints = useMemo<TherapistMapPoint[]>(
    () =>
      filtered.map((therapist, index) => {
        const [latitude, longitude] = getCoordinates(therapist.city, index)
        return {
          id: therapist.id,
          fullName: therapist.fullName,
          profession: therapist.title || therapist.profession,
          workplace: therapist.workplace,
          city: therapist.city,
          district: therapist.district,
          shortAddress: therapist.shortAddress,
          specialties: therapist.specialties,
          latitude,
          longitude,
          isExample: therapist.isExample,
        }
      }),
    [filtered],
  )

  const filteredCityCount = useMemo(
    () => new Set(filtered.map((therapist) => therapist.city).filter(Boolean)).size,
    [filtered],
  )

  const filteredProfessionCount = useMemo(
    () =>
      new Set(
        filtered
          .map((therapist) => therapist.profession || therapist.title)
          .filter(Boolean),
      ).size,
    [filtered],
  )

  useEffect(() => {
    if (selectedTherapistId && !filtered.some((therapist) => therapist.id === selectedTherapistId)) {
      setSelectedTherapistId("")
    }
  }, [filtered, selectedTherapistId])

  function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setQuery(draftQuery)
    setSelectedTherapistId("")
  }

  function resetFilters() {
    setDraftQuery("")
    setQuery("")
    setSelectedCity("Tümü")
    setSelectedProfession("Tümü")
    setSelectedTherapistId("")
  }

  function locateTherapist(id: string) {
    setSelectedTherapistId(id)
    window.requestAnimationFrame(() => {
      document.querySelector(`.${styles.mapPanel}`)?.scrollIntoView({ behavior: "smooth", block: "nearest" })
    })
  }

  function selectTherapistFromMap(id: string) {
    setSelectedTherapistId(id)
    window.requestAnimationFrame(() => {
      document.getElementById(`therapist-${id}`)?.scrollIntoView({ behavior: "smooth", block: "nearest" })
    })
  }

  return (
    <section className={styles.directoryPanel}>
      <form className={styles.filters} onSubmit={handleSearch}>
        <label className={styles.searchBox}>
          <Search size={18} />
          <input
            value={draftQuery}
            onChange={(event) => setDraftQuery(event.target.value)}
            placeholder="İsim, meslek, kurum veya uzmanlık ara"
            aria-label="Uzman ara"
          />
        </label>
        <label className={styles.selectBox}>
          <MapPin size={18} />
          <select
            value={selectedCity}
            onChange={(event) => {
              setSelectedCity(event.target.value)
              setSelectedTherapistId("")
            }}
            aria-label="Şehir seç"
          >
            {cities.map((city) => (
              <option key={city} value={city}>
                {city === "Tümü" ? "Tüm şehirler" : city}
              </option>
            ))}
          </select>
        </label>
        <label className={styles.selectBox}>
          <Filter size={18} />
          <select
            value={selectedProfession}
            onChange={(event) => {
              setSelectedProfession(event.target.value)
              setSelectedTherapistId("")
            }}
            aria-label="Meslek seç"
          >
            {professions.map((profession) => (
              <option key={profession} value={profession}>
                {profession === "Tümü" ? "Tüm meslekler" : profession}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className={styles.searchButton}>
          <Search size={17} />
          Ara
        </button>
        <button type="button" className={styles.resetButton} onClick={resetFilters} aria-label="Filtreleri temizle">
          <RotateCcw size={17} />
        </button>
      </form>

      <div className={styles.cityFilters} aria-label="Hızlı şehir filtresi">
        <button
          type="button"
          className={selectedCity === "Tümü" ? styles.cityActive : ""}
          onClick={() => {
            setSelectedCity("Tümü")
            setSelectedTherapistId("")
          }}
        >
          Türkiye geneli <span>{therapists.length}</span>
        </button>
        {populatedCities.map((city) => (
          <button
            type="button"
            key={city}
            className={selectedCity === city ? styles.cityActive : ""}
            onClick={() => {
              setSelectedCity(city)
              setSelectedTherapistId("")
            }}
          >
            {city} <span>{cityCounts[city]}</span>
          </button>
        ))}
      </div>

      <div className={styles.mapGrid}>
        <div className={styles.mapPanel} aria-label="Uzman haritası">
          <div className={styles.mapTopbar}>
            <div>
              <span>{usingExamples ? "Örnek uzman haritası" : "Canlı uzman haritası"}</span>
              <strong>{selectedCity === "Tümü" ? "Türkiye geneli" : selectedCity}</strong>
            </div>
            <div className={styles.mapSummary}>
              <span>{filtered.length} profil</span>
              <small>Yaklaşık şehir merkezi</small>
            </div>
          </div>
          <div className={styles.mapViewport}>
            <TherapistMap points={mapPoints} selectedId={selectedTherapistId} onSelect={selectTherapistFromMap} />
          </div>
          <div className={styles.mapStats}>
            <span>
              <strong>{filtered.length}</strong>
              Profil
            </span>
            <span>
              <strong>{filteredCityCount}</strong>
              Şehir
            </span>
            <span>
              <strong>{filteredProfessionCount}</strong>
              Meslek
            </span>
          </div>
        </div>

        <div className={styles.listPanel}>
          <div className={styles.listHeader}>
            <div>
              <span>Sonuçlar</span>
              <strong>{filtered.length} profil bulundu</strong>
            </div>
            {usingExamples ? <em>Örnek görünüm</em> : null}
          </div>

          <div className={styles.listRows}>
            {filtered.length === 0 ? (
              <div className={styles.empty}>
                <MapPin size={24} />
                <strong>Bu filtreyle eşleşen profil yok.</strong>
                <span>Filtreleri temizleyip yeniden deneyin.</span>
                <button type="button" onClick={resetFilters}>
                  Filtreleri temizle
                </button>
              </div>
            ) : (
              filtered.map((therapist) => (
                <TherapistRow
                  therapist={therapist}
                  key={therapist.id}
                  selected={selectedTherapistId === therapist.id}
                  onLocate={() => locateTherapist(therapist.id)}
                />
              ))
            )}
          </div>
        </div>
      </div>
    </section>
  )
}
