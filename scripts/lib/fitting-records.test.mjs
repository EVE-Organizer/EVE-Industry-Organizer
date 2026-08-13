import { describe, expect, it } from 'vitest'
import { buildFittingRecords } from './fitting-records.mjs'

describe('buildFittingRecords', () => {
  it('maps ship output to 11/48 and module usage to 30/50', () => {
    const items = buildFittingRecords(
      [
        { typeID: '1', attributeID: '11', valueInt: '', valueFloat: '62' },
        { typeID: '1', attributeID: '48', valueInt: '', valueFloat: '140' },
        { typeID: '1', attributeID: '1132', valueInt: '', valueFloat: '400' },
        { typeID: '1', attributeID: '182', valueInt: '', valueFloat: '3331' },
        { typeID: '1', attributeID: '277', valueInt: '', valueFloat: '5' },
        { typeID: '2', attributeID: '30', valueInt: '', valueFloat: '13' },
        { typeID: '2', attributeID: '50', valueInt: '', valueFloat: '19' },
      ],
      [{ typeID: '2', effectID: '12' }],
      [
        { typeId: 1, category: 'Ship' },
        { typeId: 2, category: 'Module' },
      ],
    )
    expect(items[1]).toMatchObject({ slot: 'ship', pgOut: 62, cpuOut: 140, calOut: 400 })
    expect(items[1].skills).toEqual([[3331, 5]])
    expect(items[2]).toMatchObject({ slot: 'high', pg: 13, cpu: 19 })
  })

  it('stores rig size, meta, and calibration', () => {
    const items = buildFittingRecords(
      [
        { typeID: '3', attributeID: '1153', valueInt: '', valueFloat: '200' },
        { typeID: '3', attributeID: '1547', valueInt: '', valueFloat: '1' },
        { typeID: '3', attributeID: '422', valueInt: '', valueFloat: '2' },
      ],
      [{ typeID: '3', effectID: '2663' }],
      [{ typeId: 3, category: 'Module' }],
    )
    expect(items[3]).toMatchObject({ slot: 'rig', cal: 200, rigSize: 1, meta: 2 })
  })

  it('stores rig drawback percent and effect ids', () => {
    const items = buildFittingRecords(
      [{ typeID: '4', attributeID: '1138', valueInt: '', valueFloat: '10' }],
      [
        { typeID: '4', effectID: '2663' },
        { typeID: '4', effectID: '2706' },
      ],
      [{ typeId: 4, category: 'Module' }],
    )
    expect(items[4]).toMatchObject({ slot: 'rig', drawback: 10, de: [2706] })
  })
})
