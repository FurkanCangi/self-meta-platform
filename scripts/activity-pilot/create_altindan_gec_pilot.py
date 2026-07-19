"""Create the local 3D pilot for "Altindan gec - ustunden as".

Run with Blender 4.5+ in background mode. The script deliberately builds the
scene from primitives so the pilot has no paid or remotely loaded runtime
assets. Outputs are written to PILOT_OUTPUT_DIR (ResearchSSD by default).
"""

from __future__ import annotations

import json
import math
import os
from pathlib import Path

import bpy
from mathutils import Vector


FPS = 30
FRAME_START = 1
FRAME_END = 360
OUTPUT_ROOT = Path(
    os.environ.get(
        "PILOT_OUTPUT_DIR",
        "/Volumes/ResearchSSD/selfmeta-activity-pilot/altindan-gec-ustunden-as",
    )
)
FRAMES_DIR = OUTPUT_ROOT / "frames"
STILLS_DIR = OUTPUT_ROOT / "stills"


PALETTE = {
    "navy": (0.035, 0.070, 0.145, 1.0),
    "ink": (0.020, 0.035, 0.070, 1.0),
    "cyan": (0.030, 0.690, 0.820, 1.0),
    "teal": (0.035, 0.430, 0.440, 1.0),
    "mint": (0.350, 0.900, 0.740, 1.0),
    "violet": (0.360, 0.250, 0.800, 1.0),
    "shirt": (0.300, 0.180, 0.720, 1.0),
    "amber": (0.960, 0.505, 0.180, 1.0),
    "coral": (0.930, 0.270, 0.230, 1.0),
    "cream": (0.965, 0.930, 0.820, 1.0),
    "skin": (0.680, 0.330, 0.175, 1.0),
    "skin_light": (0.820, 0.475, 0.275, 1.0),
    "hair": (0.035, 0.055, 0.095, 1.0),
    "white": (0.985, 0.990, 1.000, 1.0),
    "floor": (0.845, 0.900, 0.925, 1.0),
    "wall": (0.925, 0.955, 0.975, 1.0),
    "shadow": (0.080, 0.130, 0.180, 1.0),
}


def ensure_dirs() -> None:
    OUTPUT_ROOT.mkdir(parents=True, exist_ok=True)
    FRAMES_DIR.mkdir(parents=True, exist_ok=True)
    STILLS_DIR.mkdir(parents=True, exist_ok=True)


def clear_scene() -> None:
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for datablocks in (
        bpy.data.meshes,
        bpy.data.curves,
        bpy.data.materials,
        bpy.data.cameras,
        bpy.data.lights,
    ):
        for datablock in list(datablocks):
            if datablock.users == 0:
                datablocks.remove(datablock)


def material(name: str, color: tuple[float, float, float, float], roughness: float = 0.62):
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = color
    mat.use_nodes = True
    principled = mat.node_tree.nodes.get("Principled BSDF")
    principled.inputs["Base Color"].default_value = color
    principled.inputs["Roughness"].default_value = roughness
    principled.inputs["Specular IOR Level"].default_value = 0.28
    return mat


def emission_material(name: str, color: tuple[float, float, float, float], strength: float = 2.0):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    nodes.clear()
    out = nodes.new("ShaderNodeOutputMaterial")
    emission = nodes.new("ShaderNodeEmission")
    emission.inputs["Color"].default_value = color
    emission.inputs["Strength"].default_value = strength
    mat.node_tree.links.new(emission.outputs["Emission"], out.inputs["Surface"])
    return mat


def smooth_object(obj: bpy.types.Object) -> None:
    if obj.type == "MESH":
        for polygon in obj.data.polygons:
            polygon.use_smooth = True


def uv_sphere(name: str, mat, segments: int = 32, rings: int = 20) -> bpy.types.Object:
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments, ring_count=rings, radius=1.0)
    obj = bpy.context.object
    obj.name = name
    obj.data.materials.append(mat)
    smooth_object(obj)
    return obj


def rounded_box(name: str, location, scale, mat, bevel: float = 0.16) -> bpy.types.Object:
    bpy.ops.mesh.primitive_cube_add(location=location)
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    modifier = obj.modifiers.new("Soft rounded edges", "BEVEL")
    modifier.width = bevel
    modifier.segments = 5
    obj.data.materials.append(mat)
    smooth_object(obj)
    return obj


