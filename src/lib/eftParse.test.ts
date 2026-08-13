import { describe, expect, it } from 'vitest'
import { parseEft } from '@/lib/eftParse'

const SAMPLE = `[Retribution, Pulse kite]
Heat Sink II
Heat Sink II
Damage Control II
1MN Afterburner II
Small Focused Beam Laser II, Multifrequency S
Small Focused Beam Laser II, Multifrequency S
[Empty High slot]
Small Energy Collision Accelerator I

Hobgoblin II x2
`

describe('parseEft', () => {
  it('reads hull, modules, charges, empty slots, and drone qty', () => {
    const fit = parseEft(SAMPLE)
    expect(fit.hullName).toBe('Retribution')
    expect(fit.fitName).toBe('Pulse kite')
    expect(fit.lines.filter((l) => l.emptySlot)).toHaveLength(1)
    expect(fit.lines.find((l) => l.name === 'Small Focused Beam Laser II')?.chargeName).toBe(
      'Multifrequency S',
    )
    expect(fit.lines.find((l) => l.name === 'Hobgoblin II')?.quantity).toBe(2)
  })

  it('skips comments and blank lines', () => {
    const fit = parseEft('# note\n\n[Rifter]\n1MN Afterburner II\n')
    expect(fit.hullName).toBe('Rifter')
    expect(fit.lines).toHaveLength(1)
  })

  it('strips a trailing x without a count', () => {
    const fit = parseEft("[Rifter]\nInherent Implants 'Lancer' Small Energy Turret SE-603 x\n")
    expect(fit.lines[0]?.name).toBe("Inherent Implants 'Lancer' Small Energy Turret SE-603")
    expect(fit.lines[0]?.quantity).toBe(1)
  })
})
