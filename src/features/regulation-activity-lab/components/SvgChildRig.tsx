import { memo, useId } from "react"
import type { ActivityCharacter, MotionTransform } from "../types"
import {
  getMotionOpacity,
  motionTransformToSvg,
  type MotionSnapshot,
} from "../timeline"
import styles from "./SvgChildRig.module.css"

const EMPTY_SNAPSHOT: MotionSnapshot = Object.freeze({})

interface SvgChildRigProps {
  character: ActivityCharacter
  transforms?: MotionSnapshot
}

function readTransform(
  transforms: MotionSnapshot,
  target: string
): MotionTransform | undefined {
  return transforms[target]
}

function SvgChildRigComponent({
  character,
  transforms = EMPTY_SNAPSHOT,
}: SvgChildRigProps) {
  const gradientId = `activity-shirt-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`
  const root = readTransform(transforms, "rig.root")
  const head = readTransform(transforms, "rig.head")
  const torso = readTransform(transforms, "rig.torso")
  const breath = readTransform(transforms, "rig.breath")
  const leftUpperArm = readTransform(transforms, "rig.arm.left.upper")
  const leftLowerArm = readTransform(transforms, "rig.arm.left.lower")
  const rightUpperArm = readTransform(transforms, "rig.arm.right.upper")
  const rightLowerArm = readTransform(transforms, "rig.arm.right.lower")
  const leftUpperLeg = readTransform(transforms, "rig.leg.left.upper")
  const leftLowerLeg = readTransform(transforms, "rig.leg.left.lower")
  const rightUpperLeg = readTransform(transforms, "rig.leg.right.upper")
  const rightLowerLeg = readTransform(transforms, "rig.leg.right.lower")

  return (
    <g aria-hidden="true" className={styles.rig}>
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#22d3ee" />
          <stop offset="0.55" stopColor="#2563eb" />
          <stop offset="1" stopColor="#7c3aed" />
        </linearGradient>
      </defs>

      <g transform="translate(640 418)">
        <g
          data-motion-target="rig.root"
          className={styles.motionNode}
          transform={motionTransformToSvg(root, 2)}
          opacity={getMotionOpacity(root)}
        >
          <ellipse className={styles.shadow} cx="0" cy="195" rx="106" ry="24" />

          <g transform="translate(0 -126)">
            <g
              data-motion-target="rig.breath"
              className={styles.motionNode}
              transform={motionTransformToSvg(breath, 2)}
              opacity={breath ? getMotionOpacity(breath) : 0}
            >
              <circle className={styles.breathHaloOuter} r="82" />
              <circle className={styles.breathHaloInner} r="52" />
            </g>
          </g>

          <g transform="translate(-38 15)">
            <g
              data-motion-target="rig.leg.left.upper"
              className={styles.motionNode}
              transform={motionTransformToSvg(leftUpperLeg, 2)}
              opacity={getMotionOpacity(leftUpperLeg)}
            >
              <rect className={styles.trouser} x="-20" y="-4" width="40" height="110" rx="20" />
              <circle className={styles.joint} cx="0" cy="96" r="18" />
              <g transform="translate(0 98)">
                <g
                  data-motion-target="rig.leg.left.lower"
                  className={styles.motionNode}
                  transform={motionTransformToSvg(leftLowerLeg, 2)}
                  opacity={getMotionOpacity(leftLowerLeg)}
                >
                  <rect className={styles.skin} x="-17" y="0" width="34" height="98" rx="17" />
                  <path className={styles.sock} d="M-17 67h34v33c0 10-8 18-18 18h-16z" />
                  <path className={styles.shoe} d="M-19 92h37c21 0 36 10 39 26H-21c-8 0-13-7-10-14z" />
                  <path className={styles.shoeAccent} d="M-8 104h39" />
                </g>
              </g>
            </g>
          </g>

          <g transform="translate(38 15)">
            <g
              data-motion-target="rig.leg.right.upper"
              className={styles.motionNode}
              transform={motionTransformToSvg(rightUpperLeg, 2)}
              opacity={getMotionOpacity(rightUpperLeg)}
            >
              <rect className={styles.trouserAlt} x="-20" y="-4" width="40" height="110" rx="20" />
              <circle className={styles.joint} cx="0" cy="96" r="18" />
              <g transform="translate(0 98)">
                <g
                  data-motion-target="rig.leg.right.lower"
                  className={styles.motionNode}
                  transform={motionTransformToSvg(rightLowerLeg, 2)}
                  opacity={getMotionOpacity(rightLowerLeg)}
                >
                  <rect className={styles.skin} x="-17" y="0" width="34" height="98" rx="17" />
                  <path className={styles.sock} d="M-17 67h34v33c0 10-8 18-18 18h-16z" />
                  <path className={styles.shoe} d="M-19 92h37c21 0 36 10 39 26H-21c-8 0-13-7-10-14z" />
                  <path className={styles.shoeAccent} d="M-8 104h39" />
                </g>
              </g>
            </g>
          </g>

          <g
            data-motion-target="rig.torso"
            className={styles.motionNode}
            transform={motionTransformToSvg(torso, 2)}
            opacity={getMotionOpacity(torso)}
          >
            <path
              className={styles.shirt}
              fill={`url(#${gradientId})`}
              d="M-72-167c11-17 30-27 51-29h42c21 2 40 12 51 29l-9 145c-2 22-20 39-42 39h-42c-22 0-40-17-42-39z"
            />
            <path className={styles.shirtHighlight} d="M-43-171c17-11 51-12 74-2" />
            <path className={styles.waistband} d="M-61-19h122l-5 34H-56z" />
          </g>

          <g transform="translate(-68 -151) rotate(8)">
            <g
              data-motion-target="rig.arm.left.upper"
              className={styles.motionNode}
              transform={motionTransformToSvg(leftUpperArm, 2)}
              opacity={getMotionOpacity(leftUpperArm)}
            >
              <rect className={styles.sleeve} x="-20" y="-10" width="40" height="54" rx="20" />
              <rect className={styles.skin} x="-17" y="27" width="34" height="88" rx="17" />
              <circle className={styles.joint} cx="0" cy="105" r="17" />
              <g transform="translate(0 106)">
                <g
                  data-motion-target="rig.arm.left.lower"
                  className={styles.motionNode}
                  transform={motionTransformToSvg(leftLowerArm, 2)}
                  opacity={getMotionOpacity(leftLowerArm)}
                >
                  <rect className={styles.skin} x="-15" y="0" width="30" height="82" rx="15" />
                  <circle className={styles.hand} cx="0" cy="88" r="22" />
                  <path className={styles.handDetail} d="M-9 86c6 5 12 5 18 0" />
                </g>
              </g>
            </g>
          </g>

          <g transform="translate(68 -151) rotate(-8)">
            <g
              data-motion-target="rig.arm.right.upper"
              className={styles.motionNode}
              transform={motionTransformToSvg(rightUpperArm, 2)}
              opacity={getMotionOpacity(rightUpperArm)}
            >
              <rect className={styles.sleeve} x="-20" y="-10" width="40" height="54" rx="20" />
              <rect className={styles.skin} x="-17" y="27" width="34" height="88" rx="17" />
              <circle className={styles.joint} cx="0" cy="105" r="17" />
              <g transform="translate(0 106)">
                <g
                  data-motion-target="rig.arm.right.lower"
                  className={styles.motionNode}
                  transform={motionTransformToSvg(rightLowerArm, 2)}
                  opacity={getMotionOpacity(rightLowerArm)}
                >
                  <rect className={styles.skin} x="-15" y="0" width="30" height="82" rx="15" />
                  <circle className={styles.hand} cx="0" cy="88" r="22" />
                  <path className={styles.handDetail} d="M-9 86c6 5 12 5 18 0" />
                </g>
              </g>
            </g>
          </g>

          <g transform="translate(0 -244)">
            <g
              data-motion-target="rig.head"
              className={styles.motionNode}
              transform={motionTransformToSvg(head, 2)}
              opacity={getMotionOpacity(head)}
            >
              {character === "girl" ? (
                <path
                  className={styles.hairBack}
                  d="M-70-28c3-53 36-78 70-78s67 25 70 78l-8 99-34-13-28 17-29-17-34 13z"
                />
              ) : (
                <path
                  className={styles.hairBack}
                  d="M-67-24c7-51 35-73 68-73 38 0 64 26 67 71l-16 2-8-25-16 13-13-24-19 18-21-19-9 29z"
                />
              )}
              <ellipse className={styles.ear} cx="-64" cy="0" rx="15" ry="21" />
              <ellipse className={styles.ear} cx="64" cy="0" rx="15" ry="21" />
              <ellipse className={styles.face} cx="0" cy="0" rx="63" ry="72" />
              {character === "girl" ? (
                <path className={styles.hairFront} d="M-58-37c16-49 79-62 118-14-8 1-19 0-30-5-18 20-48 29-83 24z" />
              ) : (
                <path className={styles.hairFront} d="M-57-36c14-41 67-60 112-20l-18 5-10-10-14 12-19-13-16 15-18-9z" />
              )}
              <ellipse className={styles.eyeWhite} cx="-23" cy="2" rx="12" ry="14" />
              <ellipse className={styles.eyeWhite} cx="23" cy="2" rx="12" ry="14" />
              <circle className={styles.eye} cx="-21" cy="4" r="6" />
              <circle className={styles.eye} cx="21" cy="4" r="6" />
              <circle className={styles.eyeGlint} cx="-19" cy="1" r="2" />
              <circle className={styles.eyeGlint} cx="23" cy="1" r="2" />
              <path className={styles.nose} d="M0 9l-4 13h9" />
              <path className={styles.smile} d="M-20 34c12 13 29 13 40 0" />
              <circle className={styles.cheek} cx="-39" cy="26" r="9" />
              <circle className={styles.cheek} cx="39" cy="26" r="9" />
            </g>
          </g>
        </g>
      </g>
    </g>
  )
}

export const SvgChildRig = memo(SvgChildRigComponent)
SvgChildRig.displayName = "SvgChildRig"
