import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useAppStore } from '@/stores/appStore'
import { createDefaultUserData, createDefaultPlanTemplate } from '@/services/sync/types'

describe('useAppStore plan templates', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', {
      getItem: vi.fn(),
      setItem: vi.fn(),
      removeItem: vi.fn(),
    })
    useAppStore.setState({
      userData: createDefaultUserData(),
      hydrated: true,
      selectedPlanTemplateId: null,
    })
  })

  it('creates and selects a new plan', () => {
    const created = useAppStore.getState().addPlanTemplate('Test plan')

    const state = useAppStore.getState()
    expect(state.userData.planTemplates).toHaveLength(1)
    expect(state.selectedPlanTemplateId).toBe(created.id)
    expect(state.userData.selectedPlanTemplateId).toBe(created.id)
    expect(state.userData.planTemplates[0].roots).toEqual([])
  })

  it('restores the last selected plan on hydrate', () => {
    const planA = { ...createDefaultPlanTemplate('A'), id: 'plan-a' }
    const planB = { ...createDefaultPlanTemplate('B'), id: 'plan-b' }
    const stored = {
      ...createDefaultUserData(),
      planTemplates: [planA, planB],
      selectedPlanTemplateId: 'plan-b',
    }
    vi.mocked(localStorage.getItem).mockReturnValue(JSON.stringify(stored))

    useAppStore.getState().hydrate()

    expect(useAppStore.getState().selectedPlanTemplateId).toBe('plan-b')
  })

  it('persists plan tab selection', () => {
    const planA = { ...createDefaultPlanTemplate('A'), id: 'plan-a' }
    const planB = { ...createDefaultPlanTemplate('B'), id: 'plan-b' }
    useAppStore.setState({
      userData: {
        ...createDefaultUserData(),
        planTemplates: [planA, planB],
      },
      hydrated: true,
      selectedPlanTemplateId: 'plan-a',
    })

    useAppStore.getState().setSelectedPlanTemplateId('plan-b')

    const state = useAppStore.getState()
    expect(state.selectedPlanTemplateId).toBe('plan-b')
    expect(state.userData.selectedPlanTemplateId).toBe('plan-b')
    expect(localStorage.setItem).toHaveBeenCalled()
  })

  it('adds a plan when legacy templates are missing roots', () => {
    useAppStore.setState({
      userData: {
        ...createDefaultUserData(),
        planTemplates: [
          {
            id: 'legacy-plan',
            name: 'Legacy',
            createdAt: '2020-01-01T00:00:00.000Z',
            updatedAt: '2020-01-01T00:00:00.000Z',
            productionWindowHours: 24,
            slotSource: 'skills',
            manufacturingSlots: 6,
            defaultRunsPerBpc: 10,
            roots: undefined as unknown as [],
            modeOverrides: undefined as unknown as Record<number, never>,
            nodeOverrides: undefined as unknown as Record<number, never>,
          },
        ],
      },
      hydrated: true,
      selectedPlanTemplateId: 'legacy-plan',
    })

    const created = useAppStore.getState().addPlanTemplate('Another plan')
    const state = useAppStore.getState()

    expect(state.userData.planTemplates).toHaveLength(2)
    expect(state.selectedPlanTemplateId).toBe(created.id)
    expect(state.userData.planTemplates[0].roots).toEqual([])
    expect(state.userData.planTemplates[0].modeOverrides).toEqual({})
  })
})
