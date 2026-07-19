import { Handle, Position } from '@xyflow/react'
import type { FlowHandleSlot } from '@/lib/graphHandles'

export function FlowHandles({
  sourceHandles = [],
  targetHandles = [],
}: {
  sourceHandles?: FlowHandleSlot[]
  targetHandles?: FlowHandleSlot[]
}) {
  return (
    <>
      {targetHandles.length > 0 ? (
        targetHandles.map((handle) => (
          <Handle
            key={handle.id}
            id={handle.id}
            type="target"
            position={Position.Left}
            className="opacity-0"
            style={{ top: handle.top }}
          />
        ))
      ) : (
        <Handle type="target" position={Position.Left} className="opacity-0" />
      )}
      {sourceHandles.length > 0 ? (
        sourceHandles.map((handle) => (
          <Handle
            key={handle.id}
            id={handle.id}
            type="source"
            position={Position.Right}
            className="opacity-0"
            style={{ top: handle.top }}
          />
        ))
      ) : (
        <Handle type="source" position={Position.Right} className="opacity-0" />
      )}
    </>
  )
}
