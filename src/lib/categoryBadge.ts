/** DaisyUI badge variant for SDE product categories (Charge, Module, Other, …). */
export function categoryBadgeClass(category: string): string {
  switch (category) {
    case 'Charge':
      return 'badge-ghost'
    case 'Ship':
      return 'badge-primary'
    case 'Module':
    case 'Structure Module':
    case 'Subsystem':
      return 'badge-info'
    case 'Commodity':
    case 'Material':
    case 'Planetary Commodities':
    case 'Colony Resources':
      return 'badge-success'
    case 'Drone':
    case 'Fighter':
      return 'badge-warning'
    case 'Structure':
    case 'Starbase':
    case 'Sovereignty Structures':
    case 'Deployable':
      return 'badge-neutral'
    case 'Other':
      return 'badge-ghost opacity-60'
    default:
      return 'badge-ghost opacity-70'
  }
}
