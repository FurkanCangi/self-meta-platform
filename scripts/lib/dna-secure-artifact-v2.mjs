import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

export function sha256Bytes(value) {
  return crypto.createHash("sha256").update(value).digest("hex")
}

export function resolveSecureRoot(requested, requireVolume = false) {
  const root = path.resolve(requested)
  assert(fs.existsSync(root), `secure_v2_root_missing:${root}`)
  const metadata = fs.lstatSync(root)
  assert(!metadata.isSymbolicLink(), "secure_v2_root_symlink_rejected")
  assert(metadata.isDirectory(), "secure_v2_root_not_directory")
  const real = fs.realpathSync(root)
  assert(real === root, "secure_v2_root_realpath_mismatch")
  if (requireVolume) assert(real.startsWith(`/Volumes${path.sep}`),
    "secure_v2_local_fallback_rejected")
  return real
}

export function assertContained(root, requested) {
  const absolute = path.resolve(requested)
  const delta = path.relative(root, absolute)
  assert(delta && delta !== ".." && !delta.startsWith(`..${path.sep}`)
    && !delta.startsWith(path.sep), `secure_v2_path_escape:${absolute}`)
  return absolute
}

export function assertSecureParentChain(root, requested, createMissing) {
  const secureRoot = resolveSecureRoot(root)
  const target = assertContained(secureRoot, requested)
  const parent = path.dirname(target)
  let current = secureRoot
  for (const segment of path.relative(secureRoot, parent).split(path.sep).filter(Boolean)) {
    current = path.join(current, segment)
    if (!fs.existsSync(current)) {
      assert(createMissing, `secure_v2_parent_missing:${current}`)
      fs.mkdirSync(current, { mode: 0o700 })
    }
    const metadata = fs.lstatSync(current)
    assert(!metadata.isSymbolicLink(), `secure_v2_parent_symlink_rejected:${current}`)
    assert(metadata.isDirectory(), `secure_v2_parent_not_directory:${current}`)
    const real = fs.realpathSync(current)
    const delta = path.relative(secureRoot, real)
    assert(real === secureRoot || (delta !== ".." && !delta.startsWith(`..${path.sep}`)
      && !delta.startsWith(path.sep)), `secure_v2_parent_escape:${current}`)
  }
  return target
}

export function readSecureFile(root, requested, require0600 = false) {
  const target = assertSecureParentChain(root, requested, false)
  assert(fs.existsSync(target), `secure_v2_input_missing:${target}`)
  const metadata = fs.lstatSync(target)
  assert(!metadata.isSymbolicLink(), `secure_v2_input_symlink:${target}`)
  assert(metadata.isFile(), `secure_v2_input_not_file:${target}`)
  if (require0600) assert((metadata.mode & 0o777) === 0o600,
    `secure_v2_input_mode:${target}`)
  const bytes = fs.readFileSync(target)
  return { bytes, text: bytes.toString("utf8"), sha256: sha256Bytes(bytes) }
}

export function verifySecureFile(root, requested, expected) {
  const target = assertSecureParentChain(root, requested, false)
  assert(fs.existsSync(target), `secure_v2_output_missing:${target}`)
  const metadata = fs.lstatSync(target)
  assert(!metadata.isSymbolicLink(), `secure_v2_output_symlink_rejected:${target}`)
  assert(metadata.isFile(), `secure_v2_output_not_file:${target}`)
  assert((metadata.mode & 0o777) === 0o600,
    `secure_v2_output_mode_invalid:${(metadata.mode & 0o777).toString(8)}`)
  const expectedBytes = Buffer.isBuffer(expected) ? expected : Buffer.from(expected, "utf8")
  const actual = fs.readFileSync(target)
  assert(actual.equals(expectedBytes), `secure_v2_output_readback_mismatch:${target}`)
  return { sha256: sha256Bytes(actual), bytes: actual.length, mode: 0o600 }
}

export function secureAtomicWriteFile(root, requested, content) {
  const target = assertSecureParentChain(root, requested, true)
  if (fs.existsSync(target)) {
    const metadata = fs.lstatSync(target)
    assert(!metadata.isSymbolicLink(), `secure_v2_output_symlink_rejected:${target}`)
    assert(metadata.isFile(), `secure_v2_output_not_file:${target}`)
  }
  const bytes = Buffer.isBuffer(content) ? content : Buffer.from(content, "utf8")
  const temporary = path.join(path.dirname(target),
    `.${path.basename(target)}.${process.pid}.${crypto.randomBytes(10).toString("hex")}.tmp`)
  let descriptor = null
  try {
    descriptor = fs.openSync(temporary,
      fs.constants.O_CREAT | fs.constants.O_EXCL | fs.constants.O_WRONLY | fs.constants.O_NOFOLLOW,
      0o600)
    let offset = 0
    while (offset < bytes.length) {
      const written = fs.writeSync(descriptor, bytes, offset, bytes.length - offset, offset)
      assert(written > 0, "secure_v2_zero_progress")
      offset += written
    }
    fs.fsyncSync(descriptor)
    fs.closeSync(descriptor)
    descriptor = null
    fs.chmodSync(temporary, 0o600)
    assertSecureParentChain(root, target, false)
    if (fs.existsSync(target)) assert(!fs.lstatSync(target).isSymbolicLink(),
      `secure_v2_output_symlink_rejected:${target}`)
    fs.renameSync(temporary, target)
    fs.chmodSync(target, 0o600)
    const directoryDescriptor = fs.openSync(path.dirname(target), fs.constants.O_RDONLY)
    try {
      fs.fsyncSync(directoryDescriptor)
    } finally {
      fs.closeSync(directoryDescriptor)
    }
    return verifySecureFile(root, target, bytes)
  } finally {
    if (descriptor !== null) fs.closeSync(descriptor)
    if (fs.existsSync(temporary)) fs.unlinkSync(temporary)
  }
}
