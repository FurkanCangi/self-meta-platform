#!/usr/bin/env python3
"""Resource-gated A4/C3 challenger using the existing local Qwen model."""

from __future__ import annotations

import hashlib
import json
import math
import os
import re
import resource
import time
from pathlib import Path
from typing import Any

import mlx.core as mx
from mlx_lm import generate, load
from mlx_lm.sample_utils import make_sampler

ROOT = Path(__file__).resolve().parents[1]
SSD = Path(os.environ.get("RESEARCH_SSD_ROOT", "/Volumes/ResearchSSD"))
ARCH = SSD / "Outputs/SelfMetaAI/dna-intelligence/architecture-tournament/v2"
OUT = ARCH / "phase-2"
MODEL = SSD / "Models/SelfMetaAI/Qwen3-4B-Instruct-2507-4bit"
RESULT = OUT / "local-slm-layer-results.json"


def stable(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, indent=2, sort_keys=True) + "\n"


def percentile(values: list[float], q: float) -> float:
    ordered = sorted(values)
    return ordered[min(len(ordered) - 1, math.ceil(len(ordered) * q) - 1)] if ordered else 0.0


def normalize(value: str) -> str:
    return re.sub(r"\s+", " ", re.sub(r"[^a-z0-9çğıöşü ]+", " ", value.lower())).strip()


def extract_json(raw: str) -> dict[str, Any]:
    start = raw.find("{")
    end = raw.rfind("}")
    if start < 0 or end <= start:
        raise ValueError("json_object_missing")
    value = json.loads(raw[start:end + 1])
    if not isinstance(value, dict):
        raise ValueError("json_object_invalid")
    return value


def source_guard(answer: str, claims: list[str]) -> dict[str, int]:
    source = " ".join(claims)
    source_numbers = set(re.findall(r"\b\d+(?:[.,]\d+)?\b", source))
    answer_numbers = re.findall(r"\b\d+(?:[.,]\d+)?\b", answer)
    causal = bool(re.search(r"kesin olarak neden olur|doğrudan neden olur|kanıtlar", answer, re.I)) and not bool(re.search(r"kesin olarak neden olur|doğrudan neden olur|kanıtlar", source, re.I))
    return {
        "inventedSource": int(bool(re.search(r"\b(?:doi|pmid|kaynak:)\b", answer, re.I))),
        "inventedNumber": sum(value not in source_numbers for value in answer_numbers),
        "causalityEscalation": int(causal),
        "safetyViolation": int(bool(re.search(r"tanı koy|ilaç dozu|tedavi planı|kesin prognoz", answer, re.I))),
    }


