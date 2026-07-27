#!/usr/bin/env python3
"""Compare the immutable current owner-book draft with rebuilt source files.

The command is deliberately read-only. It validates the current package, rebuilds
the source candidate in memory, and emits a deterministic, text-free change set.
It never updates the current pointer, approval state, runtime state, or release
state and never falls back outside ResearchSSD.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any, Iterable, Sequence

import dna_owner_book_draft as draft


DIFF_SCHEMA = "dna-owner-book-diff@1"
DIFF_ENGINE_VERSION = "dna-owner-book-diff@1"
TARGET_KINDS = (
    "safety_boundary",
    "dna_product_candidate",
    "external_science_candidate",
)
CRITICAL_KIND_CODES = {
    "safety_boundary": "safety_boundary_removed",
    "dna_product_candidate": "dna_product_record_removed",
    "external_science_candidate": "external_science_record_removed",
}
FORBIDDEN_PUBLIC_KEYS = frozenset({
    "text",
    "referenceText",
    "question",
    "rows",
    "sourceFileName",
    "chapterTitle",
    "packageDirectory",
    "sourceRoot",
    "ssdRoot",
})
ABSOLUTE_PATH_RE = re.compile(r"(?:^|[\s\"'])/(?!/)[^\s\"']+")


class OwnerBookDiffError(RuntimeError):
    """A fail-closed owner-book comparison error."""


def _safe_resolve(path: Path, error_code: str) -> Path:
    try:
        return path.resolve(strict=True)
    except OSError as exc:
        raise OwnerBookDiffError(error_code) from exc


def resolve_read_only_output_root(
    ssd_root: Path,
    *,
    allow_test_root: bool = False,
) -> tuple[Path, Path]:
    """Resolve the existing immutable package root without creating anything."""
    if ssd_root.is_symlink():
        raise OwnerBookDiffError("owner_book_diff_ssd_root_symlink_rejected")
    resolved_ssd = _safe_resolve(
        ssd_root,
        "owner_book_diff_ssd_root_unavailable",
    )
    if not resolved_ssd.is_dir():
        raise OwnerBookDiffError("owner_book_diff_ssd_root_not_directory")
    volumes_root = Path("/Volumes")
    if not allow_test_root and volumes_root not in resolved_ssd.parents:
        raise OwnerBookDiffError("owner_book_diff_ssd_root_must_be_mounted_volume")

    output_root = resolved_ssd / draft.OUTPUT_SUBPATH
    if output_root.is_symlink():
        raise OwnerBookDiffError("owner_book_diff_output_root_symlink_rejected")
    resolved_output = _safe_resolve(
        output_root,
        "owner_book_diff_output_root_missing",
    )
    if not resolved_output.is_dir():
        raise OwnerBookDiffError("owner_book_diff_output_root_not_directory")
    if resolved_ssd not in resolved_output.parents:
        raise OwnerBookDiffError("owner_book_diff_output_path_escape")
    return resolved_ssd, resolved_output


def _locator(record: dict[str, Any]) -> dict[str, Any]:
    locator = record.get("locator") or {}
    return {
        "bodyBlockIndex": locator.get("bodyBlockIndex"),
        "paragraphIndex": locator.get("paragraphIndex"),
        "tableIndex": locator.get("tableIndex"),
    }


def _position_key(record: dict[str, Any]) -> tuple[Any, ...]:
    locator = _locator(record)
    marker_type = "p" if locator["paragraphIndex"] is not None else "t"
    marker_index = (
        locator["paragraphIndex"]
        if marker_type == "p"
        else locator["tableIndex"]
    )
    return (
        str(record.get("chapterId") or ""),
        marker_type,
        int(marker_index if marker_index is not None else -1),
        int(locator["bodyBlockIndex"] if locator["bodyBlockIndex"] is not None else -1),
    )


def _record_sort_key(record: dict[str, Any]) -> tuple[Any, ...]:
    return (*_position_key(record), str(record.get("recordId") or ""))


def _semantic_state(record: dict[str, Any]) -> dict[str, Any]:
    """Return only hashes or controlled fields; raw content never leaves here."""
    return {
        "canonicalTextSha256": record.get("canonicalTextSha256"),
        "kind": record.get("kind"),
        "authorityLayer": record.get("authorityLayer"),
        "reviewStatus": record.get("reviewStatus"),
        "sectionSha256": draft.stable_hash(record.get("section") or {}),
        "style": record.get("style"),
        "sourceIds": sorted(record.get("sourceIds") or []),
        "citationBindingsSha256": draft.stable_hash(
            record.get("citationBindings") or []
        ),
        "citationBindingStatus": record.get("citationBindingStatus"),
        "atomicityStatus": record.get("atomicityStatus"),
        "safetyTags": sorted(record.get("safetyTags") or []),
        "tableSha256": (
            draft.stable_hash(record.get("table"))
            if record.get("table") is not None
            else None
        ),
    }


def _public_record_ref(record: dict[str, Any]) -> dict[str, Any]:
    return {
        "recordId": record.get("recordId"),
        "chapterId": record.get("chapterId"),
        "kind": record.get("kind"),
        "authorityLayer": record.get("authorityLayer"),
        "reviewStatus": record.get("reviewStatus"),
        "canonicalTextSha256": record.get("canonicalTextSha256"),
        "sourceIds": sorted(record.get("sourceIds") or []),
        "safetyTags": sorted(record.get("safetyTags") or []),
        "locator": _locator(record),
    }


def _difference_reasons(
    before: dict[str, Any],
    after: dict[str, Any],
) -> list[str]:
    before_state = _semantic_state(before)
    after_state = _semantic_state(after)
    reason_by_field = {
        "canonicalTextSha256": "content_hash_changed",
        "kind": "kind_changed",
        "authorityLayer": "authority_layer_changed",
        "reviewStatus": "review_status_changed",
        "sectionSha256": "section_hash_changed",
        "style": "style_changed",
        "sourceIds": "source_bindings_changed",
        "citationBindingsSha256": "citation_bindings_changed",
        "citationBindingStatus": "citation_binding_status_changed",
        "atomicityStatus": "atomicity_status_changed",
        "safetyTags": "safety_tags_changed",
        "tableSha256": "table_hash_changed",
    }
    reasons = [
        reason_by_field[field]
        for field in reason_by_field
        if before_state[field] != after_state[field]
    ]
    if before.get("chapterId") != after.get("chapterId"):
        reasons.append("chapter_changed")
    if _locator(before) != _locator(after):
        reasons.append("position_changed")
    return reasons


def _pair_cost(before: dict[str, Any], after: dict[str, Any]) -> tuple[Any, ...]:
    before_position = _position_key(before)
    after_position = _position_key(after)
    return (
        before.get("chapterId") != after.get("chapterId"),
        before.get("kind") != after.get("kind"),
        before.get("authorityLayer") != after.get("authorityLayer"),
        before_position[1] != after_position[1],
        abs(before_position[2] - after_position[2]),
        abs(before_position[3] - after_position[3]),
        after_position,
        str(after.get("recordId") or ""),
    )


def _pair_group(
    before_indexes: Iterable[int],
    after_indexes: Iterable[int],
    before_records: Sequence[dict[str, Any]],
    after_records: Sequence[dict[str, Any]],
) -> list[tuple[int, int]]:
    available_after = set(after_indexes)
    pairs: list[tuple[int, int]] = []
    for before_index in sorted(before_indexes, key=lambda value: _record_sort_key(before_records[value])):
        if not available_after:
            break
        after_index = min(
            available_after,
            key=lambda value: _pair_cost(before_records[before_index], after_records[value]),
        )
        available_after.remove(after_index)
        pairs.append((before_index, after_index))
    return pairs


def _change_item(
    change_type: str,
    before: dict[str, Any] | None,
    after: dict[str, Any] | None,
    reasons: Sequence[str],
) -> dict[str, Any]:
    payload: dict[str, Any] = {
        "type": change_type,
        "reasons": sorted(set(reasons)),
    }
    if before is not None:
        payload["before"] = _public_record_ref(before)
    if after is not None:
        payload["after"] = _public_record_ref(after)
    payload["changeId"] = f"change.{draft.stable_hash(payload)[:24]}"
    return payload


def compare_records(
    before_records: Sequence[dict[str, Any]],
    after_records: Sequence[dict[str, Any]],
) -> tuple[dict[str, Any], list[tuple[dict[str, Any], dict[str, Any], str]]]:
    before_by_id = {str(record["recordId"]): index for index, record in enumerate(before_records)}
    after_by_id = {str(record["recordId"]): index for index, record in enumerate(after_records)}
    if len(before_by_id) != len(before_records) or len(after_by_id) != len(after_records):
        raise OwnerBookDiffError("owner_book_diff_duplicate_record_id")

    matched_before: set[int] = set()
    matched_after: set[int] = set()
    paired_indexes: list[tuple[int, int]] = []

    for record_id in sorted(set(before_by_id) & set(after_by_id)):
        before_index = before_by_id[record_id]
        after_index = after_by_id[record_id]
        matched_before.add(before_index)
        matched_after.add(after_index)
        paired_indexes.append((before_index, after_index))

    def unmatched_before() -> list[int]:
        return [index for index in range(len(before_records)) if index not in matched_before]

    def unmatched_after() -> list[int]:
        return [index for index in range(len(after_records)) if index not in matched_after]

    before_by_content: dict[str, list[int]] = defaultdict(list)
    after_by_content: dict[str, list[int]] = defaultdict(list)
    for index in unmatched_before():
        before_by_content[str(before_records[index].get("canonicalTextSha256") or "")].append(index)
    for index in unmatched_after():
        after_by_content[str(after_records[index].get("canonicalTextSha256") or "")].append(index)
    for content_sha in sorted(set(before_by_content) & set(after_by_content)):
        for before_index, after_index in _pair_group(
            before_by_content[content_sha],
            after_by_content[content_sha],
            before_records,
            after_records,
        ):
            matched_before.add(before_index)
            matched_after.add(after_index)
            paired_indexes.append((before_index, after_index))

    before_by_position: dict[tuple[Any, ...], list[int]] = defaultdict(list)
    after_by_position: dict[tuple[Any, ...], list[int]] = defaultdict(list)
    for index in unmatched_before():
        before_by_position[_position_key(before_records[index])].append(index)
    for index in unmatched_after():
        after_by_position[_position_key(after_records[index])].append(index)
    for position in sorted(set(before_by_position) & set(after_by_position)):
        before_group = sorted(
            before_by_position[position],
            key=lambda value: str(before_records[value].get("recordId") or ""),
        )
        after_group = sorted(
            after_by_position[position],
            key=lambda value: str(after_records[value].get("recordId") or ""),
        )
        for before_index, after_index in zip(before_group, after_group):
            matched_before.add(before_index)
            matched_after.add(after_index)
            paired_indexes.append((before_index, after_index))

    changes: dict[str, list[dict[str, Any]]] = {
        "added": [],
        "removed": [],
        "changed": [],
        "moved": [],
    }
    internal_pairs: list[tuple[dict[str, Any], dict[str, Any], str]] = []
    for before_index, after_index in sorted(
        paired_indexes,
        key=lambda pair: (_record_sort_key(before_records[pair[0]]), _record_sort_key(after_records[pair[1]])),
    ):
        before = before_records[before_index]
        after = after_records[after_index]
        reasons = _difference_reasons(before, after)
        semantic_reasons = [reason for reason in reasons if reason != "position_changed"]
        if semantic_reasons:
            change_type = "changed"
            changes[change_type].append(_change_item(change_type, before, after, reasons))
        elif "position_changed" in reasons or before.get("recordId") != after.get("recordId"):
            change_type = "moved"
            changes[change_type].append(
                _change_item(change_type, before, after, ["position_changed"])
            )
        else:
            change_type = "unchanged"
        internal_pairs.append((before, after, change_type))

    for index in sorted(unmatched_before(), key=lambda value: _record_sort_key(before_records[value])):
        changes["removed"].append(
            _change_item("removed", before_records[index], None, ["record_removed"])
        )
    for index in sorted(unmatched_after(), key=lambda value: _record_sort_key(after_records[value])):
        changes["added"].append(
            _change_item("added", None, after_records[index], ["record_added"])
        )

    for items in changes.values():
        items.sort(key=lambda item: item["changeId"])
    return changes, internal_pairs


def _doi_set(sources: Sequence[dict[str, Any]]) -> set[str]:
    return {
        str(source["doi"]).strip().lower()
        for source in sources
        if source.get("doi")
    }


def _kind_impacts(
    before_records: Sequence[dict[str, Any]],
    after_records: Sequence[dict[str, Any]],
    changes: dict[str, list[dict[str, Any]]],
    pairs: Sequence[tuple[dict[str, Any], dict[str, Any], str]],
) -> dict[str, Any]:
    before_counts = Counter(record.get("kind") for record in before_records)
    after_counts = Counter(record.get("kind") for record in after_records)
    result: dict[str, Any] = {}
    for kind in TARGET_KINDS:
        result[kind] = {
            "beforeCount": before_counts[kind],
            "afterCount": after_counts[kind],
            "delta": after_counts[kind] - before_counts[kind],
            "addedCount": sum(
                item["after"]["kind"] == kind for item in changes["added"]
            ),
            "removedCount": sum(
                item["before"]["kind"] == kind for item in changes["removed"]
            ),
            "changedWithinCount": sum(
                change_type == "changed"
                and before.get("kind") == kind
                and after.get("kind") == kind
                for before, after, change_type in pairs
            ),
            "changedAwayCount": sum(
                change_type == "changed"
                and before.get("kind") == kind
                and after.get("kind") != kind
                for before, after, change_type in pairs
            ),
            "changedIntoCount": sum(
                change_type == "changed"
                and before.get("kind") != kind
                and after.get("kind") == kind
                for before, after, change_type in pairs
            ),
            "movedCount": sum(
                change_type == "moved" and before.get("kind") == kind
                for before, _, change_type in pairs
            ),
        }
    return result


def _critical_deletions(
    changes: dict[str, list[dict[str, Any]]],
    pairs: Sequence[tuple[dict[str, Any], dict[str, Any], str]],
    removed_dois: Sequence[str],
) -> list[dict[str, Any]]:
    events: list[dict[str, Any]] = []
    for item in changes["removed"]:
        before = item["before"]
        code = CRITICAL_KIND_CODES.get(str(before.get("kind")))
        if code:
            events.append({
                "code": code,
                "record": before,
                "severity": "critical_review_required",
            })
    for before, after, change_type in pairs:
        if change_type != "changed":
            continue
        before_kind = str(before.get("kind") or "")
        after_kind = str(after.get("kind") or "")
        if before_kind in CRITICAL_KIND_CODES and after_kind != before_kind:
            events.append({
                "code": CRITICAL_KIND_CODES[before_kind],
                "record": _public_record_ref(before),
                "replacement": _public_record_ref(after),
                "severity": "critical_review_required",
            })
        removed_safety_tags = sorted(
            set(before.get("safetyTags") or []) - set(after.get("safetyTags") or [])
        )
        if before_kind == "safety_boundary" and removed_safety_tags:
            events.append({
                "code": "safety_boundary_tag_removed",
                "record": _public_record_ref(before),
                "removedSafetyTags": removed_safety_tags,
                "severity": "critical_review_required",
            })
        removed_source_ids = sorted(
            set(before.get("sourceIds") or []) - set(after.get("sourceIds") or [])
        )
        if before_kind == "external_science_candidate" and removed_source_ids:
            events.append({
                "code": "external_source_binding_removed",
                "record": _public_record_ref(before),
                "removedSourceIds": removed_source_ids,
                "severity": "critical_review_required",
            })
    for doi in removed_dois:
        events.append({
            "code": "source_doi_removed",
            "doi": doi,
            "severity": "critical_review_required",
        })
    unique = {
        draft.stable_hash(event): event
        for event in events
    }
    return [unique[key] for key in sorted(unique)]


def _assert_public_output_safe(value: Any, *, location: str = "root") -> None:
    if isinstance(value, dict):
        for key, child in value.items():
            if key in FORBIDDEN_PUBLIC_KEYS:
                raise OwnerBookDiffError(
                    f"owner_book_diff_raw_field_exposed:{location}.{key}"
                )
            _assert_public_output_safe(child, location=f"{location}.{key}")
    elif isinstance(value, list):
        for index, child in enumerate(value):
            _assert_public_output_safe(child, location=f"{location}[{index}]")
    elif isinstance(value, str) and ABSOLUTE_PATH_RE.search(value):
        raise OwnerBookDiffError(
            f"owner_book_diff_absolute_path_exposed:{location}"
        )


def build_change_set(
    *,
    current_manifest: dict[str, Any],
    current_records: Sequence[dict[str, Any]],
    current_sources: Sequence[dict[str, Any]],
    candidate: dict[str, Any],
) -> dict[str, Any]:
    candidate_manifest = candidate["manifest"]
    candidate_records = candidate["records"]
    candidate_sources = candidate["sources"]
    changes, pairs = compare_records(current_records, candidate_records)

    before_dois = _doi_set(current_sources)
    after_dois = _doi_set(candidate_sources)
    added_dois = sorted(after_dois - before_dois)
    removed_dois = sorted(before_dois - after_dois)
    unchanged_dois = sorted(before_dois & after_dois)
    artifact_changed = (
        current_manifest["canonicalArtifactSha256"]
        != candidate_manifest["canonicalArtifactSha256"]
    )
    critical_deletions = _critical_deletions(changes, pairs, removed_dois)
    change_counts = {name: len(items) for name, items in changes.items()}
    unchanged_count = sum(change_type == "unchanged" for _, _, change_type in pairs)

    approval_reasons: list[str] = []
    if artifact_changed:
        approval_reasons.append("canonical_artifact_changed")
    if any(change_counts.values()):
        approval_reasons.append("record_set_or_record_provenance_changed")
    if added_dois or removed_dois:
        approval_reasons.append("source_doi_set_changed")
    approval_invalidated = bool(approval_reasons)
    affected_prior_records = {
        item["before"]["recordId"]
        for name in ("removed", "changed", "moved")
        for item in changes[name]
        if item.get("before")
    }

    core: dict[str, Any] = {
        "schemaVersion": DIFF_SCHEMA,
        "engineVersion": DIFF_ENGINE_VERSION,
        "status": "compared_candidate_only",
        "readOnly": True,
        "fromPackageSha256": current_manifest["packageSha256"],
        "toCandidatePackageSha256": candidate_manifest["packageSha256"],
        "fromSourceSetSha256": current_manifest["sourceSetSha256"],
        "toSourceSetSha256": candidate_manifest["sourceSetSha256"],
        "fromCanonicalArtifactSha256": current_manifest["canonicalArtifactSha256"],
        "toCanonicalArtifactSha256": candidate_manifest["canonicalArtifactSha256"],
        "packageIdentityChanged": (
            current_manifest["packageSha256"] != candidate_manifest["packageSha256"]
        ),
        "canonicalArtifactChanged": artifact_changed,
        "summary": {
            **change_counts,
            "unchanged": unchanged_count,
            "beforeRecordCount": len(current_records),
            "afterRecordCount": len(candidate_records),
            "criticalDeletionCount": len(critical_deletions),
        },
        "changes": changes,
        "sourceDoiDelta": {
            "added": added_dois,
            "removed": removed_dois,
            "unchangedCount": len(unchanged_dois),
            "beforeCount": len(before_dois),
            "afterCount": len(after_dois),
        },
        "kindImpacts": _kind_impacts(
            current_records,
            candidate_records,
            changes,
            pairs,
        ),
        "criticalDeletions": critical_deletions,
        "approvalInvalidation": {
            "currentPackageOwnerApproval": False,
            "wouldInvalidatePriorExactArtifactApproval": approval_invalidated,
            "reasons": approval_reasons,
            "affectedPriorRecordCount": len(affected_prior_records),
        },
        "authorityBoundary": {
            "ownerApproval": False,
            "runtimeEligible": False,
            "releaseEligible": False,
            "activeRuntimeChanged": False,
            "approvalStateChanged": False,
            "candidateOnly": True,
        },
    }
    result = {**core, "changeSetSha256": draft.stable_hash(core)}
    _assert_public_output_safe(result)
    return result


def compare_current_to_source(
    *,
    source_root: Path,
    ssd_root: Path,
    allow_test_root: bool = False,
) -> dict[str, Any]:
    resolved_ssd, output_root = resolve_read_only_output_root(
        ssd_root,
        allow_test_root=allow_test_root,
    )
    _, current_directory, current_manifest = draft.load_current_package(output_root)
    current_records = draft.read_jsonl_objects(
        current_directory / "records.jsonl",
        label="diff_current_records",
    )
    current_sources = draft.read_jsonl_objects(
        current_directory / "sources.jsonl",
        label="diff_current_sources",
    )
    candidate = draft.build_package_data(
        source_root,
        prebook_ssd_root=None if allow_test_root else resolved_ssd,
    )
    draft.assert_candidate_flags_false(candidate, location="diff_candidate")
    return build_change_set(
        current_manifest=current_manifest,
        current_records=current_records,
        current_sources=current_sources,
        candidate=candidate,
    )


def parse_args(argv: Sequence[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("command", choices=("compare",))
    parser.add_argument(
        "--source-root",
        type=Path,
        default=Path(os.environ.get("DNA_OWNER_BOOK_DRAFT_ROOT", draft.DEFAULT_SOURCE_ROOT)),
    )
    parser.add_argument(
        "--ssd-root",
        type=Path,
        default=Path(os.environ.get("RESEARCH_SSD_ROOT", draft.DEFAULT_SSD_ROOT)),
    )
    return parser.parse_args(argv)


def _safe_error(exc: BaseException) -> str:
    message = str(exc) or "owner_book_diff_failed_closed"
    if ABSOLUTE_PATH_RE.search(message):
        code = re.match(r"^(owner_book_[a-z0-9_]+)", message)
        return code.group(1) if code else "owner_book_diff_failed_closed"
    return message


def main(argv: Sequence[str] | None = None) -> int:
    args = parse_args(argv or sys.argv[1:])
    try:
        result = compare_current_to_source(
            source_root=args.source_root,
            ssd_root=args.ssd_root,
        )
        print(draft.stable_json(result, pretty=True), end="")
        return 0
    except (
        OwnerBookDiffError,
        draft.DraftBookError,
        OSError,
        ValueError,
        KeyError,
        json.JSONDecodeError,
    ) as exc:
        print(
            draft.stable_json({"ok": False, "error": _safe_error(exc)}, pretty=True),
            file=sys.stderr,
            end="",
        )
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