def cylinder_between(name: str, start: Vector, end: Vector, radius: float, mat) -> bpy.types.Object:
    direction = end - start
    length = direction.length
    bpy.ops.mesh.primitive_cylinder_add(vertices=32, radius=radius, depth=length, location=(start + end) / 2)
    obj = bpy.context.object
    obj.name = name
    obj.rotation_mode = "QUATERNION"
    obj.rotation_quaternion = direction.to_track_quat("Z", "Y")
    obj.data.materials.append(mat)
    bevel = obj.modifiers.new("Padded edge", "BEVEL")
    bevel.width = min(radius * 0.55, 0.09)
    bevel.segments = 4
    smooth_object(obj)
    return obj


def curve_tube(name: str, points: list[Vector], bevel_depth: float, mat) -> bpy.types.Object:
    curve = bpy.data.curves.new(name, type="CURVE")
    curve.dimensions = "3D"
    curve.resolution_u = 2
    curve.bevel_depth = bevel_depth
    curve.bevel_resolution = 5
    spline = curve.splines.new("BEZIER")
    spline.bezier_points.add(len(points) - 1)
    for point, coordinate in zip(spline.bezier_points, points):
        point.co = coordinate
        point.handle_left_type = "AUTO"
        point.handle_right_type = "AUTO"
    obj = bpy.data.objects.new(name, curve)
    bpy.context.collection.objects.link(obj)
    obj.data.materials.append(mat)
    return obj


def create_arch(name: str, x: float, mat) -> bpy.types.Object:
    points: list[Vector] = []
    for index in range(17):
        angle = math.pi - math.pi * index / 16
        y = 0.78 * math.cos(angle)
        z = 0.16 + 1.30 * math.sin(angle)
        points.append(Vector((x, y, z)))
    return curve_tube(name, points, 0.085, mat)


def create_scene_props(mats: dict[str, bpy.types.Material]) -> dict[str, bpy.types.Object]:
    # Floor, soft back wall and a low stage plinth create a clean clinical set.
    rounded_box("Floor", (0.0, 0.0, -0.12), (4.8, 2.7, 0.12), mats["floor"], 0.18)
    rounded_box("BackWall", (0.0, 2.52, 2.05), (4.8, 0.10, 2.15), mats["wall"], 0.20)

    # A padded tunnel with three hoops and longitudinal rails. It stays visually
    # open so posture and clearances remain inspectable throughout the clip.
    for index, x in enumerate((-1.35, -0.62, 0.12)):
        create_arch(f"TunnelHoop_{index}", x, mats["cyan"])
    cylinder_between("TunnelTopRail", Vector((-1.35, 0.0, 1.46)), Vector((0.12, 0.0, 1.46)), 0.075, mats["violet"])
    cylinder_between("TunnelNearRail", Vector((-1.35, -0.78, 0.16)), Vector((0.12, -0.78, 0.16)), 0.075, mats["violet"])
    cylinder_between("TunnelFarRail", Vector((-1.35, 0.78, 0.16)), Vector((0.12, 0.78, 0.16)), 0.075, mats["violet"])

    # Low foam line: deliberately below ankle height.
    foam = rounded_box("LowFoamLine", (1.38, 0.0, 0.105), (0.13, 0.88, 0.105), mats["amber"], 0.10)

    # Course markers make direction legible without relying on colour alone.
    for index, x in enumerate((-2.55, -2.10, 0.68, 0.98)):
        marker = rounded_box(f"RouteMarker_{index}", (x, 0.96, 0.015), (0.16, 0.08, 0.015), mats["mint"], 0.04)
        marker.rotation_euler[2] = math.radians(-8 if index % 2 else 8)

    # Finish target, with an animated glow ring.
    bpy.ops.mesh.primitive_torus_add(major_radius=0.40, minor_radius=0.045, major_segments=64, minor_segments=12, location=(2.35, 0.0, 0.035))
    finish_ring = bpy.context.object
    finish_ring.name = "FinishRing"
    finish_ring.data.materials.append(mats["finish_glow"])
    finish_ring.scale = (0.88, 1.0, 0.88)
    finish_ring.keyframe_insert("scale", frame=1)
    finish_ring.keyframe_insert("scale", frame=329)
    finish_ring.scale = (1.08, 1.22, 1.08)
    finish_ring.keyframe_insert("scale", frame=342)
    finish_ring.scale = (1.0, 1.12, 1.0)
    finish_ring.keyframe_insert("scale", frame=356)

    return {"foam": foam, "finish_ring": finish_ring}


