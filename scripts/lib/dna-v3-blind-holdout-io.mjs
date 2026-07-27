import { createHash } from "node:crypto";
import {
  chmodSync,
  closeSync,
  existsSync,
  lstatSync,
  mkdirSync,
  openSync,
  readFileSync,
  realpathSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, isAbsolute, join, normalize, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

export const RESEARCH_SSD_ROOT = "/Volumes/ResearchSSD";
export const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

export function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, canonicalize(value[key])]),
    );
  }
  return value;
}

export function canonicalJson(value) {
  return `${JSON.stringify(canonicalize(value), null, 2)}\n`;
}

export function sha256Bytes(value) {
  return createHash("sha256").update(value).digest("hex");
}

export function sha256Json(value) {
  return sha256Bytes(canonicalJson(value));
}

export function sha256File(path) {
  return sha256Bytes(readFileSync(path));
}

function existingAncestors(path) {
  const ancestors = [];
  let cursor = resolve(path);
  while (true) {
    if (existsSync(cursor)) ancestors.push(cursor);
    const parent = dirname(cursor);
    if (parent === cursor) break;
    cursor = parent;
  }
  return ancestors;
}

export function assertNoSymlinkComponents(path, label) {
  for (const component of existingAncestors(path)) {
    if (lstatSync(component).isSymbolicLink()) {
      throw new Error(`${label} symlink bileşeni içeremez: ${component}`);
    }
  }
}

export function assertRegularFile0600(path, label) {
  assertNoSymlinkComponents(path, label);
  const info = lstatSync(path);
  if (!info.isFile()) throw new Error(`${label} normal dosya olmalıdır`);
  const mode = statSync(path).mode & 0o777;
  if (mode !== 0o600) {
    throw new Error(`${label} modu 0600 olmalıdır; bulunan ${mode.toString(8).padStart(4, "0")}`);
  }
}

export function isWithin(root, candidate) {
  const rel = relative(resolve(root), resolve(candidate));
  return rel === "" || (!rel.startsWith(`..${sep}`) && rel !== "..");
}

export function assertResearchSsdPath(path, label) {
  if (!isAbsolute(path)) throw new Error(`${label} mutlak yol olmalıdır`);
  const normalized = normalize(path);
  if (!isWithin(RESEARCH_SSD_ROOT, normalized)) {
    throw new Error(`${label} yalnız ResearchSSD altında olabilir; yerel fallback yasaktır`);
  }
  assertNoSymlinkComponents(normalized, label);
}

export function assertRepoManifestPath(path) {
  if (!isAbsolute(path)) throw new Error("manifest mutlak yol olmalıdır");
  if (!isWithin(REPO_ROOT, path)) throw new Error("manifest repo kökü altında olmalıdır");
  if (!relative(REPO_ROOT, path).startsWith(`docs${sep}`)) {
    throw new Error("manifest yalnız repo docs/ altında olabilir");
  }
  assertNoSymlinkComponents(path, "manifest");
}

export function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

export function atomicWrite(path, bytes, mode, { replace = false } = {}) {
  const parent = dirname(path);
  mkdirSync(parent, { recursive: true, mode: 0o700 });
  assertNoSymlinkComponents(parent, "çıktı dizini");
  if (!replace && existsSync(path)) throw new Error(`çıktı zaten var: ${path}`);
  if (existsSync(path) && lstatSync(path).isSymbolicLink()) {
    throw new Error(`çıktı symlink olamaz: ${path}`);
  }
  const temp = join(parent, `.${process.pid}.${Date.now()}.${Math.random().toString(16).slice(2)}.tmp`);
  let fd;
  try {
    fd = openSync(temp, "wx", mode);
    writeFileSync(fd, bytes);
    closeSync(fd);
    fd = undefined;
    chmodSync(temp, mode);
    if (!replace && existsSync(path)) throw new Error(`atomik çakışma: ${path}`);
    renameSync(temp, path);
    chmodSync(path, mode);
  } finally {
    if (fd !== undefined) closeSync(fd);
    rmSync(temp, { force: true });
  }
}

export function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) throw new Error(`geçersiz argüman: ${token}`);
    const key = token.slice(2);
    if (key === "summary") {
      parsed.summary = true;
      continue;
    }
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) throw new Error(`eksik değer: ${token}`);
    parsed[key] = value;
    index += 1;
  }
  return parsed;
}

export function countBy(items, key) {
  return Object.fromEntries(
    [...new Set(items.map((item) => item[key]))]
      .sort()
      .map((value) => [value, items.filter((item) => item[key] === value).length]),
  );
}
