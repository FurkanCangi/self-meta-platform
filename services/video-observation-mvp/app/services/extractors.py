from __future__ import annotations

from dataclasses import dataclass
from math import sqrt
from pathlib import Path
from statistics import mean, pstdev
from typing import Any

from app.core.config import settings


@dataclass
class DerivedSignal:
    name: str
    value: float
    units: str
    confidence: float
    provenance: dict[str, Any]


DEFAULT_SEGMENT_FEATURES: dict[str, dict[str, tuple[float, str]]] = {
    "solo": {
        "engaged_play_ratio": (0.72, "ratio"),
        "disengagement_count": (1, "count"),
        "self_reengagement_ratio": (0.74, "ratio"),
        "center_orientation_ratio": (0.76, "ratio"),
        "long_uninterrupted_play_bout_sec": (35, "sec"),
        "abrupt_switching_rate": (0.18, "ratio"),
        "movement_variability": (0.22, "ratio"),
        "organized_play_bout_length_sec": (34, "sec"),
        "repeated_retreat_count": (0, "count"),
    },
    "dyadic": {
        "caregiver_orientation_ratio": (0.63, "ratio"),
        "support_uptake_latency_sec": (7, "sec"),
        "joint_engagement_ratio": (0.58, "ratio"),
        "contingent_response_pairing": (0.62, "ratio"),
        "support_after_recovery_ratio": (0.61, "ratio"),
        "prompt_dependency_index": (0.26, "ratio"),
    },
    "transition": {
        "high_activation_episode_count": (1, "count"),
        "escalation_intensity": (0.26, "ratio"),
        "recovery_latency_sec": (12, "sec"),
        "reengagement_success": (0.72, "ratio"),
        "adult_support_needed": (0.32, "ratio"),
        "segment_abort_flag": (0, "binary"),
        "toy_change_withdrawal_count": (0, "count"),
        "audio_reactivity_spikes": (0, "count"),
        "avoidance_after_touch_ratio": (0.05, "ratio"),
    },
}

_TASK_RUNTIME_STATE: dict[str, str | None] = {
    "status": "unknown",
    "error": None,
}


def _clip(value: float, low: float = 0.0, high: float = 1.0) -> float:
    return max(low, min(high, value))


def _float_or(value: Any, default: float) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def _run_lengths(flags: list[bool]) -> list[int]:
    runs: list[int] = []
    current = 0
    for flag in flags:
        if flag:
            current += 1
        elif current:
            runs.append(current)
            current = 0
    if current:
        runs.append(current)
    return runs


def _load_mediapipe_solution_apis():
    try:
        import mediapipe as mp  # type: ignore[import-not-found]
    except ImportError:
        return None
    solutions = getattr(mp, "solutions", None)
    if solutions is None:
        return None
    pose_module = getattr(solutions, "pose", None)
    face_module = getattr(solutions, "face_detection", None)
    if pose_module is None or face_module is None:
        return None
    return mp, pose_module, face_module


def _load_mediapipe_task_apis():
    pose_model = settings.mediapipe_pose_model_path
    face_model = settings.mediapipe_face_model_path
    if not (pose_model and face_model):
        return None
    if not (Path(pose_model).exists() and Path(face_model).exists()):
        return None
    try:
        import mediapipe as mp  # type: ignore[import-not-found]
    except ImportError:
        return None
    tasks = getattr(mp, "tasks", None)
    vision = getattr(tasks, "vision", None) if tasks is not None else None
    if tasks is None or vision is None:
        return None
    return {
        "mp": mp,
        "BaseOptions": tasks.BaseOptions,
        "FaceLandmarker": vision.FaceLandmarker,
        "FaceLandmarkerOptions": vision.FaceLandmarkerOptions,
        "PoseLandmarker": vision.PoseLandmarker,
        "PoseLandmarkerOptions": vision.PoseLandmarkerOptions,
        "RunningMode": vision.RunningMode,
    }


def _normalized_pair(x: float, y: float) -> tuple[float, float]:
    return (float(x), float(y))


def _centroid_xy(landmarks: list[Any]) -> tuple[float, float]:
    if not landmarks:
        return 0.5, 0.5
    xs = [float(getattr(landmark, "x", 0.5)) for landmark in landmarks]
    ys = [float(getattr(landmark, "y", 0.5)) for landmark in landmarks]
    return mean(xs), mean(ys)


