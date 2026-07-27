#!/usr/bin/env python3
"""Regression tests for the read-only deterministic owner-book diff CLI."""

from __future__ import annotations

import hashlib
import json
import sys
import tempfile
import unittest
import zipfile
from pathlib import Path


SCRIPT_DIRECTORY = Path(__file__).resolve().parent
if str(SCRIPT_DIRECTORY) not in sys.path:
    sys.path.insert(0, str(SCRIPT_DIRECTORY))

import dna_owner_book_draft as draft  # noqa: E402
import dna_owner_book_diff as book_diff  # noqa: E402


def xml_escape(value: str) -> str:
    return (
        value.replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace('"', "&quot;")
    )


def paragraph(text: str, style: str = "BodyTextDNA") -> str:
    style_xml = (
        f'<w:pPr><w:pStyle w:val="{xml_escape(style)}"/></w:pPr>'
        if style else ""
    )
    return (
        f'<w:p>{style_xml}<w:r><w:t xml:space="preserve">'
        f"{xml_escape(text)}</w:t></w:r></w:p>"
    )


def table(rows: list[list[str]]) -> str:
    row_xml = []
    for row in rows:
        cells = "".join(f"<w:tc>{paragraph(cell)}</w:tc>" for cell in row)
        row_xml.append(f"<w:tr>{cells}</w:tr>")
    return f"<w:tbl>{''.join(row_xml)}</w:tbl>"


def write_docx(
    path: Path,
    chapter_number: int,
    *,
    product_suffix: str = "",
    reverse_science: bool = False,
    include_safety: bool = True,
    include_source: bool = True,
) -> None:
    science_paragraphs = [
        "Düzenleme bağlama göre değişebilir (Smith, 2020).",
        "Görev koşulları performansı etkileyebilir (Smith, 2020).",
    ]
    if reverse_science:
        science_paragraphs.reverse()
    body = [
        paragraph("DNA MODÜL 1 • KURAMSAL TEMELLER", ""),
        paragraph(f"BÖLÜM {chapter_number} — TEST BÖLÜMÜ", ""),
        paragraph(f"{chapter_number}.1. Bilimsel çerçeve", "Heading1"),
        *(paragraph(value) for value in science_paragraphs),
        paragraph("DNA sentezi", "Heading1"),
        paragraph(
            "DNA yaklaşımı davranışı çocuk, görev ve çevre etkileşiminde ele alır"
            f"{product_suffix}."
        ),
    ]
    if include_safety:
        body.append(table([
            ["Bilimsel sınır"],
            ["Davranıştan tek başına belirli bir biyolojik mekanizma çıkarılamaz."],
        ]))
    body.extend([
        paragraph("Kısa kavram sözlüğü", "Heading1"),
        paragraph("Regülasyon: Değişen koşullara göre durumu ayarlama süreci."),
        paragraph("Kaynaklar", "Heading1"),
    ])
    if include_source:
        body.append(paragraph(
            f"Smith, J. (2020). Test source {chapter_number}. "
            f"https://doi.org/10.1000/test{chapter_number}"
        ))
    document_xml = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        f'<w:document xmlns:w="{draft.W_NS}"><w:body>'
        f"{''.join(body)}<w:sectPr/></w:body></w:document>"
    )
    path.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(path, "w", compression=zipfile.ZIP_DEFLATED) as archive:
        archive.writestr("word/document.xml", document_xml)


def tree_snapshot(root: Path) -> dict[str, str]:
    return {
        str(path.relative_to(root)): hashlib.sha256(path.read_bytes()).hexdigest()
        for path in sorted(root.rglob("*"))
        if path.is_file()
    }


class OwnerBookDiffTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp = tempfile.TemporaryDirectory(prefix="dna-owner-book-diff-test-")
        self.root = Path(self.temp.name)
        self.source_root = self.root / "source"
        self.ssd_root = self.root / "ssd"
        self.repo_manifest = self.root / "repo" / "owner-book.json"
        self.ssd_root.mkdir()
        for chapter_number in range(1, 10):
            write_docx(
                self.source_root / f"{chapter_number}. Bölüm.docx",
                chapter_number,
            )
        self.baseline = draft.build(
            source_root=self.source_root,
            ssd_root=self.ssd_root,
            repo_manifest_path=self.repo_manifest,
            allow_test_root=True,
        )

    def tearDown(self) -> None:
        self.temp.cleanup()

    def compare(self) -> dict:
        return book_diff.compare_current_to_source(
            source_root=self.source_root,
            ssd_root=self.ssd_root,
            allow_test_root=True,
        )

    def test_same_package_has_zero_diff_and_is_read_only(self) -> None:
        output_root = self.ssd_root / draft.OUTPUT_SUBPATH
        before = tree_snapshot(output_root)
        result = self.compare()
        after = tree_snapshot(output_root)

        self.assertEqual(before, after)
        self.assertEqual(result["fromPackageSha256"], result["toCandidatePackageSha256"])
        self.assertFalse(result["packageIdentityChanged"])
        self.assertFalse(result["canonicalArtifactChanged"])
        self.assertEqual(result["summary"]["added"], 0)
        self.assertEqual(result["summary"]["removed"], 0)
        self.assertEqual(result["summary"]["changed"], 0)
        self.assertEqual(result["summary"]["moved"], 0)
        self.assertEqual(result["summary"]["criticalDeletionCount"], 0)
        self.assertFalse(
            result["approvalInvalidation"]["wouldInvalidatePriorExactArtifactApproval"]
        )
        self.assertTrue(result["readOnly"])
        self.assertFalse(result["authorityBoundary"]["ownerApproval"])
        self.assertFalse(result["authorityBoundary"]["runtimeEligible"])
        self.assertFalse(result["authorityBoundary"]["releaseEligible"])
        self.assertFalse(result["authorityBoundary"]["activeRuntimeChanged"])
        self.assertFalse(result["authorityBoundary"]["approvalStateChanged"])

        serialized = draft.stable_json(result)
        self.assertNotIn(str(self.root), serialized)
        self.assertNotIn("DNA yaklaşımı", serialized)
        for forbidden_key in book_diff.FORBIDDEN_PUBLIC_KEYS:
            self.assertNotIn(f'"{forbidden_key}":', serialized)

    def test_single_character_change_is_changed_not_add_remove(self) -> None:
        write_docx(
            self.source_root / "4. Bölüm.docx",
            4,
            product_suffix="x",
        )
        result = self.compare()

        self.assertEqual(result["summary"]["changed"], 1)
        self.assertEqual(result["summary"]["added"], 0)
        self.assertEqual(result["summary"]["removed"], 0)
        changed = result["changes"]["changed"][0]
        self.assertIn("content_hash_changed", changed["reasons"])
        self.assertEqual(changed["before"]["kind"], "dna_product_candidate")
        self.assertEqual(changed["after"]["kind"], "dna_product_candidate")
        self.assertTrue(result["canonicalArtifactChanged"])
        self.assertTrue(
            result["approvalInvalidation"]["wouldInvalidatePriorExactArtifactApproval"]
        )

    def test_reordered_records_are_moved(self) -> None:
        write_docx(
            self.source_root / "5. Bölüm.docx",
            5,
            reverse_science=True,
        )
        result = self.compare()

        self.assertEqual(result["summary"]["moved"], 2)
        self.assertEqual(result["summary"]["changed"], 0)
        self.assertEqual(result["summary"]["added"], 0)
        self.assertEqual(result["summary"]["removed"], 0)
        self.assertTrue(all(
            item["reasons"] == ["position_changed"]
            for item in result["changes"]["moved"]
        ))

    def test_safety_and_source_removal_are_critical(self) -> None:
        write_docx(
            self.source_root / "2. Bölüm.docx",
            2,
            include_safety=False,
        )
        write_docx(
            self.source_root / "3. Bölüm.docx",
            3,
            include_source=False,
        )
        result = self.compare()

        self.assertEqual(
            result["kindImpacts"]["safety_boundary"]["delta"],
            -1,
        )
        self.assertEqual(result["sourceDoiDelta"]["removed"], ["10.1000/test3"])
        codes = {event["code"] for event in result["criticalDeletions"]}
        self.assertIn("safety_boundary_removed", codes)
        self.assertIn("source_doi_removed", codes)
        self.assertIn("external_source_binding_removed", codes)
        self.assertGreaterEqual(result["summary"]["criticalDeletionCount"], 3)

    def test_tampered_current_package_fails_closed(self) -> None:
        records_path = Path(self.baseline["packageDirectory"]) / "records.jsonl"
        with records_path.open("ab") as handle:
            handle.write(b"{}\n")
        with self.assertRaisesRegex(
            draft.DraftBookError,
            "owner_book_package_file_hash_mismatch",
        ):
            self.compare()

    def test_path_and_mounted_volume_guards_fail_closed(self) -> None:
        with self.assertRaisesRegex(
            book_diff.OwnerBookDiffError,
            "owner_book_diff_ssd_root_must_be_mounted_volume",
        ):
            book_diff.resolve_read_only_output_root(
                self.ssd_root,
                allow_test_root=False,
            )

        current_path = self.ssd_root / draft.OUTPUT_SUBPATH / "current.json"
        current = json.loads(current_path.read_text("utf-8"))
        current["packageDirectoryName"] = "../../outside"
        current_path.write_text(draft.stable_json(current, pretty=True), encoding="utf-8")
        with self.assertRaisesRegex(
            draft.DraftBookError,
            "owner_book_current_pointer_invalid",
        ):
            self.compare()
        sanitized = book_diff._safe_error(OSError(f"failed at {self.root}/secret"))
        self.assertEqual(sanitized, "owner_book_diff_failed_closed")
        self.assertNotIn(str(self.root), sanitized)

    def test_twenty_repeats_are_byte_deterministic(self) -> None:
        write_docx(
            self.source_root / "6. Bölüm.docx",
            6,
            product_suffix="x",
        )
        serialized = [draft.stable_json(self.compare()) for _ in range(20)]
        self.assertEqual(len(set(serialized)), 1)
        hashes = {json.loads(value)["changeSetSha256"] for value in serialized}
        self.assertEqual(len(hashes), 1)


if __name__ == "__main__":
    unittest.main(verbosity=2)