def create_lighting(mats: dict[str, bpy.types.Material]) -> None:
    world = bpy.context.scene.world
    world.use_nodes = True
    background = world.node_tree.nodes.get("Background")
    background.inputs["Color"].default_value = (0.78, 0.86, 0.92, 1.0)
    background.inputs["Strength"].default_value = 0.42

    def area(name: str, location, energy: float, size: float, color):
        data = bpy.data.lights.new(name=name, type="AREA")
        data.energy = energy
        data.shape = "DISK"
        data.size = size
        data.color = color
        obj = bpy.data.objects.new(name, data)
        bpy.context.collection.objects.link(obj)
        obj.location = location
        direction = Vector((0.0, 0.0, 0.8)) - obj.location
        obj.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()

    area("KeyLight", (-3.8, -4.8, 6.8), 1050, 5.0, (0.93, 0.98, 1.0))
    area("FillLight", (4.5, -1.8, 4.0), 720, 4.0, (0.70, 0.88, 1.0))
    area("WarmRim", (1.0, 3.5, 4.8), 820, 3.0, (1.0, 0.62, 0.34))


def create_camera() -> bpy.types.Object:
    camera_data = bpy.data.cameras.new("PilotCamera")
    camera = bpy.data.objects.new("PilotCamera", camera_data)
    bpy.context.collection.objects.link(camera)
    camera.location = (5.15, -10.6, 4.65)
    target = Vector((-0.05, 0.0, 0.92))
    camera.rotation_euler = (target - camera.location).to_track_quat("-Z", "Y").to_euler()
    camera.data.type = "ORTHO"
    camera.data.ortho_scale = 6.45
    camera.data.lens = 52
    bpy.context.scene.camera = camera
    return camera


def create_character(mats: dict[str, bpy.types.Material]) -> dict[str, bpy.types.Object]:
    parts: dict[str, bpy.types.Object] = {}
    parts["torso"] = uv_sphere("Character_Torso", mats["shirt"])
    parts["hips"] = uv_sphere("Character_Hips", mats["pants"])
    parts["neck"] = uv_sphere("Character_Neck", mats["skin"])

    for side in ("L", "R"):
        parts[f"upper_arm_{side}"] = uv_sphere(f"Character_UpperArm_{side}", mats["shirt"])
        parts[f"lower_arm_{side}"] = uv_sphere(f"Character_LowerArm_{side}", mats["shirt"])
        parts[f"elbow_{side}"] = uv_sphere(f"Character_Elbow_{side}", mats["shirt"])
        parts[f"hand_{side}"] = uv_sphere(f"Character_Hand_{side}", mats["skin"])
        parts[f"upper_leg_{side}"] = uv_sphere(f"Character_UpperLeg_{side}", mats["pants"])
        parts[f"lower_leg_{side}"] = uv_sphere(f"Character_LowerLeg_{side}", mats["pants"])
        parts[f"knee_{side}"] = uv_sphere(f"Character_Knee_{side}", mats["pants"])
        parts[f"shoe_{side}"] = uv_sphere(f"Character_Shoe_{side}", mats["shoe"])
        parts[f"sole_{side}"] = uv_sphere(f"Character_Sole_{side}", mats["sole"])

    head_ctrl = bpy.data.objects.new("Character_HeadControl", None)
    bpy.context.collection.objects.link(head_ctrl)
    head_ctrl.rotation_mode = "QUATERNION"
    parts["head_ctrl"] = head_ctrl

    def child_sphere(name: str, local_location, local_scale, mat):
        obj = uv_sphere(name, mat, 32, 20)
        obj.parent = head_ctrl
        obj.location = local_location
        obj.scale = local_scale
        return obj

    child_sphere("Character_Head", (0.0, 0.0, 0.0), (0.285, 0.255, 0.310), mats["skin"])
    child_sphere("Character_Ear_L", (-0.265, 0.0, 0.005), (0.055, 0.035, 0.075), mats["skin_light"])
    child_sphere("Character_Ear_R", (0.265, 0.0, 0.005), (0.055, 0.035, 0.075), mats["skin_light"])
    for x in (-0.090, 0.090):
        child_sphere(f"Character_Eye_{x}", (x, -0.235, 0.055), (0.052, 0.020, 0.066), mats["white"])
        child_sphere(f"Character_Pupil_{x}", (x, -0.253, 0.055), (0.023, 0.012, 0.030), mats["ink"])
        child_sphere(f"Character_EyeSpark_{x}", (x - 0.008, -0.264, 0.068), (0.007, 0.005, 0.009), mats["white"])
    child_sphere("Character_Nose", (0.0, -0.260, -0.010), (0.032, 0.024, 0.037), mats["skin_light"])
    child_sphere("Character_Cheek_L", (-0.155, -0.236, -0.035), (0.042, 0.012, 0.030), mats["cheek"])
    child_sphere("Character_Cheek_R", (0.155, -0.236, -0.035), (0.042, 0.012, 0.030), mats["cheek"])

    mouth_points = [
        Vector((-0.075, -0.258, -0.080)),
        Vector((0.0, -0.270, -0.105)),
        Vector((0.075, -0.258, -0.080)),
    ]
    mouth = curve_tube("Character_Smile", mouth_points, 0.009, mats["ink"])
    mouth.parent = head_ctrl

    # Layered hair volumes read as a designed haircut rather than a helmet.
    child_sphere("Character_HairBack", (0.0, 0.025, 0.150), (0.295, 0.260, 0.205), mats["hair"])
    for index, (x, y, z, sx, sy, sz) in enumerate(
        (
            (-0.15, -0.13, 0.22, 0.14, 0.09, 0.09),
            (0.00, -0.16, 0.24, 0.16, 0.08, 0.08),
            (0.14, -0.12, 0.20, 0.12, 0.08, 0.10),
            (-0.23, -0.01, 0.13, 0.09, 0.08, 0.13),
        )
    ):
        child_sphere(f"Character_HairLock_{index}", (x, y, z), (sx, sy, sz), mats["hair"])

    return parts


