import { appRoute } from '@/lib/paths'
import { createPlanRootId, createPlanTemplateId, normalizeGlobalSettings } from '@/services/sync/types'
import { DEFAULT_SETTINGS } from '@/types'
import type {
  GlobalSettings,
  ManufacturingPlanTemplate,
  PlanBuildMode,
  PlanNodeOverride,
} from '@/types'

export const PLAN_SHARE_VERSION = 1

export interface PlanShareRoot {
  productTypeId: number
  runs: number
  productionDurationHours: number
  enabled?: boolean
}

export interface PlanShareTemplate {
  name: string
  defaultRunsPerBpc: number
  roots: PlanShareRoot[]
  modeOverrides: Record<string, PlanBuildMode>
  nodeOverrides: Record<string, PlanNodeOverride>
}

export interface PlanSharePayload {
  v: typeof PLAN_SHARE_VERSION
  template: PlanShareTemplate
  settings: GlobalSettings
}

const HASH_PARAM = 'plan'
/** Uncompressed payload prefix when CompressionStream is unavailable. */
const RAW_PREFIX = 'r.'
/** Deflate-compressed payload prefix. */
const DEFLATE_PREFIX = 'z.'

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function base64UrlDecode(encoded: string): Uint8Array {
  const padded = encoded.replace(/-/g, '+').replace(/_/g, '/')
  const padLen = (4 - (padded.length % 4)) % 4
  const binary = atob(padded + '='.repeat(padLen))
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

async function deflateBytes(input: Uint8Array): Promise<Uint8Array> {
  if (typeof CompressionStream === 'undefined') {
    return input
  }
  const stream = new Blob([input]).stream().pipeThrough(new CompressionStream('deflate'))
  const buffer = await new Response(stream).arrayBuffer()
  return new Uint8Array(buffer)
}

async function inflateBytes(input: Uint8Array): Promise<Uint8Array> {
  if (typeof DecompressionStream === 'undefined') {
    return input
  }
  const stream = new Blob([input]).stream().pipeThrough(new DecompressionStream('deflate'))
  const buffer = await new Response(stream).arrayBuffer()
  return new Uint8Array(buffer)
}

function toNumericRecord<T>(record: Record<string, T> | Record<number, T>): Record<number, T> {
  const out: Record<number, T> = {}
  for (const [key, value] of Object.entries(record ?? {})) {
    const id = Number(key)
    if (Number.isFinite(id)) out[id] = value
  }
  return out
}

function isPlanSharePayload(value: unknown): value is PlanSharePayload {
  if (!value || typeof value !== 'object') return false
  const obj = value as PlanSharePayload
  if (obj.v !== PLAN_SHARE_VERSION) return false
  if (!obj.template || typeof obj.template !== 'object') return false
  if (!Array.isArray(obj.template.roots)) return false
  if (!obj.settings || typeof obj.settings !== 'object') return false
  return true
}

export function buildPlanSharePayload(
  template: ManufacturingPlanTemplate,
  settings: GlobalSettings,
): PlanSharePayload {
  const modeOverrides: Record<string, PlanBuildMode> = {}
  for (const [key, value] of Object.entries(template.modeOverrides ?? {})) {
    modeOverrides[String(key)] = value
  }

  const nodeOverrides: Record<string, PlanNodeOverride> = {}
  for (const [key, value] of Object.entries(template.nodeOverrides ?? {})) {
    nodeOverrides[String(key)] = value
  }

  return {
    v: PLAN_SHARE_VERSION,
    template: {
      name: template.name,
      defaultRunsPerBpc: template.defaultRunsPerBpc,
      roots: (template.roots ?? []).map((root) => ({
        productTypeId: root.productTypeId,
        runs: root.runs,
        productionDurationHours: root.productionDurationHours,
        ...(root.enabled === false ? { enabled: false } : {}),
      })),
      modeOverrides,
      nodeOverrides,
    },
    settings: { ...settings },
  }
}

export function sharedPayloadToTemplate(payload: PlanSharePayload): ManufacturingPlanTemplate {
  const now = new Date().toISOString()
  return {
    id: 'shared-view',
    name: payload.template.name.trim() || 'Shared plan',
    createdAt: now,
    updatedAt: now,
    productionWindowHours: 24,
    slotSource: 'skills',
    manufacturingSlots: 6,
    defaultRunsPerBpc: Math.max(1, Number(payload.template.defaultRunsPerBpc) || 10),
    roots: (payload.template.roots ?? []).map((root) => ({
      id: createPlanRootId(),
      productTypeId: Number(root.productTypeId),
      runs: Math.max(1, Number(root.runs) || 1),
      productionDurationHours: Number(root.productionDurationHours) || 0,
      enabled: root.enabled === false ? false : undefined,
    })),
    modeOverrides: toNumericRecord(payload.template.modeOverrides ?? {}),
    nodeOverrides: toNumericRecord(payload.template.nodeOverrides ?? {}),
  }
}

/** Copy a shared-view template into the user's plan list with fresh ids. */
export function sharedTemplateToSavedTemplate(
  template: ManufacturingPlanTemplate,
): ManufacturingPlanTemplate {
  const now = new Date().toISOString()
  return {
    ...template,
    id: createPlanTemplateId(),
    name: template.name.trim() || 'Imported plan',
    createdAt: now,
    updatedAt: now,
    roots: (template.roots ?? []).map((root) => ({ ...root, id: createPlanRootId() })),
    modeOverrides: { ...(template.modeOverrides ?? {}) },
    nodeOverrides: { ...(template.nodeOverrides ?? {}) },
  }
}

/** Apply shared hub/facility settings but keep the recipient's skills. */
export function mergeSharedSettingsForImport(
  current: GlobalSettings,
  shared: GlobalSettings,
): GlobalSettings {
  const { skills: _sharedSkills, ...sharedPlanContext } = shared
  return normalizeGlobalSettings({ ...current, ...sharedPlanContext })
}

export function normalizeSharedSettings(settings: Partial<GlobalSettings> | undefined): GlobalSettings {
  return normalizeGlobalSettings({ ...DEFAULT_SETTINGS, ...(settings ?? {}) })
}

export async function encodePlanShareHash(payload: PlanSharePayload): Promise<string> {
  const json = JSON.stringify(payload)
  const bytes = new TextEncoder().encode(json)

  if (typeof CompressionStream === 'undefined' || typeof DecompressionStream === 'undefined') {
    return `${HASH_PARAM}=${RAW_PREFIX}${base64UrlEncode(bytes)}`
  }

  const compressed = await deflateBytes(bytes)
  return `${HASH_PARAM}=${DEFLATE_PREFIX}${base64UrlEncode(compressed)}`
}

export async function parsePlanShareHash(hash: string): Promise<PlanSharePayload | null> {
  const raw = hash.startsWith('#') ? hash.slice(1) : hash
  if (!raw) return null

  const params = new URLSearchParams(raw)
  const encoded = params.get(HASH_PARAM)
  if (!encoded) return null

  try {
    let bytes: Uint8Array
    if (encoded.startsWith(RAW_PREFIX)) {
      bytes = base64UrlDecode(encoded.slice(RAW_PREFIX.length))
    } else if (encoded.startsWith(DEFLATE_PREFIX)) {
      bytes = await inflateBytes(base64UrlDecode(encoded.slice(DEFLATE_PREFIX.length)))
    } else {
      return null
    }

    const parsed: unknown = JSON.parse(new TextDecoder().decode(bytes))
    if (!isPlanSharePayload(parsed)) return null
    return parsed
  } catch {
    return null
  }
}

export function planShareSearchParams(search?: URLSearchParams | string): URLSearchParams {
  const raw =
    typeof search === 'string' ? new URLSearchParams(search) : search ? new URLSearchParams(search) : null
  const shareSearch = new URLSearchParams()
  const view = raw?.get('view')
  if (view) shareSearch.set('view', view)
  return shareSearch
}

export async function planShareUrl(
  payload: PlanSharePayload,
  search?: URLSearchParams | string,
): Promise<string> {
  const hash = await encodePlanShareHash(payload)
  const searchStr = planShareSearchParams(search).toString()
  const path = searchStr ? `plan?${searchStr}` : 'plan'
  return `${appRoute(path)}#${hash}`
}
