import assert from "node:assert/strict"

import {
  getDirectoryPublicationMissingFields,
  hasTooManyDirectorySpecialties,
  isPublicTherapistComplete,
  MAX_DIRECTORY_SPECIALTIES,
  normalizeDirectoryInput,
  parseDirectorySpecialties,
} from "../src/lib/therapists/directory"

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
assert.deepEqual(getDirectoryPublicationMissingFields(incomplete), ["workplace", "city", "shortAddress", "specialties"])

const complete = normalizeDirectoryInput({
  firstName: "Ada",
  lastName: "Yılmaz",
  profession: "Ergoterapist",
  workplace: "Örnek Terapi Merkezi",
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
    city: "İstanbul",
    district: "Kadıköy",
    phone: "",
    email: "",
    shortAddress: "Bağdat Caddesi No: 10",
    specialties: ["Duyu bütünleme"],
  }),
  true,
)

console.log("Therapist directory contract tests passed.")
