import { useEffect, useRef, useState } from 'react'
import { CharacterAvatar } from '@/components/EveImage'
import { RefreshButton } from '@/components/RefreshButton'
import { Tooltip } from '@/components/Tooltip'
import { PlanOwnerPicker, type PlanOwnerOption } from '@/components/plan/PlanOwnerPicker'
import { formatDecimal } from '@/lib/profit'
import type { ResolvedPlanCharacter } from '@/lib/planCharacters'
import { useDataStatusStore } from '@/stores/dataStatusStore'
import type { PlanCharacterKey } from '@/types'

interface PlanCharacterBarProps {
  resolved: ResolvedPlanCharacter[]
  ownerOptions: PlanOwnerOption[]
  available: PlanOwnerOption[]
  sellerKey?: PlanCharacterKey
  startedAt?: string
  readOnly?: boolean
  refreshCharacterIds?: number[]
  behindHours?: number
  eta?: Date
  onAdd: (key: PlanCharacterKey) => void
  onRemove: (key: PlanCharacterKey) => void
  onSetSeller: (key: PlanCharacterKey | undefined) => void
  onReset: () => void
  onOpenStartDialog: () => void
}

function agoFromSource(checkedAt: number | undefined): string | null {
  if (!checkedAt) return null
  const minutes = Math.round((Date.now() - checkedAt) / 60_000)
  if (minutes < 1) return 'just now'
  return `${minutes}m ago`
}

function FreshnessLine({ characterIds }: { characterIds: number[] }) {
  const sources = useDataStatusStore((s) => s.sources)
  const jobsTimes = characterIds.map((id) => sources[`jobs-${id}`]?.checkedAt)
  const assetsTimes = characterIds.map((id) => sources[`assets-${id}`]?.checkedAt)
  const jobsAgo = agoFromSource(
    Math.max(...jobsTimes.filter((t): t is number => t != null), 0) || undefined,
  )
  const assetsAgo = agoFromSource(
    Math.max(...assetsTimes.filter((t): t is number => t != null), 0) || undefined,
  )
  if (!jobsAgo && !assetsAgo) return null
  return (
    <p className="text-xs opacity-70 w-full">
      {jobsAgo ? `Jobs updated ${jobsAgo}` : null}
      {jobsAgo && assetsAgo ? ' · ' : null}
      {assetsAgo ? `Assets updated ${assetsAgo}` : null}
    </p>
  )
}