def _build_signal_metrics(
    *,
    segment_type: str,
    overall_quality: float,
    segment_quality: dict[str, Any] | None,
    processed_frames: int,
    pose_visible_frames: int,
    face_visible_frames: int,
    multi_face_frames: int,
    centered_flags: list[bool],
    edge_flags: list[bool],
    movement_deltas: list[float],
) -> list[DerivedSignal]:
    if processed_frames == 0:
        return []

    pose_ratio = pose_visible_frames / processed_frames
    face_ratio = face_visible_frames / processed_frames
    multi_face_ratio = multi_face_frames / processed_frames
    mean_delta = mean(movement_deltas) if movement_deltas else 0.0
    delta_std = pstdev(movement_deltas) if len(movement_deltas) > 1 else 0.0
    centered_ratio = sum(centered_flags) / len(centered_flags) if centered_flags else 0.0
    edge_runs = _run_lengths(edge_flags)
    repeated_retreat_count = sum(1 for run in edge_runs if run >= 3)
    center_runs = _run_lengths(centered_flags)
    longest_center_bout_sec = (max(center_runs, default=0) / max(settings.mediapipe_sample_fps, 1))
    organized_bout_sec = (
        sum(
            1
            for flag, delta in zip(centered_flags[1:], movement_deltas or [0.0] * max(len(centered_flags) - 1, 0))
            if flag and delta <= 0.025
        )
        / max(settings.mediapipe_sample_fps, 1)
    )
    high_activation_flags = [delta > 0.065 for delta in movement_deltas]
    high_activation_episode_count = sum(1 for run in _run_lengths(high_activation_flags) if run >= 2)
    escalation_intensity = _clip((mean_delta * 3.5) + (delta_std * 5))
    recovery_latency_sec = round(
        max(3.0, (high_activation_episode_count * 4.0) + (mean_delta * 40.0)),
        2,
    )
    reengagement_success = _clip(centered_ratio * 0.85 + pose_ratio * 0.15)
    segment_abort_flag = 1.0 if pose_ratio < 0.35 else 0.0
    visibility_factor = segment_quality.get("child_visibility_ratio") if isinstance(segment_quality, dict) else None
    visibility_value = pose_ratio if visibility_factor is None else float(visibility_factor)
    base_confidence = _clip(mean([overall_quality, pose_ratio, face_ratio or pose_ratio, visibility_value]))

    raw_values: dict[str, float] = {}
    if segment_type == "solo":
        raw_values = {
            "engaged_play_ratio": _clip(centered_ratio * 0.55 + pose_ratio * 0.45),
            "disengagement_count": float(sum(1 for run in _run_lengths([not flag for flag in centered_flags]) if run >= 3)),
            "self_reengagement_ratio": _clip(1.0 - (mean_delta * 2.3) + (centered_ratio * 0.25)),
            "center_orientation_ratio": _clip(centered_ratio),
            "long_uninterrupted_play_bout_sec": round(longest_center_bout_sec, 2),
            "abrupt_switching_rate": _clip((sum(1 for delta in movement_deltas if delta > 0.075) / max(len(movement_deltas), 1))),
            "movement_variability": _clip((mean_delta * 3.2) + (delta_std * 4.0)),
            "organized_play_bout_length_sec": round(max(10.0, organized_bout_sec), 2),
            "repeated_retreat_count": float(repeated_retreat_count),
        }
    elif segment_type == "dyadic":
        caregiver_ratio = _clip(max(multi_face_ratio, face_ratio * 0.55))
        raw_values = {
            "caregiver_orientation_ratio": caregiver_ratio,
            "joint_engagement_ratio": _clip(caregiver_ratio * 0.65 + centered_ratio * 0.35),
            "contingent_response_pairing": _clip(caregiver_ratio * 0.60 + pose_ratio * 0.25 + centered_ratio * 0.15),
            "support_after_recovery_ratio": _clip(0.50 + caregiver_ratio * 0.35 + centered_ratio * 0.15),
        }
    elif segment_type == "transition":
        adult_support_needed = _clip(1.0 - max(multi_face_ratio, 0.15))
        raw_values = {
            "high_activation_episode_count": float(high_activation_episode_count),
            "escalation_intensity": escalation_intensity,
            "recovery_latency_sec": recovery_latency_sec,
            "reengagement_success": reengagement_success,
            "adult_support_needed": adult_support_needed,
            "segment_abort_flag": segment_abort_flag,
        }

    units_map = {name: DEFAULT_SEGMENT_FEATURES[segment_type][name][1] for name in raw_values}
    return [
        DerivedSignal(
            name=name,
            value=round(float(value), 4),
            units=units_map[name],
            confidence=round(_clip(base_confidence - (0.10 if "count" in units_map[name] else 0.0), 0.35, 0.96), 3),
            provenance={},
        )
        for name, value in raw_values.items()
    ]


