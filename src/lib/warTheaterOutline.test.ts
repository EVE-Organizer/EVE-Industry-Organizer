import { describe, expect, it } from 'vitest'
import {
  bufferSegment,
  convexHull,
  warTheaterOutlinePoints,
} from '@/lib/warTheaterOutline'

describe('convexHull', () => {
  it('wraps scattered points in counter-clockwise order', () => {
    const hull = convexHull([
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 5, y: 5 },
      { x: 5, y: 2 },
    ])
    expect(hull).toHaveLength(3)
    expect(hull[0]).toEqual({ x: 0, y: 0 })
    expect(hull[1]).toEqual({ x: 10, y: 0 })
    expect(hull[2]).toEqual({ x: 5, y: 5 })
  })
})

describe('bufferSegment', () => {
  it('offsets both sides of a segment', () => {
    const buffered = bufferSegment({ x: 0, y: 0 }, { x: 100, y: 0 }, 10)
    expect(buffered.some((p) => p.y === 10)).toBe(true)
    expect(buffered.some((p) => p.y === -10)).toBe(true)
  })
})

describe('warTheaterOutlinePoints', () => {
  it('returns empty for a single system', () => {
    expect(warTheaterOutlinePoints([{ x: 0, y: 0 }], 10)).toEqual([])
  })

  it('buffers a hub-and-spoke layout away from interior connection lines', () => {
    const focal = { x: 0, y: 0 }
    const spokeA = { x: 100, y: 40 }
    const spokeB = { x: 100, y: -40 }
    const outline = warTheaterOutlinePoints(
      [focal, spokeA, spokeB],
      12,
      [
        [focal, spokeA],
        [focal, spokeB],
      ],
    )

    const minY = Math.min(...outline.map((p) => p.y))
    const maxY = Math.max(...outline.map((p) => p.y))
    expect(minY).toBeLessThan(-40)
    expect(maxY).toBeGreaterThan(40)
  })

  it('returns a padded rectangle for two systems', () => {
    const outline = warTheaterOutlinePoints(
      [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
      ],
      10,
    )
    expect(outline.length).toBeGreaterThanOrEqual(4)
  })
})