function AddMenu({
  available,
  onAdd,
}: {
  available: PlanOwnerOption[]
  onAdd: (key: PlanCharacterKey) => void
}) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onMouseDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onMouseDown)
    return () => document.removeEventListener('mousedown', onMouseDown)
  }, [open])

  if (available.length === 0) return null
  return (
    <div ref={rootRef} className="relative">
      <Tooltip text="Add a character to this plan" placement="top">
        <button
          type="button"
          className="btn btn-ghost btn-xs btn-circle border border-dashed border-eve-border"
          aria-label="Add character"
          aria-expanded={open}
          onClick={() => setOpen((prev) => !prev)}
        >
          +
        </button>
      </Tooltip>
      {open ? (
        <ul className="absolute left-0 top-full z-30 mt-1 min-w-44 overflow-hidden rounded-lg border border-eve-border bg-base-200 py-1 shadow-lg">
          {available.map((option) => (
            <li key={option.key}>
              <button
                type="button"
                className="flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-xs hover:bg-base-300/80"
                onClick={() => {
                  onAdd(option.key)
                  setOpen(false)
                }}
              >
                <CharacterAvatar characterId={option.characterId} name={option.name} size={24} />
                <span className="truncate">{option.name}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}

/** Plan crew, seller, freshness, and Start / Reset — lives under the plan title. */
export function PlanCharacterBar({
  resolved,
  ownerOptions,
  available,
  sellerKey,
  startedAt,
  readOnly = false,
  refreshCharacterIds = [],
  behindHours = 0,
  eta,
  onAdd,
  onRemove,
  onSetSeller,
  onReset,
  onOpenStartDialog,
}: PlanCharacterBarProps) {
  const showSeller = ownerOptions.length >= 2

  return (
    <div className="flex flex-col gap-2 pt-3 mt-3 border-t border-eve-border/40">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
          <span className="text-[11px] uppercase tracking-wide opacity-50">Characters</span>
          {resolved.length === 0 ? (
            <Tooltip
              text="This plan uses skills and slots from Settings until you add a character."
              placement="top"
            >
              <span className="inline-flex cursor-help items-center rounded-full border border-eve-border/60 bg-base-100/60 px-2.5 py-1 text-xs">
                Settings
              </span>
            </Tooltip>
          ) : (
            resolved.map((character) => {
              const option = ownerOptions.find((o) => o.key === character.key)
              const { manufacturing, reactions, research } = character.slots
              return (
                <span
                  key={character.key}
                  className="inline-flex items-center gap-1.5 rounded-full border border-eve-border/60 bg-base-100/60 py-0.5 pl-0.5 pr-2 text-xs"
                >
                  <CharacterAvatar
                    characterId={option?.characterId}
                    name={character.name}
                    size={22}
                  />
                  <Tooltip
                    text={`${manufacturing} manufacturing · ${reactions} reaction · ${research} science slots${
                      character.skillsAssumed ? '. Skills assumed from Settings.' : ''
                    }`}
                    placement="top"
                  >
                    <span className="cursor-help">{character.name}</span>
                  </Tooltip>
                  {!readOnly ? (
                    <button
                      type="button"
                      className="opacity-50 hover:opacity-100"
                      aria-label={`Remove ${character.name}`}
                      onClick={() => onRemove(character.key)}
                    >
                      ×
                    </button>
                  ) : null}
                </span>
              )
            })
          )}
          {!readOnly ? <AddMenu available={available} onAdd={onAdd} /> : null}
          {!readOnly && resolved.length === 0 && available.length === 0 ? (
            <span className="text-xs text-base-content/55">
              Sign in with EVE, or add a manual character in Settings.
            </span>
          ) : null}
        </div>
        {showSeller ? (
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] uppercase tracking-wide opacity-50">Seller</span>
            <PlanOwnerPicker
              options={ownerOptions}
              value={sellerKey}
              disabled={readOnly}
              label="Seller"
              onChange={onSetSeller}
            />
          </div>
        ) : null}
      </div>

      {startedAt ? (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs opacity-80">
          <span>Started {new Date(startedAt).toLocaleString()}</span>
          {behindHours > 0.05 ? (
            <span className="text-warning font-medium">
              Behind +{formatDecimal(behindHours, 1)}h
            </span>
          ) : (
            <span className="text-success">On schedule</span>
          )}
          {eta ? <span>ETA {eta.toLocaleString()}</span> : null}
          {!readOnly && refreshCharacterIds.length > 0 ? (
            <RefreshButton
              scope="characters"
              characterIds={refreshCharacterIds}
              size="xs"
              className="btn btn-ghost btn-xs"
            />
          ) : null}
          {!readOnly ? (
            <button type="button" className="btn btn-xs btn-outline ml-auto" onClick={onReset}>
              Reset progress
            </button>
          ) : null}
        </div>
      ) : !readOnly ? (
        <div className="flex flex-wrap items-center gap-2">
          <Tooltip
            text="Freeze the job split and start tracking progress from your ESI jobs and stock"
            placement="top"
          >
            <button type="button" className="btn btn-xs btn-primary" onClick={onOpenStartDialog}>
              Start plan
            </button>
          </Tooltip>
        </div>
      ) : null}

      {startedAt && refreshCharacterIds.length > 0 ? (
        <FreshnessLine characterIds={refreshCharacterIds} />
      ) : null}
    </div>
  )
}