def smoothstep(value: float) -> float:
    value = max(0.0, min(1.0, value))
    return value * value * (3.0 - 2.0 * value)


def stand_pose(root_x: float, bob: float = 0.0, balance: float = 0.0) -> dict[str, Vector]:
    pelvis = Vector((root_x, 0.0, 1.02 + bob))
    shoulder = Vector((root_x + 0.015, 0.0, 1.57 + bob))
    pose: dict[str, Vector] = {
        "pelvis": pelvis,
        "shoulder": shoulder,
        "head": Vector((root_x + 0.055, -0.015, 1.98 + bob)),
        "head_forward": Vector((1.0, -0.42, -0.02)),
    }
    for side, sign in (("L", -1.0), ("R", 1.0)):
        pose[f"shoulder_{side}"] = shoulder + Vector((0.0, 0.225 * sign, 0.0))
        pose[f"hip_{side}"] = pelvis + Vector((0.0, 0.155 * sign, -0.03))
        if balance:
            pose[f"elbow_{side}"] = Vector((root_x + 0.02, 0.43 * sign, 1.43 + bob))
            pose[f"wrist_{side}"] = Vector((root_x + 0.06, 0.69 * sign, 1.28 + bob))
        else:
            pose[f"elbow_{side}"] = Vector((root_x - 0.015, 0.25 * sign, 1.25 + bob))
            pose[f"wrist_{side}"] = Vector((root_x + 0.035, 0.245 * sign, 0.94 + bob))
        pose[f"knee_{side}"] = Vector((root_x + (0.025 if side == "L" else -0.025), 0.155 * sign, 0.57 + bob))
        pose[f"ankle_{side}"] = Vector((root_x + (0.040 if side == "L" else -0.040), 0.155 * sign, 0.155 + bob))
        pose[f"foot_{side}"] = Vector((root_x + 0.145 + (0.04 if side == "L" else -0.04), 0.155 * sign, 0.10 + bob))
    return pose


def gait_target(root_x: float, phase: float, front: float, stride: float, ground_z: float, lift: float) -> tuple[float, float]:
    phase %= 1.0
    stance = 0.62
    if phase < stance:
        return root_x + front - stride * phase, ground_z
    u = (phase - stance) / (1.0 - stance)
    back = front - stride * stance
    x = root_x + back + stride * stance * smoothstep(u)
    z = ground_z + lift * math.sin(math.pi * u)
    return x, z


