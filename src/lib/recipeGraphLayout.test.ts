import { describe, expect, it } from 'vitest'
import type { BlueprintInfo } from '@/types'
import {
  estimateRecipeGraphHeight,
  recipeContentHeight,
  recipeInputBlockHeight,
  recipeMaterialColumnCount,
  recipeMaterialGrid,
  recipeMaterialPosition,
  recipeToFlow,
  RECIPE_MAX_ROWS_PER_COLUMN,
} from '@/lib/recipeGraphLayout'
import type { FlowHandleData } from '@/lib/graphHandles'

describe('recipeMaterialGrid', () => {
  it('uses one column for five or fewer materials', () => {
    expect(recipeMaterialColumnCount(5)).toBe(1)
    expect(recipeMaterialGrid(5)).toEqual({ columns: 1, rowsPerColumn: 5 })
  })

  it('wraps into a second column after five materials', () => {
    expect(recipeMaterialColumnCount(6)).toBe(2)
    expect(recipeMaterialGrid(6)).toEqual({ columns: 2, rowsPerColumn: 3 })
  })

  it('fills columns top-to-bottom before advancing horizontally', () => {
    expect(recipeMaterialPosition(0, 8)).toEqual({ column: 0, row: 0 })
    expect(recipeMaterialPosition(3, 8)).toEqual({ column: 0, row: 3 })
    expect(recipeMaterialPosition(4, 8)).toEqual({ column: 1, row: 0 })
    expect(recipeMaterialPosition(7, 8)).toEqual({ column: 1, row: 3 })
  })
})

describe('recipeInputBlockHeight', () => {
  it('uses wrapped row count instead of total materials', () => {
    expect(recipeInputBlockHeight(RECIPE_MAX_ROWS_PER_COLUMN + 1)).toBeLessThan(
      recipeInputBlockHeight(RECIPE_MAX_ROWS_PER_COLUMN + 1 + RECIPE_MAX_ROWS_PER_COLUMN),
    )
  })
})

describe('recipeContentHeight', () => {
  it('grows with material count but stays shorter when wrapped', () => {
    expect(recipeContentHeight(6)).toBeLessThan(recipeContentHeight(12))
    expect(recipeContentHeight(6)).toBeLessThan(recipeContentHeight(6 + RECIPE_MAX_ROWS_PER_COLUMN))
  })
})

describe('estimateRecipeGraphHeight', () => {
  it('caps height at the shared graph maximum', () => {
    const tall = estimateRecipeGraphHeight(40)
    expect(tall).toMatch(/^min\(\d+px, 75vh\)$/)
    const px = Number(tall.match(/^min\((\d+)px/)?.[1])
    expect(px).toBeLessThanOrEqual(720)
  })
})

describe('recipeToFlow', () => {
  const blueprint = {
    productTypeId: 1,
    blueprintTypeId: 2,
    productQuantity: 1,
    manufacturingTime: 3600,
    materials: Array.from({ length: 6 }, (_, index) => ({
      typeId: 100 + index,
      quantity: index + 1,
    })),
  } as BlueprintInfo

  it('connects blueprint and materials directly to the output', () => {
    const typeMap = new Map(
      blueprint.materials.map((mat) => [mat.typeId, { typeId: mat.typeId, name: `Type ${mat.typeId}` }]),
    )
    const flow = recipeToFlow(blueprint, typeMap as never, 'Test product')

    expect(flow.nodes.some((node) => node.id === 'output')).toBe(true)
    expect(flow.nodes.some((node) => node.id === 'blueprint')).toBe(true)
    expect(flow.edges).toHaveLength(7)
    expect(flow.edges.every((edge) => edge.target === 'output')).toBe(true)
  })

  it('assigns a separate target handle per edge on the output', () => {
    const typeMap = new Map(
      blueprint.materials.map((mat) => [mat.typeId, { typeId: mat.typeId, name: `Type ${mat.typeId}` }]),
    )
    const flow = recipeToFlow(blueprint, typeMap as never, 'Test product')
    const output = flow.nodes.find((node) => node.id === 'output')!
    const handles = (output.data as FlowHandleData).targetHandles ?? []

    expect(handles).toHaveLength(7)
    expect(new Set(flow.edges.map((edge) => edge.targetHandle)).size).toBe(7)
  })
})
