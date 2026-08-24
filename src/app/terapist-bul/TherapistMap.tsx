"use client"

import "leaflet/dist/leaflet.css"

import { latLngBounds } from "leaflet"
import { Building2, GraduationCap, MapPin } from "lucide-react"
import { useEffect } from "react"
import { CircleMarker, MapContainer, Popup, ScaleControl, TileLayer, Tooltip, ZoomControl, useMap } from "react-leaflet"
import styles from "./page.module.css"

export type TherapistMapPoint = {
  id: string
  fullName: string
  profession: string
  workplace: string
  country: string
  city: string
  district: string
  shortAddress: string
  specialties: string[]
  latitude: number
  longitude: number
  locationPrecision: "district" | "city"
  isExample: boolean
}

type TherapistMapProps = {
  points: TherapistMapPoint[]
  selectedId: string
  onSelect: (id: string) => void
}

function MapFocusController({ points, selectedId }: Pick<TherapistMapProps, "points" | "selectedId">) {
  const map = useMap()

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => map.invalidateSize())
    return () => window.cancelAnimationFrame(frame)
  }, [map])

  useEffect(() => {
    const selected = points.find((point) => point.id === selectedId)
    if (selected) {
      map.flyTo([selected.latitude, selected.longitude], selected.locationPrecision === "district" ? 12 : 10, {
        duration: 0.8,
      })
      return
    }

    if (points.length === 0) {
      map.setView([20, 0], 2)
      return
    }

    if (points.length === 1) {
      const [point] = points
      map.setView([point.latitude, point.longitude], point.locationPrecision === "district" ? 11 : 9)
      return
    }

    const bounds = latLngBounds(points.map((point) => [point.latitude, point.longitude]))
    map.fitBounds(bounds, {
      animate: true,
      duration: 0.7,
      maxZoom: 9,
      padding: [54, 54],
    })
  }, [map, points, selectedId])

  return null
}

export default function TherapistMap({ points, selectedId, onSelect }: TherapistMapProps) {
  return (
    <MapContainer
      center={[20, 0]}
      className={styles.liveMap}
      maxZoom={16}
      minZoom={2}
      scrollWheelZoom={false}
      zoom={2}
      zoomControl={false}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
        subdomains="abcd"
        url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
      />

      <MapFocusController points={points} selectedId={selectedId} />
      <ZoomControl position="bottomright" />
      <ScaleControl imperial={false} position="bottomleft" />

      {points.map((point) => {
        const selected = selectedId === point.id
        return (
          <CircleMarker
            center={[point.latitude, point.longitude]}
            eventHandlers={{ click: () => onSelect(point.id) }}
            key={point.id}
            pathOptions={{
              color: selected ? "#ffffff" : "#f8fbff",
              fillColor: selected ? "#7c3aed" : "#1267e8",
              fillOpacity: 1,
              opacity: 1,
              weight: selected ? 4 : 3,
            }}
            radius={selected ? 14 : 11}
          >
            <Tooltip direction="top" offset={[0, -12]} opacity={1}>
              <strong>{point.fullName}</strong>
              <span>{[point.district, point.city, point.country].filter(Boolean).join(" / ")}</span>
            </Tooltip>
            <Popup closeButton={false} className={styles.mapPopupShell} offset={[0, -8]}>
              <article className={styles.mapPopup}>
                <div className={styles.mapPopupHeading}>
                  <span aria-hidden="true">{point.fullName.slice(0, 1)}</span>
                  <div>
                    <strong>{point.fullName}</strong>
                    <small>{point.profession}</small>
                  </div>
                </div>
                <p>
                  <MapPin size={15} />
                  {[point.shortAddress, [point.district, point.city, point.country].filter(Boolean).join(" / ")]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
                {point.workplace ? (
                  <p>
                    <Building2 size={15} />
                    {point.workplace}
                  </p>
                ) : null}
                {point.specialties.length > 0 ? (
                  <div className={styles.mapPopupTags} aria-label="Uzmanlık alanları">
                    {point.specialties.map((specialty) => (
                      <span key={specialty}>{specialty}</span>
                    ))}
                  </div>
                ) : null}
                {point.isExample ? (
                  <em>
                    <GraduationCap size={14} /> Örnek profil
                  </em>
                ) : null}
              </article>
            </Popup>
          </CircleMarker>
        )
      })}
    </MapContainer>
  )
}
