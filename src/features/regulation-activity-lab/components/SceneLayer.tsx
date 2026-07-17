import { memo } from "react"
import type { MotionTransform, SceneObject } from "../types"
import {
  getMotionOpacity,
  motionTransformToSvg,
  type MotionSnapshot,
} from "../timeline"
import styles from "./SceneLayer.module.css"

const EMPTY_SNAPSHOT: MotionSnapshot = Object.freeze({})

interface SceneLayerProps {
  objects: readonly SceneObject[]
  layer: SceneObject["layer"]
  transforms?: MotionSnapshot
}

interface SceneObjectShapeProps {
  object: SceneObject
}

function SceneObjectShape({ object }: SceneObjectShapeProps) {
  const width = Math.max(1, object.width)
  const height = Math.max(1, object.height)
  const fill = object.fill || "#e0f2fe"
  const stroke = object.stroke || "#2563eb"
  const labelFontSize = Math.max(7, Math.min(15, width / Math.max(3, object.label.length * 0.52)))

  if (object.kind === "wall") {
    return (
      <g>
        <rect width={width} height={height} rx="8" fill={fill} stroke={stroke} strokeWidth="2" />
        <path className={styles.wallLine} d={`M${width * 0.5} 0v${height}`} />
        <path className={styles.wallLine} d={`M0 ${height * 0.56}h${width}`} />
      </g>
    )
  }

  if (object.kind === "floor-marker" || object.kind === "return-spot") {
    return (
      <g>
        <ellipse
          cx={width / 2}
          cy={height / 2}
          rx={width / 2}
          ry={height / 2}
          fill={fill}
          stroke={stroke}
          strokeWidth="2"
        />
        <ellipse
          className={styles.markerRing}
          cx={width / 2}
          cy={height / 2}
          rx={width * 0.31}
          ry={height * 0.31}
        />
      </g>
    )
  }

  if (object.kind === "basket") {
    return (
      <g>
        <path
          d={`M${width * 0.1} ${height * 0.2}h${width * 0.8}l-${width * 0.1} ${height * 0.72}H${width * 0.2}z`}
          fill={fill}
          stroke={stroke}
          strokeLinejoin="round"
          strokeWidth="2"
        />
        <path className={styles.basketWeave} d={`M${width * 0.2} ${height * 0.48}h${width * 0.6}`} />
        <path className={styles.basketWeave} d={`M${width * 0.36} ${height * 0.25}v${height * 0.6}`} />
        <path className={styles.basketWeave} d={`M${width * 0.64} ${height * 0.25}v${height * 0.6}`} />
      </g>
    )
  }

  if (object.kind === "cone") {
    return (
      <g>
        <path
          d={`M${width / 2} 0L${width * 0.82} ${height * 0.78}H${width * 0.18}z`}
          fill={fill}
          stroke={stroke}
          strokeLinejoin="round"
          strokeWidth="2"
        />
        <rect y={height * 0.76} width={width} height={height * 0.22} rx="3" fill={stroke} />
        <path className={styles.coneStripe} d={`M${width * 0.32} ${height * 0.46}h${width * 0.36}`} />
      </g>
    )
  }

  if (object.kind === "paw-marker") {
    return (
      <g fill={fill} stroke={stroke} strokeWidth="1.5">
        <ellipse cx={width * 0.5} cy={height * 0.62} rx={width * 0.24} ry={height * 0.28} />
        <circle cx={width * 0.22} cy={height * 0.27} r={Math.min(width, height) * 0.12} />
        <circle cx={width * 0.42} cy={height * 0.16} r={Math.min(width, height) * 0.12} />
        <circle cx={width * 0.63} cy={height * 0.17} r={Math.min(width, height) * 0.12} />
        <circle cx={width * 0.8} cy={height * 0.3} r={Math.min(width, height) * 0.12} />
      </g>
    )
  }

  if (object.kind === "cushion") {
    return (
      <g>
        <rect width={width} height={height} rx={Math.min(width, height) * 0.28} fill={fill} stroke={stroke} strokeWidth="2" />
        <path className={styles.cushionSeam} d={`M${width * 0.18} ${height * 0.18}Q${width / 2} ${height * 0.42} ${width * 0.82} ${height * 0.18}`} />
      </g>
    )
  }

  if (object.kind === "foam-arch") {
    return (
      <path
        d={`M0 ${height}V${height * 0.54}C0 ${height * 0.08} ${width} ${height * 0.08} ${width} ${height * 0.54}V${height}`}
        fill="none"
        stroke={fill}
        strokeLinecap="round"
        strokeWidth={Math.max(8, width * 0.13)}
      />
    )
  }

  if (object.kind === "soft-bar") {
    return <rect width={width} height={height} rx={height / 2} fill={fill} stroke={stroke} strokeWidth="2" />
  }

  if (object.kind === "traffic-light") {
    const radius = Math.min(width * 0.23, height * 0.12)
    return (
      <g>
        <rect width={width} height={height} rx="9" fill="#172554" stroke={stroke} strokeWidth="2" />
        <circle cx={width / 2} cy={height * 0.22} r={radius} fill="#fb7185" />
        <circle cx={width / 2} cy={height * 0.5} r={radius} fill="#facc15" />
        <circle cx={width / 2} cy={height * 0.78} r={radius} fill="#22c55e" />
      </g>
    )
  }

  if (object.kind === "rhythm-dot") {
    return <circle cx={width / 2} cy={height / 2} r={Math.min(width, height) / 2} fill={fill} stroke={stroke} strokeWidth="2" />
  }

  if (
    object.kind === "sequence-card" ||
    object.kind === "direction-card" ||
    object.kind === "choice-card"
  ) {
    return (
      <g>
        <rect width={width} height={height} rx="9" fill={fill} stroke={stroke} strokeWidth="2" />
        <path className={styles.cardAccent} d={`M9 10h${Math.max(8, width * 0.22)}`} />
        <text
          className={styles.cardLabel}
          x={width / 2}
          y={height / 2}
          fontSize={labelFontSize}
          dominantBaseline="middle"
          textAnchor="middle"
        >
          {object.label}
        </text>
      </g>
    )
  }

  return <rect width={width} height={height} rx="8" fill={fill} stroke={stroke} strokeWidth="2" />
}

function readTransform(
  transforms: MotionSnapshot,
  objectId: string
): MotionTransform | undefined {
  return transforms[`scene:${objectId}`]
}

function SceneLayerComponent({
  objects,
  layer,
  transforms = EMPTY_SNAPSHOT,
}: SceneLayerProps) {
  const matchingObjects = objects.filter((object) => object.layer === layer)

  return (
    <g data-scene-layer={String(layer)} transform="scale(2)">
      {matchingObjects.map((object) => {
        const target = `scene:${object.id}`
        const transform = readTransform(transforms, object.id)

        return (
          <g key={object.id} transform={`translate(${object.x} ${object.y})`}>
            <g
              aria-hidden="true"
              data-motion-target={target}
              className={styles.motionNode}
              transform={motionTransformToSvg(transform)}
              opacity={getMotionOpacity(transform)}
            >
              <title>{object.label}</title>
              <SceneObjectShape object={object} />
            </g>
          </g>
        )
      })}
    </g>
  )
}

export const SceneLayer = memo(SceneLayerComponent)
SceneLayer.displayName = "SceneLayer"