def crawl_pose(root_x: float, phase: float) -> dict[str, Vector]:
    shoulder = Vector((root_x + 0.20, 0.0, 0.79))
    pelvis = Vector((root_x - 0.18, 0.0, 0.59))
    pose: dict[str, Vector] = {
        "pelvis": pelvis,
        "shoulder": shoulder,
        "head": Vector((root_x + 0.52, -0.035, 1.005)),
        "head_forward": Vector((1.0, -0.24, -0.10)),
    }
    phases = {"L": phase, "R": phase + 0.5}
    for side, sign in (("L", -1.0), ("R", 1.0)):
        pose[f"shoulder_{side}"] = shoulder + Vector((0.0, 0.225 * sign, 0.0))
        pose[f"hip_{side}"] = pelvis + Vector((0.0, 0.155 * sign, -0.01))

        wrist_x, wrist_z = gait_target(root_x, phases[side], 0.63, 0.68, 0.155, 0.11)
        pose[f"wrist_{side}"] = Vector((wrist_x, 0.275 * sign, wrist_z))
        shoulder_joint = pose[f"shoulder_{side}"]
        wrist = pose[f"wrist_{side}"]
        pose[f"elbow_{side}"] = Vector(
            (
                (shoulder_joint.x + wrist.x) * 0.48 - 0.035,
                0.285 * sign,
                max(0.39, (shoulder_joint.z + wrist.z) * 0.46),
            )
        )

        knee_phase = phases["R" if side == "L" else "L"]
        knee_x, knee_z = gait_target(root_x, knee_phase, 0.02, 0.60, 0.205, 0.10)
        pose[f"knee_{side}"] = Vector((knee_x, 0.17 * sign, knee_z))
        pose[f"ankle_{side}"] = Vector((knee_x - 0.36, 0.17 * sign, 0.145 + max(0.0, knee_z - 0.205) * 0.55))
        pose[f"foot_{side}"] = Vector((knee_x - 0.22, 0.17 * sign, 0.105 + max(0.0, knee_z - 0.205) * 0.45))
    return pose


def blend_pose(a: dict[str, Vector], b: dict[str, Vector], amount: float) -> dict[str, Vector]:
    amount = smoothstep(amount)
    result = {}
    for key in a:
        value = a[key].lerp(b[key], amount)
        if key == "head_forward":
            value.normalize()
        result[key] = value
    return result


def override_leg(pose: dict[str, Vector], side: str, knee, ankle, foot) -> dict[str, Vector]:
    pose = {key: value.copy() for key, value in pose.items()}
    pose[f"knee_{side}"] = Vector(knee)
    pose[f"ankle_{side}"] = Vector(ankle)
    pose[f"foot_{side}"] = Vector(foot)
    return pose


def step_key_poses() -> list[tuple[int, dict[str, Vector]]]:
    ready = stand_pose(0.98, balance=0.35)

    left_up = stand_pose(1.14, bob=0.035, balance=1.0)
    left_up = override_leg(left_up, "L", (1.40, -0.16, 0.91), (1.58, -0.16, 0.43), (1.66, -0.18, 0.28))
    left_up = override_leg(left_up, "R", (1.00, 0.16, 0.57), (0.98, 0.16, 0.155), (1.08, 0.16, 0.10))

    left_land = stand_pose(1.34, bob=0.02, balance=0.80)
    left_land = override_leg(left_land, "L", (1.55, -0.16, 0.57), (1.72, -0.16, 0.155), (1.82, -0.18, 0.10))
    left_land = override_leg(left_land, "R", (1.08, 0.16, 0.57), (1.00, 0.16, 0.155), (1.10, 0.16, 0.10))

    right_up = stand_pose(1.56, bob=0.04, balance=1.0)
    right_up = override_leg(right_up, "L", (1.64, -0.16, 0.57), (1.72, -0.16, 0.155), (1.82, -0.18, 0.10))
    right_up = override_leg(right_up, "R", (1.67, 0.16, 0.91), (1.84, 0.16, 0.42), (1.92, 0.18, 0.27))

    right_land = stand_pose(1.86, bob=0.015, balance=0.58)
    right_land = override_leg(right_land, "L", (1.74, -0.16, 0.57), (1.72, -0.16, 0.155), (1.82, -0.18, 0.10))
    right_land = override_leg(right_land, "R", (1.92, 0.16, 0.57), (2.04, 0.16, 0.155), (2.14, 0.18, 0.10))

    finish = stand_pose(2.20, balance=0.10)
    finish["head_forward"] = Vector((1.0, -0.72, 0.0)).normalized()
    return [(270, ready), (288, left_up), (303, left_land), (318, right_up), (333, right_land), (348, finish)]


