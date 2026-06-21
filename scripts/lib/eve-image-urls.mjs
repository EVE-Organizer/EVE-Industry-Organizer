/** EVE Image Service URL builders (mirrors src/lib/eveImages.ts). */
export const IMAGE_BASE = 'https://images.evetech.net'
export const VALID_IMAGE_SIZES = [32, 64, 128, 256, 512, 1024]

export function normalizeImageSize(requested) {
  for (const size of VALID_IMAGE_SIZES) {
    if (requested <= size) return size
  }
  return 1024
}

export function typeIconUrl(typeId, size = 32) {
  return `${IMAGE_BASE}/types/${typeId}/icon?size=${normalizeImageSize(size)}`
}

export function typeRenderUrl(typeId, size = 128) {
  return `${IMAGE_BASE}/types/${typeId}/render?size=${normalizeImageSize(size)}`
}

export function blueprintIconUrl(typeId, size = 32) {
  return `${IMAGE_BASE}/types/${typeId}/bp?size=${normalizeImageSize(size)}`
}

export function corporationLogoUrl(corporationId, size = 64) {
  return `${IMAGE_BASE}/corporations/${corporationId}/logo?size=${normalizeImageSize(size)}`
}

export function typeImageUrls(typeId) {
  return {
    iconUrl: typeIconUrl(typeId),
    renderUrl: typeRenderUrl(typeId),
    bpIconUrl: blueprintIconUrl(typeId),
  }
}
