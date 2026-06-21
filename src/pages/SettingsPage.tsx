import { useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppStore } from '@/stores/appStore'
import { getCacheStats } from '@/services/cache/cacheStore'
import { isGoogleConfigured } from '@/services/sync/googleDrive'
import { GlobalSettingsForm } from '@/components/GlobalSettingsForm'
import { Panel } from '@/components/Panel'
import { PageHeader } from '@/components/Layout'

export function SettingsPage() {
  const navigate = useNavigate()
  const userData = useAppStore((s) => s.userData)
  const syncStatus = useAppStore((s) => s.syncStatus)
  const updateSettings = useAppStore((s) => s.updateSettings)
  const resetAll = useAppStore((s) => s.resetAll)
  const exportJson = useAppStore((s) => s.exportJson)
  const importJson = useAppStore((s) => s.importJson)
  const signInGoogle = useAppStore((s) => s.signInGoogle)
  const signOutGoogle = useAppStore((s) => s.signOutGoogle)
  const syncNow = useAppStore((s) => s.syncNow)
  const clearPriceCache = useAppStore((s) => s.clearPriceCache)
  const fileRef = useRef<HTMLInputElement>(null)
  const cacheStats = getCacheStats()
  const settings = userData.settings

  const handleImport = (file: File) => {
    const reader = new FileReader()
    reader.onload = () => importJson(reader.result as string)
    reader.readAsText(file)
  }

  return (
    <div>
      <PageHeader title="Settings" subtitle="Global defaults, sync, and cache" />

      <div className="grid lg:grid-cols-2 gap-6">
        <Panel title="Global defaults">
          <GlobalSettingsForm
            size="sm"
            settings={settings}
            onChange={updateSettings}
          />
        </Panel>

        <Panel title="Google Drive sync">
          <p className="text-xs opacity-70">
            Mode: {syncStatus.mode === 'drive' ? 'Google Drive' : 'Local only'} · Status:{' '}
            {syncStatus.state}
            {syncStatus.lastSyncedAt &&
              ` · Last synced ${new Date(syncStatus.lastSyncedAt).toLocaleString()}`}
          </p>
          {syncStatus.message && <p className="text-xs text-warning">{syncStatus.message}</p>}
          {isGoogleConfigured() ? (
            <div className="flex flex-wrap gap-2 mt-2">
              <button className="btn btn-primary btn-sm" onClick={signInGoogle}>
                Sign in with Google
              </button>
              <button className="btn btn-ghost btn-sm" onClick={signOutGoogle}>
                Sign out
              </button>
              <button className="btn btn-outline btn-sm" onClick={() => syncNow()}>
                Sync now
              </button>
            </div>
          ) : (
            <p className="text-xs opacity-60 mt-2">
              Set VITE_GOOGLE_CLIENT_ID in .env to enable Drive sync.
            </p>
          )}
        </Panel>

        <Panel title="Backup">
          <div className="flex flex-wrap gap-2">
            <button
              className="btn btn-outline btn-sm"
              onClick={() => {
                const blob = new Blob([exportJson()], { type: 'application/json' })
                const a = document.createElement('a')
                a.href = URL.createObjectURL(blob)
                a.download = 'eve-industry-organizer-backup.json'
                a.click()
              }}
            >
              Export JSON
            </button>
            <button className="btn btn-outline btn-sm" onClick={() => fileRef.current?.click()}>
              Import JSON
            </button>
            <input
              ref={fileRef}
              type="file"
              accept=".json"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && handleImport(e.target.files[0])}
            />
          </div>
        </Panel>

        <Panel title="Price cache">
          <p className="text-xs opacity-70">
            {cacheStats.count} entries · ~{cacheStats.sizeKb} KB
          </p>
          <button className="btn btn-outline btn-sm mt-2" onClick={clearPriceCache}>
            Clear price cache
          </button>
        </Panel>

        <Panel title="Danger zone" titleClassName="text-base text-error" className="lg:col-span-2">
          <div className="flex flex-wrap gap-2">
            <button
              className="btn btn-outline btn-sm"
              onClick={() => {
                resetAll()
                navigate('/onboarding')
              }}
            >
              Reset & re-run onboarding
            </button>
          </div>
        </Panel>
      </div>
    </div>
  )
}