STEP_POSES = step_key_poses()


def interpolate_pose_keys(frame: int, keys: list[tuple[int, dict[str, Vector]]]) -> dict[str, Vector]:
    if frame <= keys[0][0]:
        return keys[0][1]
    if frame >= keys[-1][0]:
        return keys[-1][1]
    for (frame_a, pose_a), (frame_b, pose_b) in zip(keys, keys[1:]):
        if frame_a <= frame <= frame_b:
            return blend_pose(pose_a, pose_b, (frame - frame_a) / (frame_b - frame_a))
    return keys[-1][1]


def pose_at(frame: int) -> dict[str, Vector]:
    if frame <= 30:
        bob = 0.012 * math.sin((frame - 1) / 29 * math.pi)
        return stand_pose(-2.48, bob=bob)
    if frame <= 82:
        amount = (frame - 30) / 52
        stand = stand_pose(-2.48 + 0.30 * smoothstep(amount))
        crawl = crawl_pose(-1.84, 0.02)
        return blend_pose(stand, crawl, amount)
    if frame <= 210:
        amount = (frame - 82) / 128
        root_x = -1.84 + 2.42 * smoothstep(amount)
        phase = amount * 3.55
        return crawl_pose(root_x, phase)
    if frame <= 258:
        amount = (frame - 210) / 48
        crawl = crawl_pose(0.58, 3.55)
        stand = stand_pose(0.95)
        return blend_pose(crawl, stand, amount)
    if frame <= 270:
        return stand_pose(0.95 + 0.03 * smoothstep((frame - 258) / 12), balance=0.35)
    if frame <= 348:
        return interpolate_pose_keys(frame, STEP_POSES)
    settle = smoothstep((frame - 348) / 12)
    return stand_pose(2.20, bob=0.008 * math.sin(settle * math.pi), balance=0.10 * (1.0 - settle))


def set_segment(obj: bpy.types.Object, start: Vector, end: Vector, radius_xy: tuple[float, float], frame: int) -> None:
    direction = end - start
    obj.location = (start + end) / 2
    obj.rotation_mode = "QUATERNION"
    obj.rotation_quaternion = direction.to_track_quat("Z", "Y")
    obj.scale = (radius_xy[0], radius_xy[1], max(direction.length / 2, 0.01))
    obj.keyframe_insert("location", frame=frame)
    obj.keyframe_insert("rotation_quaternion", frame=frame)
    obj.keyframe_insert("scale", frame=frame)


def set_blob(obj: bpy.types.Object, center: Vector, scale: tuple[float, float, float], frame: int, forward: Vector | None = None) -> None:
    obj.location = center
    obj.scale = scale
    obj.rotation_mode = "QUATERNION"
    if forward is not None:
        obj.rotation_quaternion = forward.to_track_quat("X", "Z")
    obj.keyframe_insert("location", frame=frame)
    obj.keyframe_insert("rotation_quaternion", frame=frame)
    obj.keyframe_insert("scale", frame=frame)


