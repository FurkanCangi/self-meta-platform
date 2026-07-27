#!/usr/bin/env python3
"""Build a deterministic, non-runtime DNA owner-book draft package.

The source DOCX files are never modified. Full extracted text is written only
under ResearchSSD. The repository receives a compact, text-free manifest.
Nothing produced by this module is owner approved, release eligible, or runtime
eligible.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import shutil
import sys
import tempfile
import unicodedata
import zipfile
from collections import Counter, defaultdict
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Iterable, Sequence
from xml.etree import ElementTree as ET


PIPELINE_VERSION = "dna-owner-book-draft-ingestion@1"
PACKAGE_SCHEMA = "dna-owner-book-draft-package@1"
REPO_MANIFEST_SCHEMA = "dna-owner-book-draft-repo-manifest@1"
REPO_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_SOURCE_ROOT = REPO_ROOT.parents[3] / "DNA Intelligence"
DEFAULT_SSD_ROOT = Path("/Volumes/ResearchSSD")
OUTPUT_SUBPATH = Path("Outputs/SelfMetaAI/dna-intelligence/owner-book-draft")
METHOD_REGISTRATION_INDEX_SUBPATH = Path(
    "Datasets/DNA-Intelligence/work/v3/method-appraisal-registrations/v1/index.json"
)
EXTERNAL_CANDIDATE_PACKAGE_SUBPATH = Path(
    "Datasets/DNA-Intelligence/work/v3/prebook-closure/v1/external-science-candidate-package.json"
)
DEFAULT_REPO_MANIFEST = (
    REPO_ROOT / "docs/dna-intelligence/governance/v3/owner-book-draft-manifest.json"
)
DEFAULT_SOURCE_GOVERNANCE_SNAPSHOT = (
    REPO_ROOT / "docs/dna-intelligence/governance/v3/source-library-governance-snapshot.json"
)

W_NS = "http://schemas.openxmlformats.org/wordprocessingml/2006/main"
W = f"{{{W_NS}}}"
SHA256_RE = re.compile(r"^[a-f0-9]{64}$")
DOI_RE = re.compile(r"\b10\.\d{4,9}/[-._;()/:A-Z0-9]+", re.IGNORECASE)
YEAR_RE = re.compile(r"\b((?:19|20)\d{2})([a-z]?)\b", re.IGNORECASE)
NUMBERED_HEADING_RE = re.compile(r"^\d+\.\d+\.")
CHAPTER_FILE_RE = re.compile(r"^\s*(\d+)(?:\D|$)")
FORWARD_REFERENCE_RE = re.compile(
    r"\b(?:modül|bölüm)\s+\d+(?:[.’']?de|[.’']?da|[.’']?te|[.’']?ta)?\b",
    re.IGNORECASE,
)

SAFETY_LABELS = {
    "bilimsel sinir",
    "gelisimsel sinir",
    "kanit denetimi",
    "guvenli klinik dil",
    "klinik sinir",
}
DNA_LABELS = {
    "dna calisma ilkesi",
    "dna calisma tanimi",
    "dna sentezinin bilimsel statusu",
    "dna sentezi",
}
SYNTHESIS_LABELS = {
    "anahtar mesaj",
    "ana fikir",
    "burada onemli olan su",
}
QUESTION_LABELS = {"anahtar soru", "klinik soru"}
TABLE_SAFETY_HEADERS = {
    "tek basina neyi gostermez",
    "yanlis yorum",
    "kacinilacak ifade",
    "cikarilmamasi gereken sonuc",
    "klinik sinir",
    "uygun olmayan anlatim",
}

PACKAGE_PAYLOAD_FILES = frozenset({
    "canonical-book.txt",
    "records.jsonl",
    "sources.jsonl",
    "benchmark-candidates.jsonl",
})
PACKAGE_CHECKSUM_FILES = frozenset({*PACKAGE_PAYLOAD_FILES, "manifest.json"})
PACKAGE_DIRECTORY_FILES = frozenset({*PACKAGE_CHECKSUM_FILES, "checksums.sha256"})
CANDIDATE_FALSE_FIELDS = frozenset({
    "ownerApproval",
    "runtimeEligible",
    "releaseEligible",
    "answerEligible",
    "evaluationEligible",
    "activationAllowed",
    "authorityInherited",
    "claimFidelityInherited",
    "methodAppraisalInherited",
    "bookPassageSupportedByCandidateClaim",
})
COMPACT_CHAPTER_KEYS = (
    "order",
    "fileName",
    "byteLength",
    "sourceSha256",
    "chapterId",
    "blockCount",
    "paragraphCount",
    "tableCount",
    "headingCount",
    "sourceCount",
    "recordCount",
    "benchmarkCandidateCount",
    "clinicalCompositeDisclaimer",
    "canonicalChapterSha256",
    "ownerApproval",
    "runtimeEligible",
    "releaseEligible",
)


class DraftBookError(RuntimeError):
    """A fail-closed draft ingestion error."""


@dataclass(frozen=True)
class Block:
    body_index: int
    kind: str
    text: str
    style: str
    paragraph_index: int | None = None
    table_index: int | None = None
    rows: tuple[tuple[str, ...], ...] = ()
    cell_paragraphs: tuple[str, ...] = ()


def sha256_bytes(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def stable_json(value: Any, *, pretty: bool = False) -> str:
    if pretty:
        return json.dumps(value, ensure_ascii=False, sort_keys=True, indent=2) + "\n"
    return json.dumps(
        value,
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
    )


def stable_hash(value: Any) -> str:
    return sha256_bytes(stable_json(value).encode("utf-8"))


def normalize_text(value: str) -> str:
    value = unicodedata.normalize("NFKC", value or "")
    value = value.replace("\u00a0", " ").replace("\u200b", "")
    lines = [re.sub(r"[ \t]+", " ", line).strip() for line in value.splitlines()]
    return "\n".join(line for line in lines if line).strip()


def fold(value: str) -> str:
    value = normalize_text(value).casefold().replace("ı", "i")
    value = "".join(
        char for char in unicodedata.normalize("NFKD", value)
        if not unicodedata.combining(char)
    )
    value = value.replace("’", "'").replace("“", '"').replace("”", '"')
    return re.sub(r"[^a-z0-9]+", " ", value).strip()


def slug(value: str, fallback: str = "item") -> str:
    result = fold(value).replace(" ", "-")
    result = re.sub(r"-+", "-", result).strip("-")
    return (result or fallback)[:72]


def author_key(value: str) -> str:
    """Return a conservative surname key shared by citations and references."""
    tokens = fold(value).split()
    return tokens[-1] if tokens else ""


def natural_docx_key(path: Path) -> tuple[int, str]:
    match = CHAPTER_FILE_RE.match(unicodedata.normalize("NFKC", path.name))
    return (int(match.group(1)) if match else 10_000, fold(path.name))


def chapter_number(path: Path) -> int:
    match = CHAPTER_FILE_RE.match(unicodedata.normalize("NFKC", path.name))
    if not match:
        raise DraftBookError(f"owner_book_chapter_number_missing:{path.name}")
    return int(match.group(1))


def ensure_regular_source_root(source_root: Path) -> Path:
    if source_root.is_symlink():
        raise DraftBookError("owner_book_source_root_symlink_rejected")
    resolved = source_root.resolve(strict=True)
    if not resolved.is_dir():
        raise DraftBookError("owner_book_source_root_not_directory")
    return resolved


def ensure_ssd_output_root(ssd_root: Path, *, allow_test_root: bool = False) -> Path:
    if ssd_root.is_symlink():
        raise DraftBookError("owner_book_ssd_root_symlink_rejected")
    resolved = ssd_root.resolve(strict=True)
    if not allow_test_root and not str(resolved).startswith("/Volumes/"):
        raise DraftBookError("owner_book_ssd_root_must_be_mounted_volume")
    output_root = resolved / OUTPUT_SUBPATH
    output_root.mkdir(parents=True, exist_ok=True)
    if output_root.is_symlink():
        raise DraftBookError("owner_book_output_symlink_rejected")
    if not os.access(output_root, os.W_OK):
        raise DraftBookError("owner_book_output_not_writable")
    if resolved not in output_root.resolve().parents:
        raise DraftBookError("owner_book_output_path_escape")
    return output_root


def document_text(element: ET.Element) -> str:
    parts: list[str] = []
    for node in element.iter():
        if node.tag == f"{W}t":
            parts.append(node.text or "")
        elif node.tag == f"{W}tab":
            parts.append("\t")
        elif node.tag in {f"{W}br", f"{W}cr"}:
            parts.append("\n")
    return normalize_text("".join(parts))


def paragraph_style(element: ET.Element) -> str:
    style = element.find(f"./{W}pPr/{W}pStyle")
    return style.get(f"{W}val", "") if style is not None else ""


def extract_docx_blocks(path: Path) -> list[Block]:
    try:
        with zipfile.ZipFile(path) as archive:
            root = ET.fromstring(archive.read("word/document.xml"))
    except (KeyError, zipfile.BadZipFile, ET.ParseError) as exc:
        raise DraftBookError(f"owner_book_invalid_docx:{path.name}") from exc

    body = root.find(f".//{W}body")
    if body is None:
        raise DraftBookError(f"owner_book_missing_document_body:{path.name}")

    blocks: list[Block] = []
    paragraph_index = 0
    table_index = 0
    for body_index, element in enumerate(list(body)):
        if element.tag == f"{W}p":
            text = document_text(element)
            if text:
                blocks.append(Block(
                    body_index=body_index,
                    kind="paragraph",
                    text=text,
                    style=paragraph_style(element),
                    paragraph_index=paragraph_index,
                ))
            paragraph_index += 1
            continue
        if element.tag != f"{W}tbl":
            continue
        rows: list[tuple[str, ...]] = []
        cell_paragraphs: list[str] = []
        for row in element.findall(f"./{W}tr"):
            cells: list[str] = []
            for cell in row.findall(f"./{W}tc"):
                paragraphs = [
                    document_text(paragraph)
                    for paragraph in cell.findall(f"./{W}p")
                ]
                paragraphs = [value for value in paragraphs if value]
                cell_paragraphs.extend(paragraphs)
                cells.append(normalize_text("\n".join(paragraphs)))
            if any(cells):
                rows.append(tuple(cells))
        text = "\n".join(" | ".join(cell for cell in row) for row in rows).strip()
        if text:
            blocks.append(Block(
                body_index=body_index,
                kind="table",
                text=text,
                style="TableDNA",
                table_index=table_index,
                rows=tuple(rows),
                cell_paragraphs=tuple(cell_paragraphs),
            ))
        table_index += 1
    if not blocks:
        raise DraftBookError(f"owner_book_empty_docx:{path.name}")
    return blocks


def is_heading(block: Block) -> bool:
    return block.kind == "paragraph" and block.style.casefold().startswith("heading")


def canonical_doi(text: str) -> str | None:
    match = DOI_RE.search(text)
    if not match:
        return None
    return match.group(0).rstrip(".,;:)]}").lower()


def reference_identity(text: str) -> dict[str, Any]:
    normalized = normalize_text(text)
    doi = canonical_doi(normalized)
    year_match = YEAR_RE.search(normalized)
    year = f"{year_match.group(1)}{year_match.group(2).lower()}" if year_match else None
    prefix = normalized[:year_match.start()] if year_match else normalized[:160]
    first_author = normalize_text(prefix.split(",", 1)[0]).strip(" .()")

    author_tokens: list[str] = []
    for match in re.finditer(
        r"(?:^|(?:,\s*&\s*)|(?:,\s+)|(?:\s+&\s+))"
        r"((?:(?:de|van|von|da|dos)\s+)?[A-ZÇĞİÖŞÜ][A-Za-zÇĞİÖŞÜçğıöşüÀ-ž'’\- ]{0,40})"
        r",\s*(?:[A-ZÇĞİÖŞÜ](?:\.[ -]?|\s)){1,4}",
        prefix,
    ):
        token = author_key(match.group(1))
        if token and token not in author_tokens:
            author_tokens.append(token)
    if not author_tokens and first_author:
        author_tokens.append(author_key(first_author))

    identity = doi or f"{fold(first_author)}|{year or 'undated'}|{stable_hash(normalized)[:16]}"
    return {
        "sourceId": f"source.{stable_hash(identity)[:20]}",
        "referenceText": normalized,
        "referenceTextSha256": sha256_bytes(normalized.encode("utf-8")),
        "doi": doi,
        "year": year,
        "firstAuthor": first_author or None,
        "authorTokens": author_tokens,
    }


def citation_mentions(text: str) -> list[dict[str, Any]]:
    mentions: list[dict[str, Any]] = []
    seen: set[tuple[str, str, tuple[str, ...]]] = set()
    patterns = [
        re.compile(
            r"(?P<authors>[A-ZÇĞİÖŞÜ][A-Za-zÇĞİÖŞÜçğıöşüÀ-ž'’\-]+"
            r"(?:\s*,\s*[A-ZÇĞİÖŞÜ][A-Za-zÇĞİÖŞÜçğıöşüÀ-ž'’\-]+)*"
            r"(?:\s+(?:&|ve)\s+[A-ZÇĞİÖŞÜ][A-Za-zÇĞİÖŞÜçğıöşüÀ-ž'’\-]+)?"
            r"(?:\s+(?:et\s+al\.|ve\s+arkadaş(?:ları|larının|larinin)?))?)"
            r"\s*\((?P<year>(?:19|20)\d{2}[a-z]?)\)",
        ),
        re.compile(
            r"(?P<authors>[A-ZÇĞİÖŞÜ][A-Za-zÇĞİÖŞÜçğıöşüÀ-ž'’\-]+"
            r"(?:\s*(?:&|ve)\s*[A-ZÇĞİÖŞÜ][A-Za-zÇĞİÖŞÜçğıöşüÀ-ž'’\-]+)?"
            r"(?:\s+et\s+al\.)?)\s*,\s*(?P<year>(?:19|20)\d{2}[a-z]?)",
        ),
    ]
    for pattern in patterns:
        for match in pattern.finditer(text):
            raw_authors = re.sub(
                r"\s+(?:et\s+al\.|ve\s+arkadaş(?:ları|larının|larinin)?)$",
                "",
                match.group("authors"),
                flags=re.IGNORECASE,
            )
            authors = tuple(
                author_key(part)
                for part in re.split(r"\s*(?:,|&|\bve\b)\s*", raw_authors)
                if author_key(part)
            )
            if not authors:
                continue
            key = (authors[0], match.group("year").lower(), authors[1:])
            if key in seen:
                continue
            seen.add(key)
            mentions.append({
                "raw": normalize_text(match.group(0)),
                "firstAuthorKey": authors[0],
                "additionalAuthorKeys": list(authors[1:]),
                "year": match.group("year").lower(),
            })
    return mentions


def resolve_citations(
    mentions: Sequence[dict[str, Any]],
    sources: Sequence[dict[str, Any]],
) -> tuple[list[dict[str, Any]], list[str]]:
    bindings: list[dict[str, Any]] = []
    source_ids: list[str] = []
    for mention in mentions:
        candidates = [
            source for source in sources
            if source.get("year") == mention["year"]
            and source.get("authorTokens")
            and source["authorTokens"][0] == mention["firstAuthorKey"]
        ]
        additional = mention["additionalAuthorKeys"]
        if additional and len(candidates) > 1:
            narrowed = [
                source for source in candidates
                if all(author in source.get("authorTokens", []) for author in additional)
            ]
            if narrowed:
                candidates = narrowed
        elif not additional and len(candidates) > 1:
            single_author = [
                source for source in candidates
                if len(source.get("authorTokens", [])) == 1
            ]
            if len(single_author) == 1:
                candidates = single_author
        if len(candidates) == 1:
            status = "resolved_same_chapter"
            source_id = candidates[0]["sourceId"]
            source_ids.append(source_id)
        elif not candidates:
            status = "unresolved_no_same_chapter_reference"
            source_id = None
        else:
            status = "unresolved_ambiguous_same_chapter_reference"
            source_id = None
        bindings.append({
            "mention": mention["raw"],
            "firstAuthorKey": mention["firstAuthorKey"],
            "year": mention["year"],
            "status": status,
            "sourceId": source_id,
            "candidateSourceIds": [source["sourceId"] for source in candidates],
        })
    return bindings, sorted(set(source_ids))


def section_flags(heading_1: str, heading_2: str) -> dict[str, bool]:
    major = fold(heading_1)
    minor = fold(heading_2)
    combined = f"{major} {minor}".strip()
    return {
        "source": major == "kaynaklar",
        "clinical": major.startswith("klinik acilis"),
        "glossary": major == "kisa kavram sozlugu",
        "questions": major == "klinik dusunme sorulari",
        "misconception": "sik yapilan" in major and "yanlis yorum" in major,
        "dna": (
            "dna sentezi" in major
            or "dna nin calisma tanimi" in major
            or "dna nın calisma tanimi" in major
            or "teorilerin dna icindeki" in major
        ),
        "summary": major in {"bolum ozeti", "bolumun ana fikirleri"},
        "safety": any(
            term in combined
            for term in ("ne degildir", "sinir", "guvenli klinik dil", "nöromit")
        ),
    }


def table_label(block: Block) -> str:
    return normalize_text(block.cell_paragraphs[0]) if block.cell_paragraphs else ""


def detected_safety_tags(text: str) -> tuple[str, ...]:
    value = fold(text)
    tags: set[str] = set()
    if any(term in value for term in ("tani degildir", "tani konulamaz", "tani cikarilamaz")):
        tags.add("no_diagnosis")
    if any(term in value for term in (
        "biyolojik mekanizma cikarilamaz",
        "beyin bolgesi cikarilamaz",
        "otonom durum cikarilamaz",
        "devrenin calistigini kanit",
        "fizyoloji hakkinda sonuc",
    )):
        tags.add("no_biological_inference")
    if any(term in value for term in (
        "tek basina gostermez",
        "tek basina kanit",
        "kaniti degildir",
        "kanitlamaz",
        "sonucuna varilamaz",
        "anlamina gelmez",
        "cikarilamaz",
    )):
        tags.add("claim_boundary")
    return tuple(sorted(tags))


def classify_block(
    block: Block,
    *,
    heading_1: str,
    heading_2: str,
    metadata_position: int,
    citation_count: int,
    resolved_source_count: int,
) -> tuple[str, str, str, tuple[str, ...]]:
    flags = section_flags(heading_1, heading_2)
    label = fold(table_label(block)) if block.kind == "table" else ""
    text_key = fold(block.text)
    safety_tags: list[str] = []

    if flags["source"]:
        return "source", "external_science", "metadata_only", ()
    if metadata_position < 2 and block.kind == "paragraph":
        return "book_metadata", "none", "draft_unapproved", ()
    if is_heading(block) or block.style == "TableCaptionDNA":
        return "navigation", "none", "draft_unapproved", ()
    if FORWARD_REFERENCE_RE.search(block.text) and len(block.text) < 220:
        return "navigation", "none", "draft_unapproved", ()
    if flags["clinical"]:
        return "clinical_example", "none", "draft_unapproved", ("no_case_inference",)
    if flags["glossary"]:
        return "definition", "mixed_unresolved", "authority_review_required", ()
    if flags["questions"] or label in QUESTION_LABELS:
        return "reasoning_question", "none", "draft_unsealed", ("no_single_correct_answer",)
    if flags["misconception"] or label == "sik yapilan yanlis yorum":
        return "misconception", "owner_book_safety_candidate", "policy_review_required", (
            "misconception_guard",
        )
    header_cells = {
        fold(cell) for cell in (block.rows[0] if block.kind == "table" and block.rows else ())
    }
    if label in SAFETY_LABELS or header_cells & TABLE_SAFETY_HEADERS:
        safety_tags.extend(("no_diagnosis", "no_biological_inference", "policy_cannot_be_overridden"))
        return "safety_boundary", "owner_book_safety_candidate", "policy_review_required", tuple(safety_tags)
    explicit_dna_text = any(text_key.startswith(prefix) for prefix in (
        "dna yaklasimi",
        "dna acisindan",
        "dna da",
        "dna nin",
        "dna sentezine gore",
        "dna icin",
    ))
    if label in DNA_LABELS or flags["dna"] or explicit_dna_text:
        return "dna_product_candidate", "dna_product", "owner_approval_required", (
            "not_external_validation",
        )
    if flags["safety"] or detected_safety_tags(block.text):
        safety_tags.extend(("no_diagnosis", "no_biological_inference", "policy_cannot_be_overridden"))
        return "safety_boundary", "owner_book_safety_candidate", "policy_review_required", tuple(safety_tags)
    if block.kind == "table":
        if any(term in header_cells for term in {"kavram", "teknik kavram", "yapi", "surec"}):
            return "comparison", "mixed_unresolved", "source_link_audit_required", ()
        if label in SYNTHESIS_LABELS:
            return "chapter_synthesis", "mixed_unresolved", "authority_review_required", ()
        return "table", "mixed_unresolved", "source_link_audit_required", ()
    if flags["summary"]:
        return "chapter_synthesis", "mixed_unresolved", "authority_review_required", ()
    if (
        "ayni sey degildir" in text_key
        or "birbirinin yerine" in text_key
        or "ayrim" in text_key
        or "karsilastir" in text_key
    ):
        authority = "external_science" if resolved_source_count else "mixed_unresolved"
        status = "draft_source_bound" if resolved_source_count else "source_link_audit_required"
        return "comparison", authority, status, ()
    if citation_count:
        status = "draft_source_bound" if citation_count == resolved_source_count else "source_link_incomplete"
        return "external_science_candidate", "external_science", status, ()
    return "narrative_context", "none", "needs_claim_audit", ()


def chapter_sources(blocks: Sequence[Block], chapter_id: str) -> list[dict[str, Any]]:
    in_sources = False
    sources: list[dict[str, Any]] = []
    for block in blocks:
        if is_heading(block):
            in_sources = fold(block.text) == "kaynaklar"
            continue
        if not in_sources or block.kind != "paragraph":
            continue
        source = reference_identity(block.text)
        source.update({
            "chapterId": chapter_id,
            "referenceIndex": len(sources),
            "publicationStatus": "not_verified_by_draft_ingestion",
            "licenceStatus": "metadata_only_no_full_text_imported",
            "integrityStatus": "not_verified_by_draft_ingestion",
            "ownerApproval": False,
            "runtimeEligible": False,
            "releaseEligible": False,
        })
        sources.append(source)
    return sources


def deduplicate_sources(source_entries: Sequence[dict[str, Any]]) -> list[dict[str, Any]]:
    merged: dict[str, dict[str, Any]] = {}
    for entry in source_entries:
        source_id = entry["sourceId"]
        appearance = {
            "chapterId": entry["chapterId"],
            "referenceIndex": entry["referenceIndex"],
            "referenceTextSha256": entry["referenceTextSha256"],
        }
        if source_id not in merged:
            row = dict(entry)
            row.pop("chapterId", None)
            row.pop("referenceIndex", None)
            row["chapterIds"] = [entry["chapterId"]]
            row["appearances"] = [appearance]
            row["referenceVariantSha256"] = [entry["referenceTextSha256"]]
            merged[source_id] = row
            continue
        row = merged[source_id]
        row["chapterIds"] = sorted(set(row["chapterIds"] + [entry["chapterId"]]))
        row["appearances"].append(appearance)
        row["referenceVariantSha256"] = sorted(set(
            row["referenceVariantSha256"] + [entry["referenceTextSha256"]]
        ))
    for row in merged.values():
        row["appearances"] = sorted(
            row["appearances"],
            key=lambda item: (item["chapterId"], item["referenceIndex"]),
        )
    return [merged[source_id] for source_id in sorted(merged)]


def apply_governance_crosswalk(
    sources: Sequence[dict[str, Any]],
    snapshot_path: Path = DEFAULT_SOURCE_GOVERNANCE_SNAPSHOT,
) -> dict[str, Any]:
    try:
        raw = snapshot_path.read_bytes()
        snapshot = json.loads(raw)
    except (OSError, json.JSONDecodeError) as exc:
        raise DraftBookError("owner_book_source_governance_snapshot_unavailable") from exc
    if snapshot.get("schemaVersion") != "dna-source-library-governance-snapshot@1":
        raise DraftBookError("owner_book_source_governance_snapshot_schema_mismatch")

    identities = {row["sourceId"]: row for row in snapshot.get("identityRecords", [])}
    priorities = {row["sourceId"]: row for row in snapshot.get("priorityRecords", [])}
    licences = {row["sourceId"]: row for row in snapshot.get("licenseRecords", [])}
    doi_to_source: dict[str, str] = {}
    for source_id, row in identities.items():
        doi = canonical_doi(str((row.get("verifiedIdentifiers") or {}).get("doi") or ""))
        if doi:
            if doi in doi_to_source and doi_to_source[doi] != source_id:
                raise DraftBookError("owner_book_governance_registry_duplicate_doi")
            doi_to_source[doi] = source_id

    matched = 0
    identity_verified = 0
    passage_decisions: Counter[str] = Counter()
    full_text_decisions: Counter[str] = Counter()
    matched_registry_ids: list[str] = []
    for source in sources:
        registry_source_id = doi_to_source.get(source.get("doi") or "")
        if not registry_source_id:
            source["prebookGovernanceCrosswalk"] = {
                "status": "not_present_in_prebook_registry",
                "authorityInherited": False,
                "claimFidelityInherited": False,
                "runtimeEligible": False,
                "releaseEligible": False,
            }
            continue
        identity = identities[registry_source_id]
        priority = priorities.get(registry_source_id, {})
        licence = licences.get(registry_source_id, {})
        decisions = licence.get("decisions") or {}
        verification = identity.get("identityVerification") or {}
        matched += 1
        identity_verified += verification.get("status") == "verified"
        passage_decisions[str(decisions.get("passage") or "missing")] += 1
        full_text_decisions[str(decisions.get("full_text") or "missing")] += 1
        matched_registry_ids.append(registry_source_id)
        source["prebookGovernanceCrosswalk"] = {
            "status": "matched_by_canonical_doi",
            "registrySourceId": registry_source_id,
            "registrySnapshotSha256": sha256_bytes(raw),
            "identityVerificationStatus": verification.get("status"),
            "identityEvidenceSha256": verification.get("evidenceSha256"),
            "versionStatus": identity.get("versionStatus"),
            "priorityRole": priority.get("role"),
            "ageScope": priority.get("ageScope"),
            "sampleScope": priority.get("sampleScope"),
            "licenseComponentDecisions": {
                "metadata": decisions.get("metadata"),
                "fullText": decisions.get("full_text"),
                "passage": decisions.get("passage"),
            },
            "authorityInherited": False,
            "claimFidelityInherited": False,
            "methodAppraisalInherited": False,
            "runtimeEligible": False,
            "releaseEligible": False,
        }
    return {
        "snapshotSchemaVersion": snapshot["schemaVersion"],
        "snapshotSha256": sha256_bytes(raw),
        "registrySourceCount": len(identities),
        "bookSourceCount": len(sources),
        "matchedByCanonicalDoi": matched,
        "unmatchedBookSources": len(sources) - matched,
        "identityVerifiedMatches": identity_verified,
        "passageLicenseDecisionCounts": dict(sorted(passage_decisions.items())),
        "fullTextLicenseDecisionCounts": dict(sorted(full_text_decisions.items())),
        "matchedRegistrySourceIds": sorted(matched_registry_ids),
        "authorityInherited": False,
        "claimFidelityInherited": False,
        "runtimeEligible": False,
        "releaseEligible": False,
    }


def apply_method_candidate_crosswalk(
    sources: Sequence[dict[str, Any]],
    ssd_root: Path | None,
) -> dict[str, Any]:
    if ssd_root is None:
        for source in sources:
            source["prebookMethodCandidateCrosswalk"] = {
                "status": "disabled_in_isolated_test",
                "authorityInherited": False,
                "claimFidelityInherited": False,
                "runtimeEligible": False,
                "releaseEligible": False,
            }
        return {
            "status": "disabled_in_isolated_test",
            "registeredExternalCandidateMatches": 0,
            "matchedRegistrySourceIds": [],
            "authorityInherited": False,
            "claimFidelityInherited": False,
            "runtimeEligible": False,
            "releaseEligible": False,
        }

    index_path = ssd_root / METHOD_REGISTRATION_INDEX_SUBPATH
    candidate_path = ssd_root / EXTERNAL_CANDIDATE_PACKAGE_SUBPATH
    try:
        index_raw = index_path.read_bytes()
        candidate_raw = candidate_path.read_bytes()
        index = json.loads(index_raw)
        candidate = json.loads(candidate_raw)
    except (OSError, json.JSONDecodeError) as exc:
        raise DraftBookError("owner_book_prebook_method_registry_unavailable") from exc
    if index.get("schemaVersion") != "dna-method-appraisal-registration-index@1":
        raise DraftBookError("owner_book_method_registration_schema_mismatch")
    if candidate.get("schemaVersion") != "dna-external-science-candidate@1":
        raise DraftBookError("owner_book_external_candidate_schema_mismatch")
    if (
        candidate.get("runtimeEligible") is not False
        or candidate.get("releaseEligible") is not False
        or candidate.get("activationAllowed") is not False
    ):
        raise DraftBookError("owner_book_external_candidate_authority_expanded")

    registrations = {row["sourceId"]: row for row in index.get("records", [])}
    candidate_sources = {row["id"]: row for row in candidate.get("sources", [])}
    matched_ids: list[str] = []
    for source in sources:
        governance = source.get("prebookGovernanceCrosswalk") or {}
        registry_source_id = governance.get("registrySourceId")
        registration = registrations.get(registry_source_id)
        candidate_source = candidate_sources.get(registry_source_id)
        if not registration or not candidate_source:
            source["prebookMethodCandidateCrosswalk"] = {
                "status": (
                    "identity_match_without_registered_external_candidate"
                    if registry_source_id else "not_present_in_prebook_registry"
                ),
                "authorityInherited": False,
                "claimFidelityInherited": False,
                "runtimeEligible": False,
                "releaseEligible": False,
            }
            continue
        if (
            registration.get("status") != "registered_for_method_pipeline"
            or registration.get("runtimeEligible") is not False
            or registration.get("releaseEligible") is not False
            or candidate_source.get("runtimeEligible") is not False
            or candidate_source.get("releaseEligible") is not False
        ):
            raise DraftBookError("owner_book_method_crosswalk_authority_expanded")
        matched_ids.append(registry_source_id)
        source["prebookMethodCandidateCrosswalk"] = {
            "status": "registered_external_science_candidate",
            "registrySourceId": registry_source_id,
            "registrationIndexFileSha256": sha256_bytes(index_raw),
            "externalCandidatePackageFileSha256": sha256_bytes(candidate_raw),
            "registrationStatus": registration["status"],
            "decisionFileSha256": registration["decisionFileSha256"],
            "decisionSha256": registration["decisionSha256"],
            "resultFileSha256": registration["resultFileSha256"],
            "resultSha256": registration["resultSha256"],
            "appraisalPayloadSha256": registration["appraisalPayloadSha256"],
            "receiptFileSha256": registration["receiptFileSha256"],
            "receiptSha256": registration["receiptSha256"],
            "artifactSha256": candidate_source["artifactSha256"],
            "sourceSha256": candidate_source["sourceSha256"],
            "integrityState": candidate_source["integrityState"],
            "passageLicenseDecision": candidate_source["passageLicenseDecision"],
            "authorityInherited": False,
            "claimFidelityInherited": False,
            "bookPassageSupportedByCandidateClaim": False,
            "runtimeEligible": False,
            "releaseEligible": False,
        }
    return {
        "status": "crosswalk_complete_candidate_only",
        "registrationIndexFileSha256": sha256_bytes(index_raw),
        "registrationIndexPayloadSha256": index.get("canonicalPayloadSha256"),
        "compiledTrustRegistrySha256": index.get("compiledTrustRegistrySha256"),
        "appraisalCollectionSha256": index.get("appraisalCollectionSha256"),
        "externalCandidatePackageFileSha256": sha256_bytes(candidate_raw),
        "externalCandidatePackagePayloadSha256": candidate.get("packageSha256"),
        "registeredMethodSourceCount": len(registrations),
        "externalCandidateSourceCount": len(candidate_sources),
        "registeredExternalCandidateMatches": len(matched_ids),
        "matchedRegistrySourceIds": sorted(matched_ids),
        "authorityInherited": False,
        "claimFidelityInherited": False,
        "bookPassageSupportedByCandidateClaim": False,
        "runtimeEligible": False,
        "releaseEligible": False,
    }


def append_artifact_block(
    artifact: bytearray,
    marker: str,
    canonical_text: str,
) -> tuple[int, int]:
    artifact.extend(marker.encode("utf-8"))
    start = len(artifact)
    artifact.extend(canonical_text.encode("utf-8"))
    end = len(artifact)
    artifact.extend(b"\n")
    return start, end


def question_candidates(
    record: dict[str, Any],
    *,
    chapter_family: str,
) -> list[dict[str, Any]]:
    kind = record["kind"]
    text = record["text"]
    questions: list[tuple[str, str]] = []
    if kind == "reasoning_question":
        for value in re.split(r"\n|(?<=\?)\s+", text):
            value = normalize_text(value).lstrip("•-–—0123456789. )")
            if value.endswith("?") and len(value) >= 12:
                questions.append((value, "clinical_reasoning_boundary"))
    elif kind == "definition" and ":" in text:
        term = normalize_text(text.split(":", 1)[0]).strip("•-–— ")
        if 2 <= len(term) <= 90:
            questions.append((f'“{term}” ne demektir?', "definition"))
    elif kind == "misconception":
        stem = text[:220].strip()
        if stem:
            questions.append((f'“{stem}” ifadesi doğru mu?', "misconception_guard"))

    result: list[dict[str, Any]] = []
    for question, family in questions:
        result.append({
            "benchmarkId": f"benchmark.draft.{stable_hash([record['recordId'], question])[:20]}",
            "question": question,
            "questionSha256": sha256_bytes(question.encode("utf-8")),
            "family": family,
            "chapterFamily": chapter_family,
            "supportRecordIds": [record["recordId"]],
            "requiredBoundaryTags": list(record["safetyTags"]),
            "forbiddenInference": [
                "diagnosis",
                "treatment_plan",
                "behaviour_to_biology_inference",
                "owner_approval_claim",
            ],
            "status": "draft_unsealed",
            "ownerApproval": False,
            "evaluationEligible": False,
            "runtimeEligible": False,
            "releaseEligible": False,
        })
    return result


def semantic_package_core(
    *,
    status: str,
    source_set_sha256: str,
    canonical_artifact: bytes,
    chapters: Sequence[dict[str, Any]],
    records: Sequence[dict[str, Any]],
    sources: Sequence[dict[str, Any]],
    benchmarks: Sequence[dict[str, Any]],
    governance_crosswalk: dict[str, Any],
    method_candidate_crosswalk: dict[str, Any],
    authority_boundary: dict[str, Any],
) -> dict[str, Any]:
    return {
        "schemaVersion": PACKAGE_SCHEMA,
        "pipelineVersion": PIPELINE_VERSION,
        "status": status,
        "sourceSetSha256": source_set_sha256,
        "canonicalArtifactSha256": sha256_bytes(canonical_artifact),
        "canonicalArtifactByteLength": len(canonical_artifact),
        "chapters": list(chapters),
        "records": list(records),
        "sources": list(sources),
        "benchmarkCandidates": list(benchmarks),
        "governanceCrosswalk": governance_crosswalk,
        "methodCandidateCrosswalk": method_candidate_crosswalk,
        "authorityBoundary": authority_boundary,
    }


def build_package_data(
    source_root: Path,
    *,
    prebook_ssd_root: Path | None = None,
) -> dict[str, Any]:
    source_root = ensure_regular_source_root(source_root)
    docx_paths = sorted(
        (path for path in source_root.iterdir() if path.suffix.casefold() == ".docx"),
        key=natural_docx_key,
    )
    if len(docx_paths) != 9:
        raise DraftBookError(f"owner_book_expected_9_docx_found_{len(docx_paths)}")
    if any(path.is_symlink() or not path.is_file() for path in docx_paths):
        raise DraftBookError("owner_book_source_file_not_regular")
    chapter_numbers = [chapter_number(path) for path in docx_paths]
    expected_chapter_numbers = list(range(1, 10))
    if chapter_numbers != expected_chapter_numbers:
        raise DraftBookError(
            "owner_book_chapter_number_set_invalid:"
            f"expected_1_to_9_observed_{','.join(map(str, chapter_numbers))}"
        )

    source_snapshots = [
        {
            "order": chapter_number(path),
            "fileName": path.name,
            "byteLength": path.stat().st_size,
            "sourceSha256": sha256_bytes(path.read_bytes()),
        }
        for path in docx_paths
    ]
    source_set_hash = stable_hash(source_snapshots)

    artifact = bytearray()
    all_records: list[dict[str, Any]] = []
    all_sources: list[dict[str, Any]] = []
    all_benchmarks: list[dict[str, Any]] = []
    chapter_manifests: list[dict[str, Any]] = []
    all_unresolved: Counter[str] = Counter()

    artifact.extend(
        f"@@DNA_OWNER_BOOK_DRAFT\t{PIPELINE_VERSION}\t{source_set_hash}\n".encode("utf-8")
    )
    for path, source_snapshot in zip(docx_paths, source_snapshots):
        chapter_id = f"chapter.{source_snapshot['order']:02d}"
        blocks = extract_docx_blocks(path)
        sources = chapter_sources(blocks, chapter_id)
        all_sources.extend(sources)

        chapter_start = len(artifact)
        artifact.extend(f"@@CHAPTER\t{chapter_id}\t{path.name}\n".encode("utf-8"))
        heading_1 = ""
        heading_2 = ""
        metadata_position = 0
        chapter_record_ids: list[str] = []
        chapter_benchmark_count = 0
        clinical_disclaimer_found = any(
            "kurgu kompozit" in fold(block.text)
            or "gercek bir cocugu temsil etmez" in fold(block.text)
            for block in blocks
        )

        for block in blocks:
            if is_heading(block):
                if block.style.casefold().startswith("heading1"):
                    heading_1 = block.text
                    heading_2 = ""
                elif block.style.casefold().startswith("heading2"):
                    heading_2 = block.text

            marker_id = (
                f"p{block.paragraph_index:04d}"
                if block.kind == "paragraph"
                else f"t{block.table_index:04d}"
            )
            start, end = append_artifact_block(
                artifact,
                f"@@BLOCK\t{chapter_id}\t{marker_id}\t{block.style}\n",
                block.text,
            )

            if section_flags(heading_1, heading_2)["source"] and not is_heading(block):
                continue

            mentions = citation_mentions(block.text)
            bindings, source_ids = resolve_citations(mentions, sources)
            for binding in bindings:
                if not binding["sourceId"]:
                    all_unresolved[f"{binding['firstAuthorKey']}|{binding['year']}"] += 1

            kind, authority, review_status, safety_tags = classify_block(
                block,
                heading_1=heading_1,
                heading_2=heading_2,
                metadata_position=metadata_position,
                citation_count=len(mentions),
                resolved_source_count=sum(1 for binding in bindings if binding["sourceId"]),
            )
            safety_tags = tuple(sorted(set(safety_tags) | set(detected_safety_tags(block.text))))
            if metadata_position < 2 and block.kind == "paragraph":
                metadata_position += 1
            if kind == "source":
                continue

            if kind == "clinical_example" and not clinical_disclaimer_found:
                review_status = "synthetic_status_unspecified_quarantined"

            canonical_sha = sha256_bytes(block.text.encode("utf-8"))
            record_id = f"bookdraft.{chapter_id}.{marker_id}.{canonical_sha[:16]}"
            record = {
                "recordId": record_id,
                "kind": kind,
                "authorityLayer": authority,
                "reviewStatus": review_status,
                "chapterId": chapter_id,
                "section": {
                    "heading1": heading_1 or None,
                    "heading2": heading_2 or None,
                },
                "locator": {
                    "sourceFileName": path.name,
                    "bodyBlockIndex": block.body_index,
                    "paragraphIndex": block.paragraph_index,
                    "tableIndex": block.table_index,
                    "artifactByteRange": {
                        "startByte": start,
                        "endByteExclusive": end,
                    },
                    "rangeAuthority": "generated_canonical_candidate_only",
                },
                "style": block.style,
                "text": block.text,
                "canonicalTextSha256": canonical_sha,
                "sourceIds": source_ids,
                "citationBindings": bindings,
                "citationBindingStatus": (
                    "not_applicable" if not mentions
                    else "resolved" if len(source_ids) == len(mentions)
                    else "incomplete"
                ),
                "atomicityStatus": (
                    "single_question_candidate" if kind == "reasoning_question"
                    else "needs_claim_audit"
                ),
                "safetyTags": list(safety_tags),
                "ownerApproval": False,
                "runtimeEligible": False,
                "releaseEligible": False,
                "answerEligible": False,
                "lifecycleStatus": "parsed",
            }
            if block.kind == "table":
                record["table"] = {
                    "rows": [list(row) for row in block.rows],
                    "label": table_label(block) or None,
                    "rowCount": len(block.rows),
                    "columnCountMax": max((len(row) for row in block.rows), default=0),
                }
            all_records.append(record)
            chapter_record_ids.append(record_id)

            candidates = question_candidates(record, chapter_family=chapter_id)
            all_benchmarks.extend(candidates)
            chapter_benchmark_count += len(candidates)

        chapter_end = len(artifact)
        chapter_records = [record for record in all_records if record["chapterId"] == chapter_id]
        chapter_manifests.append({
            **source_snapshot,
            "chapterId": chapter_id,
            "chapterTitle": next(
                (block.text for block in blocks[:4] if "BÖLÜM" in block.text.upper()),
                path.stem,
            ),
            "blockCount": len(blocks),
            "paragraphCount": sum(block.kind == "paragraph" for block in blocks),
            "tableCount": sum(block.kind == "table" for block in blocks),
            "headingCount": sum(is_heading(block) for block in blocks),
            "sourceCount": len(sources),
            "recordCount": len(chapter_records),
            "benchmarkCandidateCount": chapter_benchmark_count,
            "clinicalCompositeDisclaimer": (
                "explicit" if clinical_disclaimer_found else "unspecified_quarantined"
            ),
            "canonicalArtifactRange": {
                "startByte": chapter_start,
                "endByteExclusive": chapter_end,
            },
            "canonicalChapterSha256": sha256_bytes(bytes(artifact[chapter_start:chapter_end])),
            "ownerApproval": False,
            "runtimeEligible": False,
            "releaseEligible": False,
        })

    post_snapshots = [
        {
            "order": chapter_number(path),
            "fileName": path.name,
            "byteLength": path.stat().st_size,
            "sourceSha256": sha256_bytes(path.read_bytes()),
        }
        for path in docx_paths
    ]
    if post_snapshots != source_snapshots:
        raise DraftBookError("owner_book_source_changed_during_build")

    bibliography_entry_count = len(all_sources)
    all_sources = deduplicate_sources(all_sources)
    governance_crosswalk = apply_governance_crosswalk(all_sources)
    method_candidate_crosswalk = apply_method_candidate_crosswalk(
        all_sources,
        prebook_ssd_root,
    )
    source_id_counts = Counter(source["sourceId"] for source in all_sources)
    duplicate_source_ids = sorted(source_id for source_id, count in source_id_counts.items() if count > 1)
    unique_dois = sorted({source["doi"] for source in all_sources if source.get("doi")})
    kind_counts = Counter(record["kind"] for record in all_records)
    authority_counts = Counter(record["authorityLayer"] for record in all_records)
    scientific_records = [
        record for record in all_records
        if record["kind"] == "external_science_candidate"
    ]
    source_bound_science = [record for record in scientific_records if record["sourceIds"]]
    source_coverage = (
        len(source_bound_science) / len(scientific_records)
        if scientific_records else 1.0
    )
    canonical_artifact = bytes(artifact)

    authority_boundary = {
        "ownerApprovalCount": 0,
        "ownerApproval": False,
        "runtimeEligible": False,
        "releaseEligible": False,
        "activeRuntimeChanged": False,
        "externalScienceDoesNotValidateDnaProduct": True,
        "bookSafetyTextDoesNotBecomePolicyEnforced": True,
        "finalOwnerBookLockCompatible": False,
        "reason": "draft_multidocx_not_final_owner_approved_artifact",
    }
    core = semantic_package_core(
        status="draft_owner_book_ingested_not_approved",
        source_set_sha256=source_set_hash,
        canonical_artifact=canonical_artifact,
        chapters=chapter_manifests,
        records=all_records,
        sources=all_sources,
        benchmarks=all_benchmarks,
        governance_crosswalk=governance_crosswalk,
        method_candidate_crosswalk=method_candidate_crosswalk,
        authority_boundary=authority_boundary,
    )
    package_hash = stable_hash(core)
    manifest = {
        "schemaVersion": PACKAGE_SCHEMA,
        "pipelineVersion": PIPELINE_VERSION,
        "packageSha256": package_hash,
        "status": core["status"],
        "sourceSetSha256": source_set_hash,
        "canonicalArtifactSha256": core["canonicalArtifactSha256"],
        "canonicalArtifactByteLength": len(canonical_artifact),
        "chapterCount": len(chapter_manifests),
        "recordCount": len(all_records),
        "sourceCount": len(all_sources),
        "bibliographyEntryCount": bibliography_entry_count,
        "uniqueDoiCount": len(unique_dois),
        "benchmarkCandidateCount": len(all_benchmarks),
        "countsByKind": dict(sorted(kind_counts.items())),
        "countsByAuthority": dict(sorted(authority_counts.items())),
        "chapters": chapter_manifests,
        "sourceBinding": {
            "scientificCandidateCount": len(scientific_records),
            "sourceBoundScientificCandidateCount": len(source_bound_science),
            "directSourceCoverage": round(source_coverage, 8),
            "unresolvedCitationMentionCount": sum(all_unresolved.values()),
            "unresolvedCitationKeys": dict(sorted(all_unresolved.items())),
            "duplicateSourceIds": duplicate_source_ids,
            "note": "Bibliographic matching is not claim-fidelity validation.",
        },
        "governanceCrosswalk": governance_crosswalk,
        "methodCandidateCrosswalk": method_candidate_crosswalk,
        "authorityBoundary": core["authorityBoundary"],
        "qa": {
            "sourceDocumentCountExpected": 9,
            "sourceDocumentCountObserved": len(docx_paths),
            "allRecordsHaveProvenance": all(
                record["locator"]["sourceFileName"]
                and record["locator"]["artifactByteRange"]["endByteExclusive"]
                > record["locator"]["artifactByteRange"]["startByte"]
                for record in all_records
            ),
            "allRecordsCandidateOnly": all(
                record["ownerApproval"] is False
                and record["runtimeEligible"] is False
                and record["releaseEligible"] is False
                and record["answerEligible"] is False
                for record in all_records
            ),
            "allBenchmarksDraftUnsealed": all(
                item["status"] == "draft_unsealed"
                and item["evaluationEligible"] is False
                and item["runtimeEligible"] is False
                for item in all_benchmarks
            ),
            "clinicalExampleWithoutExplicitCompositeDisclaimer": [
                chapter["chapterId"] for chapter in chapter_manifests
                if chapter["clinicalCompositeDisclaimer"] != "explicit"
            ],
            "rawSourceDocxCopied": False,
        },
    }
    return {
        "manifest": manifest,
        "records": all_records,
        "sources": all_sources,
        "benchmarks": all_benchmarks,
        "canonicalArtifact": canonical_artifact,
    }


def jsonl(rows: Iterable[dict[str, Any]]) -> bytes:
    return ("".join(stable_json(row) + "\n" for row in rows)).encode("utf-8")


def package_files(package: dict[str, Any]) -> dict[str, bytes]:
    files = {
        "canonical-book.txt": package["canonicalArtifact"],
        "records.jsonl": jsonl(package["records"]),
        "sources.jsonl": jsonl(package["sources"]),
        "benchmark-candidates.jsonl": jsonl(package["benchmarks"]),
    }
    manifest = dict(package["manifest"])
    manifest["files"] = {
        name: {"sha256": sha256_bytes(content), "byteLength": len(content)}
        for name, content in sorted(files.items())
    }
    manifest_bytes = stable_json(manifest, pretty=True).encode("utf-8")
    files["manifest.json"] = manifest_bytes
    checksums = "".join(
        f"{sha256_bytes(content)}  {name}\n"
        for name, content in sorted(files.items())
    ).encode("utf-8")
    files["checksums.sha256"] = checksums
    return files


def read_jsonl_objects(path: Path, *, label: str) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    try:
        for line_number, line in enumerate(path.read_text("utf-8").splitlines(), start=1):
            if not line:
                continue
            row = json.loads(line)
            if not isinstance(row, dict):
                raise DraftBookError(
                    f"owner_book_package_{label}_row_not_object:{line_number}"
                )
            rows.append(row)
    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise DraftBookError(f"owner_book_package_{label}_invalid") from exc
    return rows


def assert_candidate_flags_false(value: Any, *, location: str) -> None:
    if isinstance(value, dict):
        for key, child in value.items():
            if key in CANDIDATE_FALSE_FIELDS and child is not False:
                raise DraftBookError(
                    f"owner_book_package_candidate_flag_expanded:{location}.{key}"
                )
            assert_candidate_flags_false(child, location=f"{location}.{key}")
    elif isinstance(value, list):
        for index, child in enumerate(value):
            assert_candidate_flags_false(child, location=f"{location}[{index}]")


def validate_package_directory(
    directory: Path,
    *,
    output_root: Path | None = None,
    expected_package_sha256: str | None = None,
    require_identity_directory_name: bool = True,
) -> dict[str, Any]:
    if directory.is_symlink():
        raise DraftBookError("owner_book_package_directory_symlink_rejected")
    try:
        resolved_directory = directory.resolve(strict=True)
    except OSError as exc:
        raise DraftBookError("owner_book_package_directory_missing") from exc
    if not resolved_directory.is_dir():
        raise DraftBookError("owner_book_package_directory_not_directory")
    if output_root is not None:
        resolved_output = output_root.resolve(strict=True)
        if resolved_directory.parent != resolved_output:
            raise DraftBookError("owner_book_package_path_escape")

    children = list(resolved_directory.iterdir())
    if any(path.is_symlink() for path in children):
        raise DraftBookError("owner_book_package_file_symlink_rejected")
    if any(not path.is_file() for path in children):
        raise DraftBookError("owner_book_package_non_file_entry_rejected")
    actual_names = {path.name for path in children}
    if actual_names != PACKAGE_DIRECTORY_FILES:
        raise DraftBookError(
            "owner_book_package_file_set_mismatch:"
            f"expected_{','.join(sorted(PACKAGE_DIRECTORY_FILES))}:"
            f"observed_{','.join(sorted(actual_names))}"
        )

    manifest_path = resolved_directory / "manifest.json"
    try:
        manifest = json.loads(manifest_path.read_text("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise DraftBookError("owner_book_package_manifest_invalid") from exc
    if manifest.get("schemaVersion") != PACKAGE_SCHEMA:
        raise DraftBookError("owner_book_package_schema_mismatch")
    if manifest.get("pipelineVersion") != PIPELINE_VERSION:
        raise DraftBookError("owner_book_package_pipeline_version_mismatch")
    package_sha256 = str(manifest.get("packageSha256") or "")
    if not SHA256_RE.fullmatch(package_sha256):
        raise DraftBookError("owner_book_package_identity_invalid")
    if expected_package_sha256 is not None and package_sha256 != expected_package_sha256:
        raise DraftBookError("owner_book_package_identity_mismatch")
    if require_identity_directory_name and resolved_directory.name != package_sha256:
        raise DraftBookError("owner_book_package_directory_identity_mismatch")

    file_manifest = manifest.get("files")
    if not isinstance(file_manifest, dict) or set(file_manifest) != PACKAGE_PAYLOAD_FILES:
        raise DraftBookError("owner_book_package_manifest_file_set_mismatch")
    for name in sorted(PACKAGE_PAYLOAD_FILES):
        expected = file_manifest.get(name)
        if not isinstance(expected, dict):
            raise DraftBookError(f"owner_book_package_file_metadata_invalid:{name}")
        path = resolved_directory / name
        content = path.read_bytes()
        if (
            expected.get("byteLength") != len(content)
            or expected.get("sha256") != sha256_bytes(content)
        ):
            raise DraftBookError(f"owner_book_package_file_hash_mismatch:{name}")

    checksum_rows: dict[str, str] = {}
    for line in (resolved_directory / "checksums.sha256").read_text("utf-8").splitlines():
        digest, separator, name = line.partition("  ")
        if (
            not separator
            or not SHA256_RE.fullmatch(digest)
            or name not in PACKAGE_CHECKSUM_FILES
            or name in checksum_rows
        ):
            raise DraftBookError("owner_book_package_checksums_invalid")
        checksum_rows[name] = digest
    if set(checksum_rows) != PACKAGE_CHECKSUM_FILES:
        raise DraftBookError("owner_book_package_checksum_file_set_mismatch")
    for name in sorted(PACKAGE_CHECKSUM_FILES):
        if checksum_rows[name] != sha256_bytes((resolved_directory / name).read_bytes()):
            raise DraftBookError(f"owner_book_package_checksum_mismatch:{name}")

    if manifest["authorityBoundary"] != {
        "activeRuntimeChanged": False,
        "bookSafetyTextDoesNotBecomePolicyEnforced": True,
        "externalScienceDoesNotValidateDnaProduct": True,
        "finalOwnerBookLockCompatible": False,
        "ownerApproval": False,
        "ownerApprovalCount": 0,
        "reason": "draft_multidocx_not_final_owner_approved_artifact",
        "releaseEligible": False,
        "runtimeEligible": False,
    }:
        raise DraftBookError("owner_book_package_authority_expanded")
    source_binding = manifest.get("sourceBinding") or {}
    if (
        source_binding.get("directSourceCoverage") != 1.0
        or source_binding.get("unresolvedCitationMentionCount") != 0
        or source_binding.get("duplicateSourceIds") != []
    ):
        raise DraftBookError("owner_book_package_source_binding_incomplete")
    crosswalk = manifest.get("governanceCrosswalk") or {}
    if (
        crosswalk.get("authorityInherited") is not False
        or crosswalk.get("claimFidelityInherited") is not False
        or crosswalk.get("runtimeEligible") is not False
        or crosswalk.get("releaseEligible") is not False
        or not SHA256_RE.fullmatch(str(crosswalk.get("snapshotSha256") or ""))
        or int(crosswalk.get("matchedByCanonicalDoi", -1)) > int(crosswalk.get("bookSourceCount", -1))
    ):
        raise DraftBookError("owner_book_package_crosswalk_authority_expanded")
    method_crosswalk = manifest.get("methodCandidateCrosswalk") or {}
    if (
        method_crosswalk.get("authorityInherited") is not False
        or method_crosswalk.get("claimFidelityInherited") is not False
        or method_crosswalk.get("runtimeEligible") is not False
        or method_crosswalk.get("releaseEligible") is not False
        or int(method_crosswalk.get("registeredExternalCandidateMatches", -1)) < 0
    ):
        raise DraftBookError("owner_book_package_method_crosswalk_authority_expanded")
    if method_crosswalk.get("status") == "crosswalk_complete_candidate_only" and (
        not SHA256_RE.fullmatch(str(method_crosswalk.get("registrationIndexFileSha256") or ""))
        or not SHA256_RE.fullmatch(
            str(method_crosswalk.get("externalCandidatePackageFileSha256") or "")
        )
    ):
        raise DraftBookError("owner_book_package_method_crosswalk_hash_missing")

    artifact = (resolved_directory / "canonical-book.txt").read_bytes()
    records = read_jsonl_objects(resolved_directory / "records.jsonl", label="records")
    sources = read_jsonl_objects(resolved_directory / "sources.jsonl", label="sources")
    benchmarks = read_jsonl_objects(
        resolved_directory / "benchmark-candidates.jsonl",
        label="benchmarks",
    )
    assert_candidate_flags_false(records, location="records")
    assert_candidate_flags_false(sources, location="sources")
    assert_candidate_flags_false(benchmarks, location="benchmarks")
    assert_candidate_flags_false(manifest, location="manifest")

    if manifest.get("status") != "draft_owner_book_ingested_not_approved":
        raise DraftBookError("owner_book_package_status_invalid")
    if (
        manifest.get("canonicalArtifactSha256") != sha256_bytes(artifact)
        or manifest.get("canonicalArtifactByteLength") != len(artifact)
    ):
        raise DraftBookError("owner_book_package_canonical_artifact_mismatch")
    if (
        manifest.get("recordCount") != len(records)
        or manifest.get("sourceCount") != len(sources)
        or manifest.get("benchmarkCandidateCount") != len(benchmarks)
    ):
        raise DraftBookError("owner_book_package_count_mismatch")
    if manifest.get("bibliographyEntryCount") != sum(
        len(source.get("appearances") or []) for source in sources
    ):
        raise DraftBookError("owner_book_package_bibliography_count_mismatch")
    if manifest.get("uniqueDoiCount") != len({
        source["doi"] for source in sources if source.get("doi")
    }):
        raise DraftBookError("owner_book_package_doi_count_mismatch")
    if manifest.get("countsByKind") != dict(sorted(Counter(
        record.get("kind") for record in records
    ).items())):
        raise DraftBookError("owner_book_package_kind_counts_mismatch")
    if manifest.get("countsByAuthority") != dict(sorted(Counter(
        record.get("authorityLayer") for record in records
    ).items())):
        raise DraftBookError("owner_book_package_authority_counts_mismatch")

    record_ids = [record.get("recordId") for record in records]
    source_ids = [source.get("sourceId") for source in sources]
    benchmark_ids = [benchmark.get("benchmarkId") for benchmark in benchmarks]
    if (
        any(not value for value in record_ids)
        or len(record_ids) != len(set(record_ids))
        or any(not value for value in source_ids)
        or len(source_ids) != len(set(source_ids))
        or any(not value for value in benchmark_ids)
        or len(benchmark_ids) != len(set(benchmark_ids))
    ):
        raise DraftBookError("owner_book_package_duplicate_or_missing_id")
    known_source_ids = set(source_ids)
    known_record_ids = set(record_ids)
    for record in records:
        if any(record.get(field) is not False for field in (
            "ownerApproval", "runtimeEligible", "releaseEligible", "answerEligible"
        )):
            raise DraftBookError("owner_book_package_record_authority_expanded")
        locator = record.get("locator") or {}
        byte_range = locator.get("artifactByteRange") or {}
        start = byte_range.get("startByte")
        end = byte_range.get("endByteExclusive")
        if (
            not isinstance(start, int)
            or not isinstance(end, int)
            or start < 0
            or end <= start
            or end > len(artifact)
            or sha256_bytes(artifact[start:end]) != record.get("canonicalTextSha256")
            or not set(record.get("sourceIds") or []).issubset(known_source_ids)
        ):
            raise DraftBookError("owner_book_package_record_provenance_invalid")
    for source in sources:
        if any(source.get(field) is not False for field in (
            "ownerApproval", "runtimeEligible", "releaseEligible"
        )):
            raise DraftBookError("owner_book_package_source_authority_expanded")
    for benchmark in benchmarks:
        if (
            benchmark.get("status") != "draft_unsealed"
            or any(benchmark.get(field) is not False for field in (
                "ownerApproval", "evaluationEligible", "runtimeEligible", "releaseEligible"
            ))
            or not set(benchmark.get("supportRecordIds") or []).issubset(known_record_ids)
        ):
            raise DraftBookError("owner_book_package_benchmark_authority_expanded")
    chapters = manifest.get("chapters")
    if not isinstance(chapters, list) or len(chapters) != 9:
        raise DraftBookError("owner_book_package_chapter_count_invalid")
    if [chapter.get("order") for chapter in chapters] != list(range(1, 10)):
        raise DraftBookError("owner_book_package_chapter_order_invalid")
    if any(
        chapter.get("ownerApproval") is not False
        or chapter.get("runtimeEligible") is not False
        or chapter.get("releaseEligible") is not False
        for chapter in chapters
    ):
        raise DraftBookError("owner_book_package_chapter_authority_expanded")

    semantic_core = semantic_package_core(
        status=manifest["status"],
        source_set_sha256=manifest["sourceSetSha256"],
        canonical_artifact=artifact,
        chapters=chapters,
        records=records,
        sources=sources,
        benchmarks=benchmarks,
        governance_crosswalk=manifest["governanceCrosswalk"],
        method_candidate_crosswalk=manifest["methodCandidateCrosswalk"],
        authority_boundary=manifest["authorityBoundary"],
    )
    if stable_hash(semantic_core) != package_sha256:
        raise DraftBookError("owner_book_package_semantic_hash_mismatch")
    return manifest


def write_package(
    package: dict[str, Any],
    output_root: Path,
) -> tuple[Path, bool]:
    package_hash = package["manifest"]["packageSha256"]
    target = output_root / package_hash
    if target.exists():
        manifest = validate_package_directory(
            target,
            output_root=output_root,
            expected_package_sha256=package_hash,
        )
        if manifest["packageSha256"] != package_hash:
            raise DraftBookError("owner_book_existing_package_identity_mismatch")
        return target, True

    files = package_files(package)
    temporary = Path(tempfile.mkdtemp(prefix=f".{package_hash}.tmp-", dir=output_root))
    try:
        for name, content in files.items():
            path = temporary / name
            path.write_bytes(content)
            os.chmod(path, 0o600)
        validate_package_directory(
            temporary,
            output_root=output_root,
            expected_package_sha256=package_hash,
            require_identity_directory_name=False,
        )
        temporary.rename(target)
    except Exception:
        shutil.rmtree(temporary, ignore_errors=True)
        raise
    return target, False


def compact_repo_manifest(
    package_manifest: dict[str, Any],
    *,
    output_relative_path: str,
) -> dict[str, Any]:
    return {
        "schemaVersion": REPO_MANIFEST_SCHEMA,
        "pipelineVersion": PIPELINE_VERSION,
        "status": "draft_owner_book_ingested_not_approved",
        "packageSha256": package_manifest["packageSha256"],
        "sourceSetSha256": package_manifest["sourceSetSha256"],
        "canonicalArtifactSha256": package_manifest["canonicalArtifactSha256"],
        "canonicalArtifactByteLength": package_manifest["canonicalArtifactByteLength"],
        "sourceRootConfiguration": "DNA_OWNER_BOOK_DRAFT_ROOT",
        "outputRootConfiguration": "RESEARCH_SSD_ROOT",
        "outputRelativePath": output_relative_path,
        "chapterCount": package_manifest["chapterCount"],
        "recordCount": package_manifest["recordCount"],
        "sourceCount": package_manifest["sourceCount"],
        "bibliographyEntryCount": package_manifest["bibliographyEntryCount"],
        "uniqueDoiCount": package_manifest["uniqueDoiCount"],
        "benchmarkCandidateCount": package_manifest["benchmarkCandidateCount"],
        "countsByKind": package_manifest["countsByKind"],
        "countsByAuthority": package_manifest["countsByAuthority"],
        "sourceBinding": package_manifest["sourceBinding"],
        "governanceCrosswalk": package_manifest["governanceCrosswalk"],
        "methodCandidateCrosswalk": package_manifest["methodCandidateCrosswalk"],
        "chapters": [
            {
                key: chapter[key]
                for key in COMPACT_CHAPTER_KEYS
            }
            for chapter in package_manifest["chapters"]
        ],
        "authorityBoundary": package_manifest["authorityBoundary"],
        "qa": package_manifest["qa"],
        "activationBlockers": [
            "book_not_final",
            "owner_approval_missing",
            "claim_fidelity_review_missing",
            "licence_and_integrity_review_not_inherited_from_bibliography",
            "official_benchmark_not_sealed",
            "runtime_integration_forbidden",
        ],
    }


def atomic_write_json(path: Path, value: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    descriptor, temporary_name = tempfile.mkstemp(
        prefix=f".{path.name}.tmp-",
        dir=path.parent,
    )
    temporary = Path(temporary_name)
    try:
        with os.fdopen(descriptor, "w", encoding="utf-8") as handle:
            handle.write(stable_json(value, pretty=True))
            handle.flush()
            os.fsync(handle.fileno())
        os.chmod(temporary, 0o600)
        temporary.replace(path)
    finally:
        if temporary.exists():
            temporary.unlink()


def load_current_package(output_root: Path) -> tuple[dict[str, Any], Path, dict[str, Any]]:
    current_path = output_root / "current.json"
    if current_path.is_symlink():
        raise DraftBookError("owner_book_current_pointer_symlink_rejected")
    if not current_path.is_file():
        raise DraftBookError("owner_book_current_pointer_missing")
    current = json.loads(current_path.read_text("utf-8"))
    package_name = str(current.get("packageDirectoryName") or "")
    package_sha256 = str(current.get("packageSha256") or "")
    if (
        current.get("schemaVersion") != "dna-owner-book-draft-current@1"
        or not SHA256_RE.fullmatch(package_name)
        or package_name != package_sha256
        or current.get("status") != "draft_owner_book_ingested_not_approved"
        or current.get("ownerApproval") is not False
        or current.get("runtimeEligible") is not False
        or current.get("releaseEligible") is not False
    ):
        raise DraftBookError("owner_book_current_pointer_invalid")
    target = output_root / package_name
    manifest = validate_package_directory(
        target,
        output_root=output_root,
        expected_package_sha256=package_sha256,
    )
    return current, target, manifest


def build(
    *,
    source_root: Path,
    ssd_root: Path,
    repo_manifest_path: Path | None,
    allow_test_root: bool = False,
) -> dict[str, Any]:
    output_root = ensure_ssd_output_root(ssd_root, allow_test_root=allow_test_root)
    package = build_package_data(
        source_root,
        prebook_ssd_root=None if allow_test_root else ssd_root.resolve(),
    )
    target, reused = write_package(package, output_root)
    current = {
        "schemaVersion": "dna-owner-book-draft-current@1",
        "packageSha256": package["manifest"]["packageSha256"],
        "sourceSetSha256": package["manifest"]["sourceSetSha256"],
        "packageDirectoryName": target.name,
        "status": "draft_owner_book_ingested_not_approved",
        "ownerApproval": False,
        "runtimeEligible": False,
        "releaseEligible": False,
    }
    atomic_write_json(output_root / "current.json", current)
    compact = compact_repo_manifest(
        {**package["manifest"], "files": package_files(package)},
        output_relative_path=str(OUTPUT_SUBPATH / target.name),
    )
    if repo_manifest_path is not None:
        atomic_write_json(repo_manifest_path, compact)
    return {
        "operationStatus": "reused" if reused else "built",
        "packageDirectory": str(target),
        "repoManifest": str(repo_manifest_path) if repo_manifest_path else None,
        **compact,
    }


def verify(
    *,
    source_root: Path,
    ssd_root: Path,
    repo_manifest_path: Path,
    allow_test_root: bool = False,
) -> dict[str, Any]:
    output_root = ensure_ssd_output_root(ssd_root, allow_test_root=allow_test_root)
    if not repo_manifest_path.is_file():
        raise DraftBookError("owner_book_repo_manifest_missing")
    compact = json.loads(repo_manifest_path.read_text("utf-8"))
    if compact.get("schemaVersion") != REPO_MANIFEST_SCHEMA:
        raise DraftBookError("owner_book_repo_manifest_schema_mismatch")
    compact_serialized = stable_json(compact)
    if str(DEFAULT_SOURCE_ROOT) in compact_serialized or '"/Users/' in compact_serialized:
        raise DraftBookError("owner_book_repo_manifest_contains_absolute_source_root")
    _, target, manifest = load_current_package(output_root)
    if manifest["packageSha256"] != compact["packageSha256"]:
        raise DraftBookError("owner_book_repo_and_ssd_package_mismatch")
    rebuilt = build_package_data(
        source_root,
        prebook_ssd_root=None if allow_test_root else ssd_root.resolve(),
    )
    expected_files = package_files(rebuilt)
    if set(expected_files) != PACKAGE_DIRECTORY_FILES:
        raise DraftBookError("owner_book_rebuilt_package_file_set_invalid")
    for name in sorted(PACKAGE_DIRECTORY_FILES):
        if (target / name).read_bytes() != expected_files[name]:
            raise DraftBookError(f"owner_book_source_rebuild_file_mismatch:{name}")
    rebuilt_manifest = json.loads(expected_files["manifest.json"])
    if rebuilt_manifest["packageSha256"] != manifest["packageSha256"]:
        raise DraftBookError("owner_book_source_or_pipeline_is_stale")
    expected_compact = compact_repo_manifest(
        rebuilt_manifest,
        output_relative_path=str(OUTPUT_SUBPATH / target.name),
    )
    if compact != expected_compact:
        raise DraftBookError("owner_book_repo_manifest_content_mismatch")
    raw_manifest = repo_manifest_path.read_text("utf-8")
    forbidden_raw_fields = (
        '"text":',
        '"referenceText":',
        '"question":',
        '"rows":',
        '"chapterTitle":',
    )
    if any(field in raw_manifest for field in forbidden_raw_fields):
        raise DraftBookError("owner_book_repo_manifest_contains_raw_content")
    if any(set(chapter) != set(COMPACT_CHAPTER_KEYS) for chapter in compact.get("chapters", [])):
        raise DraftBookError("owner_book_repo_manifest_chapter_keys_invalid")
    return {
        "status": "verified",
        "packageSha256": manifest["packageSha256"],
        "sourceSetSha256": manifest["sourceSetSha256"],
        "chapterCount": manifest["chapterCount"],
        "recordCount": manifest["recordCount"],
        "sourceCount": manifest["sourceCount"],
        "benchmarkCandidateCount": manifest["benchmarkCandidateCount"],
        "runtimeEligible": False,
        "releaseEligible": False,
        "ownerApproval": False,
    }


def parse_args(argv: Sequence[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("command", choices=("build", "verify", "status"))
    parser.add_argument(
        "--source-root",
        type=Path,
        default=Path(os.environ.get("DNA_OWNER_BOOK_DRAFT_ROOT", DEFAULT_SOURCE_ROOT)),
    )
    parser.add_argument(
        "--ssd-root",
        type=Path,
        default=Path(os.environ.get("RESEARCH_SSD_ROOT", DEFAULT_SSD_ROOT)),
    )
    parser.add_argument(
        "--repo-manifest",
        type=Path,
        default=DEFAULT_REPO_MANIFEST,
    )
    return parser.parse_args(argv)


def main(argv: Sequence[str] | None = None) -> int:
    args = parse_args(argv or sys.argv[1:])
    try:
        if args.command == "build":
            result = build(
                source_root=args.source_root,
                ssd_root=args.ssd_root,
                repo_manifest_path=args.repo_manifest,
            )
            # Filesystem paths are useful to in-process tests, but CLI output may be
            # persisted by CI or terminal logging. Expose only the already-minimized
            # relative package locator at that boundary.
            result.pop("packageDirectory", None)
            result.pop("repoManifest", None)
        elif args.command == "verify":
            result = verify(
                source_root=args.source_root,
                ssd_root=args.ssd_root,
                repo_manifest_path=args.repo_manifest,
            )
        else:
            output_root = ensure_ssd_output_root(args.ssd_root)
            current, _, manifest = load_current_package(output_root)
            result = {
                "status": current["status"],
                "packageSha256": manifest["packageSha256"],
                "sourceSetSha256": manifest["sourceSetSha256"],
                "chapterCount": manifest["chapterCount"],
                "recordCount": manifest["recordCount"],
                "ownerApproval": False,
                "runtimeEligible": False,
                "releaseEligible": False,
            }
        print(stable_json(result, pretty=True), end="")
        return 0
    except (DraftBookError, OSError, ValueError, KeyError, json.JSONDecodeError) as exc:
        print(stable_json({"ok": False, "error": str(exc)}, pretty=True), file=sys.stderr, end="")
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
