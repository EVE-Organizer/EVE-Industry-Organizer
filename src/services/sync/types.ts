import type { UserData, GlobalSettings, CharacterAccount, CharacterSkills } from '@/types'
import { DEFAULT_SETTINGS, DEFAULT_SKILLS, DEFAULT_MINERALS } from '@/types'

export const SCHEMA_VERSION = 1
export const USER_DATA_KEY = 'eveio:userData'

export function createDefaultUserData(): UserData {
  return {
    schemaVersion: SCHEMA_VERSION,
    updatedAt: new Date().toISOString(),
    onboardingComplete: false,
    settings: { ...DEFAULT_SETTINGS },
    accounts: [],
    watchlist: [],
    progressionState: {},
  }
}

export function createCharacter(name: string, skills?: Partial<CharacterAccount['skills']>): CharacterAccount {
  return {
    id: crypto.randomUUID(),
    name,
    isOmega: true,
    iskGoal: 100_000_000,
    iskCurrent: 0,
    skills: { ...DEFAULT_SKILLS, ...(skills ?? {}) } as CharacterSkills,
    ownedBPOs: [],
    runningJobs: [],
    mineralStock: { ...DEFAULT_MINERALS },
    sellOrders: [],
    researchTimers: [],
    skillProgress: {},
    intelligence: 20,
    memory: 20,
  }
}

export function loadUserDataFromLocal(): UserData {
  try {
    const raw = localStorage.getItem(USER_DATA_KEY)
    if (!raw) return createDefaultUserData()
    const parsed = JSON.parse(raw) as UserData
    return { ...createDefaultUserData(), ...parsed, settings: { ...DEFAULT_SETTINGS, ...parsed.settings } }
  } catch {
    return createDefaultUserData()
  }
}

export function saveUserDataToLocal(data: UserData): void {
  const payload: UserData = { ...data, updatedAt: new Date().toISOString() }
  localStorage.setItem(USER_DATA_KEY, JSON.stringify(payload))
}

export function mergeUserData(local: UserData, remote: UserData): UserData {
  const localTime = new Date(local.updatedAt).getTime()
  const remoteTime = new Date(remote.updatedAt).getTime()
  return remoteTime >= localTime ? { ...createDefaultUserData(), ...remote } : local
}

export function exportUserDataJson(data: UserData): string {
  return JSON.stringify(data, null, 2)
}

export function importUserDataJson(json: string): UserData {
  const parsed = JSON.parse(json) as UserData
  if (!parsed.settings || !Array.isArray(parsed.accounts)) {
    throw new Error('Invalid user data file')
  }
  return { ...createDefaultUserData(), ...parsed, updatedAt: new Date().toISOString() }
}

export function updateSettings(data: UserData, settings: Partial<GlobalSettings>): UserData {
  return { ...data, settings: { ...data.settings, ...settings }, updatedAt: new Date().toISOString() }
}
