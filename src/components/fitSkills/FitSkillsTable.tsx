import { useEffect, useMemo, useState } from 'react'
import {
  FIT_SKILL_GROUP_HINTS,
  groupFitSkills,
  romanLevel,
  type FitSkillGroup,
  type FitSkillGroupName,
} from '@/lib/fitting/skillDisplay'
import type { EsiSkillQueueEntry } from '@/services/character/characterSkillQueueService'
import {
  fitSkillStatusClass,
  fitSkillStatusLabel,
  isFitSkillGap,
  resolveFitSkillStatus,
} from '@/lib/fitting/fitSkillStatus'
import type { FitSkillRow } from '@/lib/fitting/types'

interface FitSkillsTableProps {
  rows: FitSkillRow[]
  skillQueue?: readonly EsiSkillQueueEntry[]
  previewSkills: Map<number, number>
  onPreviewChange: (skillId: number, level: number) => void
  onAllV?: () => void
  onZero?: () => void
  onUseCharacter?: () => void
}

const COL_NEED = 'w-[4.5rem]'
const COL_PREVIEW = 'w-[4rem]'
const COL_TRAINED = 'w-[7rem]'
const COL_STATUS = 'w-[5.5rem]'

function clampLevel(level: number): number {
  return Math.min(5, Math.max(0, Math.floor(level)))
}

export function FitSkillsTable({
  rows,
  skillQueue = [],
  previewSkills,
  onPreviewChange,
  onAllV,
  onZero,
  onUseCharacter,
}: FitSkillsTableProps) {
  const groups = useMemo(() => groupFitSkills(rows), [rows])
  const categories = useMemo(() => groups.map((g) => g.title), [groups])
  const [active, setActive] = useState<FitSkillGroupName | 'All'>('All')

  useEffect(() => {
    if (active !== 'All' && !categories.includes(active)) {
      setActive(categories[0] ?? 'All')
    }
  }, [active, categories])

  const visibleGroups = useMemo(
    () => (active === 'All' ? groups : groups.filter((group) => group.title === active)),
    [active, groups],
  )

  if (!rows.length) {
    return <p className="text-sm opacity-60">No skills for this fit.</p>
  }

  return (
    <div className="flex flex-col gap-4 min-w-0">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1">
          <CategoryPill
            label="All"
            active={active === 'All'}
            count={rows.length}
            onClick={() => setActive('All')}
          />
          {groups.map((group) => (
            <CategoryPill
              key={group.title}
              label={group.title}
              active={active === group.title}
              count={group.rows.length}
              onClick={() => setActive(group.title)}
            />
          ))}
        </div>
        <div className="w-px h-5 bg-eve-border/50 hidden sm:block" />
        <div className="flex flex-wrap gap-1">
          {onAllV ? (
            <button type="button" className="btn btn-xs h-7 min-h-0 rounded-md btn-ghost bg-base-200/50" onClick={onAllV}>
              All V
            </button>
          ) : null}
          {onZero ? (
            <button type="button" className="btn btn-xs h-7 min-h-0 rounded-md btn-ghost bg-base-200/50" onClick={onZero}>
              Zero
            </button>
          ) : null}
          {onUseCharacter ? (
            <button
              type="button"
              className="btn btn-xs h-7 min-h-0 rounded-md btn-ghost bg-base-200/50"
              onClick={onUseCharacter}
            >
              Use character
            </button>
          ) : null}
        </div>
      </div>

      <div className="rounded-lg border border-eve-border/60 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="table table-sm table-fixed w-full min-w-[32rem]">
            <thead>
              <tr className="bg-base-300/40">
                <th>Skill</th>
                <th className={`${COL_NEED} text-right`}>Need</th>
                <th className={`${COL_PREVIEW} text-center`}>Preview</th>
                <th className={`${COL_TRAINED} text-right`}>Trained</th>
                <th className={COL_STATUS}>Status</th>
              </tr>
            </thead>
            {visibleGroups.map((group) => (
              <SkillCategoryBody
                key={group.title}
                group={group}
                focused={active !== 'All'}
                skillQueue={skillQueue}
                previewSkills={previewSkills}
                onPreviewChange={onPreviewChange}
              />
            ))}
          </table>
        </div>
      </div>
    </div>
  )
}

function SkillCategoryBody({
  group,
  focused,
  skillQueue,
  previewSkills,
  onPreviewChange,
}: {
  group: FitSkillGroup
  focused: boolean
  skillQueue: readonly EsiSkillQueueEntry[]
  previewSkills: Map<number, number>
  onPreviewChange: (skillId: number, level: number) => void
}) {
  const missing = group.rows.filter((row) =>
    isFitSkillGap(row.skillId, row.required, row.trained ?? 0, skillQueue),
  ).length

  return (
    <tbody
      className={
        focused
          ? 'bg-primary/5 [&>tr:first-child]:border-primary/30'
          : 'border-t border-eve-border/40 first:border-t-0'
      }
    >
      <tr className="bg-base-300/30 border-t border-eve-border/40">
        <td colSpan={5} className="py-2 px-3">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold">{group.title}</h3>
            <span className="text-[10px] tabular-nums opacity-50 shrink-0">
              {group.rows.length} skill{group.rows.length === 1 ? '' : 's'}
              {missing ? ` · ${missing} missing` : ''}
            </span>
          </div>
          <p className="text-xs opacity-60 mt-0.5 leading-relaxed">{FIT_SKILL_GROUP_HINTS[group.title]}</p>
        </td>
      </tr>
      {group.rows.map((row) => {
        const trained = row.trained ?? 0
        const preview = previewSkills.get(row.skillId) ?? trained ?? row.required
        const { status, queuedTo } = resolveFitSkillStatus(
          row.skillId,
          row.required,
          trained,
          skillQueue,
        )
        return (
          <tr key={row.skillId} className={fitSkillStatusClass(status)}>
            <td className="truncate">{row.name}</td>
            <td className="text-right tabular-nums">{romanLevel(row.required)}</td>
            <td className="text-center">
              <input
                type="number"
                min={0}
                max={5}
                step={1}
                className="input input-bordered input-xs w-12 h-7 min-h-0 px-1 text-center tabular-nums"
                value={preview}
                onChange={(e) => {
                  const next = Number(e.target.value)
                  if (Number.isFinite(next)) onPreviewChange(row.skillId, clampLevel(next))
                }}
                aria-label={`Preview level for ${row.name}`}
              />
            </td>
            <td className="text-right tabular-nums whitespace-nowrap">
              {romanLevel(trained)}
              {queuedTo != null && queuedTo > trained ? (
                <span className="opacity-50"> → {romanLevel(queuedTo)}</span>
              ) : null}
            </td>
            <td>{fitSkillStatusLabel(status)}</td>
          </tr>
        )
      })}
    </tbody>
  )
}

function CategoryPill({
  label,
  active,
  count,
  onClick,
}: {
  label: string
  active: boolean
  count: number
  onClick: () => void
}) {
  return (
    <button
      type="button"
      className={`btn btn-xs h-7 min-h-0 rounded-md ${
        active ? 'btn-primary' : 'btn-ghost bg-base-200/50 opacity-70 hover:opacity-100'
      }`}
      onClick={onClick}
    >
      {label}
      <span className={`ml-1 tabular-nums ${active ? 'opacity-80' : 'opacity-50'}`}>{count}</span>
    </button>
  )
}
