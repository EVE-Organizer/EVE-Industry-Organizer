import { useMemo, useState } from 'react'
import { FitLoadStats } from '@/components/fitSkills/FitLoadStats'
import { FitSkillsTable } from '@/components/fitSkills/FitSkillsTable'
import { FormFieldLabel } from '@/components/FormFieldLabel'
import { LoadingState, PageHeader } from '@/components/Layout'
import { Panel } from '@/components/Panel'
import { useFittingData } from '@/hooks/useFittingData'
import { useSdeData } from '@/hooks/useSdeData'
import { analyzeFit, type FitAnalysis } from '@/lib/fitting/analyzeFit'
import { buildFittingIndex, formatCpu, formatMw } from '@/lib/fitting/fitSkills'
import { SAMPLE_RETRIBUTION_EFT } from '@/lib/fitting/sampleEft'
import { formatFittingCombo } from '@/lib/fitting/skillDisplay'
import { getValidAccessToken } from '@/services/auth/eveAuth'
import { fetchCharacterSkills } from '@/services/character/characterSkillsService'
import { useAuthStore } from '@/stores/authStore'

export function FitSkillsPage() {
  const { data: fitting, isLoading: fittingLoading, error: fittingError } = useFittingData()
  const { data: sde, isLoading: sdeLoading } = useSdeData()
  const character = useAuthStore((state) => state.character)
  const [eft, setEft] = useState(SAMPLE_RETRIBUTION_EFT)
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

  const gaps = analysis?.skills.filter((row) => (row.trained ?? 0) < row.required) ?? []

  return (
    <div className="flex flex-col min-h-0 gap-6">
      <PageHeader
        title="Fit skills"
        subtitle="Paste an EFT fit. See CPU, powergrid, and the skills needed to online it."
      />

      <Panel title="Fit">
        <label className="form-control w-full">
          <FormFieldLabel label="EFT paste" size="sm" />
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
          <button type="button" className="btn btn-ghost" onClick={() => setEft(SAMPLE_RETRIBUTION_EFT)}>
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

      {analysis?.load ? (
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
            <p className="text-xs opacity-70 mb-4">
              {trained
                ? "Bars use this character's skills. The badge is the hull at all fitting skills V."
                : 'Bars assume fitting skills at V (CPU/PGM, Weapon Upgrades, AWU, rigging).'}
            </p>
            <FitLoadStats load={analysis.load} />
            <FitLoadNotes analysis={analysis} hasSheet={Boolean(trained)} />
          </Panel>

          <Panel title="Skills to fly">
            <FitSkillsSummary
              gapCount={gaps.length}
              fits={analysis.fits}
              hasSheet={Boolean(trained)}
            />
            <FitSkillsTable rows={analysis.skills} />
          </Panel>
        </>
      ) : null}
    </div>
  )
}

function FitLoadNotes({
  analysis,
  hasSheet,
}: {
  analysis: FitAnalysis
  hasSheet: boolean
}) {
  if (!analysis.possible) {
    return (
      <p className="text-sm text-error mt-4">
        This hull cannot online the fit even with CPU Management, Power Grid Management, Weapon
        Upgrades, Advanced Weapon Upgrades, and matching rigging at V.
      </p>
    )
  }
  if (hasSheet && !analysis.fits) {
    return (
      <div className="flex flex-col gap-2 mt-4 text-sm">
        <p className="text-warning">
          Fits at skills V ({formatCpu(analysis.maxLoad.cpuUsed)} /{' '}
          {formatCpu(analysis.maxLoad.cpuOutput)} CPU, {formatMw(analysis.maxLoad.powerUsed)} /{' '}
          {formatMw(analysis.maxLoad.powerOutput)} PG). This character is still short.
        </p>
        {analysis.minLevels ? (
          <p className="text-xs opacity-70">Train at least: {formatFittingCombo(analysis.minLevels)}.</p>
        ) : null}
      </div>
    )
  }
  return null
}

function FitSkillsSummary({
  gapCount,
  fits,
  hasSheet,
}: {
  gapCount: number
  fits: boolean
  hasSheet: boolean
}) {
  if (gapCount === 0 && fits) {
    return (
      <p className="text-sm text-success mb-3">
        {hasSheet
          ? 'This character can online the fit.'
          : 'CPU and powergrid work at skills V. Train the list below to fly it.'}
      </p>
    )
  }
  return (
    <p className="text-sm text-error mb-3">
      {gapCount} skill{gapCount === 1 ? '' : 's'} below the level needed to fly this fit
      {!hasSheet ? ' (no character loaded, trained column is 0)' : ''}.
    </p>
  )
}
