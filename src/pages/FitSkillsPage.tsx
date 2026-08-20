import { useMemo, useRef, useState } from 'react'

import { useQueryClient } from '@tanstack/react-query'

import { FitChargeSelects } from '@/components/fitSkills/FitChargeSelects'

import { FitLoadStats } from '@/components/fitSkills/FitLoadStats'

import { FitSkillsTable } from '@/components/fitSkills/FitSkillsTable'

import { FitStatsDock } from '@/components/fitSkills/FitStatsDock'

import { FormFieldLabel } from '@/components/FormFieldLabel'

import { LoadingState, PageHeader } from '@/components/Layout'

import { Panel } from '@/components/Panel'

import { useFittingData } from '@/hooks/useFittingData'

import { useCharacterSkillQueue } from '@/hooks/useCharacterSkillsData'

import { useSdeData } from '@/hooks/useSdeData'

import { analyzeFit, type FitAnalysis } from '@/lib/fitting/analyzeFit'

import { initialChargeSelections } from '@/lib/fitting/fitCharges'

import { buildFittingIndex, formatCpu, formatMw } from '@/lib/fitting/fitSkills'

import { maxoutSkillsForFit } from '@/lib/fitting/maxoutSkills'

import { SAMPLE_RETRIBUTION_EFT } from '@/lib/fitting/sampleEft'

import { formatFittingCombo, mergeAllFitSkills } from '@/lib/fitting/skillDisplay'

import { isFitSkillGap } from '@/lib/fitting/fitSkillStatus'

import type { FleetLinkId } from '@/lib/fitting/types'

import { getValidAccessToken } from '@/services/auth/eveAuth'

import { fetchCharacterImplants } from '@/services/character/characterImplantsService'

import { fetchCharacterSkillQueue } from '@/services/character/characterSkillQueueService'

import { fetchCharacterSkills } from '@/services/character/characterSkillsService'

import { useAuthStore } from '@/stores/authStore'



