/** Site root for resolving public data and deep links (works on direct /item/... loads). */
function getAppRoot(): string {
  const base = import.meta.env.BASE_URL
  if (base.startsWith('/') && base !== '/') {
    return `${window.location.origin}${base}`
  }
  if (base === './') {
    return new URL('./', window.location.href).href
  }
  return `${window.location.origin}/`
}

export function publicDataUrl(file: string): string {
  const path = `data/${file.replace(/^\//, '')}`
  return new URL(path, getAppRoot()).href
}

export function appRoute(path: string): string {
  const route = path.replace(/^\//, '')
  return new URL(route, getAppRoot()).href
}