def main() -> None:
    locked = json.loads((ARCH / "sealed/locked-automated.json").read_text("utf-8"))["cases"]
    dense = json.loads((ROOT / "src/lib/dna/chat/catalog/generated/dense/runtime.json").read_text("utf-8"))
    unit_by_id = {unit["id"]: unit for unit in dense["units"]}
    domains = sorted({unit["domain"] for unit in dense["units"]} | {"ood", "safety"} | {topic for row in locked for topic in row["gold"]["queryFrame"]["topicIds"] if topic.startswith("conversation.")})
    operations = ["definition", "comparison", "relation", "measurement", "development", "evidence", "case", "follow_up", "correction", "compound", "social", "safety", "unknown"]
    a4_cases = locked[::12][:20]
    c3_cases = [row for row in locked if row["gold"]["acceptedClaimIds"]][::18][:10]

    mx.reset_peak_memory()
    load_started = time.perf_counter()
    model, tokenizer = load(str(MODEL), lazy=False)
    load_ms = (time.perf_counter() - load_started) * 1000
    sampler = make_sampler(temp=0.0)

    def ask(system: str, user: str, max_tokens: int) -> tuple[str, float]:
        prompt = tokenizer.apply_chat_template([{"role": "system", "content": system}, {"role": "user", "content": user}], add_generation_prompt=True, tokenize=False)
        started = time.perf_counter()
        raw = generate(model, tokenizer, prompt=prompt, max_tokens=max_tokens, sampler=sampler, verbose=False)
        return raw, (time.perf_counter() - started) * 1000

    a4_rows: list[dict[str, Any]] = []
    for row in a4_cases:
        raw, latency = ask(
            "Yalnız JSON QueryFrame üret. Bilimsel cevap yazma. Verilen domain/operation dışına çıkma.",
            stable({"domains": domains, "operations": operations, "question": row["question"], "previousTopicIds": row.get("context", {}).get("previousTopicIds", []), "output": {"operation": "enum", "domain": "enum", "focus": "string", "subquestionCount": "1|2", "correction": "boolean", "followUp": "boolean", "answerability": "supported|unsupported|refuse", "confidence": "0..1"}}),
            180,
        )
        try:
            parsed = extract_json(raw)
            valid = parsed.get("operation") in operations and parsed.get("domain") in domains and parsed.get("subquestionCount") in {1, 2}
        except (ValueError, json.JSONDecodeError):
            parsed, valid = {}, False
        accepted = row["gold"]["acceptedClaimIds"]
        expected_domain = unit_by_id[accepted[0]]["domain"] if accepted else (row["gold"]["queryFrame"]["topicIds"][0] if row["gold"]["queryFrame"]["topicIds"] else ("safety" if row["gold"]["expectedAction"] == "refuse" else "ood"))
        expected_operation = "follow_up" if row["gold"]["queryFrame"]["operation"] == "followup" else row["gold"]["queryFrame"]["operation"]
        a4_rows.append({"id": row["id"], "valid": valid, "operationCorrect": valid and parsed.get("operation") == expected_operation, "topicCorrect": valid and parsed.get("domain") == expected_domain, "splitCorrect": valid and parsed.get("subquestionCount") == row["gold"]["queryFrame"]["subquestionCount"], "latencyMs": latency, "rawSha256": hashlib.sha256(raw.encode()).hexdigest(), "parsed": parsed if valid else None})

    c3_rows: list[dict[str, Any]] = []
    for row in c3_cases:
        claims = [unit_by_id[value]["text"] for value in row["gold"]["acceptedClaimIds"]]
        raw, latency = ask(
            "Yalnız verilen claimleri açık doğal Türkçeyle düzenle. Yeni bilgi, sayı, kaynak, mekanizma, nedensellik veya klinik yorum ekleme. Yalnız cevap metnini yaz.",
            stable({"question": row["question"], "claims": claims}),
            260,
        )
        guard = source_guard(raw, claims)
        c3_rows.append({"id": row["id"], "answer": raw, "claims": claims, "answerSha256": hashlib.sha256(raw.encode()).hexdigest(), "latencyMs": latency, **guard})

    result = {
        "schemaVersion": "dna-layer-tournament-local-slm@1",
        "benchmarkSha256": json.loads((ARCH / "manifest.json").read_text("utf-8"))["benchmarkSha256"],
        "model": {"id": "mlx-community/Qwen3-4B-Instruct-2507-4bit", "path": str(MODEL), "license": "Apache-2.0"},
        "loadMs": load_ms,
        "layerA": {"A4": {"evaluationCases": len(a4_rows), "fullLockedCoverage": False, "resourceGateSample": len(a4_rows), "intentAccuracy": sum(row["operationCorrect"] for row in a4_rows) / len(a4_rows), "topicMacroF1Approx": sum(row["topicCorrect"] for row in a4_rows) / len(a4_rows), "twoQuestionSplitAccuracy": sum(row["splitCorrect"] for row in a4_rows) / len(a4_rows), "validJson": sum(row["valid"] for row in a4_rows) / len(a4_rows), "latencyMs": {"p50": percentile([row["latencyMs"] for row in a4_rows], .5), "p95": percentile([row["latencyMs"] for row in a4_rows], .95)}, "costPer1000Usd": 0, "decision": "resource_gate_challenger"}},
        "layerC": {"C3": {"cases": len(c3_rows), "fullLockedCoverage": False, "resourceGateSample": len(c3_rows), "mandatoryZeros": {key: sum(row[key] for row in c3_rows) for key in ["inventedSource", "inventedNumber", "causalityEscalation", "safetyViolation"]}, "latencyMs": {"p50": percentile([row["latencyMs"] for row in c3_rows], .5), "p95": percentile([row["latencyMs"] for row in c3_rows], .95)}, "blindHumanPreference": "pending_independent_human_evaluation", "decision": "resource_gate_challenger"}},
        "resources": {"mlxPeakMb": int(mx.get_peak_memory()) / 1024 / 1024, "processPeakRssMb": resource.getrusage(resource.RUSAGE_SELF).ru_maxrss / 1024 / 1024},
        "boundaries": {"runtimeEligible": False, "releaseEligible": False, "rawQuestionsInRepository": False, "humanEvaluationUsed": False},
        "rows": {"A4": a4_rows, "C3": c3_rows},
    }
    OUT.mkdir(parents=True, exist_ok=True, mode=0o700)
    RESULT.write_text(stable(result), "utf-8"); os.chmod(RESULT, 0o600)
    print(json.dumps({"ok": True, "A4": result["layerA"]["A4"], "C3": result["layerC"]["C3"], "resources": result["resources"]}, ensure_ascii=False))


if __name__ == "__main__":
    main()
