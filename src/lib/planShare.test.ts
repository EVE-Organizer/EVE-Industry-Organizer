import { describe, expect, it } from 'vitest'
import {
  buildPlanSharePayload,
  encodePlanShareHash,
  mergeSharedSettingsForImport,
  parsePlanShareHash,
  planShareSearchParams,
  sharedPayloadToTemplate,
  sharedTemplateToSavedTemplate,
} from '@/lib/planShare'
import { createDefaultPlanTemplate } from '@/services/sync/types'
import { DEFAULT_SETTINGS } from '@/types'

describe('planShare', () => {
  it('round-trips a multi-root plan with overrides', async () => {
    const template = createDefaultPlanTemplate('T2 batch')
    template.roots = [
      { id: 'root-a', productTypeId: 587, runs: 100, productionDurationHours: 48 },
      { id: 'root-b', productTypeId: 622, runs: 50, productionDurationHours: 24 },
    ]
    template.modeOverrides = { 587: 'build', 34: 'buy' }
    template.nodeOverrides = { 587: { me: 10, te: 20 } }
    template.defaultRunsPerBpc = 25

    const settings = {
      ...DEFAULT_SETTINGS,
      primaryHub: 'amarr' as const,
      manufacturingSystemId: 30002187,
      meDefault: 5,
    }

    const payload = buildPlanSharePayload(template, settings)
    const hash = await encodePlanShareHash(payload)
    const parsed = await parsePlanShareHash(`#${hash}`)

    expect(parsed).not.toBeNull()
    expect(parsed?.v).toBe(1)
    expect(parsed?.template.name).toBe('T2 batch')
    expect(parsed?.template.roots).toHaveLength(2)
    expect(parsed?.template.modeOverrides['587']).toBe('build')
    expect(parsed?.template.nodeOverrides['587']).toEqual({ me: 10, te: 20 })
    expect(parsed?.settings.primaryHub).toBe('amarr')
    expect(parsed?.settings.manufacturingSystemId).toBe(30002187)
  })

  it('builds a synthetic template with new root ids', () => {
    const payload = buildPlanSharePayload(createDefaultPlanTemplate('Shared'), DEFAULT_SETTINGS)
    payload.template.roots = [{ productTypeId: 34, runs: 10, productionDurationHours: 1 }]

    const template = sharedPayloadToTemplate(payload)
    expect(template.id).toBe('shared-view')
    expect(template.roots).toHaveLength(1)
    expect(template.roots[0].id).toMatch(/^root-/)
    expect(template.roots[0].productTypeId).toBe(34)
  })

  it('copies a shared template into a saved plan with fresh ids', () => {
    const payload = buildPlanSharePayload(createDefaultPlanTemplate('Shared'), DEFAULT_SETTINGS)
    payload.template.roots = [{ productTypeId: 34, runs: 10, productionDurationHours: 1 }]
    const shared = sharedPayloadToTemplate(payload)
    const saved = sharedTemplateToSavedTemplate(shared)

    expect(saved.id).not.toBe('shared-view')
    expect(saved.name).toBe('Shared')
    expect(saved.roots[0].id).not.toBe(shared.roots[0].id)
    expect(saved.modeOverrides).toEqual(shared.modeOverrides)
  })

  it('imports shared settings but keeps recipient skills', () => {
    const current = {
      ...DEFAULT_SETTINGS,
      skills: { ...DEFAULT_SETTINGS.skills, industry: 5 },
    }
    const shared = {
      ...DEFAULT_SETTINGS,
      primaryHub: 'amarr' as const,
      manufacturingSystemId: 30002187,
      skills: { ...DEFAULT_SETTINGS.skills, industry: 1 },
    }

    const merged = mergeSharedSettingsForImport(current, shared)
    expect(merged.primaryHub).toBe('amarr')
    expect(merged.manufacturingSystemId).toBe(30002187)
    expect(merged.skills.industry).toBe(5)
  })

  it('returns null for invalid hash', async () => {
    expect(await parsePlanShareHash('')).toBeNull()
    expect(await parsePlanShareHash('#plan=not-valid')).toBeNull()
    expect(await parsePlanShareHash('#other=abc')).toBeNull()
  })

  it('returns null for corrupt compressed payload', async () => {
    expect(await parsePlanShareHash('#plan=z.not-valid-base64!!!')).toBeNull()
  })

  it('keeps only shareable query params', () => {
    const params = planShareSearchParams('add=587&view=graph&foo=bar')
    expect(params.toString()).toBe('view=graph')
  })

  it('uses raw encoding when DecompressionStream is unavailable', async () => {
    const payload = buildPlanSharePayload(createDefaultPlanTemplate('Compat'), DEFAULT_SETTINGS)
    const originalDecompression = globalThis.DecompressionStream

    try {
      // @ts-expect-error test shim
      delete globalThis.DecompressionStream
      const hash = await encodePlanShareHash(payload)
      expect(hash).toMatch(/^plan=r\./)
      expect(await parsePlanShareHash(`#${hash}`)).not.toBeNull()
    } finally {
      if (originalDecompression) {
        globalThis.DecompressionStream = originalDecompression
      }
    }
  })
})
