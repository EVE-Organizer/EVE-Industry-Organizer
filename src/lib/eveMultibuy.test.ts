import { describe, expect, it } from 'vitest'
import {
  eveMultibuyLinesFromBuyNodes,
  eveMultibuyTextFromBuyNodes,
  formatEveMultibuyClipboard,
  mergeEveMultibuyLines,
} from '@/lib/eveMultibuy'

describe('formatEveMultibuyClipboard', () => {
  it('uses tab between name and integer quantity', () => {
    expect(
      formatEveMultibuyClipboard([
        { name: 'Tritanium', quantity: 1000 },
        { name: 'Pyerite', quantity: 50 },
      ]),
    ).toBe('Tritanium\t1000\nPyerite\t50')
  })

  it('skips empty names and non-positive quantities', () => {
    expect(
      formatEveMultibuyClipboard([
        { name: '  ', quantity: 10 },
        { name: 'Tritanium', quantity: 0 },
        { name: 'Pyerite', quantity: -1 },
      ]),
    ).toBe('')
  })

  it('ceils fractional quantities', () => {
    expect(formatEveMultibuyClipboard([{ name: 'Tritanium', quantity: 10.2 }])).toBe(
      'Tritanium\t11',
    )
  })
})

describe('mergeEveMultibuyLines', () => {
  it('sums the same type id and sorts by name', () => {
    expect(
      mergeEveMultibuyLines([
        { productTypeId: 35, name: 'Pyerite', quantity: 10 },
        { productTypeId: 34, name: 'Tritanium', quantity: 5 },
        { productTypeId: 34, name: 'Tritanium', quantity: 7 },
      ]),
    ).toEqual([
      { name: 'Pyerite', quantity: 10 },
      { name: 'Tritanium', quantity: 12 },
    ])
  })
})

describe('eveMultibuyLinesFromBuyNodes', () => {
  const nodes = [
    { productTypeId: 34, name: 'Tritanium', totalDemandQty: 100 },
    { productTypeId: 35, name: 'Pyerite', totalDemandQty: 20 },
  ]

  it('uses full demand when inventory is off', () => {
    expect(eveMultibuyLinesFromBuyNodes(nodes, new Map([[34, 40]]), false)).toEqual([
      { name: 'Pyerite', quantity: 20 },
      { name: 'Tritanium', quantity: 100 },
    ])
  })

  it('subtracts hangar stock when inventory is on', () => {
    expect(eveMultibuyTextFromBuyNodes(nodes, new Map([[34, 40]]), true)).toBe(
      'Pyerite\t20\nTritanium\t60',
    )
  })

  it('omits types already covered by inventory', () => {
    expect(
      eveMultibuyLinesFromBuyNodes(
        nodes,
        new Map([
          [34, 100],
          [35, 25],
        ]),
        true,
      ),
    ).toEqual([])
  })
})