class FallbackBehaviorSignalExtractor:
    version = "fallback_behavior_extractor_v1"

    def extract(
        self,
        segment_type: str,
        signal_hints: dict[str, Any],
        overall_quality: float,
        media_path: str | None = None,
        segment_quality: dict[str, Any] | None = None,
    ) -> list[DerivedSignal]:
        defaults = DEFAULT_SEGMENT_FEATURES[segment_type]
        provided_keys = set(signal_hints.keys())
        if not defaults:
            return []
        hint_ratio = min(len(provided_keys.intersection(defaults)) / max(len(defaults), 1), 1.0)
        base_confidence = min(0.95, max(0.45, overall_quality * (0.70 + 0.30 * hint_ratio)))

        signals: list[DerivedSignal] = []
        for name, (default_value, units) in defaults.items():
            raw_value = signal_hints.get(name, default_value)
            value = _float_or(raw_value, float(default_value))
            provenance = {
                "source": "manual_signal_hint" if name in signal_hints else "fallback_default",
                "segment_type": segment_type,
                "extractor_version": self.version,
            }
            signals.append(
                DerivedSignal(
                    name=name,
                    value=value,
                    units=units,
                    confidence=round(base_confidence if name in signal_hints else base_confidence - 0.12, 3),
                    provenance=provenance,
                )
            )
        return signals


