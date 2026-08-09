#!/usr/bin/env python3
"""Generate four architecture answers for the sealed 150-case human set.

The human questions are never used for training. Gold labels are loaded only by
the later automated safety adjudicator, not by this answer generator.
"""

from __future__ import annotations

import hashlib
import json
import os
import re
from pathlib import Path
from typing import Any

import numpy as np
from sentence_transformers import SentenceTransformer
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import FeatureUnion

ROOT = Path(__file__).resolve().parents[1]
SSD = Path(os.environ.get("RESEARCH_SSD_ROOT", "/Volumes/ResearchSSD"))
ARCH = SSD / "Outputs/SelfMetaAI/dna-intelligence/architecture-tournament/v2"
OUT = ARCH / "phase-8"
E5_PATH = SSD / "Models/SelfMetaAI/multilingual-e5-small"
UNITS_PATH = SSD / "Outputs/SelfMetaAI/dna-intelligence/knowledge-expansion/v1/owner-knowledge-units.jsonl"


def stable(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, indent=2, sort_keys=True) + "\n"


def normalize(value: str) -> str:
    table = str.maketrans("ÇĞİÖŞÜçğıöşü", "CGIOSUcgiosu")
    return re.sub(r"\s+", " ", re.sub(r"[^a-z0-9 ]+", " ", value.translate(table).lower())).strip()


def safety_gate(question: str) -> bool:
    return bool(re.search(r"tan[ıi] koy|ila[cç]|doz|tedavi plan|prognoz|gizli kural|sistem (?:talimat|prompt)|ham cevap|ba[sş]ka terapistin|insula hasar|hrv [oö]l[cç]meden|vagal tonus", question, re.I))


def social_answer(question: str) -> str | None:
    value = normalize(question)
    if re.search(r"\b(?:merhaba|selam)\b", value):
        return "Merhaba! DNA kavramları, nörofizyoloji, öz-düzenleme ve seçilmiş rapordaki güvenli bulgular hakkında yardımcı olabilirim."
    if re.search(r"nelerde yardim|ne yapabilirsin|yardim alanlari", value):
        return "Kavramları açıklayabilir, iki süreci karşılaştırabilir, kanıt ve ölçüm sınırlarını anlatabilir ve seçtiğiniz DNA raporundaki güvenli bulguları genel bilgiyle birlikte ele alabilirim."
    if re.search(r"kaynak|gizli|gecmis|yanit uzunlugu|nasil kullan|rapora soru", value):
        return "Yanıtlar kaynak bağlı bilgi birimlerinden hazırlanır. Sohbet geçmişi kalıcı tutulmaz; rapor sorularında yalnız seçtiğiniz ve size ait raporun güvenli bağlamı kullanılır."
    return None


def ranks(scores: np.ndarray, top_k: int = 20) -> list[int]:
    count = min(top_k, len(scores))
    return np.argsort(-scores, kind="stable")[:count].tolist()


def clean_claim(value: str) -> str:
    return re.sub(r"\s*\([^)]*\d{4}[^)]*\)\s*\.?$", ".", value).strip()


def response(operation: str, claims: list[str], action: str, controlled: bool) -> str:
    if action == "refusal":
        return "Bu istek tanı, tedavi, ilaç, kesin prognoz veya yetkisiz klinik çıkarım sınırına giriyor; bu nedenle yerine getiremiyorum."
    if action == "social":
        return claims[0]
    if action == "abstain":
        return "Bu özgül iddia için güvenli ve doğrudan bir dayanak seçemedim. Soruyu daha geniş bir kavram üzerinden açıklayabilir veya hangi yönünü kastettiğinizi netleştirebiliriz."
    sentences = [clean_claim(value) for value in claims]
    if not controlled:
        return " ".join(sentences)
    opening = {
        "comparison": "Temel ayrım şu:",
        "relation": "Kaynakların desteklediği sınırda ilişkiyi şöyle kurabiliriz:",
        "measurement": "Ölçüm açısından:",
        "development": "Gelişim açısından:",
    }.get(operation, "Kısaca:")
    return f'{opening} {" ".join(sentences)}'