def animate_character(parts: dict[str, bpy.types.Object]) -> None:
    keyframes = list(range(FRAME_START, FRAME_END + 1, 2))
    if keyframes[-1] != FRAME_END:
        keyframes.append(FRAME_END)

    for frame in keyframes:
        pose = pose_at(frame)
        set_segment(parts["torso"], pose["pelvis"] + Vector((0, 0, 0.08)), pose["shoulder"], (0.285, 0.245), frame)
        set_blob(parts["hips"], pose["pelvis"], (0.26, 0.245, 0.20), frame)
        set_blob(parts["neck"], pose["shoulder"] + Vector((0.02, 0, 0.20)), (0.105, 0.095, 0.14), frame)

        head_ctrl = parts["head_ctrl"]
        head_ctrl.location = pose["head"]
        head_ctrl.rotation_mode = "QUATERNION"
        head_ctrl.rotation_quaternion = pose["head_forward"].to_track_quat("-Y", "Z")
        head_ctrl.keyframe_insert("location", frame=frame)
        head_ctrl.keyframe_insert("rotation_quaternion", frame=frame)

        for side in ("L", "R"):
            set_segment(parts[f"upper_arm_{side}"], pose[f"shoulder_{side}"], pose[f"elbow_{side}"], (0.105, 0.10), frame)
            set_segment(parts[f"lower_arm_{side}"], pose[f"elbow_{side}"], pose[f"wrist_{side}"], (0.09, 0.085), frame)
            set_blob(parts[f"elbow_{side}"], pose[f"elbow_{side}"], (0.105, 0.10, 0.10), frame)
            set_blob(parts[f"hand_{side}"], pose[f"wrist_{side}"], (0.115, 0.095, 0.075), frame, Vector((1, 0, 0)))

            set_segment(parts[f"upper_leg_{side}"], pose[f"hip_{side}"], pose[f"knee_{side}"], (0.135, 0.125), frame)
            set_segment(parts[f"lower_leg_{side}"], pose[f"knee_{side}"], pose[f"ankle_{side}"], (0.115, 0.105), frame)
            set_blob(parts[f"knee_{side}"], pose[f"knee_{side}"], (0.14, 0.125, 0.12), frame)
            foot_forward = Vector((1.0, 0.0, 0.02))
            set_blob(parts[f"shoe_{side}"], pose[f"foot_{side}"], (0.205, 0.125, 0.105), frame, foot_forward)
            sole_center = pose[f"foot_{side}"] + Vector((0.02, 0, -0.055))
            set_blob(parts[f"sole_{side}"], sole_center, (0.21, 0.13, 0.035), frame, foot_forward)

    for obj in parts.values():
        if obj.animation_data and obj.animation_data.action:
            for fcurve in obj.animation_data.action.fcurves:
                for point in fcurve.keyframe_points:
                    point.interpolation = "BEZIER"
                    point.handle_left_type = "AUTO_CLAMPED"
                    point.handle_right_type = "AUTO_CLAMPED"


def configure_render() -> None:
    scene = bpy.context.scene
    scene.frame_start = FRAME_START
    scene.frame_end = FRAME_END
    scene.render.engine = "BLENDER_EEVEE_NEXT"
    scene.render.resolution_x = 1280
    scene.render.resolution_y = 720
    scene.render.resolution_percentage = int(os.environ.get("PILOT_RESOLUTION_PERCENT", "100"))
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    scene.render.filepath = str(FRAMES_DIR / "frame_")
    scene.render.fps = FPS
    scene.render.film_transparent = False
    scene.render.image_settings.color_depth = "8"
    scene.render.use_file_extension = True
    scene.render.use_overwrite = True
    scene.render.use_placeholder = False
    scene.render.filter_size = 1.5
    scene.render.engine = "BLENDER_EEVEE_NEXT"
    try:
        scene.view_settings.look = "AgX - Medium High Contrast"
    except TypeError:
        pass


def effective_render_resolution(scene: bpy.types.Scene) -> list[int]:
    render_result = bpy.data.images.get("Render Result")
    if render_result and all(render_result.size):
        return [int(render_result.size[0]), int(render_result.size[1])]
    scale = scene.render.resolution_percentage / 100.0
    return [
        round(scene.render.resolution_x * scale),
        round(scene.render.resolution_y * scale),
    ]


