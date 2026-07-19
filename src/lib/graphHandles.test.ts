import { describe, expect, it } from 'vitest'
import type { Edge, Node } from '@xyflow/react'
import { withAlignedEdgeHandles, type FlowHandleData } from '@/lib/graphHandles'

describe('withAlignedEdgeHandles', () => {
  it('assigns separate source handles for left-to-right edges', () => {
    const nodes: Node[] = [
      { id: 'parent', position: { x: 0, y: 0 }, data: {}, width: 100, height: 200 },
      { id: 'child-a', position: { x: 200, y: 0 }, data: {}, width: 100, height: 40 },
      { id: 'child-b', position: { x: 200, y: 120 }, data: {}, width: 100, height: 40 },
    ]
    const edges: Edge[] = [
      { id: 'a', source: 'parent', target: 'child-a' },
      { id: 'b', source: 'parent', target: 'child-b' },
    ]

    const aligned = withAlignedEdgeHandles(nodes, edges)
    const parent = aligned.nodes.find((node) => node.id === 'parent')!
    const handles = (parent.data as FlowHandleData).sourceHandles ?? []

    expect(aligned.edges.map((edge) => edge.sourceHandle)).toEqual(['out-child-a', 'out-child-b'])
    expect(handles).toHaveLength(2)
    expect(handles[0]?.top).not.toBe(handles[1]?.top)
  })

  it('assigns separate target handles for right-to-left edges', () => {
    const nodes: Node[] = [
      { id: 'output', position: { x: 0, y: 0 }, data: {}, width: 100, height: 200 },
      { id: 'input-a', position: { x: 200, y: 0 }, data: {}, width: 100, height: 40 },
      { id: 'input-b', position: { x: 200, y: 120 }, data: {}, width: 100, height: 40 },
    ]
    const edges: Edge[] = [
      { id: 'a', source: 'input-a', target: 'output' },
      { id: 'b', source: 'input-b', target: 'output' },
    ]

    const aligned = withAlignedEdgeHandles(nodes, edges)
    const output = aligned.nodes.find((node) => node.id === 'output')!
    const handles = (output.data as FlowHandleData).targetHandles ?? []

    expect(aligned.edges.map((edge) => edge.targetHandle)).toEqual(['in-input-a', 'in-input-b'])
    expect(aligned.edges.map((edge) => edge.sourceHandle)).toEqual(['out-output', 'out-output'])
    expect(handles).toHaveLength(2)

    const inputA = aligned.nodes.find((node) => node.id === 'input-a')!
    const sourceHandles = (inputA.data as FlowHandleData).sourceHandles ?? []
    expect(sourceHandles[0]?.top).toBe('50%')
  })
})
