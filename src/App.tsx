import { useEffect } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useParams } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Layout } from '@/components/Layout'
import { useAppStore } from '@/stores/appStore'
import { BlueprintsPage } from '@/pages/BlueprintsPage'
import { ProductionGraphPage } from '@/pages/ProductionGraphPage'
import { ItemDetailPage } from '@/pages/ItemDetailPage'
import { PlanPage } from '@/pages/PlanPage'
import { MapPage } from '@/pages/MapPage'
import { JobsPage } from '@/pages/JobsPage'
import { SettingsPage } from '@/pages/SettingsPage'
import { AuthCallbackPage } from '@/pages/AuthCallbackPage'
import { useAuthStore } from '@/stores/authStore'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
})

function LegacyBlueprintRedirect() {
  const { typeId } = useParams()
  return <Navigate to={`/item/${typeId}`} replace />
}

function AppRoutes() {
  const hydrate = useAppStore((s) => s.hydrate)
  const hydrated = useAppStore((s) => s.hydrated)
  const hydrateAuth = useAuthStore((s) => s.hydrate)
  const authHydrated = useAuthStore((s) => s.hydrated)

  useEffect(() => {
    hydrate()
    hydrateAuth()
  }, [hydrate, hydrateAuth])

  if (!hydrated || !authHydrated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <span className="loading loading-spinner loading-lg text-primary" />
      </div>
    )
  }

  return (
    <Routes>
      <Route path="/auth/callback" element={<AuthCallbackPage />} />
      <Route element={<Layout />}>
        <Route path="/" element={<BlueprintsPage />} />
        <Route path="/blueprints" element={<Navigate to="/" replace />} />
        <Route path="/graph/:productTypeId" element={<ProductionGraphPage />} />
        <Route path="/item/:typeId" element={<ItemDetailPage />} />
        <Route path="/blueprints/:typeId" element={<LegacyBlueprintRedirect />} />
        <Route path="/stations" element={<Navigate to="/" replace />} />
        <Route path="/plan" element={<PlanPage />} />
        <Route path="/map" element={<MapPage />} />
        <Route path="/jobs" element={<JobsPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/dashboard" element={<Navigate to="/" replace />} />
        <Route path="/accounts" element={<Navigate to="/settings" replace />} />
        <Route path="/progression" element={<Navigate to="/settings" replace />} />
        <Route path="/onboarding" element={<Navigate to="/" replace />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

function routerBasename(): string | undefined {
  const base = import.meta.env.BASE_URL
  if (!base || base === '/' || base === './') return undefined
  return base.replace(/\/$/, '')
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter basename={routerBasename()}>
        <AppRoutes />
      </BrowserRouter>
    </QueryClientProvider>
  )
}
