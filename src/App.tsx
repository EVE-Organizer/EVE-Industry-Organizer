import { useEffect } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useParams } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Layout } from '@/components/Layout'
import { useAppStore } from '@/stores/appStore'
import { DashboardPage } from '@/pages/DashboardPage'
import { BlueprintsPage } from '@/pages/BlueprintsPage'
import { ItemDetailPage } from '@/pages/ItemDetailPage'
import { StationsPage } from '@/pages/StationsPage'
import { AccountsPage } from '@/pages/AccountsPage'
import { ProgressionPage } from '@/pages/ProgressionPage'
import { SettingsPage } from '@/pages/SettingsPage'
import { OnboardingPage } from '@/pages/OnboardingPage'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
})

function RequireOnboarding({ children }: { children: React.ReactNode }) {
  const hydrated = useAppStore((s) => s.hydrated)
  const complete = useAppStore((s) => s.userData.onboardingComplete)

  if (!hydrated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <span className="loading loading-spinner loading-lg text-primary" />
      </div>
    )
  }

  if (!complete) return <Navigate to="/onboarding" replace />
  return <>{children}</>
}

function LegacyBlueprintRedirect() {
  const { typeId } = useParams()
  return <Navigate to={`/item/${typeId}`} replace />
}

function AppRoutes() {
  const hydrate = useAppStore((s) => s.hydrate)
  const complete = useAppStore((s) => s.userData.onboardingComplete)
  const hydrated = useAppStore((s) => s.hydrated)

  useEffect(() => {
    hydrate()
  }, [hydrate])

  return (
    <Routes>
      <Route
        path="/onboarding"
        element={hydrated && complete ? <Navigate to="/" replace /> : <OnboardingPage />}
      />
      <Route
        element={
          <RequireOnboarding>
            <Layout />
          </RequireOnboarding>
        }
      >
        <Route path="/" element={<DashboardPage />} />
        <Route path="/blueprints" element={<BlueprintsPage />} />
        <Route path="/item/:typeId" element={<ItemDetailPage />} />
        <Route path="/blueprints/:typeId" element={<LegacyBlueprintRedirect />} />
        <Route path="/stations" element={<StationsPage />} />
        <Route path="/accounts" element={<AccountsPage />} />
        <Route path="/progression" element={<ProgressionPage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </QueryClientProvider>
  )
}
