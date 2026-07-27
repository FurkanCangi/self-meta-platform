#!/usr/bin/env python3
"""Regression tests for the non-runtime owner-book draft ingestion pipeline."""

from __future__ import annotations

import importlib.util
import hashlib
import json
import os
import sys
import tempfile
import unittest
import zipfile
from pathlib import Path


SCRIPT_PATH = Path(__file__).with_name("dna_owner_book_draft.py")
SPEC = importlib.util.spec_from_file_location("dna_owner_book_draft", SCRIPT_PATH)
if SPEC is None or SPEC.loader is None:
    raise RuntimeError("owner_book_test_import_failed")
draft = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = draft
SPEC.loader.exec_module(draft)


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
        f"<w:p>{style_xml}<w:r><w:t xml:space=\"preserve\">"
        f"{xml_escape(text)}</w:t></w:r></w:p>"
    )


def table(rows: list[list[str]]) -> str:
    row_xml = []
    for row in rows:
        cells = "".join(
            f"<w:tc>{paragraph(cell)}</w:tc>"
            for cell in row
        )
        row_xml.append(f"<w:tr>{cells}</w:tr>")
    return f"<w:tbl>{''.join(row_xml)}</w:tbl>"


def write_docx(path: Path, chapter_number: int) -> None:
    body = [
        paragraph("DNA MODÜL 1 • KURAMSAL TEMELLER", ""),
        paragraph(f"BÖLÜM {chapter_number} — TEST BÖLÜMÜ", ""),
        paragraph("Bu bölümün temel sorusu", "Heading1"),
        paragraph("Bu kavram nasıl açıklanır?"),
        paragraph("Klinik açılış: Kurgu örnek", "Heading1"),
    ]
    if chapter_number != 9:
        body.append(paragraph(
            "Bu bölümdeki örnekler kurgu kompozitlerdir; gerçek bir çocuğu temsil etmez."
        ))
    body.extend([
        paragraph("Bir çocuk göreve geç başlıyor; bu gözlem tek başına tanı değildir."),
        paragraph(f"{chapter_number}.1. Bilimsel çerçeve", "Heading1"),
        paragraph(
            "Düzenleme bağlama göre değişebilir (Smith, 2020)."
        ),
        paragraph("DNA sentezi: Çalışma ilkesi", "Heading1"),
        paragraph(
            "DNA yaklaşımı davranışı çocuk, görev ve çevre etkileşiminde ele alır."
        ),
        table([
            ["Bilimsel sınır"],
            ["Davranıştan tek başına belirli bir biyolojik mekanizma çıkarılamaz."],
        ]),
        paragraph("Sık yapılan üç yanlış yorum", "Heading1"),
        paragraph("Sakin görünmek her zaman iyi düzenleme kanıtıdır."),
        paragraph("Klinik düşünme soruları", "Heading1"),
        paragraph("Koşullar değiştiğinde performans nasıl değişiyor?"),
        paragraph("Kısa kavram sözlüğü", "Heading1"),
        paragraph("Regülasyon: Değişen koşullara göre durumu ayarlama süreci."),
        paragraph("Kaynaklar", "Heading1"),
        paragraph(
            f"Smith, J. (2020). Test source {chapter_number}. "
            f"https://doi.org/10.1000/test{chapter_number}"
        ),
    ])
    document_xml = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        f'<w:document xmlns:w="{draft.W_NS}"><w:body>'
        f"{''.join(body)}<w:sectPr/></w:body></w:document>"
    )
    path.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(path, "w", compression=zipfile.ZIP_DEFLATED) as archive:
        archive.writestr("word/document.xml", document_xml)


def load_jsonl(path: Path) -> list[dict]:
    return [json.loads(line) for line in path.read_text("utf-8").splitlines() if line]


def rewrite_package_hash_files(package_dir: Path) -> None:
    manifest_path = package_dir / "manifest.json"
    manifest = json.loads(manifest_path.read_text("utf-8"))
    for name in sorted(draft.PACKAGE_PAYLOAD_FILES):
        content = (package_dir / name).read_bytes()
        manifest["files"][name] = {
            "sha256": hashlib.sha256(content).hexdigest(),
            "byteLength": len(content),
        }
    manifest_path.write_text(
        draft.stable_json(manifest, pretty=True),
        encoding="utf-8",
    )
    checksums = "".join(
        f"{hashlib.sha256((package_dir / name).read_bytes()).hexdigest()}  {name}\n"
        for name in sorted(draft.PACKAGE_CHECKSUM_FILES)
    )
    (package_dir / "checksums.sha256").write_text(checksums, encoding="utf-8")


class OwnerBookDraftTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp = tempfile.TemporaryDirectory(prefix="dna-owner-book-draft-test-")
        self.root = Path(self.temp.name)
        self.source_root = self.root / "source"
        self.ssd_root = self.root / "ssd"
        self.repo_manifest = self.root / "repo" / "manifest.json"
        self.ssd_root.mkdir()
        for chapter_number in range(1, 10):
            write_docx(self.source_root / f"{chapter_number}. Bölüm.docx", chapter_number)

    def tearDown(self) -> None:
        self.temp.cleanup()

    def build(self) -> dict:
        return draft.build(
            source_root=self.source_root,
            ssd_root=self.ssd_root,
            repo_manifest_path=self.repo_manifest,
            allow_test_root=True,
        )

    def test_deterministic_candidate_only_package(self) -> None:
        first = self.build()
        second = self.build()
        self.assertEqual(first["packageSha256"], second["packageSha256"])
        self.assertEqual(first["sourceSetSha256"], second["sourceSetSha256"])
        self.assertEqual(second["operationStatus"], "reused")
        self.assertEqual(first["chapterCount"], 9)
        self.assertFalse(first["authorityBoundary"]["ownerApproval"])
        self.assertFalse(first["authorityBoundary"]["runtimeEligible"])
        self.assertFalse(first["authorityBoundary"]["releaseEligible"])

        package_dir = Path(first["packageDirectory"])
        records = load_jsonl(package_dir / "records.jsonl")
        sources = load_jsonl(package_dir / "sources.jsonl")
        benchmarks = load_jsonl(package_dir / "benchmark-candidates.jsonl")
        artifact = (package_dir / "canonical-book.txt").read_bytes()

        self.assertEqual(len(records), len({record["recordId"] for record in records}))
        self.assertTrue(records)
        self.assertTrue(sources)
        self.assertTrue(benchmarks)
        self.assertEqual(first["sourceBinding"]["duplicateSourceIds"], [])
        self.assertEqual(first["governanceCrosswalk"]["matchedByCanonicalDoi"], 0)
        self.assertFalse(first["governanceCrosswalk"]["authorityInherited"])
        self.assertFalse(first["governanceCrosswalk"]["claimFidelityInherited"])
        self.assertEqual(
            first["methodCandidateCrosswalk"]["status"],
            "disabled_in_isolated_test",
        )
        self.assertFalse(first["methodCandidateCrosswalk"]["authorityInherited"])
        self.assertFalse(first["methodCandidateCrosswalk"]["claimFidelityInherited"])
        self.assertIn("dna_product_candidate", {record["kind"] for record in records})
        self.assertIn("external_science_candidate", {record["kind"] for record in records})
        self.assertIn("safety_boundary", {record["kind"] for record in records})
        self.assertIn("definition", {record["kind"] for record in records})
        self.assertIn("reasoning_question", {record["kind"] for record in records})

        for record in records:
            self.assertFalse(record["ownerApproval"])
            self.assertFalse(record["runtimeEligible"])
            self.assertFalse(record["releaseEligible"])
            self.assertFalse(record["answerEligible"])
            start = record["locator"]["artifactByteRange"]["startByte"]
            end = record["locator"]["artifactByteRange"]["endByteExclusive"]
            self.assertEqual(
                draft.sha256_bytes(artifact[start:end]),
                record["canonicalTextSha256"],
            )
        chapter_nine_examples = [
            record for record in records
            if record["chapterId"] == "chapter.09" and record["kind"] == "clinical_example"
        ]
        self.assertTrue(chapter_nine_examples)
        self.assertTrue(all(
            record["reviewStatus"] == "synthetic_status_unspecified_quarantined"
            for record in chapter_nine_examples
        ))
        for source in sources:
            self.assertFalse(source["ownerApproval"])
            self.assertFalse(source["runtimeEligible"])
            self.assertFalse(source["releaseEligible"])
        for benchmark in benchmarks:
            self.assertEqual(benchmark["status"], "draft_unsealed")
            self.assertFalse(benchmark["evaluationEligible"])
            self.assertFalse(benchmark["runtimeEligible"])
            self.assertFalse(benchmark["releaseEligible"])

        compact_text = self.repo_manifest.read_text("utf-8")
        self.assertNotIn(str(self.source_root), compact_text)
        self.assertNotIn('"text":', compact_text)
        self.assertNotIn('"referenceText":', compact_text)
        self.assertNotIn('"question":', compact_text)
        self.assertNotIn('"rows":', compact_text)
        self.assertNotIn('"chapterTitle":', compact_text)
        compact = json.loads(compact_text)
        self.assertTrue(all(
            set(chapter) == set(draft.COMPACT_CHAPTER_KEYS)
            for chapter in compact["chapters"]
        ))

        verified = draft.verify(
            source_root=self.source_root,
            ssd_root=self.ssd_root,
            repo_manifest_path=self.repo_manifest,
            allow_test_root=True,
        )
        self.assertEqual(verified["status"], "verified")
        self.assertFalse(verified["runtimeEligible"])

    def test_source_mutation_invalidates_identity(self) -> None:
        first = self.build()
        source = self.source_root / "4. Bölüm.docx"
        with source.open("ab") as handle:
            handle.write(b"draft-source-byte-change")
        second = self.build()
        self.assertNotEqual(first["sourceSetSha256"], second["sourceSetSha256"])
        self.assertNotEqual(first["packageSha256"], second["packageSha256"])
        self.assertTrue(Path(first["packageDirectory"]).is_dir())
        self.assertTrue(Path(second["packageDirectory"]).is_dir())

    def test_output_tamper_fails_closed(self) -> None:
        result = self.build()
        records_path = Path(result["packageDirectory"]) / "records.jsonl"
        with records_path.open("ab") as handle:
            handle.write(b"{}\n")
        with self.assertRaisesRegex(
            draft.DraftBookError,
            "owner_book_package_file_hash_mismatch",
        ):
            draft.verify(
                source_root=self.source_root,
                ssd_root=self.ssd_root,
                repo_manifest_path=self.repo_manifest,
                allow_test_root=True,
            )

    def test_rehashed_authority_expansion_tamper_fails_closed(self) -> None:
        result = self.build()
        package_dir = Path(result["packageDirectory"])
        records_path = package_dir / "records.jsonl"
        records = load_jsonl(records_path)
        records[0]["runtimeEligible"] = True
        records_path.write_bytes(draft.jsonl(records))
        rewrite_package_hash_files(package_dir)

        with self.assertRaisesRegex(
            draft.DraftBookError,
            "owner_book_package_candidate_flag_expanded",
        ):
            draft.verify(
                source_root=self.source_root,
                ssd_root=self.ssd_root,
                repo_manifest_path=self.repo_manifest,
                allow_test_root=True,
            )

    def test_rehashed_semantic_tamper_fails_closed(self) -> None:
        result = self.build()
        package_dir = Path(result["packageDirectory"])
        records_path = package_dir / "records.jsonl"
        records = load_jsonl(records_path)
        records[0]["reviewStatus"] = "owner_approved"
        records_path.write_bytes(draft.jsonl(records))
        rewrite_package_hash_files(package_dir)

        with self.assertRaisesRegex(
            draft.DraftBookError,
            "owner_book_package_semantic_hash_mismatch",
        ):
            draft.verify(
                source_root=self.source_root,
                ssd_root=self.ssd_root,
                repo_manifest_path=self.repo_manifest,
                allow_test_root=True,
            )

    def test_repo_manifest_tamper_fails_closed(self) -> None:
        self.build()
        compact = json.loads(self.repo_manifest.read_text("utf-8"))
        compact["recordCount"] += 1
        self.repo_manifest.write_text(
            draft.stable_json(compact, pretty=True),
            encoding="utf-8",
        )
        with self.assertRaisesRegex(
            draft.DraftBookError,
            "owner_book_repo_manifest_content_mismatch",
        ):
            draft.verify(
                source_root=self.source_root,
                ssd_root=self.ssd_root,
                repo_manifest_path=self.repo_manifest,
                allow_test_root=True,
            )

    def test_symlink_output_root_is_rejected(self) -> None:
        target = self.root / "real-ssd"
        target.mkdir()
        symlink = self.root / "linked-ssd"
        os.symlink(target, symlink)
        with self.assertRaisesRegex(
            draft.DraftBookError,
            "owner_book_ssd_root_symlink_rejected",
        ):
            draft.ensure_ssd_output_root(symlink, allow_test_root=True)

    def test_symlink_package_directory_is_rejected(self) -> None:
        result = self.build()
        package_dir = Path(result["packageDirectory"])
        real_package_dir = package_dir.with_name(f".{package_dir.name}.real")
        package_dir.rename(real_package_dir)
        package_dir.symlink_to(real_package_dir, target_is_directory=True)
        with self.assertRaisesRegex(
            draft.DraftBookError,
            "owner_book_package_directory_symlink_rejected",
        ):
            draft.verify(
                source_root=self.source_root,
                ssd_root=self.ssd_root,
                repo_manifest_path=self.repo_manifest,
                allow_test_root=True,
            )

    def test_current_pointer_path_traversal_is_rejected(self) -> None:
        self.build()
        current_path = self.ssd_root / draft.OUTPUT_SUBPATH / "current.json"
        current = json.loads(current_path.read_text("utf-8"))
        current["packageDirectoryName"] = "../../outside"
        current_path.write_text(draft.stable_json(current, pretty=True), encoding="utf-8")
        with self.assertRaisesRegex(
            draft.DraftBookError,
            "owner_book_current_pointer_invalid",
        ):
            draft.verify(
                source_root=self.source_root,
                ssd_root=self.ssd_root,
                repo_manifest_path=self.repo_manifest,
                allow_test_root=True,
            )

    def test_exact_package_file_allowlist_is_enforced(self) -> None:
        result = self.build()
        (Path(result["packageDirectory"]) / "unexpected.txt").write_text(
            "not allowed",
            encoding="utf-8",
        )
        with self.assertRaisesRegex(
            draft.DraftBookError,
            "owner_book_package_file_set_mismatch",
        ):
            draft.verify(
                source_root=self.source_root,
                ssd_root=self.ssd_root,
                repo_manifest_path=self.repo_manifest,
                allow_test_root=True,
            )

    def test_missing_or_extra_chapter_fails_closed(self) -> None:
        (self.source_root / "9. Bölüm.docx").unlink()
        with self.assertRaisesRegex(draft.DraftBookError, "expected_9_docx_found_8"):
            draft.build_package_data(self.source_root)

    def test_chapter_number_set_must_be_exactly_one_to_nine(self) -> None:
        (self.source_root / "2. Bölüm.docx").rename(
            self.source_root / "10. Bölüm.docx"
        )
        with self.assertRaisesRegex(
            draft.DraftBookError,
            "owner_book_chapter_number_set_invalid",
        ):
            draft.build_package_data(self.source_root)

    def test_multi_author_and_single_author_citations_resolve_without_guessing(self) -> None:
        sources = [
            {
                "sourceId": "source.uddin",
                "year": "2019",
                "authorTokens": ["uddin", "yeo", "spreng"],
            },
            {
                "sourceId": "source.gross",
                "year": "2024",
                "authorTokens": ["gross"],
            },
            {
                "sourceId": "source.gross-ford",
                "year": "2024",
                "authorTokens": ["gross", "ford"],
            },
        ]
        mentions = draft.citation_mentions(
            "Uddin, Yeo ve Spreng (2019) ile Gross (2024) bu ayrımı tartışır."
        )
        bindings, source_ids = draft.resolve_citations(mentions, sources)
        self.assertEqual(source_ids, ["source.gross", "source.uddin"])
        self.assertTrue(all(binding["status"] == "resolved_same_chapter" for binding in bindings))


if __name__ == "__main__":
    suite = unittest.defaultTestLoader.loadTestsFromTestCase(OwnerBookDraftTests)
    result = unittest.TextTestRunner(verbosity=2).run(suite)
    if result.wasSuccessful():
        print("DNA owner-book draft ingestion: PASS")
        raise SystemExit(0)
    raise SystemExit(1)
