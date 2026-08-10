export interface ToolsNavItem {
  id: string
  label: string
  to: string
}

export const TOOLS_NAV_ITEMS: ToolsNavItem[] = [
  { id: 'gate-check', label: 'Gate check', to: '/tools/gate-check' },
  { id: 'mining', label: 'Mining', to: '/tools/mining' },
]

export function isToolsPath(pathname: string): boolean {
  return pathname === '/tools' || pathname.startsWith('/tools/')
}
