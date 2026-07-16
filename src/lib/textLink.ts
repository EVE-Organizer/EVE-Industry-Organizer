/** Shared animated underline for in-app text links. Defined in `styles/_components.scss`. */
export const TEXT_LINK_CLASS = 'text-link'

export function textLinkClass(...extra: (string | false | null | undefined)[]): string {
  return [TEXT_LINK_CLASS, ...extra].filter(Boolean).join(' ')
}
