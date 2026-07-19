import { Handle, Position } from '@xyflow/react'
import type { FlowHandleSlot } from '@/lib/graphHandles'

/** Handles for item recipe cards: materials source left, product targets right. */
export function RecipeFlowHandles({
  sourceHandles = [],
  targetHandles = [],
}: {
  sourceHandles?: FlowHandleSlot[]
  targetHandles?: FlowHandleSlot[]
}) {
  return (
    <>
      {targetHandles.map((handle) => (
        <Handle
          key={handle.id}
          id={handle.id}
          type="target"
          position={Position.Right}
          className="opacity-0"
          style={{ top: handle.top }}
        />
      ))}
      {sourceHandles.map((handle) => (
        <Handle
          key={handle.id}
          id={handle.id}
          type="source"
          position={Position.Left}
          className="opacity-0"
          style={{ top: handle.top }}
        />
      ))}
    </>
  )
}