class MediaPipeBehaviorSignalExtractor:
    version = "mediapipe_behavior_extractor_v2"

    def __init__(self, sample_fps: float | None = None, max_frames: int | None = None) -> None:
        self.sample_fps = sample_fps or settings.mediapipe_sample_fps
        self.max_frames = max_frames or settings.mediapipe_max_frames

    @staticmethod
    def is_available() -> bool:
        try:
            import cv2  # noqa: F401
        except ImportError:
            return False
        return _load_mediapipe_solution_apis() is not None or _load_mediapipe_task_apis() is not None

    def _extract_with_opencv_motion(
        self,
        *,
        media_path: str,
    ) -> tuple[int, int, int, int, list[bool], list[bool], list[float], str]:
        import cv2  # type: ignore[import-not-found]

        capture = cv2.VideoCapture(media_path)
        if not capture.isOpened():
            return 0, 0, 0, 0, [], [], [], "opencv_face_motion_fallback"

        fps = capture.get(cv2.CAP_PROP_FPS) or 25.0
        sample_every = max(1, int(round(fps / max(self.sample_fps, 1))))
        frame_index = 0
        processed_frames = 0

        pose_visible_frames = 0
        face_visible_frames = 0
        multi_face_frames = 0
        centered_flags: list[bool] = []
        edge_flags: list[bool] = []
        movement_deltas: list[float] = []
        previous_anchor: tuple[float, float] | None = None
        previous_gray = None

        face_cascade_path = Path(cv2.data.haarcascades) / "haarcascade_frontalface_default.xml"
        face_cascade = cv2.CascadeClassifier(str(face_cascade_path))

        try:
            while processed_frames < self.max_frames:
                ok, frame = capture.read()
                if not ok:
                    break
                frame_index += 1
                if frame_index % sample_every != 0:
                    continue
                processed_frames += 1

                frame_height, frame_width = frame.shape[:2]
                gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
                blurred = cv2.GaussianBlur(gray, (9, 9), 0)
                faces = face_cascade.detectMultiScale(
                    blurred,
                    scaleFactor=1.1,
                    minNeighbors=4,
                    minSize=(24, 24),
                )

                current_anchor: tuple[float, float] | None = None
                if len(faces) > 0:
                    face_visible_frames += 1
                    pose_visible_frames += 1
                    if len(faces) >= 2:
                        multi_face_frames += 1
                    x, y, w, h = max(faces, key=lambda rect: rect[2] * rect[3])
                    current_anchor = ((x + (w / 2)) / frame_width, (y + (h / 2)) / frame_height)
                elif previous_gray is not None:
                    diff = cv2.absdiff(blurred, previous_gray)
                    _, threshold = cv2.threshold(diff, 18, 255, cv2.THRESH_BINARY)
                    threshold = cv2.medianBlur(threshold, 5)
                    contours, _ = cv2.findContours(threshold, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
                    min_motion_area = max(40.0, (frame_width * frame_height) * 0.002)
                    motion_contours = [contour for contour in contours if cv2.contourArea(contour) >= min_motion_area]
                    if motion_contours:
                        largest = max(motion_contours, key=cv2.contourArea)
                        moments = cv2.moments(largest)
                        if moments.get("m00", 0.0):
                            pose_visible_frames += 1
                            current_anchor = (
                                float(moments["m10"] / moments["m00"] / frame_width),
                                float(moments["m01"] / moments["m00"] / frame_height),
                            )

                if current_anchor is not None:
                    anchor_x, anchor_y = current_anchor
                    centered_flags.append(0.25 <= anchor_x <= 0.75)
                    edge_flags.append(anchor_x <= 0.12 or anchor_x >= 0.88 or anchor_y <= 0.12 or anchor_y >= 0.88)
                    if previous_anchor is not None:
                        movement_deltas.append(
                            sqrt((anchor_x - previous_anchor[0]) ** 2 + (anchor_y - previous_anchor[1]) ** 2)
                        )
                    previous_anchor = current_anchor
                else:
                    centered_flags.append(False)
                    edge_flags.append(True)
                    previous_anchor = None

                previous_gray = blurred
        finally:
            capture.release()

        return (
            processed_frames,
            pose_visible_frames,
            face_visible_frames,
            multi_face_frames,
            centered_flags,
            edge_flags,
            movement_deltas,
            "opencv_face_motion_fallback",
        )

    def extract(
        self,
        segment_type: str,
        signal_hints: dict[str, Any],
        overall_quality: float,
        media_path: str | None = None,
        segment_quality: dict[str, Any] | None = None,
    ) -> list[DerivedSignal]:
        if not media_path or not self.is_available():
            return []

        import cv2  # type: ignore[import-not-found]
        processed_frames = 0

        pose_visible_frames = 0
        face_visible_frames = 0
        multi_face_frames = 0
        centered_flags: list[bool] = []
        edge_flags: list[bool] = []
        movement_deltas: list[float] = []
        solution_apis = _load_mediapipe_solution_apis()
        task_apis = _load_mediapipe_task_apis()
        runtime_label = "mediapipe_unavailable"
        provenance_source = "mediapipe_pose_face"
        task_runtime_error: str | None = None
        if task_apis is not None and _TASK_RUNTIME_STATE["status"] == "unsupported":
            task_runtime_error = _TASK_RUNTIME_STATE["error"]
        try:
            if task_apis is not None and _TASK_RUNTIME_STATE["status"] != "unsupported":
                runtime_label = "mediapipe_tasks_pose_face_landmarker"
                mp = task_apis["mp"]
                BaseOptions = task_apis["BaseOptions"]
                FaceLandmarker = task_apis["FaceLandmarker"]
                FaceLandmarkerOptions = task_apis["FaceLandmarkerOptions"]
                PoseLandmarker = task_apis["PoseLandmarker"]
                PoseLandmarkerOptions = task_apis["PoseLandmarkerOptions"]
                RunningMode = task_apis["RunningMode"]
                cpu_delegate = getattr(BaseOptions, "Delegate", None)
                base_options_kwargs = {
                    "model_asset_path": settings.mediapipe_pose_model_path,
                }
                face_base_options_kwargs = {
                    "model_asset_path": settings.mediapipe_face_model_path,
                }
                if cpu_delegate is not None and hasattr(cpu_delegate, "CPU"):
                    base_options_kwargs["delegate"] = cpu_delegate.CPU
                    face_base_options_kwargs["delegate"] = cpu_delegate.CPU
                pose_options = PoseLandmarkerOptions(
                    base_options=BaseOptions(**base_options_kwargs),
                    running_mode=RunningMode.IMAGE,
                    num_poses=1,
                    min_pose_detection_confidence=0.45,
                    min_pose_presence_confidence=0.45,
                    min_tracking_confidence=0.45,
                )
                face_options = FaceLandmarkerOptions(
                    base_options=BaseOptions(**face_base_options_kwargs),
                    running_mode=RunningMode.IMAGE,
                    num_faces=2,
                    output_face_blendshapes=False,
                    output_facial_transformation_matrixes=True,
                )
                capture = cv2.VideoCapture(media_path)
                if not capture.isOpened():
                    return []
                fps = capture.get(cv2.CAP_PROP_FPS) or 25.0
                sample_every = max(1, int(round(fps / max(self.sample_fps, 1))))
                frame_index = 0
                previous_nose: tuple[float, float] | None = None
                try:
                    with PoseLandmarker.create_from_options(pose_options) as pose_landmarker, FaceLandmarker.create_from_options(face_options) as face_landmarker:
                        while processed_frames < self.max_frames:
                            ok, frame = capture.read()
                            if not ok:
                                break
                            frame_index += 1
                            if frame_index % sample_every != 0:
                                continue
                            processed_frames += 1
                            rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                            image = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb)
                            pose_result = pose_landmarker.detect(image)
                            face_result = face_landmarker.detect(image)
                            face_landmarks = list(face_result.face_landmarks or [])
                            if face_landmarks:
                                face_visible_frames += 1
                                if len(face_landmarks) >= 2:
                                    multi_face_frames += 1

                            current_anchor: tuple[float, float] | None = None
                            if pose_result.pose_landmarks:
                                pose_visible_frames += 1
                                nose = pose_result.pose_landmarks[0][0]
                                current_anchor = _normalized_pair(nose.x, nose.y)
                            elif face_landmarks:
                                current_anchor = _centroid_xy(face_landmarks[0])

                            if current_anchor is not None:
                                anchor_x, anchor_y = current_anchor
                                centered_flags.append(0.25 <= anchor_x <= 0.75)
                                edge_flags.append(
                                    anchor_x <= 0.12 or anchor_x >= 0.88 or anchor_y <= 0.12 or anchor_y >= 0.88
                                )
                                if previous_nose is not None:
                                    movement_deltas.append(
                                        sqrt((anchor_x - previous_nose[0]) ** 2 + (anchor_y - previous_nose[1]) ** 2)
                                    )
                                previous_nose = current_anchor
                            else:
                                centered_flags.append(False)
                                edge_flags.append(True)
                                previous_nose = None
                except RuntimeError as exc:
                    task_runtime_error = str(exc)
                    _TASK_RUNTIME_STATE["status"] = "unsupported"
                    _TASK_RUNTIME_STATE["error"] = task_runtime_error
                finally:
                    capture.release()
                if processed_frames > 0 and not task_runtime_error:
                    _TASK_RUNTIME_STATE["status"] = "available"
                    _TASK_RUNTIME_STATE["error"] = None
            elif solution_apis is not None:
                runtime_label = "mediapipe_solutions_pose_face_detection"
                _, pose_module, face_module = solution_apis
                pose = pose_module.Pose(
                    static_image_mode=False,
                    model_complexity=0,
                    enable_segmentation=False,
                    min_detection_confidence=0.5,
                    min_tracking_confidence=0.5,
                )
                face_detection = face_module.FaceDetection(model_selection=0, min_detection_confidence=0.5)
                capture = cv2.VideoCapture(media_path)
                if not capture.isOpened():
                    return []
                fps = capture.get(cv2.CAP_PROP_FPS) or 25.0
                sample_every = max(1, int(round(fps / max(self.sample_fps, 1))))
                frame_index = 0
                previous_nose: tuple[float, float] | None = None
                try:
                    while processed_frames < self.max_frames:
                        ok, frame = capture.read()
                        if not ok:
                            break
                        frame_index += 1
                        if frame_index % sample_every != 0:
                            continue
                        processed_frames += 1
                        rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                        pose_result = pose.process(rgb)
                        face_result = face_detection.process(rgb)
                        detections = list(face_result.detections or [])
                        if detections:
                            face_visible_frames += 1
                            if len(detections) >= 2:
                                multi_face_frames += 1
                        if pose_result.pose_landmarks:
                            pose_visible_frames += 1
                            nose = pose_result.pose_landmarks.landmark[pose_module.PoseLandmark.NOSE]
                            nose_x = float(nose.x)
                            nose_y = float(nose.y)
                            centered_flags.append(0.25 <= nose_x <= 0.75)
                            edge_flags.append(nose_x <= 0.12 or nose_x >= 0.88 or nose_y <= 0.12 or nose_y >= 0.88)
                            if previous_nose is not None:
                                movement_deltas.append(sqrt((nose_x - previous_nose[0]) ** 2 + (nose_y - previous_nose[1]) ** 2))
                            previous_nose = (nose_x, nose_y)
                        else:
                            centered_flags.append(False)
                            edge_flags.append(True)
                            previous_nose = None
                finally:
                    capture.release()
                    pose.close()
                    face_detection.close()
            else:
                return []
        except RuntimeError as exc:
            task_runtime_error = str(exc)
            _TASK_RUNTIME_STATE["status"] = "unsupported"
            _TASK_RUNTIME_STATE["error"] = task_runtime_error

        if processed_frames == 0 and (_TASK_RUNTIME_STATE["status"] == "unsupported" or task_runtime_error):
            (
                processed_frames,
                pose_visible_frames,
                face_visible_frames,
                multi_face_frames,
                centered_flags,
                edge_flags,
                movement_deltas,
                runtime_label,
            ) = self._extract_with_opencv_motion(media_path=media_path)
            provenance_source = runtime_label
            if not task_runtime_error and _TASK_RUNTIME_STATE["error"]:
                task_runtime_error = _TASK_RUNTIME_STATE["error"]

        signals = _build_signal_metrics(
            segment_type=segment_type,
            overall_quality=overall_quality,
            segment_quality=segment_quality,
            processed_frames=processed_frames,
            pose_visible_frames=pose_visible_frames,
            face_visible_frames=face_visible_frames,
            multi_face_frames=multi_face_frames,
            centered_flags=centered_flags,
            edge_flags=edge_flags,
            movement_deltas=movement_deltas,
        )
        for signal in signals:
            signal.provenance = {
                "source": provenance_source,
                "segment_type": segment_type,
                "media_path": media_path,
                "processed_frames": processed_frames,
                "sample_fps": self.sample_fps,
                "extractor_version": self.version,
                "mediapipe_runtime": runtime_label,
                "pose_model_path": settings.mediapipe_pose_model_path,
                "face_model_path": settings.mediapipe_face_model_path,
            }
            if task_runtime_error:
                signal.provenance["mediapipe_runtime_error"] = task_runtime_error
        return signals


