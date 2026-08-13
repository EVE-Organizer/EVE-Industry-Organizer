export interface ToolsNavItem {
  id: string
  label: string
  to: string
}

export const TOOLS_NAV_ITEMS: ToolsNavItem[] = [
  { id: 'route-risk', label: 'Route risk', to: '/tools/route-risk' },
  { id: 'fit-skills', label: 'Fit skills', to: '/tools/fit-skills' },
  { id: 'mining', label: 'Mining', to: '/tools/mining' },
]

export function isToolsPath(pathname: string): boolean {
  return pathname === '/tools' || pathname.startsWith('/tools/')
}
