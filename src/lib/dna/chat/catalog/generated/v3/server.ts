import "server-only"

import { validateCurrentDnaV3StaticPackage } from "../../../governance/v3StaticPackage"
import claimPassageLinksJson from "./claim-passage-links.json"
import claimsJson from "./claims.json"
import lexicalIndexJson from "./lexical-index.json"
import manifestJson from "./manifest.json"
import passagesJson from "./passages.json"
import relationsJson from "./relations.json"
import sourcesJson from "./sources.json"
import type { DnaV3StaticPackage } from "./types"

export type * from "./types"

let loadedPackage: DnaV3StaticPackage | null = null

/** Server-only loader for the committed, hash-checked V3 package. */
export function loadDnaV3StaticPackage(): DnaV3StaticPackage {
  if (loadedPackage) return loadedPackage
  loadedPackage = validateCurrentDnaV3StaticPackage({
    manifest: manifestJson,
    sources: sourcesJson,
    passages: passagesJson,
    claims: claimsJson,
    relations: relationsJson,
    claimPassageLinks: claimPassageLinksJson,
    lexicalIndex: lexicalIndexJson,
  } as unknown as DnaV3StaticPackage)
  return loadedPackage
}

export const DNA_V3_STATIC_PACKAGE = loadDnaV3StaticPackage()
