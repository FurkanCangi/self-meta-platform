import assert from "node:assert/strict"

import {
  getDirectoryPublicationMissingFields,
  hasTooManyDirectorySpecialties,
  isPublicTherapistComplete,
  MAX_DIRECTORY_SPECIALTIES,
  normalizeDirectoryInput,
  parseDirectorySpecialties,
} from "../src/lib/therapists/directory"
import {
  buildTherapistLocationQuery,
  normalizeGeocodingText,
  selectVerifiedGeocodingCandidate,
} from "../src/lib/therapists/geocoding"

const duplicateSpecialties = parseDirectorySpecialties([
  "Duyu bütünleme",
  "  duyu bütünleme  ",
  "Pediatrik uygulama",
])
assert.deepEqual(duplicateSpecialties, ["Duyu bütünleme", "Pediatrik uygulama"])

const elevenSpecialties = Array.from({ length: 11 }, (_, index) => `Uzmanlık ${index + 1}`)
assert.equal(hasTooManyDirectorySpecialties(elevenSpecialties), true)
assert.equal(parseDirectorySpecialties(elevenSpecialties).length, MAX_DIRECTORY_SPECIALTIES)

const incomplete = normalizeDirectoryInput({
  firstName: "Ada",
  lastName: "Yılmaz",
  profession: "Ergoterapist",
  publicListingEnabled: true,
})
assert.deepEqual(getDirectoryPublicationMissingFields(incomplete), [
  "workplace",
  "country",
  "city",
  "shortAddress",
  "specialties",
])

const complete = normalizeDirectoryInput({
  firstName: "Ada",
  lastName: "Yılmaz",
  profession: "Ergoterapist",
  workplace: "Örnek Terapi Merkezi",
  country: "Türkiye",
  city: "İstanbul",
  district: "Kadıköy",
  shortAddress: "Bağdat Caddesi No: 10",
  specialties: ["Duyu bütünleme", "Pediatrik uygulama"],
  publicListingEnabled: true,
})
assert.deepEqual(getDirectoryPublicationMissingFields(complete), [])
assert.equal(complete.specialties, "Duyu bütünleme, Pediatrik uygulama")

assert.equal(
  isPublicTherapistComplete({
    id: "profile-1",
    fullName: "Ada Yılmaz",
    firstName: "Ada",
    lastName: "Yılmaz",
    profession: "Ergoterapist",
    title: "Uzm. Ergoterapist",
    workplace: "Örnek Terapi Merkezi",
    country: "Türkiye",
    city: "İstanbul",
    district: "Kadıköy",
    phone: "",
    email: "",
    shortAddress: "Bağdat Caddesi No: 10",
    specialties: ["Duyu bütünleme"],
    latitude: 40.9917,
    longitude: 29.0277,
    locationPrecision: "district",
  }),
  true,
)

assert.equal(
  isPublicTherapistComplete({
    id: "profile-2",
    fullName: "Ada Yılmaz",
    firstName: "Ada",
    lastName: "Yılmaz",
    profession: "Ergoterapist",
    title: "",
    workplace: "Örnek Terapi Merkezi",
    country: "Türkiye",
    city: "İstanbul",
    district: "Kadıköy",
    phone: "",
    email: "",
    shortAddress: "Kadıköy",
    specialties: ["Duyu bütünleme"],
    latitude: null,
    longitude: null,
    locationPrecision: null,
  }),
  false,
)

assert.equal(normalizeGeocodingText("  İSTANBUL  "), "istanbul")
assert.equal(normalizeGeocodingText("Ataşehir"), "atasehir")
assert.equal(
  buildTherapistLocationQuery({ country: "Türkiye", city: "İstanbul", district: "Ataşehir" }),
  "Ataşehir, İstanbul, Türkiye",
)

const atasehirLocation = selectVerifiedGeocodingCandidate(
  { country: "Türkiye", city: "İstanbul", district: "Ataşehir" },
  [{
    lat: "40.9827",
    lon: "29.1274",
    place_id: 101,
    display_name: "Ataşehir, İstanbul, Türkiye",
    address: { country: "Türkiye", province: "İstanbul", town: "Ataşehir" },
  }],
)
assert.deepEqual(atasehirLocation, {
  latitude: 40.9827,
  longitude: 29.1274,
  precision: "district",
  providerPlaceId: "101",
  displayName: "Ataşehir, İstanbul, Türkiye",
})

for (const testCase of [
  {
    input: { country: "Türkiye", city: "Ankara", district: "Çankaya" },
    candidate: {
      lat: "39.9179",
      lon: "32.8627",
      display_name: "Çankaya, Ankara, Türkiye",
      address: { country: "Türkiye", province: "Ankara", town: "Çankaya" },
    },
    precision: "district",
  },
  {
    input: { country: "France", city: "Paris" },
    candidate: {
      lat: "48.8589",
      lon: "2.3200",
      display_name: "Paris, Île-de-France, France",
      address: { country: "France", city: "Paris" },
    },
    precision: "city",
  },
  {
    input: { country: "ABD", city: "New York", district: "Manhattan" },
    candidate: {
      lat: "40.7896",
      lon: "-73.9599",
      display_name: "Manhattan, New York, United States",
      address: { country: "United States", city: "New York", borough: "Manhattan" },
    },
    precision: "district",
  },
  {
    input: { country: "Deutschland", city: "Berlin" },
    candidate: {
      lat: "52.5174",
      lon: "13.3951",
      display_name: "Berlin, Deutschland",
      address: { country: "Germany", city: "Berlin" },
    },
    precision: "city",
  },
  {
    input: { country: "Australia", city: "Sydney" },
    candidate: {
      lat: "-33.8698",
      lon: "151.2083",
      display_name: "Sidney, New South Wales, Avustralya",
      address: { country: "Avustralya", country_code: "au", city: "Sidney" },
      namedetails: { name: "Sydney", "name:tr": "Sidney" },
    },
    precision: "city",
  },
  {
    input: { country: "Japan", city: "東京" },
    candidate: {
      lat: "35.6769",
      lon: "139.7639",
      display_name: "Tokyo, Japonya",
      address: { country: "Japonya", country_code: "jp", city: "Tokyo" },
      namedetails: { name: "Tokyo", "name:ja": "東京" },
    },
    precision: "city",
  },
] as const) {
  const selected = selectVerifiedGeocodingCandidate(testCase.input, [testCase.candidate])
  assert.ok(selected, `${testCase.input.city} doğrulanmalı`)
  assert.equal(selected.precision, testCase.precision)
}

assert.equal(
  selectVerifiedGeocodingCandidate(
    { country: "Türkiye", city: "İstanbul", district: "Ataşehir" },
    [{
      lat: "40.9827",
      lon: "29.1274",
      display_name: "Ataşehir, İstanbul, Türkiye",
      address: { country: "Greece", city: "İstanbul", district: "Ataşehir" },
    }],
  ),
  null,
)
assert.equal(
  selectVerifiedGeocodingCandidate(
    { country: "Türkiye", city: "İstanbul", district: "Ataşehir" },
    [{
      lat: "41.0082",
      lon: "28.9784",
      display_name: "Fatih, İstanbul, Türkiye",
      address: { country: "Türkiye", province: "İstanbul", town: "Fatih" },
    }],
  ),
  null,
)
assert.equal(
  selectVerifiedGeocodingCandidate(
    { country: "Türkiye", city: "İstanbul" },
    [{ lat: "999", lon: "29", display_name: "İstanbul, Türkiye", address: { country: "Türkiye", city: "İstanbul" } }],
  ),
  null,
)

console.log("Therapist directory contract tests passed.")
