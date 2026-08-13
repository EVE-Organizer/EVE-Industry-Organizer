import { useMemo, useState } from 'react'
import { LoadingState, PageHeader } from '@/components/Layout'
import { Panel } from '@/components/Panel'
import { useFittingData } from '@/hooks/useFittingData'
import { useSdeData } from '@/hooks/useSdeData'
import { analyzeFit, type FitAnalysis } from '@/lib/fitting/analyzeFit'
import { buildFittingIndex, formatCpu, formatMw } from '@/lib/fitting/fitSkills'
import { useAuthStore } from '@/stores/authStore'
import { getValidAccessToken } from '@/services/auth/eveAuth'
import { fetchCharacterSkills } from '@/services/character/characterSkillsService'

const SAMPLE_EFT = `[Retribution, DPS T5/T6 Firestorm]

Imperial Navy Heat Sink
Imperial Navy Heat Sink
Centii A-Type Thermal Coating
Dark Blood Multispectrum Coating
Heat Sink II

Coreli A-Type 1MN Afterburner
Republic Fleet Small Cap Battery

Coreli A-Type Small Remote Armor Repairer
Small Focused Beam Laser II
Small Focused Beam Laser II
Small Focused Beam Laser II
Small Focused Beam Laser II

Small Energy Burst Aerator II
Small Thermal Armor Reinforcer II

Aurora S x4
Gleam S x4
`

function roman(level: number): string {
  return ['0', 'I', 'II', 'III', 'IV', 'V'][level] ?? String(level)
}

function LoadBar({
  label,
  used,
  output,
  ok,
  format,
}: {
  label: string
  used: number
  output: number
  ok: boolean
  format: (value: number) => string
}) {
  const pct = output > 0 ? Math.min(100, (used / output) * 100) : 0
  return (
    <div className="flex flex-col gap-1 min-w-0">
      <div className="flex justify-between gap-2 text-sm">
        <span>{label}</span>
        <span className={ok ? 'text-success' : 'text-error'}>
          {format(used)} / {format(output)}
        </span>
      </div>
      <progress
        className={`progress w-full ${ok ? 'progress-success' : 'progress-error'}`}
        value={pct}
        max={100}
      />
    </div>
  )
}

