import { useEffect, useState } from 'react'
import type { HubId } from '@/types'
import {
  characterPortraitUrl,
  HUB_FACTION_IDS,
  type ImageVariant,
  imageUrlChain,
  normalizeImageSize,
} from '@/lib/eveImages'

interface EveImageProps {
  id: number
  variant?: ImageVariant
  /** Product type ID used when blueprint/render URLs are unavailable. */
  productTypeId?: number
  size?: number
  alt?: string
  className?: string
  framed?: boolean
  lazy?: boolean
}

export function EveImage({
  id,
  variant = 'icon',
  productTypeId,
  size = 32,
  alt = '',
  className = '',
  framed = false,
  lazy = true,
}: EveImageProps) {
  const urls = imageUrlChain(id, variant, size, productTypeId)
  const [urlIndex, setUrlIndex] = useState(0)

  useEffect(() => {
    setUrlIndex(0)
  }, [id, variant, productTypeId, size])

  const frame =
    'rounded-md border border-eve-border bg-base-300/80 p-0.5 shadow-sm'

  const src = urls[urlIndex]

  if (!src || urlIndex >= urls.length) {
    if (framed) {
      return (
        <span
          className={`inline-flex items-center justify-center shrink-0 aspect-square ${frame} ${className}`}
          style={{ width: size, height: size }}
          aria-hidden={!alt}
          title={alt || undefined}
        >
          <span className="text-[10px] opacity-40 font-mono">?</span>
        </span>
      )
    }
    return (
      <span
        className={`inline-flex items-center justify-center shrink-0 rounded bg-base-300/60 ${className}`}
        style={{ width: size, height: size }}
        aria-hidden={!alt}
        title={alt || undefined}
      >
        <span className="text-[10px] opacity-40 font-mono">?</span>
      </span>
    )
  }

  if (framed) {
    return (
      <span
        className={`inline-flex items-center justify-center shrink-0 aspect-square overflow-hidden ${frame} ${className}`}
        style={{ width: size, height: size }}
      >
        <img
          key={src}
          src={src}
          alt={alt}
          width={size}
          height={size}
          loading={lazy ? 'lazy' : 'eager'}
          decoding="async"
          className="h-full w-full object-contain"
          onError={() => setUrlIndex((i) => i + 1)}
        />
      </span>
    )
  }

  return (
    <img
      key={src}
      src={src}
      alt={alt}
      width={size}
      height={size}
      loading={lazy ? 'lazy' : 'eager'}
      decoding="async"
      className={`shrink-0 object-contain rounded bg-base-300/60 ${className}`}
      onError={() => setUrlIndex((i) => i + 1)}
    />
  )
}

export function CorpLogo({
  corporationId,
  size = 24,
  className = '',
  alt = '',
  framed = true,
}: {
  corporationId: number
  size?: number
  className?: string
  alt?: string
  framed?: boolean
}) {
  if (!corporationId) return null
  return (
    <EveImage
      id={corporationId}
      variant="faction"
      size={size}
      alt={alt}
      className={className}
      framed={framed}
    />
  )
}

export function HubLogo({
  hubId,
  size = 48,
  className = '',
  alt = '',
}: {
  hubId: HubId
  size?: number
  className?: string
  alt?: string
}) {
  return (
    <EveImage
      id={HUB_FACTION_IDS[hubId]}
      variant="faction"
      size={size}
      alt={alt}
      className={className}
      framed
    />
  )
}

export function CharacterAvatar({
  characterId,
  name,
  size = 48,
  isOmega,
  className = '',
}: {
  characterId?: number
  name: string
  size?: number
  isOmega?: boolean
  className?: string
}) {
  const initial = name.trim().charAt(0).toUpperCase() || '?'
  const portrait = characterId ? characterPortraitUrl(characterId, size) : null
  const [portraitFailed, setPortraitFailed] = useState(false)

  return (
    <div className={`relative shrink-0 ${className}`} style={{ width: size, height: size }}>
      {portrait && !portraitFailed ? (
        <img
          src={portrait}
          alt={name}
          width={size}
          height={size}
          className="rounded-full border-2 border-primary/40 object-cover bg-base-300"
          onError={() => setPortraitFailed(true)}
        />
      ) : (
        <div
          className="flex items-center justify-center rounded-full border-2 border-primary/40 bg-gradient-to-br from-base-300 to-base-100 font-bold text-primary"
          style={{ width: size, height: size, fontSize: size * 0.38 }}
          aria-hidden={!!portrait}
        >
          {initial}
        </div>
      )}
      {isOmega && (
        <span
          className="absolute -bottom-0.5 -right-0.5 badge badge-warning badge-xs px-1 min-h-0 h-4"
          title="Omega clone"
        >
          Ω
        </span>
      )}
    </div>
  )
}

export function IskBadge({ className = '' }: { className?: string }) {
  return (
    <span
      className={`inline-flex items-center justify-center rounded-full bg-warning/20 text-warning font-bold border border-warning/30 ${className}`}
      style={{ width: 32, height: 32, fontSize: 14 }}
      title="ISK"
      aria-hidden
    >
      Ƶ
    </span>
  )
}

export { normalizeImageSize }
