import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { LoadingState, PageHeader } from '@/components/Layout'
import { Panel } from '@/components/Panel'
import { MetricTile } from '@/components/MetricTile'
import { EveImage } from '@/components/EveImage'
import { FormFieldLabel } from '@/components/FormFieldLabel'
import { useSdeData } from '@/hooks/useSdeData'
import { useAuthStore } from '@/stores/authStore'
import { parseEft } from '@/lib/eftParse'
import {
  analyzeFit,
  buildTypeNameIndex,
  esiLevelsFromSkills,
  formatGapLevel,
  formatTrainTime,
  parsePastedSkillLevels,
  type FitGoal,
  type FitRole,
  type FitSkillAnalysis,
  type SkillGapRow,
} from '@/lib/fitSkills'
import { formatSkillLevel } from '@/lib/skillFields'
import { fittingByTypeId, loadFittingData } from '@/services/data/fittingLoader'
import { fetchCharacterSkills } from '@/services/character/characterSkillsService'
import { getValidAccessToken } from '@/services/auth/eveAuth'

const SAMPLE_EFT = `[Retribution, Pulse kite]
Heat Sink II
Heat Sink II
Damage Control II
Small Armor Repairer II
1MN Afterburner II
Small Capacitor Booster II, Cap Booster 25
Small Focused Beam Laser II, Multifrequency S
Small Focused Beam Laser II, Multifrequency S
Small Focused Beam Laser II, Multifrequency S
Small Focused Beam Laser II, Multifrequency S
[Empty High slot]
Small Energy Collision Accelerator I
Small Energy Metastasis Adjuster I
Small Energy Locus Coordinator I

Hobgoblin II x2
`

const ROLES: { id: FitRole; label: string }[] = [
  { id: 'dps', label: 'DPS' },
  { id: 'tank', label: 'Tank' },
  { id: 'logi', label: 'Logi' },
  { id: 'general', label: 'General' },
]

const SLOT_LABEL: Record<string, string> = {
  ship: 'Hull',
  high: 'High',
  mid: 'Mid',
  low: 'Low',
  rig: 'Rig',
  subsystem: 'Subsystem',
  drone: 'Drone',
  charge: 'Charge',
  implant: 'Implant',
  module: 'Module',
  unknown: 'Unknown',
}

