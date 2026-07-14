import { useEffect } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useParams } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Layout } from '@/components/Layout'
import { useAppStore } from '@/stores/appStore'
import { BlueprintsPage } from '@/pages/BlueprintsPage'
import { ProductionGraphPage } from '@/pages/ProductionGraphPage'
import { ItemDetailPage } from '@/pages/ItemDetailPage'
import { SettingsPage } from '@/pages/SettingsPage'

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

  useEffect(() => {
    hydrate()
  }, [hydrate])

  if (!hydrated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <span className="loading loading-spinner loading-lg text-primary" />
      </div>
    )
  }

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<BlueprintsPage />} />
        <Route path="/blueprints" element={<Navigate to="/" replace />} />
        <Route path="/graph/:productTypeId" element={<ProductionGraphPage />} />
        <Route path="/item/:typeId" element={<ItemDetailPage />} />
        <Route path="/blueprints/:typeId" element={<LegacyBlueprintRedirect />} />
        <Route path="/stations" element={<Navigate to="/" replace />} />
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
