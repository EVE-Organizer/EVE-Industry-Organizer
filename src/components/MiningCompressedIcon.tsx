import { EveImage } from '@/components/EveImage'

/** Table row stack size (matches plan product icon footprint). */
export const MINING_ROW_ICON_SIZE = 40

interface MiningCompressedIconProps {
  rawTypeId: number
  compressedTypeId?: number | null
  size?: number
  alt?: string
  lazy?: boolean
  className?: string
}

/** Compressed ore behind, raw ore in front (offset stack like plan BPO + product). */
export function MiningCompressedIcon({
  rawTypeId,
  compressedTypeId,
  size = MINING_ROW_ICON_SIZE,
  alt = '',
  lazy = true,
  className = '',
}: MiningCompressedIconProps) {
  if (compressedTypeId == null) {
    return (
      <EveImage
        id={rawTypeId}
        size={size}
        framed
        alt={alt}
        lazy={lazy}
        className={`shrink-0 ${className}`}
      />
    )
  }

  const layerSize = Math.max(24, Math.round(size * 0.82))

  return (
    <span
      className={`relative inline-block shrink-0 ${className}`}
      style={{ width: size, height: size }}
      title={alt || undefined}
    >
      <span className="absolute left-0 top-0 z-0">
        <EveImage id={compressedTypeId} size={layerSize} framed alt="" lazy={lazy} />
      </span>
      <span className="absolute right-0 bottom-0 z-10">
        <EveImage
          id={rawTypeId}
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
