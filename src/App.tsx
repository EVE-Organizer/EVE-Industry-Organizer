import { useEffect } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useLocation, useParams } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClient } from '@/lib/queryClient'
import { Layout } from '@/components/layout/Layout'
import { useAppStore } from '@/stores/appStore'
import { BlueprintsPage } from '@/pages/Blueprints/BlueprintsPage'
import { ProductionGraphPage } from '@/pages/Graph/ProductionGraphPage'
import { ItemDetailPage } from '@/pages/Item/ItemDetailPage'
import { PlanPage } from '@/pages/Plan/PlanPage'
import { JobsPage } from '@/pages/Jobs/JobsPage'
import { SettingsPage } from '@/pages/Settings/SettingsPage'
import { MiningIskHrPage } from '@/pages/Mining/MiningIskHrPage'
import { RouteRiskPage } from '@/pages/RouteRisk/RouteRiskPage'
import { FitSkillsPage } from '@/pages/FitSkills/FitSkillsPage'
import { SkillsPage } from '@/pages/Skills/SkillsPage'
import { AuthCallbackPage } from '@/pages/Auth/AuthCallbackPage'
import { useAuthStore } from '@/stores/authStore'

function LegacyBlueprintRedirect() {
  const { typeId } = useParams()
  return <Navigate to={`/item/${typeId}`} replace />
}

function LegacyGateCheckRedirect() {
  const { search } = useLocation()
  return <Navigate to={`/tools/route-risk${search}`} replace />
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
        <Route path="/jobs" element={<JobsPage />} />
        <Route path="/tools/route-risk" element={<RouteRiskPage />} />
        <Route path="/skills" element={<SkillsPage />} />
        <Route path="/tools/fit-skills" element={<FitSkillsPage />} />
        <Route path="/tools/gate-check" element={<LegacyGateCheckRedirect />} />
        <Route path="/tools/mining" element={<MiningIskHrPage />} />
        <Route path="/isk-hr" element={<Navigate to="/tools/mining" replace />} />
        <Route path="/isk-hr/mining" element={<Navigate to="/tools/mining" replace />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/dashboard" element={<Navigate to="/" replace />} />
        <Route path="/accounts" element={<Navigate to="/settings" replace />} />
        <Route path="/progression" element={<Navigate to="/settings" replace />} />
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
