import type { UserData } from '@/types'

const DRIVE_FOLDER = 'EVE Industry Organizer'
const DRIVE_FILE = 'userData.json'
const SCOPES = 'https://www.googleapis.com/auth/drive.file'

let accessToken: string | null = null
let fileId: string | null = localStorage.getItem('eveio:driveFileId')

export function getGoogleClientId(): string {
  return import.meta.env.VITE_GOOGLE_CLIENT_ID ?? ''
}

export function isGoogleConfigured(): boolean {
  return Boolean(getGoogleClientId())
}

export function getAccessToken(): string | null {
  return accessToken
}

export function setAccessToken(token: string | null): void {
  accessToken = token
}

async function driveFetch(path: string, init?: RequestInit): Promise<Response> {
  if (!accessToken) throw new Error('Not signed in to Google')
  return fetch(`https://www.googleapis.com/drive/v3${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(init?.headers ?? {}),
    },
  })
}

async function findOrCreateFolder(): Promise<string> {
  const q = encodeURIComponent(
    `name='${DRIVE_FOLDER}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
  )
  const res = await driveFetch(`/files?q=${q}&spaces=drive&fields=files(id)`)
  const data = (await res.json()) as { files: { id: string }[] }
  if (data.files?.[0]?.id) return data.files[0].id

  const create = await driveFetch('/files', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: DRIVE_FOLDER,
      mimeType: 'application/vnd.google-apps.folder',
    }),
  })
  const folder = (await create.json()) as { id: string }
  return folder.id
}

async function findFile(folderId: string): Promise<string | null> {
  const q = encodeURIComponent(
    `name='${DRIVE_FILE}' and '${folderId}' in parents and trashed=false`,
  )
  const res = await driveFetch(`/files?q=${q}&spaces=drive&fields=files(id)`)
  const data = (await res.json()) as { files: { id: string }[] }
  return data.files?.[0]?.id ?? null
}

export async function downloadUserData(): Promise<UserData | null> {
  if (!accessToken) return null
  const folderId = await findOrCreateFolder()
  const id = fileId ?? (await findFile(folderId))
  if (!id) return null
  fileId = id
  localStorage.setItem('eveio:driveFileId', id)

  const res = await driveFetch(`/files/${id}?alt=media`)
  if (!res.ok) throw new Error('Failed to download from Drive')
  return (await res.json()) as UserData
}

export async function uploadUserData(data: UserData): Promise<void> {
  if (!accessToken) throw new Error('Not signed in to Google')
  const folderId = await findOrCreateFolder()
  const payload = JSON.stringify({ ...data, updatedAt: new Date().toISOString() })
  const blob = new Blob([payload], { type: 'application/json' })

  if (!fileId) {
    fileId = (await findFile(folderId)) ?? null
  }

  if (fileId) {
    await fetch(`https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: payload,
    })
  } else {
    const metadata = { name: DRIVE_FILE, parents: [folderId], mimeType: 'application/json' }
    const form = new FormData()
    form.append(
      'metadata',
      new Blob([JSON.stringify(metadata)], { type: 'application/json' }),
    )
    form.append('file', blob)
    const res = await fetch(
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
        body: form,
      },
    )
    const created = (await res.json()) as { id: string }
    fileId = created.id
    localStorage.setItem('eveio:driveFileId', fileId)
  }
}

export function initGoogleSignIn(onToken: (token: string) => void): void {
  const clientId = getGoogleClientId()
  if (!clientId) return

  const g = (window as unknown as { google?: { accounts: { oauth2: { initTokenClient: (cfg: unknown) => { requestAccessToken: () => void } } } } }).google
  if (!g?.accounts?.oauth2) return

  const client = g.accounts.oauth2.initTokenClient({
    client_id: clientId,
    scope: SCOPES,
    callback: (response: { access_token?: string; error?: string }) => {
      if (response.access_token) {
        accessToken = response.access_token
        onToken(response.access_token)
      }
    },
  })

  ;(window as unknown as { __eveGoogleSignIn: () => void }).__eveGoogleSignIn = () =>
    client.requestAccessToken()
}

export function signOutGoogle(): void {
  accessToken = null
}

export { SCOPES }
