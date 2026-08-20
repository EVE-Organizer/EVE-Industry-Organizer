/** EVE stacking penalty on identical module bonuses. */
export function stackingProduct(bonus: number, count: number): number {
  let mult = 1
  for (let i = 0; i < count; i++) {
    mult *= 1 + bonus * Math.exp(-(i * i) / 7.1289)
  }
  return mult
}

export function clampLevel(level: number | undefined): number {
  if (!Number.isFinite(level)) return 0
  return Math.min(5, Math.max(0, Math.floor(level ?? 0)))
}

export function skillPct(level: number, pctPerLevel: number): number {
  return 1 + pctPerLevel * clampLevel(level)
}

export function omniEhp(hp: number, res: { em: number; thermal: number; kinetic: number; explosive: number }): number {
  const avg =
    (1 - res.em + 1 - res.thermal + 1 - res.kinetic + 1 - res.explosive) / 4
  return hp / Math.max(0.01, avg)
}

export function effectiveResist(base: number, bonusPct: number): number {
  return Math.min(0.99, base - (1 - base) * (bonusPct / 100))
}
