/** ISK/HR navbar categories. Enable new routes as pages ship. */
export interface IskHrNavCategory {
  id: string
  label: string
  to: string
  enabled: boolean
}

export const ISK_HR_CATEGORIES: IskHrNavCategory[] = [
  { id: 'mining', label: 'Mining', to: '/isk-hr/mining', enabled: true },
  { id: 'ratting', label: 'Ratting', to: '/isk-hr/ratting', enabled: false },
  { id: 'pi', label: 'PI', to: '/isk-hr/pi', enabled: false },
]

export const ISK_HR_ENABLED = ISK_HR_CATEGORIES.filter((c) => c.enabled)

export function isIskHrPath(pathname: string): boolean {
  return pathname === '/isk-hr' || pathname.startsWith('/isk-hr/')
}
