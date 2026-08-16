import { useEffect, useState } from 'react'
import { EveImage } from '@/components/EveImage'
import type { AttributeMap, ImplantBonuses } from '@/lib/skillAttributes'
import {
  ATTRIBUTE_MAX,
  ATTRIBUTE_MIN,
  EVE_ATTRIBUTES,
  effectiveAttributes,
  remainingRemapPoints,
} from '@/lib/skillAttributes'
import {
  ATTRIBUTE_ICON_TYPE_IDS,
  ATTRIBUTE_THEME,
  attributeBarWidth,
  IMPLANT_CATEGORY_TYPE_ID,
} from '@/lib/attributeDisplay'
import { IMPLANT_BONUS_MAX } from '@/lib/skillImplants'
import type { EveAttributeId } from '@/types'

interface SkillsAttributesPanelProps {
  bases: AttributeMap
  implants: ImplantBonuses
  seedImplants: ImplantBonuses
  hasEsiData: boolean
  onBaseChange: (next: AttributeMap) => void
  onImplantChange: (attr: keyof ImplantBonuses, value: number) => void
  onResetRemap: () => void
  onResetImplants: () => void
}

function clampImplant(value: number): number {
  if (Number.isNaN(value)) return 0
  return Math.min(IMPLANT_BONUS_MAX, Math.max(0, Math.round(value)))
}

function AttributeBaseInput({
  value,
  label,
  onCommit,
}: {
  value: number
  label: string
  onCommit: (next: number) => void
}) {
  const [text, setText] = useState(String(value))

  useEffect(() => {
    setText(String(value))
  }, [value])

  function commit() {
    const parsed = Number(text)
    if (Number.isNaN(parsed)) {
      setText(String(value))
      return
    }
    onCommit(parsed)
  }

  return (
    <input
      type="number"
      className="skills-attr__base-input input input-xs input-ghost tabular-nums"
      min={ATTRIBUTE_MIN}
      max={ATTRIBUTE_MAX}
      step={1}
      inputMode="numeric"
      aria-label={`${label} base attribute`}
      value={text}
      onChange={(event) => setText(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === 'Enter') {
          event.currentTarget.blur()
        }
      }}
    />
  )
}

export function SkillsAttributesPanel({
  bases,
  implants,
  seedImplants,
  hasEsiData,
  onBaseChange,
  onImplantChange,
  onResetRemap,
  onResetImplants,
}: SkillsAttributesPanelProps) {
  const effective = effectiveAttributes(bases, implants)
  const remaining = remainingRemapPoints(bases)
  const implantsDirty = EVE_ATTRIBUTES.some((key) => implants[key] !== seedImplants[key])

  function setBase(key: EveAttributeId, next: number) {
    const current = bases[key]
    if (next === current) return
    if (next > current) {
      const max = Math.min(ATTRIBUTE_MAX, current + Math.max(0, remaining))
      next = Math.min(next, max)
    } else {
      next = Math.max(ATTRIBUTE_MIN, next)
    }
    if (next === current) return
    onBaseChange({ ...bases, [key]: next })
  }

  return (
    <section className="skills-page__card skills-attr">
      <div className="skills-attr__header">
        <div className="min-w-0">
          <h2 className="skills-page__section-title">Attributes (preview)</h2>
          <p className="text-[11px] text-warning/80 mt-0.5 leading-snug">
            Session-only remap and implants.
            {hasEsiData ? ' Synced from EVE.' : ' Sign in to sync.'}
          </p>
        </div>
        <div className="skills-attr__header-meta">
          <p
            className={`text-[11px] tabular-nums shrink-0 ${remaining < 0 ? 'text-error' : 'opacity-60'}`}
          >
            Remap left: <strong>{remaining}</strong>
          </p>
          <div className="flex flex-wrap gap-1">
            <button type="button" className="btn btn-ghost btn-xs px-2 min-h-7" onClick={onResetRemap}>
              Reset remap
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-xs px-2 min-h-7"
              disabled={!implantsDirty}
              onClick={onResetImplants}
            >
              Reset implants{hasEsiData ? ' to EVE' : ''}
            </button>
          </div>
        </div>
      </div>

      <ul className="skills-attr__grid list-none p-0 m-0">
        {EVE_ATTRIBUTES.map((key) => {
          const theme = ATTRIBUTE_THEME[key]
          const implantDirty = implants[key] !== seedImplants[key]
          const remapMax = Math.min(ATTRIBUTE_MAX, bases[key] + Math.max(0, remaining))
          const canDecrease = bases[key] > ATTRIBUTE_MIN
          const canIncrease = bases[key] < remapMax

          return (
            <li
              key={key}
              className="skills-attr__col"
              style={{ ['--attr-color' as string]: theme.color }}
            >
              <EveImage
                id={ATTRIBUTE_ICON_TYPE_IDS[key]}
                size={32}
                alt={theme.label}
                className="skills-attr__attr-icon"
                framed
              />

              <div className="skills-attr__remap">
                <button
                  type="button"
                  className="skills-attr__step"
                  aria-label={`Decrease ${theme.label}`}
                  disabled={!canDecrease}
                  onClick={() => setBase(key, bases[key] - 1)}
                >
                  −
                </button>
                <AttributeBaseInput
                  value={bases[key]}
                  label={theme.label}
                  onCommit={(next) => setBase(key, next)}
                />
                <button
                  type="button"
                  className="skills-attr__step"
                  aria-label={`Increase ${theme.label}`}
                  disabled={!canIncrease}
                  onClick={() => setBase(key, bases[key] + 1)}
                >
                  +
                </button>
              </div>

              <div className="skills-attr__bar-track" aria-hidden>
                <div
                  className="skills-attr__bar-fill"
                  style={{ width: `${attributeBarWidth(effective[key])}%` }}
                />
              </div>

              <p className="skills-attr__meta tabular-nums">
                Total <span className="skills-attr__total">{effective[key]}</span>
              </p>

              <label className={`skills-attr__implant-field${implantDirty ? ' skills-attr__implant-field--dirty' : ''}`}>
                <EveImage
                  id={IMPLANT_CATEGORY_TYPE_ID}
                  size={18}
                  alt="Implant"
                  className="skills-attr__implant-cat-icon"
                />
                <span className="skills-attr__implant-prefix">+</span>
                <input
                  type="number"
                  className="skills-attr__implant-input input input-xs input-bordered tabular-nums"
                  min={0}
                  max={IMPLANT_BONUS_MAX}
                  step={1}
                  inputMode="numeric"
                  aria-label={`${theme.label} implant bonus`}
                  value={implants[key]}
                  onChange={(event) => onImplantChange(key, clampImplant(Number(event.target.value)))}
                />
              </label>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
