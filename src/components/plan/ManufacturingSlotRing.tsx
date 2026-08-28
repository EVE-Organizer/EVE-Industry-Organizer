import { PlanProductIcon } from '@/components/plan/PlanProductIcon'

const BRACKET_PATH =
  'M -14 -4 L -14 -10 L -6 -10 M 14 -4 L 14 -10 L 6 -10 M -14 4 L -14 10 L -6 10 M 14 4 L 14 10 L 6 10'

function EmptyBlueprintIcon() {
  return (
    <svg viewBox="0 0 24 24" className="manufacturing-slot__empty-icon" aria-hidden>
      <rect x="6" y="6" width="12" height="12" rx="1" />
      <path d="M8 8l8 8M16 8l-8 8" />
    </svg>
  )
}

export interface ManufacturingSlotRingProps {
  slotIndex: number
  active?: boolean
  selected?: boolean
  /** 0–1 share of plan window this slot is busy. */
  utilization?: number
  productTypeId?: number
  blueprintTypeId?: number
  productName?: string
  idleMessage?: string
  size?: 'sm' | 'md'
  className?: string
  onSelect?: (slotIndex: number) => void
}

export function ManufacturingSlotRing({
  slotIndex,
  active = false,
  selected = false,
  utilization = 0,
  productTypeId,
  blueprintTypeId,
  productName,
  idleMessage = 'Idle',
  size = 'md',
  className = '',
  onSelect,
}: ManufacturingSlotRingProps) {
  const clampedUtil = Math.max(0, Math.min(1, utilization))
  const progressDeg = clampedUtil * 360
  const hasProduct = active && productTypeId != null
  const iconSize = size === 'sm' ? 32 : 46
  const label = `Slot ${slotIndex + 1}${productName ? `: ${productName}` : ''}`

  return (
    <button
      type="button"
      className={`manufacturing-slot manufacturing-slot--${size}${active ? ' manufacturing-slot--active' : ''}${selected ? ' manufacturing-slot--selected' : ''}${className ? ` ${className}` : ''}`}
      aria-pressed={selected}
      aria-label={label}
      title={productName ?? idleMessage}
      onClick={() => onSelect?.(slotIndex)}
    >
      <div className="manufacturing-slot__frame">
        <svg viewBox="0 0 200 200" className="manufacturing-slot__svg" aria-hidden>
          <circle cx="100" cy="100" r="92" className="manufacturing-slot__outer" />
          <circle cx="100" cy="100" r="78" className="manufacturing-slot__inner" />
          {Array.from({ length: 12 }, (_, i) => {
            const angle = (i * Math.PI) / 6
            const x1 = 100 + Math.cos(angle) * 34
            const y1 = 100 + Math.sin(angle) * 34
            const x2 = 100 + Math.cos(angle) * 78
            const y2 = 100 + Math.sin(angle) * 78
            return (
              <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} className="manufacturing-slot__spoke" />
            )
          })}
          {active && clampedUtil > 0.01 ? (
            <circle
              cx="100"
              cy="100"
              r="86"
              className="manufacturing-slot__progress"
              strokeDasharray={`${(progressDeg / 360) * 540} 540`}
              transform="rotate(-90 100 100)"
            />
          ) : null}
          <g className="manufacturing-slot__brackets">
            <g transform="translate(100 34)">
              <path
                d={BRACKET_PATH}
                className="manufacturing-slot__bracket manufacturing-slot__bracket--top"
              />
            </g>
            <g transform="translate(166 100) rotate(90)">
              <path
                d={BRACKET_PATH}
                className="manufacturing-slot__bracket manufacturing-slot__bracket--right"
              />
            </g>
            <g transform="translate(100 166) rotate(180)">
              <path
                d={BRACKET_PATH}
                className="manufacturing-slot__bracket manufacturing-slot__bracket--bottom"
              />
            </g>
            <g transform="translate(34 100) rotate(-90)">
              <path
                d={BRACKET_PATH}
                className="manufacturing-slot__bracket manufacturing-slot__bracket--left"
              />
            </g>
          </g>
        </svg>

        <div className="manufacturing-slot__center">
          {hasProduct ? (
            <PlanProductIcon
              productTypeId={productTypeId}
              blueprintTypeId={blueprintTypeId}
              size={iconSize}
              alt={productName ?? ''}
              className="manufacturing-slot__product"
            />
          ) : (
            <EmptyBlueprintIcon />
          )}
        </div>
      </div>

      <span className="manufacturing-slot__caption">
        <span className="manufacturing-slot__slot-label">Slot {slotIndex + 1}</span>
        {size === 'md' ? (
          <span className="manufacturing-slot__status">
            {hasProduct ? (productName ?? 'Building') : idleMessage}
          </span>
        ) : null}
      </span>
    </button>
  )
}

interface ManufacturingSlotsRowProps {
  slots: ManufacturingSlotRingProps[]
  selectedSlotIndex?: number | null
  onSelectSlot?: (slotIndex: number) => void
  emptyHint?: string
  className?: string
  onAddSlot?: () => void
  addSlotLabel?: string
  onRemoveSlot?: () => void
  removeSlotLabel?: string
  canRemoveSlot?: boolean
}

export function ManufacturingSlotsRow({
  slots,
  selectedSlotIndex = null,
  onSelectSlot,
  emptyHint = 'Industry slots from Mass Production skills',
  className = '',
  onAddSlot,
  addSlotLabel = 'Add slot',
  onRemoveSlot,
  removeSlotLabel = 'Remove slot',
  canRemoveSlot = false,
}: ManufacturingSlotsRowProps) {
  const allIdle = slots.every((slot) => !slot.active)

  return (
    <div className={`manufacturing-slots${className ? ` ${className}` : ''}`}>
      {allIdle && slots.length > 0 ? (
        <p className="manufacturing-slots__hint">{emptyHint}</p>
      ) : null}
      <div className="manufacturing-slots__row-wrap">
        <div
          className="manufacturing-slots__row"
          style={{ ['--slot-count' as string]: slots.length }}
        >
          {slots.map((slot) => (
            <ManufacturingSlotRing
              key={slot.slotIndex}
              {...slot}
              selected={selectedSlotIndex === slot.slotIndex}
              onSelect={onSelectSlot}
            />
          ))}
        </div>
        {onAddSlot || onRemoveSlot ? (
          <div className="manufacturing-slots__controls">
            {onRemoveSlot && canRemoveSlot ? (
              <button
                type="button"
                className="manufacturing-slots__remove btn btn-circle btn-ghost btn-sm"
                aria-label={removeSlotLabel}
                title={removeSlotLabel}
                onClick={onRemoveSlot}
              >
                −
              </button>
            ) : null}
            {onAddSlot ? (
              <button
                type="button"
                className="manufacturing-slots__add btn btn-circle btn-ghost btn-sm"
                aria-label={addSlotLabel}
                title={addSlotLabel}
                onClick={onAddSlot}
              >
                +
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  )
}
