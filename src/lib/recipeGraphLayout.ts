import type { BlueprintInfo, TypeInfo } from '@/types'
import { isReactionRecipe } from '@/lib/recipes'
import type { Edge, Node } from '@xyflow/react'
import { withAlignedEdgeHandles, type FlowHandleData } from '@/lib/graphHandles'

export const RECIPE_INPUT_WIDTH = 176
export const RECIPE_OUTPUT_WIDTH = 220
export const RECIPE_COLUMN_GAP = 56
export const RECIPE_ROW_HEIGHT = 56
export const RECIPE_ROW_GAP = 12
export const RECIPE_OUTPUT_MIN_HEIGHT = 112
export const RECIPE_GRAPH_MIN_HEIGHT = 240
export const RECIPE_GRAPH_MAX_HEIGHT_PX = 720
export const RECIPE_GRAPH_MAX_HEIGHT_VH = 75
/** Max material rows in one column before wrapping horizontally. */
export const RECIPE_MAX_ROWS_PER_COLUMN = 5

export interface RecipeBlueprintData extends Record<string, unknown>, FlowHandleData {
  blueprintTypeId: number
  productTypeId: number
  name: string
  isReaction: boolean
}

export interface RecipeInputData extends Record<string, unknown>, FlowHandleData {
  typeId: number
  name: string
  quantity: number
}

export interface RecipeOutputData extends Record<string, unknown>, FlowHandleData {
  typeId: number
  name: string
  productQuantity: number
  jobTimeSeconds: number
}

export function recipeMaterialColumnCount(materialCount: number): number {
  if (materialCount <= 0) return 0
  if (materialCount <= RECIPE_MAX_ROWS_PER_COLUMN) return 1
  return Math.ceil(materialCount / RECIPE_MAX_ROWS_PER_COLUMN)
}

export function recipeMaterialGrid(materialCount: number): { columns: number; rowsPerColumn: number } {
  const columns = Math.max(1, recipeMaterialColumnCount(materialCount))
  const rowsPerColumn = materialCount > 0 ? Math.ceil(materialCount / columns) : 0
  return { columns, rowsPerColumn }
}

export function recipeMaterialPosition(
  index: number,
  materialCount: number,
): { column: number; row: number } {
  const { rowsPerColumn } = recipeMaterialGrid(materialCount)
  return {
    column: Math.floor(index / rowsPerColumn),
    row: index % rowsPerColumn,
  }
}

export function recipeInputBlockHeight(materialCount: number): number {
  const { rowsPerColumn } = recipeMaterialGrid(materialCount)
  if (materialCount <= 0) return 0
  return rowsPerColumn * RECIPE_ROW_HEIGHT + Math.max(0, rowsPerColumn - 1) * RECIPE_ROW_GAP
}

export function recipeContentHeight(materialCount: number): number {
  const materialsBlock = recipeInputBlockHeight(materialCount)
  const rightColumnHeight =
    RECIPE_ROW_HEIGHT + (materialCount > 0 ? RECIPE_ROW_GAP + materialsBlock : 0)
  return Math.max(RECIPE_OUTPUT_MIN_HEIGHT, rightColumnHeight)
}

export function estimateRecipeGraphHeight(materialCount: number): string {
  const contentHeight = Math.max(RECIPE_GRAPH_MIN_HEIGHT, recipeContentHeight(materialCount) + 32)
  const capped = Math.min(contentHeight, RECIPE_GRAPH_MAX_HEIGHT_PX)
  return `min(${capped}px, ${RECIPE_GRAPH_MAX_HEIGHT_VH}vh)`
}

const edgeDefaults: Partial<Edge> = {
  type: 'step',
  style: { strokeWidth: 1.25, stroke: '#64748b', opacity: 0.55 },
}

export function recipeToFlow(
  blueprint: BlueprintInfo,
  typeMap: Map<number, TypeInfo>,
  productName: string,
): { nodes: Node[]; edges: Edge[] } {
  const materials = blueprint.materials
  const isReaction = isReactionRecipe(blueprint)
  const blueprintType = typeMap.get(blueprint.blueprintTypeId)
  const blockHeight = recipeContentHeight(materials.length)
  const outputHeight = RECIPE_OUTPUT_MIN_HEIGHT
  const outputY = Math.max(0, (blockHeight - outputHeight) / 2)
  const materialsColumnX = RECIPE_OUTPUT_WIDTH + RECIPE_COLUMN_GAP
  const materialsY = RECIPE_ROW_HEIGHT + RECIPE_ROW_GAP

  const nodes: Node[] = [
    {
      id: 'output',
      type: 'recipeOutput',
      position: { x: 0, y: outputY },
      width: RECIPE_OUTPUT_WIDTH,
      height: outputHeight,
      draggable: false,
      selectable: false,
      zIndex: 2,
      data: {
        typeId: blueprint.productTypeId,
        name: productName,
        productQuantity: blueprint.productQuantity,
        jobTimeSeconds: blueprint.manufacturingTime,
      } satisfies RecipeOutputData,
    },
    {
      id: 'blueprint',
      type: 'recipeBlueprint',
      position: { x: materialsColumnX, y: 0 },
      width: RECIPE_INPUT_WIDTH,
      height: RECIPE_ROW_HEIGHT,
      draggable: false,
      selectable: false,
      zIndex: 2,
      data: {
        blueprintTypeId: blueprint.blueprintTypeId,
        productTypeId: blueprint.productTypeId,
        name: blueprintType?.name ?? (isReaction ? 'Reaction formula' : 'Blueprint'),
        isReaction,
      } satisfies RecipeBlueprintData,
    },
  ]

  const edges: Edge[] = [
    {
      id: 'edge-blueprint',
      source: 'blueprint',
      target: 'output',
      ...edgeDefaults,
    },
  ]

  materials.forEach((mat, index) => {
    const id = `input-${mat.typeId}`
    const matType = typeMap.get(mat.typeId)
    const { column, row } = recipeMaterialPosition(index, materials.length)
    const x = materialsColumnX + column * (RECIPE_INPUT_WIDTH + RECIPE_COLUMN_GAP)
    const y = materialsY + row * (RECIPE_ROW_HEIGHT + RECIPE_ROW_GAP)

    nodes.push({
      id,
      type: 'recipeInput',
      position: { x, y },
      width: RECIPE_INPUT_WIDTH,
      height: RECIPE_ROW_HEIGHT,
      draggable: false,
      selectable: false,
      zIndex: 2,
      data: {
        typeId: mat.typeId,
        name: matType?.name ?? `Type ${mat.typeId}`,
        quantity: mat.quantity,
      } satisfies RecipeInputData,
    })

    edges.push({
      id: `edge-${id}`,
      source: id,
      target: 'output',
      ...edgeDefaults,
    })
  })

  return withAlignedEdgeHandles(nodes, edges)
}