export function FitSkillFinderPage() {
  const { data: sde, isLoading: sdeLoading } = useSdeData()
  const { data: fittingFile, isLoading: fittingLoading, error: fittingError } = useQuery({
    queryKey: ['fitting-data'],
    queryFn: loadFittingData,
    staleTime: Infinity,
  })

  const characters = useAuthStore((s) => s.characters)
  const activeCharacterId = useAuthStore((s) => s.activeCharacterId)
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)

  const [eftText, setEftText] = useState(SAMPLE_EFT)
  const [skillSource, setSkillSource] = useState<'esi' | 'paste'>(isAuthenticated ? 'esi' : 'paste')
  const [characterId, setCharacterId] = useState<number | null>(activeCharacterId)
  const [pastedSkills, setPastedSkills] = useState('')
  const [role, setRole] = useState<FitRole>('dps')
  const [goal, setGoal] = useState<FitGoal>('fits')
  const [budgetDays, setBudgetDays] = useState(14)
  const [analysis, setAnalysis] = useState<FitSkillAnalysis | null>(null)
  const [analyzeError, setAnalyzeError] = useState<string | null>(null)

  const typesByName = useMemo(
    () => buildTypeNameIndex(sde?.types ?? []),
    [sde?.types],
  )
  const fittingMap = useMemo(
    () => (fittingFile ? fittingByTypeId(fittingFile) : new Map()),
    [fittingFile],
  )

  const esiQuery = useQuery({
    queryKey: ['esi-skills-full', characterId],
    enabled: skillSource === 'esi' && characterId != null,
    queryFn: async () => {
      if (characterId == null) throw new Error('No character')
      const token = await getValidAccessToken(characterId)
      if (!token) throw new Error('Session expired. Sign in again.')
      return fetchCharacterSkills(characterId, token)
    },
    staleTime: 10 * 60 * 1000,
  })

  function runAnalyze() {
    setAnalyzeError(null)
    if (!sde) {
      setAnalyzeError('Static data is still loading.')
      return
    }
    const parsed = parseEft(eftText)
    if (!parsed.hullName) {
      setAnalyzeError('Paste an EFT fit starting with [Hull, Fit name].')
      return
    }

    let characterLevels: Map<number, number>
    if (skillSource === 'esi') {
      if (!esiQuery.data) {
        setAnalyzeError(
          esiQuery.error instanceof Error
            ? esiQuery.error.message
            : 'ESI skills are not loaded yet. Sign in, pick a character, and try again.',
        )
        return
      }
      characterLevels = esiLevelsFromSkills(esiQuery.data.skills)
    } else {
      characterLevels = parsePastedSkillLevels(pastedSkills, sde.skills)
    }

    setAnalysis(
      analyzeFit({
        parsed,
        typesByName,
        fittingByTypeId: fittingMap,
        skills: sde.skills,
        characterLevels,
        role,
        budgetDays,
      }),
    )
  }

  if (sdeLoading || fittingLoading) return <LoadingState />

  const queue = analysis
    ? goal === 'fits'
      ? analysis.queueFitsWithinBudget
      : analysis.queueFliesWithinBudget
    : []
  const queueAll = analysis ? (goal === 'fits' ? analysis.queueFits : analysis.queueFlies) : []

  return (
    <div className="flex flex-col min-h-0 gap-6">
      <PageHeader
        title="Fit skill finder"
        subtitle="Paste an EFT fit. See if the hull can online, which skills you still need, and a short queue that fits in your training window."
      />

      {fittingError ? (
        <div className="alert alert-error text-sm">Could not load fitting data.</div>
      ) : null}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Panel title="EFT fit">
          <label className="form-control w-full">
            <FormFieldLabel
              label="Fit"
              tooltip="Pyfa / EFT block: [Hull, name] then lows, mids, highs, rigs, drones."
            />
            <textarea
              className="textarea textarea-bordered font-mono text-xs min-h-64 w-full"
              value={eftText}
              onChange={(e) => setEftText(e.target.value)}
              spellCheck={false}
            />
          </label>
          <div className="flex flex-wrap gap-2 mt-3">
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEftText(SAMPLE_EFT)}>
              Sample Retribution
            </button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEftText('')}>
              Clear
            </button>
          </div>
        </Panel>

        <Panel title="Character and optimize">
          <fieldset className="mb-3">
            <legend className="text-xs font-medium mb-2">Skills from</legend>
            <div className="flex flex-wrap gap-3">
              <label className="label cursor-pointer gap-2 py-1">
                <input
                  type="radio"
                  className="radio radio-sm radio-primary"
                  checked={skillSource === 'esi'}
                  onChange={() => setSkillSource('esi')}
                />
                <span className="label-text text-sm">ESI character</span>
              </label>
              <label className="label cursor-pointer gap-2 py-1">
                <input
                  type="radio"
                  className="radio radio-sm radio-primary"
                  checked={skillSource === 'paste'}
                  onChange={() => setSkillSource('paste')}
                />
                <span className="label-text text-sm">Pasted levels</span>
              </label>
            </div>
          </fieldset>

          {skillSource === 'esi' ? (
            <label className="form-control w-full mb-3">
              <FormFieldLabel label="Character" />
              {characters.length ? (
                <select
                  className="select select-bordered select-sm"
                  value={characterId ?? ''}
                  onChange={(e) => setCharacterId(Number(e.target.value))}
                >
                  {characters.map((c) => (
                    <option key={c.characterId} value={c.characterId}>
                      {c.characterName}
                    </option>
                  ))}
                </select>
              ) : (
                <p className="text-sm opacity-70">Sign in with EVE in the nav bar, then sync skills.</p>
              )}
              {esiQuery.isFetching ? <p className="text-xs opacity-60 mt-1">Loading ESI skills…</p> : null}
            </label>
          ) : (
            <label className="form-control w-full mb-3">
              <FormFieldLabel
                label="Skill list"
                tooltip="One skill per line: Amarr Frigate V or Small Energy Turret: 4"
              />
              <textarea
                className="textarea textarea-bordered font-mono text-xs min-h-32 w-full"
                value={pastedSkills}
                onChange={(e) => setPastedSkills(e.target.value)}
                placeholder={'Amarr Frigate V\nCPU Management 4'}
                spellCheck={false}
              />
            </label>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="form-control">
              <FormFieldLabel
                label="Training window"
                tooltip="Queue is cut to what you can finish in this many days at ~30 SP/min."
                valueLabel={`${budgetDays}d`}
              />
              <input
                type="number"
                min={1}
                max={90}
                className="input input-bordered input-sm"
                value={budgetDays}
                onChange={(e) => setBudgetDays(Math.min(90, Math.max(1, Number(e.target.value) || 1)))}
              />
            </label>
            <div>
              <FormFieldLabel
                label="Queue goal"
                tooltip="Fits = online the hull. Flies well = required skills to V plus role support."
              />
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className={`btn btn-sm ${goal === 'fits' ? 'btn-primary' : 'btn-ghost'}`}
                  onClick={() => setGoal('fits')}
                >
                  Fits
                </button>
                <button
                  type="button"
                  className={`btn btn-sm ${goal === 'flies' ? 'btn-primary' : 'btn-ghost'}`}
                  onClick={() => setGoal('flies')}
                >
                  Flies well
                </button>
              </div>
            </div>
          </div>

          <fieldset className="mt-3">
            <legend className="text-xs font-medium mb-2">Role extras (flies well)</legend>
            <div className="flex flex-wrap gap-2">
              {ROLES.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={`btn btn-sm ${role === item.id ? 'btn-primary' : 'btn-ghost'}`}
                  onClick={() => setRole(item.id)}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </fieldset>

          <button type="button" className="btn btn-primary mt-4" onClick={runAnalyze}>
            Analyze fit
          </button>
          {analyzeError ? <p className="text-error text-sm mt-2">{analyzeError}</p> : null}
        </Panel>
      </div>

      {analysis ? (
        <>
          <div className="flex items-center gap-3 min-w-0">
            {analysis.hullTypeId ? (
              <EveImage id={analysis.hullTypeId} variant="render" size={64} alt="" />
            ) : null}
            <div className="min-w-0">
              <h2 className="text-lg font-semibold truncate">
                {analysis.hullName}
                {analysis.fitName ? ` · ${analysis.fitName}` : ''}
              </h2>
              <p className={`text-sm ${analysis.online ? 'text-success' : 'text-warning'}`}>
                {analysis.online
                  ? 'This hull can go online with the fitting skills below.'
                  : analysis.rigSizeOk
                    ? 'This hull is over PG, CPU, or calibration even at max fitting skills (no hull bonuses).'
                    : 'A rig is the wrong size for this hull.'}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <MetricTile
              label="Powergrid"
              value={`${analysis.pg.used.toFixed(1)} / ${analysis.pg.output.toFixed(1)}`}
              accent={analysis.pg.ok ? 'success' : 'warning'}
            />
            <MetricTile
              label="CPU"
              value={`${analysis.cpu.used.toFixed(1)} / ${analysis.cpu.output.toFixed(1)}`}
              accent={analysis.cpu.ok ? 'success' : 'warning'}
            />
            <MetricTile
              label="Calibration"
              value={`${analysis.cal.used.toFixed(0)} / ${analysis.cal.output.toFixed(0)}`}
              accent={analysis.cal.ok ? 'success' : 'warning'}
            />
          </div>

          {analysis.unresolved.length ? (
            <p className="text-sm text-warning">
              Unresolved names: {analysis.unresolved.join(', ')}
            </p>
          ) : null}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Panel title="Skills to fit">
              <SkillTable rows={analysis.fitSkills} empty="No extra skills to online." />
            </Panel>
            <Panel title="Skills to use">
              <SkillTable rows={analysis.useSkills} empty="No charge or drone skills on this fit." />
            </Panel>
          </div>

          <Panel title="What you already have">
            <div className="overflow-x-auto">
              <table className="table table-sm">
                <thead>
                  <tr>
                    <th>Piece</th>
                    <th>Where</th>
                    <th>Enough?</th>
                  </tr>
                </thead>
                <tbody>
                  {analysis.owned.map((piece, index) => (
                    <tr key={`${piece.name}-${index}`}>
                      <td>
                        <span className="inline-flex items-center gap-2 min-w-0">
                          {piece.typeId ? (
                            <EveImage id={piece.typeId} size={24} alt="" className="size-6" />
                          ) : null}
                          <span>
                            {piece.name}
                            {piece.quantity > 1 ? ` ×${piece.quantity}` : ''}
                          </span>
                        </span>
                      </td>
                      <td>{SLOT_LABEL[piece.slot] ?? piece.slot}</td>
                      <td>
                        {piece.enough ? (
                          <span className="text-success">Yes</span>
                        ) : (
                          <span className="text-warning">
                            {!piece.sizeOk
                              ? 'Wrong size'
                              : piece.missing
                                  .filter((m) => m.skillId !== 0)
                                  .map((m) => `${m.name} ${formatSkillLevel(m.need)}`)
                                  .join(', ') || 'No'}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>

          <Panel
            title={goal === 'fits' ? 'Queue to fit' : 'Queue to fly well'}
            actions={
              <span className="text-xs opacity-60">
                {queueAll.length
                  ? `${formatTrainTime(queueAll.reduce((s, i) => s + i.minutes, 0))} total · showing ${queue.length} in ${budgetDays}d`
                  : 'Nothing to train'}
              </span>
            }
          >
            {queue.length ? (
              <div className="overflow-x-auto">
                <table className="table table-sm">
                  <thead>
                    <tr>
                      <th>Skill</th>
                      <th>Levels</th>
                      <th>Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {queue.map((item) => (
                      <tr key={`${item.skillId}-${item.to}`}>
                        <td>{item.name}</td>
                        <td>
                          {formatSkillLevel(item.from)} → {formatSkillLevel(item.to)}
                        </td>
                        <td>{formatTrainTime(item.minutes)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm opacity-70">
                {queueAll.length
                  ? 'Nothing in this window finishes a full skill. Raise the day budget.'
                  : 'You already meet this goal.'}
              </p>
            )}
          </Panel>
        </>
      ) : null}
    </div>
  )
}

function SkillTable({ rows, empty }: { rows: SkillGapRow[]; empty: string }) {
  if (!rows.length) return <p className="text-sm opacity-70">{empty}</p>
  return (
    <div className="overflow-x-auto">
      <table className="table table-sm">
        <thead>
          <tr>
            <th>Skill</th>
            <th>Have / need</th>
            <th>Enough?</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.skillId}>
              <td>{row.name}</td>
              <td>{formatGapLevel(row)}</td>
              <td>{row.enough ? <span className="text-success">Yes</span> : <span className="text-warning">No</span>}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