def extract_segment_signals(
    segment_type: str,
    signal_hints: dict[str, Any],
    overall_quality: float,
    media_path: str | None,
    segment_quality: dict[str, Any] | None = None,
) -> tuple[list[DerivedSignal], str]:
    primary_signals: list[DerivedSignal] = []
    extractor_version = FallbackBehaviorSignalExtractor.version

    use_mediapipe = settings.extractor_backend in {"auto", "mediapipe"}
    if use_mediapipe:
        mediapipe_extractor = MediaPipeBehaviorSignalExtractor()
        primary_signals = mediapipe_extractor.extract(
            segment_type=segment_type,
            signal_hints=signal_hints,
            overall_quality=overall_quality,
            media_path=media_path,
            segment_quality=segment_quality,
        )
        if primary_signals:
            extractor_version = mediapipe_extractor.version

    defaults = DEFAULT_SEGMENT_FEATURES[segment_type]
    primary_map = {signal.name: signal for signal in primary_signals}
    fallback = FallbackBehaviorSignalExtractor()
    fallback_signals = fallback.extract(
        segment_type=segment_type,
        signal_hints=signal_hints,
        overall_quality=overall_quality,
        media_path=media_path,
        segment_quality=segment_quality,
    )
    fallback_map = {signal.name: signal for signal in fallback_signals}

    merged: list[DerivedSignal] = []
    for name in defaults:
        if name in primary_map:
            merged.append(primary_map[name])
        else:
            merged.append(fallback_map[name])
    return merged, extractor_version