def write_manifest(
    scene: bpy.types.Scene,
    blend_path: Path,
    render_mode: str,
    rendered_files: list[Path],
) -> None:
    missing_files = [path for path in rendered_files if not path.is_file()]
    if not blend_path.is_file() or missing_files:
        missing = [str(path) for path in missing_files]
        if not blend_path.is_file():
            missing.insert(0, str(blend_path))
        raise RuntimeError(f"Pilot outputs missing after render: {missing}")

    effective_resolution = effective_render_resolution(scene)
    image_output = {
        "kind": "animation_png_sequence" if render_mode == "animation_frames" else "qa_png_stills",
        "directory": str(FRAMES_DIR if render_mode == "animation_frames" else STILLS_DIR),
        "count": len(rendered_files),
        "first": str(rendered_files[0]),
        "last": str(rendered_files[-1]),
    }
    manifest = {
        "schemaVersion": "activity-pilot-manifest@2",
        "id": "altindan-gec-ustunden-as-pilot-v1",
        "title": "Altından geç – üstünden aş",
        "status": "local-pilot-clinical-review-required",
        "durationSeconds": FRAME_END / FPS,
        "resolution": effective_resolution,
        "fps": FPS,
        "renderConfiguration": {
            "baseResolution": [scene.render.resolution_x, scene.render.resolution_y],
            "resolutionPercentage": scene.render.resolution_percentage,
            "effectiveResolution": effective_resolution,
            "frameStart": FRAME_START,
            "frameEnd": FRAME_END,
        },
        "production": {
            "renderer": "Blender 4.5 LTS / Eevee",
            "runtimeAI": False,
            "paidAssets": False,
            "externalMediaAssets": False,
            "character": "procedural original stylized 3D child",
            "motion": "deterministic hand-authored joint trajectories with grounded contacts",
        },
        "content": {
            "instruction": "Yumuşak tünelin altından kontrollü biçimde geç; çok alçak köpük çizgisinin üzerinden tek adımla aş ve bitişte dengeli biçimde dur.",
            "stopConditions": "Ağrı, baş dönmesi, nefes güçlüğü, korku veya denge kaybında durdur.",
            "supervision": "Sürekli yetişkin gözetimi gerektirir.",
        },
        "qaFrames": [1, 60, 120, 180, 240, 300, 360],
        "generatedOutputs": {
            "generatedByThisRun": True,
            "renderMode": render_mode,
            "blend": str(blend_path),
            "images": image_output,
        },
        "videoPostprocess": {
            "generatedByThisScript": False,
            "status": "external_ffmpeg_step_required",
            "preview": {
                "purpose": "low_resolution_review_only",
                "suggestedPath": str(OUTPUT_ROOT / "preview-360p.mp4"),
            },
            "final": {
                "purpose": "delivery_output",
                "suggestedMp4Path": str(OUTPUT_ROOT / "altindan-gec-ustunden-as-pilot.mp4"),
                "suggestedWebmPath": str(OUTPUT_ROOT / "altindan-gec-ustunden-as-pilot.webm"),
            },
        },
    }
    (OUTPUT_ROOT / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def main() -> None:
    ensure_dirs()
    clear_scene()

    mats = {
        "navy": material("Navy", PALETTE["navy"]),
        "ink": material("Ink", PALETTE["ink"], 0.48),
        "cyan": material("Cyan padding", PALETTE["cyan"], 0.52),
        "teal": material("Teal", PALETTE["teal"]),
        "mint": material("Mint route markers", PALETTE["mint"], 0.54),
        "violet": material("Violet padding", PALETTE["violet"], 0.54),
        "amber": material("Low foam amber", PALETTE["amber"], 0.67),
        "shirt": material("Violet activity shirt", PALETTE["shirt"], 0.72),
        "pants": material("Deep teal trousers", PALETTE["teal"], 0.76),
        "shoe": material("Cream shoes", PALETTE["cream"], 0.64),
        "sole": material("Navy soles", PALETTE["navy"], 0.76),
        "skin": material("Skin", PALETTE["skin"], 0.70),
        "skin_light": material("Skin highlight", PALETTE["skin_light"], 0.70),
        "hair": material("Hair", PALETTE["hair"], 0.76),
        "white": material("Eye white", PALETTE["white"], 0.40),
        "cheek": material("Cheeks", (0.85, 0.19, 0.15, 1.0), 0.70),
        "floor": material("Floor", PALETTE["floor"], 0.82),
        "wall": material("Wall", PALETTE["wall"], 0.86),
        "finish_glow": emission_material("Finish glow", PALETTE["mint"], 2.3),
    }

    create_scene_props(mats)
    create_lighting(mats)
    create_camera()
    parts = create_character(mats)
    animate_character(parts)
    configure_render()

    scene = bpy.context.scene
    scene.frame_set(FRAME_START)
    blend_path = OUTPUT_ROOT / "altindan-gec-ustunden-as-pilot.blend"
    bpy.ops.wm.save_as_mainfile(filepath=str(blend_path))

    if os.environ.get("PILOT_RENDER_ANIMATION", "0") == "1":
        bpy.ops.render.render(animation=True)
        rendered_files = [
            FRAMES_DIR / f"frame_{frame:04d}.png"
            for frame in range(FRAME_START, FRAME_END + 1)
        ]
        render_mode = "animation_frames"
    else:
        qa_frames = [1, 60, 120, 180, 240, 300, 360]
        rendered_files = []
        for frame in qa_frames:
            scene.frame_set(frame)
            still_path = STILLS_DIR / f"qa_{frame:03d}.png"
            scene.render.filepath = str(still_path)
            bpy.ops.render.render(write_still=True)
            rendered_files.append(still_path)
        render_mode = "qa_stills"

    write_manifest(scene, blend_path, render_mode, rendered_files)


if __name__ == "__main__":
    main()
