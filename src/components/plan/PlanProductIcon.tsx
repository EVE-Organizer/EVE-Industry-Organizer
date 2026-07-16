import { EveImage } from '@/components/EveImage'

export const PLAN_ROW_ICON_SIZE = 40

interface PlanProductIconProps {
  productTypeId: number
  /** When set, stacks the BPO scroll behind the product icon (offset layers). */
  blueprintTypeId?: number
  size?: number
  alt?: string
  lazy?: boolean
  className?: string
}

/** Product icon with optional offset BPO + product stack (manufacturable items). */
export function PlanProductIcon({
  productTypeId,
  blueprintTypeId,
  size = PLAN_ROW_ICON_SIZE,
  alt = '',
  lazy = true,
  className = '',
}: PlanProductIconProps) {
  if (!blueprintTypeId) {
    return (
      <EveImage
        id={productTypeId}
        size={size}
        framed
        alt={alt}
        lazy={lazy}
        className={`shrink-0 ${className}`}
      />
    )
  }

  const layerSize = Math.max(18, Math.round(size * 0.72))

  return (
    <span
      className={`relative inline-block shrink-0 ${className}`}
      style={{ width: size, height: size }}
      title={alt || undefined}
    >
      <span className="absolute left-0 top-0 z-0">
        <EveImage
          id={blueprintTypeId}
          variant="bp"
          productTypeId={productTypeId}
          size={layerSize}
          framed
          alt=""
          lazy={lazy}
        />
      </span>
      <span className="absolute right-0 bottom-0 z-10">
        <EveImage
          id={productTypeId}
          size={layerSize}
          framed
          alt={alt}
          lazy={lazy}
          className="ring-1 ring-base-100 shadow-sm"
        />
      </span>
    </span>
  )
}
