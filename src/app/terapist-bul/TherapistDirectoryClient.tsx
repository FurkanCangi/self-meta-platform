"use client"

import dynamic from "next/dynamic"
import {
  Building2,
  Filter,
  Globe2,
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

type DirectoryTherapist = PublicTherapist

function normalize(value: string) {
  return value.toLocaleLowerCase("tr-TR").trim()
}

function TherapistRow({
  therapist,
  selected,
  onLocate,
  canLocate,
}: {
  therapist: DirectoryTherapist
  selected: boolean
  onLocate: () => void
  canLocate: boolean
}) {
  const cityLabel = [therapist.district, therapist.city, therapist.country].filter(Boolean).join(" / ")
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
            <span className={styles.approvedBadge}>Onaylı profil</span>
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
        {canLocate ? (
          <button type="button" onClick={onLocate} aria-label={`${therapist.fullName} haritada göster`}>
            <LocateFixed size={16} />
            Haritada göster
          </button>
        ) : null}
        {therapist.phone ? (
          <a href={`tel:${therapist.phone.replace(/\s/g, "")}`} aria-label={`${therapist.fullName} telefon numarası`}>
            <Phone size={16} />
            Ara
          </a>
        ) : null}
        {therapist.email ? (
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
  const [loadingTherapists, setLoadingTherapists] = useState(true)
  const [therapistLoadError, setTherapistLoadError] = useState(false)
  const [reloadAttempt, setReloadAttempt] = useState(0)
  const [draftQuery, setDraftQuery] = useState("")
  const [query, setQuery] = useState("")
  const [selectedCountry, setSelectedCountry] = useState("Tümü")
  const [selectedCity, setSelectedCity] = useState("Tümü")
  const [selectedProfession, setSelectedProfession] = useState("Tümü")
  const [selectedTherapistId, setSelectedTherapistId] = useState("")

  useEffect(() => {
    let active = true

    async function loadTherapists() {
      setLoadingTherapists(true)
      setTherapistLoadError(false)

      try {
        const response = await fetch("/api/public/therapists", { cache: "no-store" })
        const payload = await response.json().catch(() => ({}))
        if (!response.ok || payload?.ok === false) {
          throw new Error(payload?.error || "Terapist listesi alınamadı.")
        }
        if (active) {
          const rows = Array.isArray(payload?.therapists) ? payload.therapists : []
          setLiveTherapists(rows as PublicTherapist[])
        }
      } catch {
        if (active) {
          setLiveTherapists([])
          setTherapistLoadError(true)
        }
      } finally {
        if (active) setLoadingTherapists(false)
      }
    }

    loadTherapists()

    return () => {
      active = false
    }
  }, [reloadAttempt])

  const therapists = useMemo(
    () => liveTherapists,
    [liveTherapists],
  )

  const countries = useMemo(() => {
    const allCountries = new Set(therapists.map((item) => item.country).filter(Boolean))
    return ["Tümü", ...Array.from(allCountries).sort((a, b) => a.localeCompare(b, "tr"))]
  }, [therapists])

  const cities = useMemo(() => {
    const allCities = new Set(
      therapists
        .filter((item) => selectedCountry === "Tümü" || item.country === selectedCountry)
        .map((item) => item.city)
        .filter(Boolean),
    )
    return ["Tümü", ...Array.from(allCities).sort((a, b) => a.localeCompare(b, "tr"))]
  }, [selectedCountry, therapists])

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
      if (therapist.city && (selectedCountry === "Tümü" || therapist.country === selectedCountry)) {
        acc[therapist.city] = (acc[therapist.city] || 0) + 1
      }
      return acc
    }, {})
  }, [selectedCountry, therapists])

  const populatedCities = useMemo(
    () => Object.keys(cityCounts).sort((a, b) => a.localeCompare(b, "tr")),
    [cityCounts],
  )

  const filtered = useMemo(() => {
    const q = normalize(query)
    return therapists.filter((therapist) => {
      const countryMatch = selectedCountry === "Tümü" || therapist.country === selectedCountry
      if (!countryMatch) return false
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
        therapist.country,
        therapist.city,
        therapist.district,
        therapist.specialties.join(" "),
      ]
        .map(normalize)
        .some((field) => field.includes(q))
    })
  }, [query, selectedCity, selectedCountry, selectedProfession, therapists])

  const mapPoints = useMemo<TherapistMapPoint[]>(
    () =>
      filtered.flatMap((therapist) => {
        if (
          therapist.latitude === null ||
          therapist.longitude === null ||
          !therapist.locationPrecision
        ) return []

        return [{
          id: therapist.id,
          fullName: therapist.fullName,
          profession: therapist.title || therapist.profession,
          workplace: therapist.workplace,
          country: therapist.country,
          city: therapist.city,
          district: therapist.district,
          shortAddress: therapist.shortAddress,
          specialties: therapist.specialties,
          latitude: therapist.latitude,
          longitude: therapist.longitude,
          locationPrecision: therapist.locationPrecision,
        }]
      }),
    [filtered],
  )

  const filteredCityCount = useMemo(
    () => new Set(filtered.map((therapist) => therapist.city).filter(Boolean)).size,
    [filtered],
  )

  const mappableTherapistIds = useMemo(() => new Set(mapPoints.map((point) => point.id)), [mapPoints])

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
    setSelectedCountry("Tümü")
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

  if (loadingTherapists) {
    return (
      <section className={styles.directoryPanel} aria-live="polite">
        <div className={styles.empty}>
          <Search size={24} />
          <strong>Yayımlanmış uzman profilleri yükleniyor.</strong>
          <span>Liste hazır olduğunda yalnızca gerçek ve yayına açık profiller gösterilecektir.</span>
        </div>
      </section>
    )
  }

  if (therapistLoadError) {
    return (
      <section className={styles.directoryPanel} role="alert">
        <div className={styles.empty}>
          <MapPin size={24} />
          <strong>Uzman listesi şu anda yüklenemedi.</strong>
          <span>Bağlantıyı yenileyip tekrar deneyebilirsiniz.</span>
          <button type="button" onClick={() => setReloadAttempt((attempt) => attempt + 1)}>
            Yeniden dene
          </button>
        </div>
      </section>
    )
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
          <Globe2 size={18} />
          <select
            value={selectedCountry}
            onChange={(event) => {
              setSelectedCountry(event.target.value)
              setSelectedCity("Tümü")
              setSelectedTherapistId("")
            }}
            aria-label="Ülke seç"
          >
            {countries.map((country) => (
              <option key={country} value={country}>
                {country === "Tümü" ? "Tüm ülkeler" : country}
              </option>
            ))}
          </select>
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
          {selectedCountry === "Tümü" ? "Tüm konumlar" : selectedCountry} <span>{therapists.filter((item) => selectedCountry === "Tümü" || item.country === selectedCountry).length}</span>
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
              <span>Canlı uzman haritası</span>
              <strong>
                {selectedCity !== "Tümü"
                  ? [selectedCity, selectedCountry === "Tümü" ? "" : selectedCountry].filter(Boolean).join(" / ")
                  : selectedCountry === "Tümü" ? "Tüm konumlar" : selectedCountry}
              </strong>
            </div>
            <div className={styles.mapSummary}>
              <span>{mapPoints.length} harita konumu</span>
              <small>Doğrulanmış yaklaşık ilçe/şehir merkezi</small>
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
          </div>

          <div className={styles.listRows}>
            {filtered.length === 0 ? (
              <div className={styles.empty}>
                <MapPin size={24} />
                {therapists.length === 0 ? (
                  <>
                    <strong>Henüz yayımlanmış uzman profili yok.</strong>
                    <span>Yalnızca yayın izni açık ve gerekli bilgileri tamamlanmış gerçek profiller burada görünür.</span>
                  </>
                ) : (
                  <>
                    <strong>Bu filtreyle eşleşen profil yok.</strong>
                    <span>Filtreleri temizleyip yeniden deneyin.</span>
                    <button type="button" onClick={resetFilters}>
                      Filtreleri temizle
                    </button>
                  </>
                )}
              </div>
            ) : (
              filtered.map((therapist) => (
                <TherapistRow
                  therapist={therapist}
                  key={therapist.id}
                  selected={selectedTherapistId === therapist.id}
                  canLocate={mappableTherapistIds.has(therapist.id)}
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
