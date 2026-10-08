import { describe, expect, it, beforeEach } from 'vitest'
import { useDataStatusStore, worstSourceStatus } from '@/stores/dataStatusStore'

describe('dataStatusStore', () => {
  beforeEach(() => {
    useDataStatusStore.setState({
      sources: {},
      refreshing: { characters: false, 'prices-live': false, static: false, all: false },
      toasts: [],
      changedPrices: {},
    })
  })

  it('marks refreshing and replaces the loading toast on endRefresh', () => {
    const id = useDataStatusStore.getState().beginRefresh('characters')
    expect(useDataStatusStore.getState().refreshing.characters).toBe(true)
    expect(
      useDataStatusStore.getState().toasts.some((t) => t.persistent && t.text === 'Refreshing…'),
    ).toBe(true)

    useDataStatusStore.getState().endRefresh('characters', id, {
      parts: ['Jobs · Main: unchanged'],
      statuses: ['unchanged'],
    })

    expect(useDataStatusStore.getState().refreshing.characters).toBe(false)
    expect(useDataStatusStore.getState().toasts.some((t) => t.id === id)).toBe(false)
    expect(useDataStatusStore.getState().toasts.at(-1)?.tone).toBe('info')
  })

  it('uses error tone when any source failed', () => {
    const id = useDataStatusStore.getState().beginRefresh('prices-live')
    useDataStatusStore.getState().endRefresh('prices-live', id, {
      parts: ['Live prices: failed'],
      statuses: ['failed', 'unchanged'],
    })
    expect(useDataStatusStore.getState().toasts.at(-1)?.tone).toBe('error')
  })

  it('sets sources to loading', () => {
    useDataStatusStore.getState().setSourcesLoading(['jobs-1'], { 'jobs-1': 'Jobs · Main' })
    expect(useDataStatusStore.getState().sources['jobs-1']?.status).toBe('loading')
  })
})

describe('worstSourceStatus', () => {
  it('prefers failed over warning', () => {
    expect(worstSourceStatus(['updated', 'not-yet-updated-by-esi', 'failed'])).toBe('error')
    expect(worstSourceStatus(['not-yet-updated-by-esi', 'unchanged'])).toBe('warning')
  })
})