export function FitSkillsPage() {
  const { data: fitting, isLoading: fittingLoading, error: fittingError } = useFittingData()
  const { data: sde, isLoading: sdeLoading } = useSdeData()
  const character = useAuthStore((state) => state.character)
  const [eft, setEft] = useState(SAMPLE_EFT)
  const [analysis, setAnalysis] = useState<FitAnalysis | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [trained, setTrained] = useState<Map<number, number> | undefined>()
  const [esiBusy, setEsiBusy] = useState(false)
  const [esiError, setEsiError] = useState<string | null>(null)

  const index = useMemo(() => (fitting ? buildFittingIndex(fitting) : null), [fitting])
  const skills = sde?.skills ?? []

  function runAnalyze(skillMap = trained) {
    if (!index) return
    try {
      setError(null)
      setAnalysis(analyzeFit(eft, index, skills, skillMap))
    } catch (err) {
      setAnalysis(null)
      setError(err instanceof Error ? err.message : 'Could not read this fit')
    }
  }

  async function loadEsiSkills() {
    if (!character) return
    setEsiBusy(true)
    setEsiError(null)
    try {
      const token = await getValidAccessToken(character.characterId)
      if (!token) throw new Error('Sign in again to load skills')
      const esi = await fetchCharacterSkills(character.characterId, token)
      const map = new Map(esi.skills.map((row) => [row.skill_id, row.trained_skill_level]))
      setTrained(map)
      if (index) setAnalysis(analyzeFit(eft, index, skills, map))
    } catch (err) {
      setEsiError(err instanceof Error ? err.message : 'Skill fetch failed')
    } finally {
      setEsiBusy(false)
    }
  }

  if (fittingLoading || sdeLoading) return <LoadingState />

  if (fittingError || !fitting) {
    return (
      <div className="alert alert-warning">
        Fitting data is missing. Run <code>pnpm rebuild-fitting</code>.
      </div>
    )
  }

  const load = analysis?.load
  const gaps = analysis?.skills.filter((row) => (row.trained ?? 0) < row.required) ?? []

  return (
    <div className="flex flex-col min-h-0 gap-6">
      <PageHeader
        title="Fit skills"
        subtitle="Paste an EFT fit. See CPU, powergrid, and the skills needed to online it."
      />

      <Panel title="Fit">
        <label className="form-control w-full">
          <span className="label-text text-xs font-medium mb-1">EFT paste</span>
          <textarea
            className="textarea textarea-bordered font-mono text-sm min-h-64 w-full"
            value={eft}
            onChange={(event) => setEft(event.target.value)}
            spellCheck={false}
          />
        </label>
        <div className="flex flex-wrap gap-2 mt-4">
          <button type="button" className="btn btn-primary" onClick={() => runAnalyze()}>
            Check fit
          </button>
          <button type="button" className="btn btn-ghost" onClick={() => setEft(SAMPLE_EFT)}>
            Sample Retribution
          </button>
          {character ? (
            <button
              type="button"
              className="btn btn-ghost"
              disabled={esiBusy}
              onClick={() => void loadEsiSkills()}
            >
              {esiBusy ? 'Loading skills…' : `Compare ${character.characterName}`}
            </button>
          ) : (
            <span className="text-xs opacity-60 self-center">Sign in to compare trained skills.</span>
          )}
        </div>
      </Panel>

      {error ? (
        <div className="alert alert-warning text-sm">
          <span>{error}</span>
        </div>
      ) : null}
      {esiError ? (
        <div className="alert alert-warning text-sm">
          <span>{esiError}</span>
        </div>
      ) : null}

      {analysis && load ? (
        <>
          <Panel
            title={analysis.fitName ? `${analysis.shipName}: ${analysis.fitName}` : analysis.shipName}
            actions={
              <span className={`badge ${analysis.possible ? 'badge-success' : 'badge-error'}`}>
                {analysis.possible ? 'Fits at skills V' : 'Cannot fit at skills V'}
              </span>
            }
          >
            {analysis.unknown.length ? (
              <p className="text-sm text-warning mb-3">
                Unknown items: {analysis.unknown.join(', ')}
              </p>
            ) : null}
            <p className="text-xs opacity-70 mb-3">
              {trained
                ? "CPU and powergrid below use this character's skills. The badge is whether the hull can online the fit with all fitting skills at V."
                : 'CPU and powergrid below assume all fitting skills at V (CPU/PGM, Weapon Upgrades, AWU, rigging).'}
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <LoadBar
                label="CPU"
                used={load.cpuUsed}
                output={load.cpuOutput}
                ok={load.cpuOk}
                format={formatCpu}
              />
              <LoadBar
                label="Powergrid"
                used={load.powerUsed}
                output={load.powerOutput}
                ok={load.powerOk}
                format={formatMw}
              />
            </div>
            {trained && analysis.possible && !analysis.fits ? (
              <p className="text-sm text-warning mt-3">
                This hull can online the fit at skills V ({formatCpu(analysis.maxLoad.cpuUsed)} /{' '}
                {formatCpu(analysis.maxLoad.cpuOutput)} CPU, {formatMw(analysis.maxLoad.powerUsed)} /{' '}
                {formatMw(analysis.maxLoad.powerOutput)} PG). This character is still short.
              </p>
            ) : null}
            {!analysis.possible ? (
              <p className="text-sm text-error mt-3">
                This hull cannot online the fit even with CPU Management, Power Grid Management,
                Weapon Upgrades, Advanced Weapon Upgrades, and matching rigging at V.
              </p>
            ) : analysis.minLevels && trained && !analysis.fits ? (
              <p className="text-xs opacity-70 mt-3">
                One combo that fits: CPU Management {roman(analysis.minLevels.cpuManagement)},
                Power Grid Management {roman(analysis.minLevels.powerGridManagement)}, Weapon
                Upgrades {roman(analysis.minLevels.weaponUpgrades)}, Advanced Weapon Upgrades{' '}
                {roman(analysis.minLevels.advancedWeaponUpgrades)}
                {analysis.minLevels.rigging.energy
                  ? `, Energy Weapon Rigging ${roman(analysis.minLevels.rigging.energy)}`
                  : ''}
                .
              </p>
            ) : null}
          </Panel>

          <Panel title="Skills to fly">
            {gaps.length === 0 && analysis.fits ? (
              <p className="text-sm text-success mb-3">
                {trained
                  ? 'This character can online the fit.'
                  : 'CPU and powergrid work at skills V. Train the list below to actually fly it.'}
              </p>
            ) : (
              <p className="text-sm text-error mb-3">
                {gaps.length} skill{gaps.length === 1 ? '' : 's'} below the level needed to fly this
                fit
                {!trained ? ' (no character loaded, trained column is 0)' : ''}.
              </p>
            )}
            <div className="overflow-x-auto">
              <table className="table table-sm">
                <thead>
                  <tr>
                    <th>Skill</th>
                    <th>Need</th>
                    <th>Trained</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {analysis.skills.map((row) => {
                    const have = row.trained ?? 0
                    const short = have < row.required
                    return (
                      <tr key={row.skillId} className={short ? 'text-error' : 'text-success'}>
                        <td>{row.name}</td>
                        <td>{roman(row.required)}</td>
                        <td>{roman(have)}</td>
                        <td>{short ? 'Missing' : 'Ok'}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </Panel>
        </>
      ) : null}
    </div>
  )
}
