#!/usr/bin/env python3
"""Compile the single owner-selected DNA book into a deterministic runtime corpus.

The source DOCX is read-only. Every non-empty heading, body paragraph and table
before the bibliography marker is retained. Inline citations are not used as a
publication gate in this package; sentence-level citation mapping deliberately
remains pending for a later pass.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import tempfile
import unicodedata
import zipfile
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Iterable
from xml.etree import ElementTree as ET


PIPELINE_VERSION = "dna-single-owner-book-ingestion@1"
RUNTIME_SCHEMA = "dna-owner-book-runtime@1"
MANIFEST_SCHEMA = "dna-owner-book-runtime-manifest@1"
REPO_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_SOURCE = (
    REPO_ROOT.parents[3]
    / "DNA Intelligence"
    / "Self-Regülasyon Kitabı.docx"
)
OUTPUT_ROOT = REPO_ROOT / "src/lib/dna/chat/catalog/generated/owner-book"
RUNTIME_PATH = OUTPUT_ROOT / "runtime.json"
MANIFEST_PATH = OUTPUT_ROOT / "manifest.json"

W_NS = "http://schemas.openxmlformats.org/wordprocessingml/2006/main"
W = f"{{{W_NS}}}"
DC_NS = "http://purl.org/dc/elements/1.1/"
DCTERMS_NS = "http://purl.org/dc/terms/"

REFERENCE_MARKERS = {"kaynakca", "kaynaklar", "references", "referanslar"}
HEADING_SIZE_TO_LEVEL = {48: 1, 36: 2, 27: 3}
INLINE_CITATION_RE = re.compile(
    r"\([^)]*\b(?:19|20)\d{2}[a-z]?[^)]*\)|\[[^]]*\b(?:19|20)\d{2}[a-z]?[^]]*\]",
    re.IGNORECASE,
)
SENTENCE_SPLIT_RE = re.compile(r"(?<=[.!?])\s+(?=[A-ZÇĞİÖŞÜ0-9\"“(])")

STOP_TOKENS = {
    "acaba", "ama", "bana", "bir", "bu", "cocuk", "cocugun", "da", "de",
    "dna", "gibi", "hakkinda", "hangi", "ile", "icin", "kadar", "mi", "mu",
    "nasil", "ne", "nedir", "olarak", "olan", "peki", "sence", "ve", "veya",
    "midir", "mudur", "misin", "anlat", "acikla",
}
TURKISH_SUFFIXES = (
    "larinizdan", "lerinizden", "larindan", "lerinden", "larinin", "lerinin",
    "larinda", "lerinde", "larina", "lerine", "lardan", "lerden", "siniz",
    "sunuz", "iyorlar", "uyorlar", "digini", "ligini", "iyor", "uyor", "mis",
    "mus", "lar", "ler", "inda", "inde", "undan", "inden", "dan", "den", "nin",
    "nun", "sini", "lari", "leri", "yi", "yu",
)
DOMAIN_ROOTS = (
    "interosepsiyon", "regulasyon", "norofizyoloji", "parasempatik", "prefrontal",
    "sempatik", "korteks", "yetiskin", "cocuk", "ergen", "bebek", "otonom",
)


class SingleBookError(RuntimeError):
    pass


@dataclass(frozen=True)
class Paragraph:
    body_index: int
    text: str
    font_size: int | None
    bold: bool


def normalize_text(value: str) -> str:
    value = unicodedata.normalize("NFKC", value or "")
    value = value.replace("\u00a0", " ").replace("\u200b", "")
    return re.sub(r"\s+", " ", value).strip()


def fold(value: str) -> str:
    value = normalize_text(value).casefold().replace("ı", "i")
    value = "".join(
        char for char in unicodedata.normalize("NFKD", value)
        if not unicodedata.combining(char)
    )
    return re.sub(r"[^a-z0-9]+", " ", value).strip()


def token_root(token: str) -> str:
    for root in DOMAIN_ROOTS:
        if token.startswith(root):
            return root
    for suffix in TURKISH_SUFFIXES:
        if token.endswith(suffix) and len(token) - len(suffix) >= 4:
            return token[:-len(suffix)]
    return token


def tokens_for(value: str) -> list[str]:
    return sorted({
        token_root(token)
        for token in fold(value).split()
        if len(token) >= 2 and token not in STOP_TOKENS
    })


def sha256_bytes(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def sha256_file(path: Path) -> str:
    return sha256_bytes(path.read_bytes())


def stable_json_bytes(value: Any, *, pretty: bool = False) -> bytes:
    if pretty:
        text = json.dumps(value, ensure_ascii=False, sort_keys=True, indent=2) + "\n"
    else:
        text = json.dumps(
            value,
            ensure_ascii=False,
            sort_keys=True,
            separators=(",", ":"),
        ) + "\n"
    return text.encode("utf-8")


def atomic_write(path: Path, payload: bytes) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    descriptor, temporary = tempfile.mkstemp(prefix=f".{path.name}.", dir=path.parent)
    try:
        with os.fdopen(descriptor, "wb") as handle:
            handle.write(payload)
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(temporary, path)
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)


def element_text(element: ET.Element) -> str:
    parts: list[str] = []
    for node in element.iter():
        if node.tag == f"{W}t":
            parts.append(node.text or "")
        elif node.tag == f"{W}tab":
            parts.append("\t")
        elif node.tag in {f"{W}br", f"{W}cr"}:
            parts.append("\n")
    return normalize_text("".join(parts))


def paragraph_info(element: ET.Element, body_index: int) -> Paragraph | None:
    text = element_text(element)
    if not text:
        return None
    sizes: list[int] = []
    bold = False
    for run in element.findall(f".//{W}r"):
        size = run.find(f"./{W}rPr/{W}sz")
        if size is not None:
            try:
                sizes.append(int(size.get(f"{W}val", "")))
            except ValueError:
                pass
        bold_node = run.find(f"./{W}rPr/{W}b")
        if bold_node is not None and bold_node.get(f"{W}val", "1") not in {"0", "false", "off"}:
            bold = True
    return Paragraph(
        body_index=body_index,
        text=text,
        font_size=max(sizes) if sizes else None,
        bold=bold,
    )


def split_sentences(text: str) -> list[str]:
    return [normalize_text(sentence) for sentence in SENTENCE_SPLIT_RE.split(text) if normalize_text(sentence)]


def node_id(order: int, kind: str, text: str) -> str:
    digest = sha256_bytes(text.encode("utf-8"))[:10]
    return f"owner-book:{kind}:{order:04d}:{digest}"


def table_rows(element: ET.Element) -> list[list[str]]:
    rows: list[list[str]] = []
    for row in element.findall(f"./{W}tr"):
        cells: list[str] = []
        for cell in row.findall(f"./{W}tc"):
            paragraphs = [
                element_text(paragraph)
                for paragraph in cell.findall(f".//{W}p")
            ]
            cells.append(normalize_text(" ".join(value for value in paragraphs if value)))
        if any(cells):
            rows.append(cells)
    return rows


def read_core_properties(archive: zipfile.ZipFile) -> dict[str, str | None]:
    try:
        root = ET.fromstring(archive.read("docProps/core.xml"))
    except (KeyError, ET.ParseError):
        return {"author": None, "modifiedAt": None}
    creator = root.find(f"{{{DC_NS}}}creator")
    modified = root.find(f"{{{DCTERMS_NS}}}modified")
    return {
        "author": normalize_text(creator.text or "") if creator is not None else None,
        "modifiedAt": normalize_text(modified.text or "") if modified is not None else None,
    }


def extract(source: Path) -> tuple[dict[str, Any], dict[str, Any]]:
    if source.is_symlink() or not source.is_file():
        raise SingleBookError("single_owner_book_source_invalid")
    if source.name != "Self-Regülasyon Kitabı.docx":
        raise SingleBookError("single_owner_book_wrong_source_name")
    try:
        with zipfile.ZipFile(source) as archive:
            root = ET.fromstring(archive.read("word/document.xml"))
            core = read_core_properties(archive)
    except (zipfile.BadZipFile, KeyError, ET.ParseError) as exc:
        raise SingleBookError("single_owner_book_invalid_docx") from exc

    body = root.find(f".//{W}body")
    if body is None:
        raise SingleBookError("single_owner_book_body_missing")

    nodes: list[dict[str, Any]] = []
    references: list[str] = []
    heading_path: list[str] = []
    heading_ids: list[str] = []
    in_references = False

    for body_index, element in enumerate(list(body)):
        if element.tag == f"{W}p":
            paragraph = paragraph_info(element, body_index)
            if paragraph is None:
                continue
            if fold(paragraph.text) in REFERENCE_MARKERS:
                in_references = True
                continue
            if in_references:
                references.append(paragraph.text)
                continue

            heading_level = HEADING_SIZE_TO_LEVEL.get(paragraph.font_size)
            if not nodes and paragraph.bold and len(paragraph.text) <= 160:
                heading_level = 1
            order = len(nodes) + 1
            if heading_level:
                heading_path = heading_path[: heading_level - 1]
                heading_ids = heading_ids[: heading_level - 1]
                heading_path.append(paragraph.text)
                identifier = node_id(order, "heading", paragraph.text)
                heading_ids.append(identifier)
                nodes.append({
                    "id": identifier,
                    "order": order,
                    "kind": "heading",
                    "headingLevel": heading_level,
                    "headingPath": list(heading_path),
                    "sectionId": identifier,
                    "text": paragraph.text,
                    "sentences": [paragraph.text],
                    "tokens": tokens_for(paragraph.text),
                    "headingTokens": tokens_for(" ".join(heading_path)),
                })
                continue

            identifier = node_id(order, "paragraph", paragraph.text)
            sentences = split_sentences(paragraph.text)
            nodes.append({
                "id": identifier,
                "order": order,
                "kind": "paragraph",
                "headingLevel": None,
                "headingPath": list(heading_path),
                "sectionId": heading_ids[-1] if heading_ids else identifier,
                "text": paragraph.text,
                "sentences": sentences,
                "tokens": tokens_for(paragraph.text),
                "headingTokens": tokens_for(" ".join(heading_path)),
            })
            continue

        if element.tag != f"{W}tbl" or in_references:
            continue
        rows = table_rows(element)
        if not rows:
            continue
        text = "\n".join(" | ".join(cell for cell in row) for row in rows)
        order = len(nodes) + 1
        identifier = node_id(order, "table", text)
        nodes.append({
            "id": identifier,
            "order": order,
            "kind": "table",
            "headingLevel": None,
            "headingPath": list(heading_path),
            "sectionId": heading_ids[-1] if heading_ids else identifier,
            "text": text,
            "sentences": [" | ".join(cell for cell in row) for row in rows],
            "tokens": tokens_for(text),
            "headingTokens": tokens_for(" ".join(heading_path)),
        })

    if not nodes or not references:
        raise SingleBookError("single_owner_book_content_incomplete")

    all_sentences = [
        sentence
        for node in nodes
        if node["kind"] != "heading"
        for sentence in node["sentences"]
    ]
    body_payload = "\n\n".join(node["text"] for node in nodes).encode("utf-8")
    reference_payload = "\n".join(references).encode("utf-8")
    nodes_sha256 = sha256_bytes(stable_json_bytes(nodes))
    package = {
        "schemaVersion": RUNTIME_SCHEMA,
        "pipelineVersion": PIPELINE_VERSION,
        "source": {
            "id": "book.self-regulation.owner-current",
            "title": "Self-Regülasyon Kitabı",
            "author": core["author"] or "Abdullah Furkan CANGİ",
            "year": 2026,
            "fileName": source.name,
            "sha256": sha256_file(source),
            "modifiedAt": core["modifiedAt"],
            "selectedByOwner": True,
            "citationStatus": "pending_sentence_mapping",
            "legacyChapterFilesIncluded": [],
        },
        "content": {
            "bodyTextSha256": sha256_bytes(body_payload),
            "referenceTextSha256": sha256_bytes(reference_payload),
            "nodesSha256": nodes_sha256,
        },
        "counts": {
            "nodes": len(nodes),
            "headings": sum(node["kind"] == "heading" for node in nodes),
            "paragraphs": sum(node["kind"] == "paragraph" for node in nodes),
            "tables": sum(node["kind"] == "table" for node in nodes),
            "sentences": len(all_sentences),
            "sentencesWithoutInlineCitation": sum(
                INLINE_CITATION_RE.search(sentence) is None for sentence in all_sentences
            ),
            "sentencesWithInlineCitation": sum(
                INLINE_CITATION_RE.search(sentence) is not None for sentence in all_sentences
            ),
            "citationPendingSentences": len(all_sentences),
            "references": len(references),
        },
        "runtimePolicy": {
            "externalLlm": False,
            "runtimeInternet": False,
            "embedding": False,
            "vectorDatabase": False,
            "safetyGateRequired": True,
            "citationMappingPending": True,
        },
        "nodes": nodes,
    }
    manifest = {
        "schemaVersion": MANIFEST_SCHEMA,
        "pipelineVersion": PIPELINE_VERSION,
        "source": package["source"],
        "content": package["content"],
        "counts": package["counts"],
        "runtimePolicy": package["runtimePolicy"],
        "runtimePath": str(RUNTIME_PATH.relative_to(REPO_ROOT)),
    }
    return package, manifest


def build(source: Path) -> dict[str, Any]:
    package, manifest = extract(source.resolve(strict=True))
    runtime_payload = stable_json_bytes(package)
    manifest = {
        **manifest,
        "runtimeSha256": sha256_bytes(runtime_payload),
        "runtimeBytes": len(runtime_payload),
    }
    atomic_write(RUNTIME_PATH, runtime_payload)
    atomic_write(MANIFEST_PATH, stable_json_bytes(manifest, pretty=True))
    return manifest


def verify(source: Path | None = None) -> dict[str, Any]:
    if not RUNTIME_PATH.is_file() or not MANIFEST_PATH.is_file():
        raise SingleBookError("single_owner_book_runtime_missing")
    runtime_payload = RUNTIME_PATH.read_bytes()
    package = json.loads(runtime_payload)
    manifest = json.loads(MANIFEST_PATH.read_text("utf-8"))
    if package.get("schemaVersion") != RUNTIME_SCHEMA:
        raise SingleBookError("single_owner_book_runtime_schema_invalid")
    if manifest.get("schemaVersion") != MANIFEST_SCHEMA:
        raise SingleBookError("single_owner_book_manifest_schema_invalid")
    if manifest.get("runtimeSha256") != sha256_bytes(runtime_payload):
        raise SingleBookError("single_owner_book_runtime_hash_mismatch")
    if manifest.get("source") != package.get("source"):
        raise SingleBookError("single_owner_book_source_manifest_mismatch")
    if manifest.get("counts") != package.get("counts"):
        raise SingleBookError("single_owner_book_count_manifest_mismatch")
    if package["source"].get("legacyChapterFilesIncluded") != []:
        raise SingleBookError("single_owner_book_legacy_chapter_included")
    nodes = package.get("nodes")
    if not isinstance(nodes, list) or len(nodes) != package["counts"]["nodes"]:
        raise SingleBookError("single_owner_book_node_count_invalid")
    if sha256_bytes(stable_json_bytes(nodes)) != package["content"]["nodesSha256"]:
        raise SingleBookError("single_owner_book_nodes_hash_mismatch")
    if any(not node.get("text") or not node.get("id") for node in nodes):
        raise SingleBookError("single_owner_book_empty_node")
    if package["counts"]["citationPendingSentences"] != package["counts"]["sentences"]:
        raise SingleBookError("single_owner_book_citation_pending_coverage_invalid")
    if source is not None and source.exists():
        if sha256_file(source.resolve(strict=True)) != package["source"]["sha256"]:
            raise SingleBookError("single_owner_book_source_hash_mismatch")
    return manifest


def print_status(manifest: dict[str, Any]) -> None:
    print(json.dumps({
        "ok": True,
        "schemaVersion": manifest["schemaVersion"],
        "sourceSha256": manifest["source"]["sha256"],
        "runtimeSha256": manifest["runtimeSha256"],
        "runtimeBytes": manifest["runtimeBytes"],
        "counts": manifest["counts"],
        "citationStatus": manifest["source"]["citationStatus"],
        "legacyChapterFilesIncluded": manifest["source"]["legacyChapterFilesIncluded"],
    }, ensure_ascii=False, sort_keys=True))


def main(argv: Iterable[str] | None = None) -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("command", choices=("build", "verify", "status"))
    parser.add_argument("--source", type=Path, default=DEFAULT_SOURCE)
    args = parser.parse_args(list(argv) if argv is not None else None)
    try:
        if args.command == "build":
            manifest = build(args.source)
        else:
            manifest = verify(args.source if args.source.exists() else None)
        print_status(manifest)
        return 0
    except (OSError, KeyError, TypeError, ValueError, SingleBookError) as exc:
        print(json.dumps({"ok": False, "error": str(exc)}, ensure_ascii=False))
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
