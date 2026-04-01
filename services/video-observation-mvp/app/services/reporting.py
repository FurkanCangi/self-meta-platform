from __future__ import annotations

from typing import Any


DISPLAY_NAMES = {
    "attention_engagement": "Dikkat ve Oyunda Kalma",
    "behavioral_organization": "Davranış Organizasyonu",
    "emotional_recovery": "Frustrasyon ve Toparlanma",
    "co_regulation_openness": "Ko-Regülasyon Açıklığı",
    "sensory_reactivity_markers": "Duyusal Reaktivite İşaretleri",
}


def _quality_sentence(quality: dict[str, Any]) -> str:
    warnings = quality.get("warnings", [])
    warning_text = " Uyarılar: " + ", ".join(warnings) + "." if warnings else ""
    return (
        f"Bu oturum için genel gozlem guveni {quality['label']} duzeydedir "
        f"(confidence={quality['overall_confidence']:.2f})."
        f"{warning_text}"
    )


def _segment_summary(segment_type: str, features: dict[str, float]) -> str:
    if segment_type == "solo":
        return (
            f"Solo oyunda merkeze yonelim orani {features.get('center_orientation_ratio', 0):.2f}, "
            f"oyunda kalma orani {features.get('engaged_play_ratio', 0):.2f} ve kopma sayisi "
            f"{int(features.get('disengagement_count', 0))} olarak izlenmistir."
        )
    if segment_type == "dyadic":
        return (
            f"Bakimverenli bolumde ortak dikkat orani {features.get('joint_engagement_ratio', 0):.2f}, "
            f"destek alma gecikmesi {features.get('support_uptake_latency_sec', 0):.1f} sn ve "
            f"prompt bagimlilik indeksi {features.get('prompt_dependency_index', 0):.2f} olarak hesaplanmistir."
        )
    return (
        f"Gecis bolumunde yuksek aktivasyon epizodu sayisi {int(features.get('high_activation_episode_count', 0))}, "
        f"toparlanma gecikmesi {features.get('recovery_latency_sec', 0):.1f} sn ve yeniden oyuna donus basarisi "
        f"{features.get('reengagement_success', 0):.2f} olarak izlenmistir."
    )


def _strengths(domain_scores: list[dict[str, Any]]) -> list[dict[str, Any]]:
    rows = [row for row in domain_scores if row["label"] in {"olagan", "none"}]
    return sorted(rows, key=lambda row: row["score_0_100"], reverse=True)[:2]


def _concerns(domain_scores: list[dict[str, Any]]) -> list[dict[str, Any]]:
    concern_labels = {"hafif zorlanma isaretleri", "belirgin zorlanma isaretleri", "possible", "notable"}
    rows = [row for row in domain_scores if row["label"] in concern_labels]
    return sorted(rows, key=lambda row: row["score_0_100"])


def build_report_text(
    session_context: dict[str, Any],
    quality: dict[str, Any],
    segment_feature_map: dict[str, dict[str, float]],
    domain_scores: list[dict[str, Any]],
    fusion_results: list[dict[str, Any]],
) -> str:
    strong = _strengths(domain_scores)
    concerns = _concerns(domain_scores)

    lines = [
        "1. Oturum Ozeti",
        (
            f"{session_context['child_label']} icin serbest oyun oturumu "
            f"{session_context['age_months']} ay yas bilgisiyle degerlendirilmis; bu oturumda kararlar "
            "yalnizca gozlemsel regülasyon bulgulari uzerinden uretilmistir."
        ),
        "",
        "2. Kalite ve Sinirliliklar",
        _quality_sentence(quality),
        "",
        "3. Gozlenen Guclu Alanlar",
    ]

    if strong:
        for row in strong:
            lines.append(
                f"- {DISPLAY_NAMES[row['domain_name']]}: {row['label']} "
                f"(skor={row['score_0_100']:.1f}, confidence={row['confidence']:.2f})"
            )
    else:
        lines.append("- Bu oturumda belirgin koruyucu alanlar sinirli gozlendi.")

    lines.extend(["", "4. Gozlenen Zorlanma Alanlari"])
    if concerns:
        for row in concerns:
            lines.append(
                f"- {DISPLAY_NAMES[row['domain_name']]}: {row['label']} "
                f"(skor={row['score_0_100']:.1f}, confidence={row['confidence']:.2f})"
            )
    else:
        lines.append("- Bu oturumda belirgin bir zorlanma ekseni gozlenmemistir.")

    lines.extend(["", "5. Olcek-Video Entegrasyonu"])
    if fusion_results:
        for row in fusion_results:
            fused_fragment = f", fused={row['fused_score']:.1f}" if row["fused_score"] is not None else ""
            lines.append(
                f"- {DISPLAY_NAMES[row['domain_name']]}: uyum={row['agreement_label']}, "
                f"video={row['video_score']:.1f}, olcek={row['scale_score'] if row['scale_score'] is not None else 'yok'}"
                f"{fused_fragment}."
            )
    else:
        lines.append("- Self Meta olcek baglami verilmedigi icin video-olcek entegrasyonu uretilmedi.")

    lines.extend(
        [
            "",
            "6. Klinik Yorum",
            (
                "Bu oturumda yorumlanan bulgular tanisal degil, baglama ozgu ve session-specific gozlemsel "
                "regulasyon isaretleri olarak ele alinmalidir."
            ),
        ]
    )
    for segment_type, features in segment_feature_map.items():
        lines.append(_segment_summary(segment_type, features))

    if concerns:
        dominant = concerns[0]
        lines.append(
            f"Genel tablo en cok {DISPLAY_NAMES[dominant['domain_name']]} alaninda zorlanma isaretleri "
            "oldigunu; buna karsin kararlarin quality/confidence ve diger veri kaynaklari ile birlikte "
            "okunmasi gerektigini dusundurmektedir."
        )
    else:
        lines.append(
            "Genel tablo, bu oturum baglaminda buyuk olcude korunmus bir regülasyon oruntusune isaret etmektedir."
        )

    lines.extend(["", "7. Self Meta Ici Sonraki Adim Onerileri"])
    if fusion_results:
        for row in fusion_results:
            lines.append(f"- {DISPLAY_NAMES[row['domain_name']]}: {row['next_step']}")
    else:
        lines.append("- Video bulgulari mevcut anamnez ve klinisyen gozlumu ile birlikte okunabilir.")

    lines.extend(
        [
            "",
            "8. Dis Yonlendirme / Sinirlilik Notu",
            (
                "Bu modül tani uretmez. Bulgular klinik karar destek amaciyla kullanilmali; "
                "dusuk kalite veya baglamsal uyumsuzluk durumunda ikinci video, dogrudan gozlem "
                "veya gorev bazli degerlendirme dusunulmelidir."
            ),
        ]
    )
    return "\n".join(lines)


def build_report_payload(
    session_context: dict[str, Any],
    quality: dict[str, Any],
    segment_feature_map: dict[str, dict[str, float]],
    domain_scores: list[dict[str, Any]],
    fusion_results: list[dict[str, Any]],
    rule_evaluations: list[dict[str, Any]],
) -> dict[str, Any]:
    return {
        "session_context": session_context,
        "quality": quality,
        "segment_summaries": {
            segment_type: _segment_summary(segment_type, features)
            for segment_type, features in segment_feature_map.items()
        },
        "domains": domain_scores,
        "fusion": fusion_results,
        "rule_evaluations": rule_evaluations,
    }
