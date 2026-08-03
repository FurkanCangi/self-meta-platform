#!/usr/bin/env python3
"""Build the dense, deterministic DNA chat knowledge expansion package.

The owner-selected DOCX stays read-only. Raw decisions, question surfaces and
locked evaluation rows live on ResearchSSD; only a compact runtime package and
hash-only evidence manifest are committed. The pipeline is resumable and never
promotes the existing external-science candidate merely by flipping its flags.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import tempfile
import time
import unicodedata
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any, Iterable


PIPELINE_VERSION = "dna-knowledge-expansion@1"
RUNTIME_SCHEMA = "dna-dense-knowledge-runtime@1"
MANIFEST_SCHEMA = "dna-knowledge-expansion-manifest@1"
REPO_ROOT = Path(__file__).resolve().parents[1]
RESEARCH_ROOT = Path(os.environ.get("RESEARCH_SSD_ROOT", "/Volumes/ResearchSSD"))
OUTPUT_ROOT = (
    RESEARCH_ROOT
    / "Outputs"
    / "SelfMetaAI"
    / "dna-intelligence"
    / "knowledge-expansion"
    / "v1"
)
OWNER_RUNTIME_PATH = REPO_ROOT / "src/lib/dna/chat/catalog/generated/owner-book/runtime.json"
OWNER_MANIFEST_PATH = REPO_ROOT / "src/lib/dna/chat/catalog/generated/owner-book/manifest.json"
OWNER_BOOK_PATH = (
    REPO_ROOT.parents[3]
    / "DNA Intelligence"
    / "Self-Regülasyon Kitabı.docx"
)
EXTERNAL_ROOT = (
    RESEARCH_ROOT
    / "Outputs"
    / "SelfMetaAI"
    / "dna-intelligence"
    / "book-catalog-v32"
    / "v1"
)
REPO_GENERATED_ROOT = REPO_ROOT / "src/lib/dna/chat/catalog/generated/dense"
REPO_RUNTIME_PATH = REPO_GENERATED_ROOT / "runtime.json"
REPO_RUNTIME_MANIFEST_PATH = REPO_GENERATED_ROOT / "manifest.json"
REPO_EVIDENCE_PATH = (
    REPO_ROOT
    / "docs/dna-intelligence/program/evidence/dna-knowledge-expansion-current.json"
)

DECISIONS_PATH = OUTPUT_ROOT / "owner-sentence-decisions.jsonl"
UNITS_PATH = OUTPUT_ROOT / "owner-knowledge-units.jsonl"
SURFACES_PATH = OUTPUT_ROOT / "question-surfaces.jsonl"
OPEN_BANK_PATH = OUTPUT_ROOT / "open-development-5000.json"
HOLDOUT_PATH = OUTPUT_ROOT / "locked-holdout-1500.json"
HOLDOUT_RESULT_PATH = OUTPUT_ROOT / "locked-holdout-first-result.json"
HOLDOUT_POSTFIX_RESULT_PATH = OUTPUT_ROOT / "locked-holdout-postfix-result.json"
GAP_MAP_PATH = OUTPUT_ROOT / "coverage-gap-map.json"
EXTERNAL_DECISIONS_PATH = OUTPUT_ROOT / "external-science-decisions.jsonl"
CHECKPOINT_PATH = OUTPUT_ROOT / "checkpoint.json"
HEARTBEAT_PATH = OUTPUT_ROOT / "heartbeat.json"

TERMINAL_DECISIONS = {
    "accepted",
    "duplicate",
    "nonfactual",
    "context_dependent",
    "unsafe_for_answer",
    "reference_only",
    "needs_split",
}

DOMAIN_RULES: tuple[tuple[str, tuple[str, ...]], ...] = (
    ("cellular_neurophysiology", ("noron", "sinaps", "membran", "iyon", "aksiyon potansiy", "glia", "norotransmitter")),
    ("autonomic_hrv", ("otonom", "sempatik", "parasempatik", "vagal", "vagus", "hrv", "rsa", "kalp hizi", "enterik")),
    ("sleep_circadian", ("uyku", "sirkadiyen", "ultradiyen", "melatonin", "uyaniklik")),
    ("interoception_sensory", ("interosep", "duyusal", "vestibul", "propriose", "dokunsal", "gustasyon", "olfaksiyon", "somatosensor")),
    ("attention_working_memory_executive", ("dikkat", "calisma bellegi", "yurutucu", "inhibisyon", "bilissel esneklik", "metakognisyon", "prospektif bellek")),
    ("stress_arousal_recovery", ("stres", "arousal", "uyarilma", "reaktivite", "toparlanma", "allostaz", "hpa")),
    ("emotion_self_coregulation", ("duygu", "self regulasyon", "oz duzenleme", "ko regulasyon", "es regulasyon", "sosyal tamponlama", "baglanma")),
    ("development_neurodiversity", ("gelisim", "cocuk", "bebek", "ergen", "prenatal", "norogelisim", "otizm", "dehb", "serebral palsi")),
    ("measurement_case_boundaries", ("olcum", "degerlendirme", "olcek", "test", "gozlem", "vaka", "rapor", "gecerlik", "guvenirlik")),
    ("cns_networks", ("korteks", "insula", "singulat", "prefrontal", "beyin sapi", "amigdala", "hipotalamus", "network", "ag ", "merkezi sinir")),
)

DIMENSION_RULES: tuple[tuple[str, tuple[str, ...]], ...] = (
    ("definition", ("olarak tanim", "ifade eder", "anlamina gelir", "adi verilir", "kavram")),
    ("process", ("surec", "islev", "duzenler", "modul", "katki", "rol oyn", "gercekles")),
    ("relation", ("iliski", "baglanti", "birlikte", "etkiles", "baglidir")),
    ("comparison", ("fark", "ayril", "aksine", "oysa", "benzer")),
    ("development", ("gelisim", "yas", "cocuk", "bebek", "ergen", "yetiskin")),
    ("measurement", ("olcum", "olcul", "degerlend", "test", "olcek", "gozlem")),
    ("misconception_boundary", ("tek basina", "kanitlamaz", "gostermez", "cikarilamaz", "yeterli degil", "sinirl")),
    ("daily_function", ("gunluk", "aktivite", "katilim", "okupasyon", "rutin", "performans")),
    ("theory", ("teori", "model", "yaklasim", "cerceve")),
)

UNSAFE_RE = re.compile(
    r"\b(?:tani\s+koy|ilac\s+doz|recete|kesin\s+prognoz|tedavi\s+plani|seans\s+plani)\b",
    re.IGNORECASE,
)
REFERENCE_RE = re.compile(r"\b(?:doi\s*:|isbn\s*:|https?://|www\.)", re.IGNORECASE)
CONTEXT_RE = re.compile(
    r"^(?:bu|bunun|bunlar|bu nedenle|bu surec|bu durum|burada|boylece|dolayisiyla|ayrica|ornegin|ancak|buna karsin)\b"
)
STOP = {
    "acikla", "anlat", "arasinda", "bana", "bir", "bu", "da", "de", "gibi",
    "gore", "hakkinda", "hangi", "icin", "ile", "ise", "kitaba", "kitap",
    "kadar", "mi", "mu", "nasil", "ne", "nedir", "olarak", "olan", "peki",
    "sence", "tam", "ve", "veya", "ver", "sey",
}


def normalize(value: str) -> str:
    value = unicodedata.normalize("NFKC", str(value or ""))
    value = value.replace("\u00a0", " ").replace("\u200b", "")
    return re.sub(r"\s+", " ", value).strip()


def fold(value: str) -> str:
    value = normalize(value).casefold().replace("ı", "i")
    value = "".join(
        char for char in unicodedata.normalize("NFKD", value)
        if not unicodedata.combining(char)
    )
    return re.sub(r"[^a-z0-9]+", " ", value).strip()


def sha256_bytes(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def sha256_file(path: Path) -> str:
    return sha256_bytes(path.read_bytes())


def stable_bytes(value: Any, *, pretty: bool = False) -> bytes:
    return (
        json.dumps(
            value,
            ensure_ascii=False,
            sort_keys=True,
            indent=2 if pretty else None,
            separators=None if pretty else (",", ":"),
        )
        + "\n"
    ).encode("utf-8")


def canonical_hash(value: Any) -> str:
    return sha256_bytes(stable_bytes(value))


def atomic_write(path: Path, payload: bytes, mode: int = 0o644) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    descriptor, temporary = tempfile.mkstemp(prefix=f".{path.name}.", dir=path.parent)
    try:
        with os.fdopen(descriptor, "wb") as handle:
            handle.write(payload)
            handle.flush()
            os.fsync(handle.fileno())
        os.chmod(temporary, mode)
        os.replace(temporary, path)
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)


def write_json(path: Path, value: Any, mode: int = 0o644) -> None:
    atomic_write(path, stable_bytes(value, pretty=True), mode)


def write_jsonl(path: Path, rows: Iterable[dict[str, Any]], mode: int = 0o600) -> None:
    payload = b"".join(stable_bytes(row) for row in rows)
    atomic_write(path, payload, mode)


def read_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def read_jsonl(path: Path) -> list[dict[str, Any]]:
    return [json.loads(line) for line in path.read_text(encoding="utf-8").splitlines() if line]


def heartbeat(stage: str, status: str, detail: dict[str, Any] | None = None) -> None:
    write_json(
        HEARTBEAT_PATH,
        {
            "pipelineVersion": PIPELINE_VERSION,
            "stage": stage,
            "status": status,
            "epochSeconds": int(time.time()),
            "detail": detail or {},
        },
        0o600,
    )


def assert_preflight() -> None:
    if not RESEARCH_ROOT.is_dir():
        raise RuntimeError("ResearchSSD bağlı değil, önce SSD'yi tak.")
    for path in (OWNER_RUNTIME_PATH, OWNER_MANIFEST_PATH, OWNER_BOOK_PATH):
        if not path.is_file():
            raise RuntimeError(f"required_input_missing:{path}")
    if OWNER_BOOK_PATH.is_symlink():
        raise RuntimeError("owner_book_symlink_not_allowed")
    for path in (
        EXTERNAL_ROOT / "manifest.json",
        EXTERNAL_ROOT / "knowledge-units.jsonl",
        EXTERNAL_ROOT / "passages.jsonl",
    ):
        if not path.is_file():
            raise RuntimeError(f"external_candidate_input_missing:{path}")


def domain_for(text: str) -> str:
    value = f" {fold(text)} "
    scores = {
        domain: sum(value.count(token) for token in tokens)
        for domain, tokens in DOMAIN_RULES
    }
    return max(scores, key=lambda key: (scores[key], key)) if max(scores.values()) else "cns_networks"


def dimensions_for(text: str) -> list[str]:
    value = fold(text)
    dimensions = [
        dimension
        for dimension, tokens in DIMENSION_RULES
        if any(token in value for token in tokens)
    ]
    return dimensions or ["process"]


def title_like(sentence: str, headings: set[str]) -> bool:
    normalized = fold(re.sub(r"^\d+(?:\.\d+)*[.)]?\s*", "", sentence))
    if normalized in headings:
        return True
    words = normalize(sentence).split()
    if len(words) <= 8 and not re.search(r"[.!?]$", sentence):
        capitalized = sum(1 for word in words if word[:1].isupper())
        return capitalized >= max(2, len(words) - 1)
    return False


def terminal_decision(
    sentence: str,
    headings: set[str],
    seen: dict[str, str],
    semantic_seen: dict[str, str],
) -> tuple[str, str, str | None]:
    normalized = fold(sentence)
    if normalized in seen:
        return "duplicate", "same_normalized_sentence", seen[normalized]
    seen[normalized] = sha256_bytes(normalized.encode("utf-8"))[:16]
    semantic_tokens = re.sub(r"\b(?:19|20)\d{2}[a-z]?\b", "", normalized).split()
    semantic_key = " ".join(sorted(semantic_tokens))
    if len(semantic_tokens) >= 8 and semantic_key in semantic_seen:
        return "duplicate", "same_token_multiset_claim", semantic_seen[semantic_key]
    if len(semantic_tokens) >= 8:
        semantic_seen[semantic_key] = seen[normalized]
    if REFERENCE_RE.search(sentence):
        return "reference_only", "identifier_or_url_line", None
    if UNSAFE_RE.search(fold(sentence)):
        return "unsafe_for_answer", "directive_or_high_risk_clinical_language", None
    short_measurement_statement = (
        len(normalized.split()) >= 3
        and re.search(r"\b(?:olculmelidir|degerlendirilmelidir|izlenmelidir)\.?$", normalized)
    )
    if ((len(normalized) < 35 or len(normalized.split()) < 5)
            and not short_measurement_statement) or title_like(sentence, headings):
        return "nonfactual", "heading_fragment_or_insufficient_proposition", None
    if sentence.endswith("?"):
        return "nonfactual", "question_not_claim", None
    if CONTEXT_RE.match(normalized):
        return "context_dependent", "requires_heading_or_previous_sentence", None
    if len(sentence) > 420 or sentence.count(";") >= 2:
        return "needs_split", "multiple_atomic_propositions", None
    return "accepted", "standalone_source_bound_statement", None


def focus_phrase(sentence: str, title: str) -> str:
    tokens = [token for token in fold(sentence).split() if len(token) >= 4 and token not in STOP]
    title_tokens = set(fold(title).split())
    distinctive = [token for token in tokens if token not in title_tokens]
    chosen = (distinctive or tokens)[:6]
    return " ".join(chosen) or fold(title)


def atomic_parts(sentence: str, decision: str) -> list[str]:
    if decision != "needs_split":
        return [sentence]
    clauses = [normalize(part) for part in sentence.split(";") if normalize(part)]
    if len(clauses) < 2:
        raise AssertionError("needs_split_without_atomic_boundary")
    terminal = "değerlendirilmelidir."
    return [
        clause if re.search(r"[.!?]$", clause) else f"{clause} {terminal}"
        for clause in clauses
    ]


def ascii_text(value: str) -> str:
    return fold(value)


def typo(value: str) -> str:
    words = value.split()
    if not words:
        return value
    index = max(range(len(words)), key=lambda idx: len(words[idx]))
    word = words[index]
    if len(word) >= 6:
        middle = len(word) // 2
        words[index] = word[:middle] + word[middle + 1 :]
    return " ".join(words)


def question_anchor(sentence: str, maximum_words: int = 18) -> str:
    words = normalize(sentence).split()
    anchor = " ".join(words[:maximum_words]).strip(" ,.;:!?()[]{}\"“”")
    return anchor if len(words) <= maximum_words else f"{anchor}…"


def query_surfaces(unit: dict[str, Any]) -> list[dict[str, Any]]:
    anchor = question_anchor(unit["text"])
    ascii_anchor = ascii_text(anchor)
    typo_anchor = typo(ascii_anchor)
    templates = (
        ("canonical", f"“{anchor}” ifadesi ne anlatıyor?", False),
        ("terminology", f"“{anchor}” ne anlama geliyor?", False),
        ("conversational", f"Şu kısmı biraz açar mısın: “{anchor}”?", False),
        ("short", f"“{anchor}” ne demek?", False),
        ("book_cue", f"Kitaba göre “{anchor}” nasıl açıklanıyor?", False),
        ("daily", f"Şu cümleyi anlayamadım: “{anchor}”.", False),
        ("ascii", f"\"{ascii_anchor}\" ne anlatiyor", False),
        ("typo", f"{typo_anchor} ne demek", False),
        ("mixed", f"“{anchor}” hangi process'i anlatıyor?", False),
        ("evidence", f"Kitaptaki “{anchor}” bilgisini açıklar mısın?", False),
        ("development", f"“{anchor}” ifadesini gelişim açısından nasıl anlamalıyım?", False),
        ("comparison", f"“{anchor}” ifadesinin ayırt edici noktası nedir?", False),
        ("repair", f"Hayır, “{anchor}” kısmını soruyorum.", False),
        ("followup_expand", "Bunu biraz daha aç.", True),
        ("followup_simple", "Bunu daha basit anlat.", True),
    )
    return [
        {
            "family": family,
            "question": normalize(question),
            "conversationTopicIds": [unit["topicId"]] if needs_context else [],
        }
        for family, question, needs_context in templates
    ]


def build_owner() -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    runtime = read_json(OWNER_RUNTIME_PATH)
    owner_manifest = read_json(OWNER_MANIFEST_PATH)
    headings = {
        fold(node["text"])
        for node in runtime["nodes"]
        if node["kind"] == "heading"
    }
    decisions: list[dict[str, Any]] = []
    units: list[dict[str, Any]] = []
    seen: dict[str, str] = {}
    semantic_seen: dict[str, str] = {}
    ordinal = 0
    for node in runtime["nodes"]:
        if node["kind"] == "heading":
            continue
        title = normalize(node.get("headingPath", [])[-1] if node.get("headingPath") else "Self-Regülasyon")
        context = " ".join([*node.get("headingPath", []), node.get("text", "")])
        for sentence_index, sentence in enumerate(node.get("sentences", [])):
            ordinal += 1
            sentence = normalize(sentence)
            decision, reason, duplicate_of = terminal_decision(
                sentence, headings, seen, semantic_seen,
            )
            passage_id = f"{node['id']}:sentence:{sentence_index + 1}"
            sentence_sha = sha256_bytes(sentence.encode("utf-8"))
            row = {
                "id": f"owner.sentence:{ordinal:04d}:{sentence_sha[:12]}",
                "ordinal": ordinal,
                "nodeId": node["id"],
                "sectionId": node["sectionId"],
                "passageId": passage_id,
                "sentenceIndex": sentence_index,
                "sentenceSha256": sentence_sha,
                "text": sentence,
                "decision": decision,
                "reason": reason,
                "duplicateOf": duplicate_of,
                "citationStatus": "citation_mapping_pending",
                "authorityClass": "owner_approved_for_chat_use",
            }
            decisions.append(row)
            if decision not in {"accepted", "needs_split"}:
                continue
            for atom_index, atom_text in enumerate(atomic_parts(sentence, decision), start=1):
                atom_sha = sha256_bytes(atom_text.encode("utf-8"))
                unit_id = f"owner.unit:{len(units) + 1:04d}:{atom_sha[:12]}"
                unit = {
                    "id": unit_id,
                    "title": title,
                    "topicId": f"owner-book-section/{node['sectionId']}",
                    "sectionId": node["sectionId"],
                    "passageId": passage_id if decision == "accepted" else f"{passage_id}:atom:{atom_index}",
                    "sourceId": owner_manifest["source"]["id"],
                    "domain": domain_for(context),
                    "dimensions": dimensions_for(context),
                    "questionType": dimensions_for(context)[0],
                    "focus": focus_phrase(atom_text, title),
                    "text": atom_text,
                    "sentenceSha256": atom_sha,
                    "sourceSentenceSha256": sentence_sha,
                    "citationStatus": "citation_mapping_pending",
                    "authorityClass": "owner_approved_for_chat_use",
                    "answerEligible": True,
                }
                units.append(unit)
    if len(decisions) != owner_manifest["counts"]["sentences"]:
        raise AssertionError("owner_sentence_terminal_coverage_mismatch")
    if any(row["decision"] not in TERMINAL_DECISIONS for row in decisions):
        raise AssertionError("owner_sentence_nonterminal_decision")
    if len({row["sentenceSha256"] for row in units}) != len(units):
        raise AssertionError("owner_unit_duplicate_sentence")
    return decisions, units


def audit_external() -> tuple[list[dict[str, Any]], dict[str, Any]]:
    external_manifest = read_json(EXTERNAL_ROOT / "manifest.json")
    units = read_jsonl(EXTERNAL_ROOT / "knowledge-units.jsonl")
    passage_ids = {row["id"]: row for row in read_jsonl(EXTERNAL_ROOT / "passages.jsonl")}
    decisions: list[dict[str, Any]] = []
    eligible = 0
    for unit in units:
        atoms = unit.get("answerProfiles", {}).get("deep", [])
        referenced = [passage_ids.get(passage_id) for passage_id in unit.get("passageIds", [])]
        reasons: list[str] = []
        if unit.get("reviewDecision") not in {"reconciled_a_b", "rereview_c_accept"}:
            reasons.append("review_not_terminal_accept")
        if unit.get("licenseDecision") != "licensed_runtime_candidate_text_only":
            reasons.append("unit_license_not_runtime_candidate")
        if not atoms or any(not atom.get("claimId") or not atom.get("passageId") or not atom.get("sourceId") for atom in atoms):
            reasons.append("atom_binding_incomplete")
        if any(row is None or row.get("licenseDecision") != "licensed_runtime_candidate" for row in referenced):
            reasons.append("passage_license_or_identity_incomplete")
        if not unit.get("claimBoundary"):
            reasons.append("claim_boundary_missing")
        if external_manifest.get("releaseEligible") is not True:
            reasons.append("upstream_manifest_release_locked")
        decision = "release_eligible" if not reasons else "candidate_preserved_not_live"
        eligible += int(decision == "release_eligible")
        decisions.append({
            "unitId": unit["id"],
            "decision": decision,
            "reasons": reasons,
            "unitSha256": canonical_hash(unit),
        })
    return decisions, {
        "candidateCount": len(units),
        "releaseEligibleCount": eligible,
        "preservedCandidateCount": len(units) - eligible,
        "upstreamManifestSha256": sha256_file(EXTERNAL_ROOT / "manifest.json"),
        "unitsSha256": sha256_file(EXTERNAL_ROOT / "knowledge-units.jsonl"),
    }


def build_surfaces(units: list[dict[str, Any]]) -> list[dict[str, Any]]:
    surfaces: list[dict[str, Any]] = []
    seen: set[str] = set()
    for unit in units:
        for surface in query_surfaces(unit):
            normalized = fold(surface["question"])
            if not normalized or normalized in seen:
                continue
            seen.add(normalized)
            surfaces.append({
                "id": f"surface:{len(surfaces) + 1:05d}",
                "unitId": unit["id"],
                "topicId": unit["topicId"],
                "family": surface["family"],
                "question": surface["question"],
                "conversationTopicIds": surface["conversationTopicIds"],
                "normalizedSha256": sha256_bytes(normalized.encode("utf-8")),
            })
    if len(surfaces) < 20000:
        raise AssertionError(f"question_surface_minimum_not_met:{len(surfaces)}")
    return surfaces


def build_banks(surfaces: list[dict[str, Any]]) -> tuple[dict[str, Any], dict[str, Any]]:
    holdout_families = {"typo", "mixed", "repair", "followup_expand", "comparison"}
    holdout_candidates = sorted(
        (row for row in surfaces if row["family"] in holdout_families),
        key=lambda row: (row["normalizedSha256"], row["id"]),
    )
    open_candidates = sorted(
        (row for row in surfaces if row["family"] not in holdout_families),
        key=lambda row: (row["normalizedSha256"], row["id"]),
    )
    locked_existing = read_json(HOLDOUT_PATH) if HOLDOUT_RESULT_PATH.is_file() and HOLDOUT_PATH.is_file() else None
    holdout = list(locked_existing["cases"]) if locked_existing else holdout_candidates[:1500]
    holdout_hashes = {row["normalizedSha256"] for row in holdout}
    open_rows = [row for row in open_candidates if row["normalizedSha256"] not in holdout_hashes][:5000]
    if len(open_rows) != 5000 or len(holdout) != 1500:
        raise AssertionError("evaluation_bank_size_mismatch")
    open_payload = {
        "schemaVersion": "dna-knowledge-expansion-open-bank@1",
        "pipelineVersion": PIPELINE_VERSION,
        "caseCount": len(open_rows),
        "cases": open_rows,
    }
    open_payload["logicalSha256"] = canonical_hash(open_payload)
    if locked_existing:
        holdout_payload = locked_existing
    else:
        holdout_payload = {
            "schemaVersion": "dna-knowledge-expansion-locked-holdout@1",
            "pipelineVersion": PIPELINE_VERSION,
            "caseCount": len(holdout),
            "cases": holdout,
        }
        holdout_payload["logicalSha256"] = canonical_hash(holdout_payload)
    return open_payload, holdout_payload


def coverage_map(units: list[dict[str, Any]], external_summary: dict[str, Any]) -> dict[str, Any]:
    matrix: dict[str, dict[str, int]] = defaultdict(lambda: defaultdict(int))
    for unit in units:
        for dimension in unit["dimensions"]:
            matrix[unit["domain"]][dimension] += 1
    expected_dimensions = [row[0] for row in DIMENSION_RULES]
    rows = []
    for domain, _ in DOMAIN_RULES:
        counts = {dimension: matrix[domain].get(dimension, 0) for dimension in expected_dimensions}
        rows.append({
            "domain": domain,
            "counts": counts,
            "missingDimensions": [key for key, value in counts.items() if value == 0],
        })
    return {
        "schemaVersion": "dna-knowledge-expansion-coverage@1",
        "ownerUnitCount": len(units),
        "externalScience": external_summary,
        "rows": rows,
        "unfilledCellCount": sum(len(row["missingDimensions"]) for row in rows),
    }


def compact_runtime(
    owner_manifest: dict[str, Any],
    units: list[dict[str, Any]],
    external_summary: dict[str, Any],
) -> dict[str, Any]:
    runtime_units = [{
        "id": unit["id"],
        "claimId": unit["id"],
        "topicId": unit["topicId"],
        "title": unit["title"],
        "domain": unit["domain"],
        "dimensions": unit["dimensions"],
        "focus": unit["focus"],
        "passageId": unit["passageId"],
        "sourceId": unit["sourceId"],
        "text": unit["text"],
        "sentenceSha256": unit["sentenceSha256"],
    } for unit in units]
    return {
        "schemaVersion": RUNTIME_SCHEMA,
        "pipelineVersion": PIPELINE_VERSION,
        "source": {
            **owner_manifest["source"],
            "approvalStatus": "owner_approved_for_chat_use",
            "scientificValidationStatus": "not_established_by_owner_approval",
        },
        "counts": {
            "ownerUnits": len(runtime_units),
            "externalCandidatesPreserved": external_summary["candidateCount"],
            "externalUnitsLive": external_summary["releaseEligibleCount"],
        },
        "units": runtime_units,
    }


def current_input_hashes() -> dict[str, str]:
    hashes = {
        "pipelineSha256": sha256_file(Path(__file__).resolve()),
        "evaluationRunnerSha256": sha256_file(
            REPO_ROOT / "scripts/run-dna-knowledge-expansion-evaluation.ts"
        ),
        "runtimeRetrieverSha256": sha256_file(
            REPO_ROOT / "src/lib/dna/chat/ownerBookRuntime.ts"
        ),
        "textNormalizerSha256": sha256_file(
            REPO_ROOT / "src/lib/dna/chat/text.ts"
        ),
        "ownerBookSha256": sha256_file(OWNER_BOOK_PATH),
        "ownerRuntimeSha256": sha256_file(OWNER_RUNTIME_PATH),
        "externalManifestSha256": sha256_file(EXTERNAL_ROOT / "manifest.json"),
        "externalUnitsSha256": sha256_file(EXTERNAL_ROOT / "knowledge-units.jsonl"),
        "externalPassagesSha256": sha256_file(EXTERNAL_ROOT / "passages.jsonl"),
    }
    for key, path in (
        ("openEvaluationResultSha256", OUTPUT_ROOT / "open-development-result.json"),
        ("holdoutFirstResultSha256", HOLDOUT_RESULT_PATH),
        ("holdoutPostFixResultSha256", HOLDOUT_POSTFIX_RESULT_PATH),
    ):
        hashes[key] = sha256_file(path) if path.is_file() else "missing"
    return hashes


def resume_if_complete() -> dict[str, Any] | None:
    if not CHECKPOINT_PATH.is_file() or not REPO_RUNTIME_MANIFEST_PATH.is_file():
        return None
    checkpoint = read_json(CHECKPOINT_PATH)
    if checkpoint.get("status") != "complete":
        return None
    if checkpoint.get("inputHashes") != current_input_hashes():
        return None
    try:
        verify()
    except Exception:
        return None
    manifest = read_json(REPO_RUNTIME_MANIFEST_PATH)
    heartbeat("build", "resumed", manifest["counts"])
    return manifest


def evaluation_result(
    path: Path,
    bank: dict[str, Any],
    minimum: float,
    *,
    immutable: bool,
) -> dict[str, Any] | None:
    if not path.is_file():
        return None
    value = read_json(path)
    if value.get("bankLogicalSha256") != bank.get("logicalSha256"):
        if immutable:
            raise RuntimeError(f"evaluation_bank_hash_mismatch:{path.name}")
        return None
    if value.get("caseCount") != bank.get("caseCount"):
        raise RuntimeError(f"evaluation_case_count_mismatch:{path.name}")
    if float(value.get("accuracy", 0)) < minimum:
        raise RuntimeError(f"evaluation_threshold_failed:{path.name}")
    if float(value.get("p95Ms", 999999)) >= 25:
        raise RuntimeError(f"evaluation_performance_failed:{path.name}")
    return {
        "caseCount": value["caseCount"],
        "correct": value["correct"],
        "accuracy": value["accuracy"],
        "p95Ms": value["p95Ms"],
        "resultSha256": value["resultSha256"],
        "fileSha256": sha256_file(path),
    }


def build() -> dict[str, Any]:
    assert_preflight()
    OUTPUT_ROOT.mkdir(parents=True, exist_ok=True)
    resumed = resume_if_complete()
    if resumed is not None:
        return resumed
    heartbeat("build", "running")
    owner_manifest = read_json(OWNER_MANIFEST_PATH)
    if owner_manifest["source"]["sha256"] != sha256_file(OWNER_BOOK_PATH):
        raise AssertionError("owner_book_hash_drift")
    decisions, units = build_owner()
    external_decisions, external_summary = audit_external()
    surfaces = build_surfaces(units)
    open_bank, holdout = build_banks(surfaces)
    gaps = coverage_map(units, external_summary)
    runtime = compact_runtime(owner_manifest, units, external_summary)

    write_jsonl(DECISIONS_PATH, decisions)
    write_jsonl(UNITS_PATH, units)
    write_jsonl(SURFACES_PATH, surfaces)
    write_jsonl(EXTERNAL_DECISIONS_PATH, external_decisions)
    write_json(OPEN_BANK_PATH, open_bank, 0o600)
    if HOLDOUT_PATH.exists():
        existing = read_json(HOLDOUT_PATH)
        if existing.get("logicalSha256") != holdout["logicalSha256"]:
            if HOLDOUT_RESULT_PATH.exists():
                raise RuntimeError("locked_holdout_exists_with_different_hash")
            archived = HOLDOUT_PATH.with_name(
                f"locked-holdout-unopened-{existing.get('logicalSha256', 'unknown')[:12]}.json"
            )
            if not archived.exists():
                os.replace(HOLDOUT_PATH, archived)
            write_json(HOLDOUT_PATH, holdout, 0o600)
    else:
        write_json(HOLDOUT_PATH, holdout, 0o600)
    write_json(GAP_MAP_PATH, gaps, 0o600)
    write_json(REPO_RUNTIME_PATH, runtime)
    open_result = evaluation_result(
        OUTPUT_ROOT / "open-development-result.json", open_bank, 98, immutable=False,
    )
    holdout_result = evaluation_result(HOLDOUT_RESULT_PATH, holdout, 95, immutable=True)
    holdout_postfix_result = evaluation_result(
        HOLDOUT_POSTFIX_RESULT_PATH, holdout, 95, immutable=False,
    )
    holdout_current_result = holdout_postfix_result or holdout_result

    decision_counts = dict(sorted(Counter(row["decision"] for row in decisions).items()))
    manifest = {
        "schemaVersion": MANIFEST_SCHEMA,
        "pipelineVersion": PIPELINE_VERSION,
        "status": "release_candidate_evaluated" if open_result and holdout_current_result else "release_candidate_built",
        "source": {
            "id": owner_manifest["source"]["id"],
            "title": owner_manifest["source"]["title"],
            "sha256": owner_manifest["source"]["sha256"],
            "approvalStatus": "owner_approved_for_chat_use",
            "scientificValidationStatus": "not_established_by_owner_approval",
            "citationStatus": "pending_sentence_mapping",
            "legacyChapterFilesIncluded": [],
        },
        "counts": {
            "ownerSentencesTerminal": len(decisions),
            "ownerKnowledgeUnits": len(units),
            "questionSurfaces": len(surfaces),
            "openDevelopmentQuestions": open_bank["caseCount"],
            "lockedHoldoutQuestions": holdout["caseCount"],
            "externalCandidatesPreserved": external_summary["candidateCount"],
            "externalUnitsLive": external_summary["releaseEligibleCount"],
        },
        "terminalDecisions": decision_counts,
        "coverage": {
            "unfilledCellCount": gaps["unfilledCellCount"],
            "matrixSha256": canonical_hash(gaps),
        },
        "evaluation": {
            "openDevelopment": open_result,
            "lockedHoldoutFirstResult": holdout_result,
            "holdoutFirstResultImmutable": bool(holdout_result),
            "lockedHoldoutPostFixResult": holdout_postfix_result,
            "lockedHoldoutCurrentEngineResult": holdout_current_result,
        },
        "hashes": {
            "ownerBookSha256": sha256_file(OWNER_BOOK_PATH),
            "ownerRuntimeSha256": sha256_file(OWNER_RUNTIME_PATH),
            "decisionsSha256": sha256_file(DECISIONS_PATH),
            "unitsSha256": sha256_file(UNITS_PATH),
            "surfacesSha256": sha256_file(SURFACES_PATH),
            "openBankSha256": sha256_file(OPEN_BANK_PATH),
            "holdoutSha256": sha256_file(HOLDOUT_PATH),
            "externalDecisionsSha256": sha256_file(EXTERNAL_DECISIONS_PATH),
            "runtimeSha256": sha256_file(REPO_RUNTIME_PATH),
            **({"openResultSha256": open_result["fileSha256"]} if open_result else {}),
            **({"holdoutResultSha256": holdout_result["fileSha256"]} if holdout_result else {}),
            **({"holdoutPostFixResultSha256": holdout_postfix_result["fileSha256"]}
               if holdout_postfix_result else {}),
        },
        "storage": {
            "researchSsdRelativeRoot": str(OUTPUT_ROOT.relative_to(RESEARCH_ROOT)),
            "rawQuestionsInRepository": 0,
            "rawDecisionsInRepository": 0,
        },
        "runtimePolicy": {
            "externalLlm": False,
            "embedding": False,
            "vectorDatabase": False,
            "runtimeInternet": False,
            "newDatabaseTable": False,
        },
    }
    manifest["manifestSha256"] = canonical_hash(manifest)
    write_json(REPO_RUNTIME_MANIFEST_PATH, manifest)
    write_json(REPO_EVIDENCE_PATH, manifest)
    write_json(CHECKPOINT_PATH, {
        "pipelineVersion": PIPELINE_VERSION,
        "status": "complete",
        "manifestSha256": manifest["manifestSha256"],
        "inputHashes": current_input_hashes(),
        "completedStages": [
            "preflight", "owner_terminal_decisions", "owner_units",
            "external_reaudit", "coverage", "question_surfaces",
            "evaluation_banks", "runtime_compile",
        ],
    }, 0o600)
    heartbeat("build", "complete", manifest["counts"])
    return manifest


def verify() -> dict[str, Any]:
    assert_preflight()
    required = (
        DECISIONS_PATH, UNITS_PATH, SURFACES_PATH, OPEN_BANK_PATH, HOLDOUT_PATH,
        GAP_MAP_PATH, EXTERNAL_DECISIONS_PATH, REPO_RUNTIME_PATH,
        REPO_RUNTIME_MANIFEST_PATH, REPO_EVIDENCE_PATH, CHECKPOINT_PATH,
    )
    missing = [str(path) for path in required if not path.is_file()]
    if missing:
        raise RuntimeError(f"knowledge_expansion_artifacts_missing:{missing}")
    manifest = read_json(REPO_RUNTIME_MANIFEST_PATH)
    evidence = read_json(REPO_EVIDENCE_PATH)
    decisions = read_jsonl(DECISIONS_PATH)
    units = read_jsonl(UNITS_PATH)
    surfaces = read_jsonl(SURFACES_PATH)
    open_bank = read_json(OPEN_BANK_PATH)
    holdout = read_json(HOLDOUT_PATH)
    external_decisions = read_jsonl(EXTERNAL_DECISIONS_PATH)
    runtime = read_json(REPO_RUNTIME_PATH)
    checks = {
        "schema": manifest.get("schemaVersion") == MANIFEST_SCHEMA,
        "evidenceParity": evidence == manifest,
        "terminalCoverage": len(decisions) == 4909 and all(row["decision"] in TERMINAL_DECISIONS for row in decisions),
        "unitUniqueness": len(units) == len({row["sentenceSha256"] for row in units}),
        "questionSurfaceMinimum": len(surfaces) >= 20000,
        "questionSurfaceUniqueness": len(surfaces) == len({row["normalizedSha256"] for row in surfaces}),
        "openBank": open_bank.get("caseCount") == 5000,
        "lockedHoldout": holdout.get("caseCount") == 1500,
        "bankSeparation": not ({row["normalizedSha256"] for row in open_bank["cases"]} & {row["normalizedSha256"] for row in holdout["cases"]}),
        "externalTerminal": len(external_decisions) == 1000 and all(row["decision"] in {"release_eligible", "candidate_preserved_not_live"} for row in external_decisions),
        "runtimeUnitParity": len(runtime.get("units", [])) == len(units),
        "claimPassageSourceCoverage": all(
            row.get("claimId") == row.get("id") and row.get("passageId") and
            row.get("sourceId") == runtime.get("source", {}).get("id")
            for row in runtime.get("units", [])
        ),
        "ownerHash": manifest["source"]["sha256"] == sha256_file(OWNER_BOOK_PATH),
        "noExternalModel": manifest["runtimePolicy"]["externalLlm"] is False,
        "noRuntimeInternet": manifest["runtimePolicy"]["runtimeInternet"] is False,
        "evaluatedReleaseCandidate": manifest.get("status") == "release_candidate_evaluated",
        "openEvaluation": manifest.get("evaluation", {}).get("openDevelopment", {}).get("accuracy", 0) >= 98,
        "lockedEvaluation": manifest.get("evaluation", {}).get("lockedHoldoutCurrentEngineResult", {}).get("accuracy", 0) >= 95,
    }
    for field, path in (
        ("decisionsSha256", DECISIONS_PATH),
        ("unitsSha256", UNITS_PATH),
        ("surfacesSha256", SURFACES_PATH),
        ("openBankSha256", OPEN_BANK_PATH),
        ("holdoutSha256", HOLDOUT_PATH),
        ("externalDecisionsSha256", EXTERNAL_DECISIONS_PATH),
        ("runtimeSha256", REPO_RUNTIME_PATH),
    ):
        checks[f"hash:{field}"] = manifest["hashes"][field] == sha256_file(path)
    if not all(checks.values()):
        raise AssertionError({key: value for key, value in checks.items() if not value})
    return {
        "ok": True,
        "counts": manifest["counts"],
        "terminalDecisions": manifest["terminalDecisions"],
        "checks": checks,
        "manifestSha256": manifest["manifestSha256"],
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("command", choices=("build", "verify", "run", "status"))
    args = parser.parse_args()
    if args.command == "build":
        result = build()
    elif args.command == "verify":
        result = verify()
    elif args.command == "run":
        build()
        result = verify()
    else:
        result = read_json(CHECKPOINT_PATH) if CHECKPOINT_PATH.is_file() else {"status": "not_started"}
    print(json.dumps(result, ensure_ascii=False, indent=2, sort_keys=True))


if __name__ == "__main__":
    main()