export function FitSkillsPage() {

  const queryClient = useQueryClient()

  const statsPanelRef = useRef<HTMLDivElement>(null)

  const { data: fitting, isLoading: fittingLoading, error: fittingError } = useFittingData()

  const { data: sde, isLoading: sdeLoading } = useSdeData()

  const character = useAuthStore((state) => state.character)

  const [eft, setEft] = useState(SAMPLE_RETRIBUTION_EFT)

  const [analysis, setAnalysis] = useState<FitAnalysis | null>(null)

  const [error, setError] = useState<string | null>(null)

  const [trained, setTrained] = useState<Map<number, number> | undefined>()

  const [implantIds, setImplantIds] = useState<number[]>([])

  const [previewSkills, setPreviewSkills] = useState<Map<number, number>>(new Map())

  const [chargeSelections, setChargeSelections] = useState<Map<string, number | null>>(new Map())

  const [fleetLinks, setFleetLinks] = useState<FleetLinkId[]>([])

  const [rangeKm, setRangeKm] = useState(12)

  const [esiBusy, setEsiBusy] = useState(false)

  const [esiError, setEsiError] = useState<string | null>(null)



  const index = useMemo(() => (fitting ? buildFittingIndex(fitting) : null), [fitting])

  const skills = sde?.skills ?? []

  const { data: skillQueue = [] } = useCharacterSkillQueue(trained ? character?.characterId : undefined)



  function initPreviewFromAnalysis(result: FitAnalysis, skillMap?: Map<number, number>) {
    const maxout = maxoutSkillsForFit(result.ship, result.items, fleetLinks)
    const map = new Map<number, number>()
    for (const row of result.skills) {
      map.set(row.skillId, skillMap?.get(row.skillId) ?? row.required)
    }
    for (const entry of maxout) {
      map.set(entry.skillId, skillMap?.get(entry.skillId) ?? entry.level)
    }
    setPreviewSkills(map)
    return map
  }



  function handleCheckFit() {

    if (!index) return

    try {

      setError(null)

      const draft = analyzeFit(eft, index, skills, trained, { fleetLinks, rangeKm, implantTypeIds: implantIds })

      const charges = initialChargeSelections(draft.chargeGroups)

      setChargeSelections(charges)

      const preview = initPreviewFromAnalysis(draft, trained)

      const result = analyzeFit(eft, index, skills, trained, {

        previewSkills: preview,

        chargeSelections: charges,

        fleetLinks,

        rangeKm,

        implantTypeIds: implantIds,

      })

      setAnalysis(result)

    } catch (err) {

      setAnalysis(null)

      setError(err instanceof Error ? err.message : 'Could not read this fit')

    }

  }



  async function loadEsiSkills() {

    if (!character || !index) return

    setEsiBusy(true)

    setEsiError(null)

    try {

      const token = await getValidAccessToken(character.characterId)

      if (!token) throw new Error('Sign in again to load skills')

      const [esi, implants, queue] = await Promise.all([

        fetchCharacterSkills(character.characterId, token),

        fetchCharacterImplants(character.characterId, token),

        fetchCharacterSkillQueue(character.characterId, token),

      ])

      const map = new Map(esi.skills.map((row) => [row.skill_id, row.trained_skill_level]))

      setTrained(map)

      setImplantIds(implants)

      queryClient.setQueryData(['character-skillqueue', character.characterId], queue)

      const draft = analyzeFit(eft, index, skills, map, {

        chargeSelections,

        fleetLinks,

        rangeKm,

        implantTypeIds: implants,

      })

      const preview = initPreviewFromAnalysis(draft, map)

      setAnalysis(

        analyzeFit(eft, index, skills, map, {

          previewSkills: preview,

          chargeSelections,

          fleetLinks,

          rangeKm,

          implantTypeIds: implants,

        }),

      )

    } catch (err) {

      setEsiError(err instanceof Error ? err.message : 'Skill fetch failed')

    } finally {

      setEsiBusy(false)

    }

  }



  function setPreviewAllV() {
    if (!analysis) return
    const map = new Map(previewSkills)
    for (const row of allSkillRows) map.set(row.skillId, 5)
    setPreviewSkills(map)
    rerunWithPreview(map)
  }

  function setPreviewZero() {
    if (!analysis) return
    const map = new Map(previewSkills)
    for (const row of allSkillRows) map.set(row.skillId, 0)
    setPreviewSkills(map)
    rerunWithPreview(map)
  }

  function setPreviewFromCharacter() {
    if (!analysis || !trained) return
    const map = new Map(previewSkills)
    for (const row of allSkillRows) {
      map.set(row.skillId, trained.get(row.skillId) ?? 0)
    }
    setPreviewSkills(map)
    rerunWithPreview(map)
  }



  function rerunWithPreview(map: Map<number, number>, charges = chargeSelections, links = fleetLinks, range = rangeKm) {

    if (!index) return

    setAnalysis(

      analyzeFit(eft, index, skills, trained, {

        previewSkills: map,

        chargeSelections: charges,

        fleetLinks: links,

        rangeKm: range,

        implantTypeIds: implantIds,

      }),

    )

  }



  function handlePreviewChange(skillId: number, level: number) {

    const map = new Map(previewSkills)

    map.set(skillId, level)

    setPreviewSkills(map)

    rerunWithPreview(map)

  }



  function handleChargeChange(key: string, chargeTypeId: number | null) {

    const charges = new Map(chargeSelections)

    charges.set(key, chargeTypeId)

    setChargeSelections(charges)

    rerunWithPreview(previewSkills, charges)

  }



  function handleFleetLinksChange(links: FleetLinkId[]) {

    setFleetLinks(links)

    rerunWithPreview(previewSkills, chargeSelections, links)

  }



  function handleRangeChange(km: number) {

    setRangeKm(km)

    rerunWithPreview(previewSkills, chargeSelections, fleetLinks, km)

  }



  const maxoutEntries = useMemo(

    () => (analysis ? maxoutSkillsForFit(analysis.ship, analysis.items, fleetLinks) : []),

    [analysis, fleetLinks],

  )

  const allSkillRows = useMemo(

    () => (analysis ? mergeAllFitSkills(analysis.skills, maxoutEntries, skills, trained) : []),

    [analysis, maxoutEntries, skills, trained],

  )

  const gaps = allSkillRows.filter((row) =>

    isFitSkillGap(row.skillId, row.required, row.trained ?? 0, skillQueue),

  )

  const implantSource =

    implantIds.length > 0 ? `from clone (${implantIds.length} implants)` : undefined



  if (fittingLoading || sdeLoading) return <LoadingState />



  if (fittingError || !fitting || !index) {

    return (

      <div className="alert alert-warning">

        Fitting data is missing. Run <code>pnpm rebuild-fitting</code>.

      </div>

    )

  }



  return (

    <div className="flex flex-col min-h-0 gap-6">

      <PageHeader

        title="Fit skills"

        subtitle="Paste an EFT fit, tweak preview levels in the skills table, and browse skills by category."

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

          <button type="button" className="btn btn-primary" onClick={handleCheckFit}>

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



      {analysis ? (

        <>

          <Panel

            title={analysis.fitName ? `${analysis.shipName}: ${analysis.fitName}` : analysis.shipName}

            compact

            bodyClassName="pt-2"

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

            <div ref={statsPanelRef}>

              <FitLoadStats

                stats={analysis.stats}

                rangeKm={rangeKm}

                onRangeKmChange={handleRangeChange}

                fleetLinks={fleetLinks}

                onFleetLinksChange={handleFleetLinksChange}

                implantSource={implantSource}

              />

            </div>

            <FitLoadNotes analysis={analysis} hasSheet={Boolean(trained)} />

          </Panel>



          <Panel title="Ammo & charges">

            <FitChargeSelects

              groups={analysis.chargeGroups}

              selections={chargeSelections}

              onChange={handleChargeChange}

            />

          </Panel>



          <Panel title="Skills">

            <FitSkillsSummary

              gapCount={gaps.length}

              fits={analysis.fits}

              hasSheet={Boolean(trained)}

            />

            <FitSkillsTable

              rows={allSkillRows}

              skillQueue={skillQueue}

              previewSkills={previewSkills}

              onPreviewChange={handlePreviewChange}

              onAllV={setPreviewAllV}

              onZero={setPreviewZero}

              onUseCharacter={trained ? setPreviewFromCharacter : undefined}

            />

          </Panel>



          <FitStatsDock stats={analysis.stats} rangeKm={rangeKm} statsPanelRef={statsPanelRef} />

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

          ? 'This character meets all skill requirements.'

          : 'CPU and powergrid work at skills V. Train the list below to fly and max the fit.'}

      </p>

    )

  }

  return (

    <p className="text-sm text-error mb-3">

      {gapCount} skill{gapCount === 1 ? '' : 's'} below the level needed

      {!hasSheet ? ' (no character loaded, trained column is 0)' : ''}.

    </p>

  )

}


