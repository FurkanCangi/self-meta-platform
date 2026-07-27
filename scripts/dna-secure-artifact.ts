import { createHash, randomBytes } from "node:crypto"
import {
  chmodSync,
  closeSync,
  constants,
  existsSync,
  fsyncSync,
  lstatSync,
  mkdirSync,
  openSync,
  readFileSync,
  realpathSync,
  renameSync,
  statSync,
  unlinkSync,
  writeSync,
} from "node:fs"
import { basename, dirname, join, relative, resolve, sep } from "node:path"

type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue }

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

function canonicalize(value: unknown): JsonValue {
  if (value === null || typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return value
  }
  if (Array.isArray(value)) return value.map(canonicalize)
  assert(typeof value === "object", "secure_artifact_non_json_value")
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right, "en"))
      .map(([key, child]) => [key, canonicalize(child)]),
  )
}

export function canonicalSha256(value: unknown): string {
  return createHash("sha256")
    .update(JSON.stringify(canonicalize(value)), "utf8")
    .digest("hex")
}

export function sha256Bytes(value: string | Buffer): string {
  return createHash("sha256").update(value).digest("hex")
}

export function resolveSecureRoot(requested: string, requireVolume = false): string {
  const root = resolve(requested)
  assert(existsSync(root), `secure_artifact_root_missing:${root}`)
  assert(!lstatSync(root).isSymbolicLink(), "secure_artifact_root_symlink_rejected")
  assert(lstatSync(root).isDirectory(), "secure_artifact_root_not_directory")
  const real = realpathSync(root)
  assert(real === root, "secure_artifact_root_realpath_mismatch")
  if (requireVolume) {
    assert(real.startsWith(`/Volumes${sep}`), "secure_artifact_local_fallback_rejected")
  }
  return real
}

export function assertContained(root: string, requested: string): string {
  const absolute = resolve(requested)
  const delta = relative(root, absolute)
  assert(
    delta !== "" && delta !== ".." && !delta.startsWith(`..${sep}`) && !delta.startsWith(sep),
    `secure_artifact_path_escape:${absolute}`,
  )
  return absolute
}

export function assertSecureParentChain(root: string, target: string, createMissing: boolean): string {
  const secureRoot = resolveSecureRoot(root)
  const absolute = assertContained(secureRoot, target)
  const parent = dirname(absolute)
  const delta = relative(secureRoot, parent)
  let current = secureRoot
  for (const segment of delta.split(sep).filter(Boolean)) {
    current = join(current, segment)
    if (!existsSync(current)) {
      assert(createMissing, `secure_artifact_parent_missing:${current}`)
      mkdirSync(current, { mode: 0o700 })
    }
    const metadata = lstatSync(current)
    assert(!metadata.isSymbolicLink(), `secure_artifact_parent_symlink_rejected:${current}`)
    assert(metadata.isDirectory(), `secure_artifact_parent_not_directory:${current}`)
    const real = realpathSync(current)
    const realDelta = relative(secureRoot, real)
    assert(
      real === secureRoot || (realDelta !== ".." && !realDelta.startsWith(`..${sep}`) && !realDelta.startsWith(sep)),
      `secure_artifact_parent_realpath_escape:${current}`,
    )
  }
  return absolute
}

export function verifySecureFile(
  root: string,
  requested: string,
  expected: string | Buffer,
): { sha256: string; bytes: number; mode: number } {
  const path = assertSecureParentChain(root, requested, false)
  assert(existsSync(path), `secure_artifact_written_file_missing:${path}`)
  const metadata = lstatSync(path)
  assert(!metadata.isSymbolicLink(), `secure_artifact_output_symlink_rejected:${path}`)
  assert(metadata.isFile(), `secure_artifact_output_not_regular_file:${path}`)
  const mode = statSync(path).mode & 0o777
  assert(mode === 0o600, `secure_artifact_output_mode_invalid:${mode.toString(8)}`)
  const real = realpathSync(path)
  const realDelta = relative(root, real)
  assert(
    realDelta !== ".." && !realDelta.startsWith(`..${sep}`) && !realDelta.startsWith(sep),
    `secure_artifact_output_realpath_escape:${path}`,
  )
  const expectedBytes = Buffer.isBuffer(expected) ? expected : Buffer.from(expected, "utf8")
  const actualBytes = readFileSync(path)
  const expectedHash = sha256Bytes(expectedBytes)
  const actualHash = sha256Bytes(actualBytes)
  assert(actualHash === expectedHash, `secure_artifact_output_hash_mismatch:${path}`)
  assert(actualBytes.equals(expectedBytes), `secure_artifact_output_readback_mismatch:${path}`)
  return { sha256: actualHash, bytes: actualBytes.length, mode }
}

export function secureAtomicWriteFile(
  root: string,
  requested: string,
  content: string | Buffer,
): { sha256: string; bytes: number; mode: number } {
  const path = assertSecureParentChain(root, requested, true)
  if (existsSync(path)) {
    const targetMetadata = lstatSync(path)
    assert(!targetMetadata.isSymbolicLink(), `secure_artifact_output_symlink_rejected:${path}`)
    assert(targetMetadata.isFile(), `secure_artifact_output_not_regular_file:${path}`)
  }
  const bytes = Buffer.isBuffer(content) ? content : Buffer.from(content, "utf8")
  const temporary = join(
    dirname(path),
    `.${basename(path)}.${process.pid}.${randomBytes(12).toString("hex")}.tmp`,
  )
  let fileDescriptor: number | null = null
  try {
    fileDescriptor = openSync(
      temporary,
      constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY | constants.O_NOFOLLOW,
      0o600,
    )
    let offset = 0
    while (offset < bytes.length) {
      const written = writeSync(fileDescriptor, bytes, offset, bytes.length - offset, offset)
      assert(written > 0, "secure_artifact_atomic_write_zero_progress")
      offset += written
    }
    fsyncSync(fileDescriptor)
    closeSync(fileDescriptor)
    fileDescriptor = null
    chmodSync(temporary, 0o600)

    assertSecureParentChain(root, path, false)
    if (existsSync(path)) {
      assert(!lstatSync(path).isSymbolicLink(), `secure_artifact_output_symlink_rejected:${path}`)
    }
    renameSync(temporary, path)
    chmodSync(path, 0o600)

    const directoryDescriptor = openSync(dirname(path), constants.O_RDONLY)
    try {
      fsyncSync(directoryDescriptor)
    } finally {
      closeSync(directoryDescriptor)
    }
    return verifySecureFile(root, path, bytes)
  } finally {
    if (fileDescriptor !== null) closeSync(fileDescriptor)
    if (existsSync(temporary)) unlinkSync(temporary)
  }
}
