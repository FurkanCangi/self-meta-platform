import { randomBytes } from "node:crypto"
import {
  chmodSync,
  closeSync,
  constants,
  existsSync,
  fsyncSync,
  linkSync,
  lstatSync,
  mkdirSync,
  openSync,
  readFileSync,
  realpathSync,
  renameSync,
  unlinkSync,
  writeSync,
} from "node:fs"
import { basename, dirname, join, relative, resolve, sep } from "node:path"

import { sha256 } from "./dna-locked-retrieval-core.mjs"

function fail(code) {
  throw new Error(code)
}

export function resolveSecureRoot(requested, options = {}) {
  const root = resolve(requested)
  if (!existsSync(root)) fail("dna_secure_root_missing")
  const metadata = lstatSync(root)
  if (metadata.isSymbolicLink()) fail("dna_secure_root_symlink_forbidden")
  if (!metadata.isDirectory()) fail("dna_secure_root_not_directory")
  const real = realpathSync(root)
  if (real !== root) fail("dna_secure_root_realpath_mismatch")
  if (options.requiredPrefix
    && real !== options.requiredPrefix
    && !real.startsWith(`${options.requiredPrefix}${sep}`)) {
    fail("dna_secure_root_prefix_mismatch")
  }
  return real
}

export function assertContained(root, requested) {
  const target = resolve(requested)
  const delta = relative(root, target)
  if (!delta || delta === ".." || delta.startsWith(`..${sep}`) || delta.startsWith(sep)) {
    fail("dna_secure_path_escape")
  }
  return target
}

export function assertSecureParentChain(root, requested, createMissing = false) {
  const secureRoot = resolveSecureRoot(root)
  const target = assertContained(secureRoot, requested)
  const parent = dirname(target)
  const delta = relative(secureRoot, parent)
  let current = secureRoot
  for (const segment of delta.split(sep).filter(Boolean)) {
    current = join(current, segment)
    if (!existsSync(current)) {
      if (!createMissing) fail("dna_secure_parent_missing")
      mkdirSync(current, { mode: 0o700 })
    }
    const metadata = lstatSync(current)
    if (metadata.isSymbolicLink()) fail("dna_secure_parent_symlink_forbidden")
    if (!metadata.isDirectory()) fail("dna_secure_parent_not_directory")
    const real = realpathSync(current)
    const realDelta = relative(secureRoot, real)
    if (real !== secureRoot
      && (realDelta === ".." || realDelta.startsWith(`..${sep}`) || realDelta.startsWith(sep))) {
      fail("dna_secure_parent_realpath_escape")
    }
  }
  return target
}

export function verifySecureFile(root, requested, expected) {
  const target = assertSecureParentChain(root, requested, false)
  if (!existsSync(target)) fail("dna_secure_output_missing")
  const metadata = lstatSync(target)
  if (metadata.isSymbolicLink()) fail("dna_secure_output_symlink_forbidden")
  if (!metadata.isFile()) fail("dna_secure_output_not_regular")
  if ((metadata.mode & 0o777) !== 0o600) fail("dna_secure_output_mode_invalid")
  const real = realpathSync(target)
  const realDelta = relative(root, real)
  if (realDelta === ".." || realDelta.startsWith(`..${sep}`) || realDelta.startsWith(sep)) {
    fail("dna_secure_output_realpath_escape")
  }
  const expectedBytes = Buffer.isBuffer(expected) ? expected : Buffer.from(expected, "utf8")
  const actualBytes = readFileSync(target)
  if (actualBytes.length !== expectedBytes.length || sha256(actualBytes) !== sha256(expectedBytes)
    || !actualBytes.equals(expectedBytes)) fail("dna_secure_output_readback_mismatch")
  return { sha256: sha256(actualBytes), bytes: actualBytes.length, mode: 0o600 }
}

function secureAtomicWrite(root, requested, content, replaceExisting) {
  const target = assertSecureParentChain(root, requested, true)
  if (existsSync(target)) {
    const metadata = lstatSync(target)
    if (metadata.isSymbolicLink()) fail("dna_secure_output_symlink_forbidden")
    if (!metadata.isFile()) fail("dna_secure_output_not_regular")
    if (!replaceExisting) fail("dna_secure_output_exists")
  }
  const bytes = Buffer.isBuffer(content) ? content : Buffer.from(content, "utf8")
  const temporary = join(
    dirname(target),
    `.${basename(target)}.${randomBytes(16).toString("hex")}.tmp`,
  )
  let descriptor = null
  try {
    descriptor = openSync(
      temporary,
      constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY | constants.O_NOFOLLOW,
      0o600,
    )
    let offset = 0
    while (offset < bytes.length) {
      const written = writeSync(descriptor, bytes, offset, bytes.length - offset, offset)
      if (written <= 0) fail("dna_secure_atomic_write_stalled")
      offset += written
    }
    fsyncSync(descriptor)
    closeSync(descriptor)
    descriptor = null
    chmodSync(temporary, 0o600)

    assertSecureParentChain(root, target, false)
    if (existsSync(target)) {
      const metadata = lstatSync(target)
      if (metadata.isSymbolicLink()) fail("dna_secure_output_symlink_forbidden")
      if (!metadata.isFile()) fail("dna_secure_output_not_regular")
      if (!replaceExisting) fail("dna_secure_output_exists")
    }
    if (replaceExisting) {
      renameSync(temporary, target)
    } else {
      linkSync(temporary, target)
      unlinkSync(temporary)
    }
    chmodSync(target, 0o600)
    const directoryDescriptor = openSync(dirname(target), constants.O_RDONLY)
    try {
      fsyncSync(directoryDescriptor)
    } finally {
      closeSync(directoryDescriptor)
    }
    return verifySecureFile(root, target, bytes)
  } finally {
    if (descriptor !== null) closeSync(descriptor)
    if (existsSync(temporary)) unlinkSync(temporary)
  }
}

export function secureAtomicWriteNew(root, requested, content) {
  return secureAtomicWrite(root, requested, content, false)
}

export function secureAtomicWriteReplace(root, requested, content) {
  return secureAtomicWrite(root, requested, content, true)
}
