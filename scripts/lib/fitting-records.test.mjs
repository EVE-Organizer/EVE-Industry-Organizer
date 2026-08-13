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
})