def operation(question: str) -> str:
    value = normalize(question)
    if re.search(r"farki|karsilastir|hangisi", value):
        return "comparison"
    if re.search(r"iliski|baglanti|birbirini", value):
        return "relation"
    if re.search(r"nasil olcul|olcumu", value):
        return "measurement"
    if re.search(r"gelisim|cocuk|ergen|yetiskin", value):
        return "development"
    return "definition"


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True, mode=0o700)
    development = json.loads((ARCH / "development.json").read_text("utf-8"))["cases"]
    human = json.loads((ARCH / "sealed/human-evaluation-questions.json").read_text("utf-8"))["cases"]
    units = [json.loads(line) for line in UNITS_PATH.read_text("utf-8").splitlines() if line.strip()]
    unit_by_id = {unit["id"]: unit for unit in units}
    passages = [f'{unit["title"]}. {unit["focus"]}. {unit["text"]}' for unit in units]
    questions = [row["question"] for row in human]

    lexical = FeatureUnion([
        ("word", TfidfVectorizer(preprocessor=normalize, ngram_range=(1, 2), min_df=1, max_features=100_000, sublinear_tf=True)),
        ("char", TfidfVectorizer(preprocessor=normalize, analyzer="char_wb", ngram_range=(3, 5), min_df=2, max_features=120_000, sublinear_tf=True)),
    ])
    lexical_units = lexical.fit_transform(passages)
    lexical_queries = lexical.transform(questions)
    e5 = SentenceTransformer(str(E5_PATH), device="cpu")
    unit_embeddings = np.load(ARCH / "phase-2/e5-unit-embeddings.npy")
    human_embeddings = e5.encode([f"query: {value}" for value in questions], batch_size=32, normalize_embeddings=True, show_progress_bar=False)
    development_embeddings = e5.encode([f'query: {row["question"]}' for row in development], batch_size=32, normalize_embeddings=True, show_progress_bar=False)
    development_domains = []
    for row in development:
        accepted = row["gold"]["acceptedClaimIds"]
        development_domains.append(unit_by_id[accepted[0]]["domain"] if accepted else "ood")
    domain_clf = LogisticRegression(max_iter=1000, class_weight="balanced", random_state=20260809).fit(development_embeddings, development_domains)
    neural_domains = domain_clf.predict(human_embeddings)
    phase3 = json.loads((ARCH / "phase-3-4/phase-3-summary.json").read_text("utf-8"))
    thresholds = {name: phase3["architectures"][name]["locked"]["threshold"] for name in ["S1", "S2", "S3"]}

    rows: dict[str, list[dict[str, Any]]] = {name: [] for name in ["S1", "S2", "S3"]}
    luna_requests: list[dict[str, Any]] = []
    for case_index, case in enumerate(human):
        question = case["question"]
        social = social_answer(question)
        if social:
            for name in rows:
                rows[name].append({"id": case["id"], "action": "social", "selectedClaimIds": [], "selectedPassageIds": [], "selectedSourceIds": [], "answer": social, "confidence": 1})
            continue
        if safety_gate(question):
            for name in rows:
                rows[name].append({"id": case["id"], "action": "refusal", "selectedClaimIds": [], "selectedPassageIds": [], "selectedSourceIds": [], "answer": response("safety", [], "refusal", False), "confidence": 1})
            continue

        lexical_scores = (lexical_queries[case_index] @ lexical_units.T).toarray().ravel()
        dense_scores = unit_embeddings @ human_embeddings[case_index]
        lexical_rank = ranks(lexical_scores)
        dense_rank = ranks(dense_scores)
        rrf: dict[int, float] = {}
        for rank, index in enumerate(lexical_rank):
            rrf[index] = rrf.get(index, 0) + 1 / (61 + rank)
        for rank, index in enumerate(dense_rank):
            rrf[index] = rrf.get(index, 0) + 1 / (61 + rank)
        hybrid_rank = [index for index, _ in sorted(rrf.items(), key=lambda item: (-item[1], item[0]))[:20]]
        lexical_domain = units[lexical_rank[0]]["domain"]
        configurations = {
            "S1": (lexical_rank, lexical_domain, float(lexical_scores[lexical_rank[0]]), True),
            "S2": (hybrid_rank, lexical_domain, max(0.0, (float(lexical_scores[hybrid_rank[0]]) + float(dense_scores[hybrid_rank[0]])) / 2), False),
            "S3": (hybrid_rank, str(neural_domains[case_index]), max(0.0, (float(lexical_scores[hybrid_rank[0]]) + float(dense_scores[hybrid_rank[0]])) / 2), False),
        }
        for name, (ranking, domain, confidence, controlled) in configurations.items():
            filtered = [index for index in ranking if units[index]["domain"] == domain]
            selected = [units[index] for index in (filtered or ranking)[:1]]
            action = "answer" if confidence >= thresholds[name] else "abstain"
            answer = response(operation(question), [unit["text"] for unit in selected], action, controlled)
            row = {"id": case["id"], "action": action, "selectedClaimIds": [unit["id"] for unit in selected] if action == "answer" else [], "selectedPassageIds": [unit["passageId"] for unit in selected] if action == "answer" else [], "selectedSourceIds": [unit["sourceId"] for unit in selected] if action == "answer" else [], "answer": answer, "confidence": confidence}
            rows[name].append(row)
            if name == "S2" and action == "answer":
                key = hashlib.sha256(stable({"question": question, "claims": [unit["text"] for unit in selected]}).encode()).hexdigest()[:24]
                row["lunaRequestKey"] = key
                luna_requests.append({"key": key, "id": case["id"], "question": question, "claims": [unit["text"] for unit in selected], "fallback": answer})

    output = {"schemaVersion": "dna-phase8-human-architecture-base@1", "architectures": rows, "boundaries": {"humanQuestionsUsedForTraining": False, "goldLabelsUsedForGeneration": False, "productionAffected": False}}
    (OUT / "human-architecture-base.json").write_text(stable(output), "utf-8")
    (OUT / "human-luna-requests.json").write_text(stable({"schemaVersion": "dna-phase8-human-luna-requests@1", "requests": luna_requests}), "utf-8")
    os.chmod(OUT / "human-architecture-base.json", 0o600)
    os.chmod(OUT / "human-luna-requests.json", 0o600)
    print(json.dumps({"ok": True, "humanCases": len(human), "architectures": list(rows), "lunaRequests": len(luna_requests)}, ensure_ascii=False))


if __name__ == "__main__":
    main()
