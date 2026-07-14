import { useCallback, useMemo } from 'react'
import { useNavigate, useParams, useSearchParams, useLocation } from 'react-router-dom'
import type { ManufacturingSettings, RankedBlueprintRow } from '@/types'
import { useAppStore } from '@/stores/appStore'
import { useSdeData } from '@/hooks/useSdeData'
import {
  buildTypeMap,
  getAllBlueprints,
  getBlueprintForProduct,
} from '@/services/data/sdeLoader'
import { searchParamsToQuery } from '@/lib/blueprintQuery'
import { BlueprintGraphModal } from '@/components/BlueprintGraphModal'
import { LoadingState, PageHeader } from '@/components/Layout'

interface GraphLocationState {
  rankedRow?: RankedBlueprintRow
}

export function ProductionGraphPage() {
  const { productTypeId: productTypeIdParam } = useParams()
  const productTypeId = Number(productTypeIdParam)
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const location = useLocation()
  const settings = useAppStore((s) => s.userData.settings)
  const { data: sde, isLoading } = useSdeData()

  const query = useMemo(
    () => searchParamsToQuery(searchParams, settings),
    [searchParams, settings],
  )

  const manufacturingSettings = useMemo(
    (): ManufacturingSettings => ({
      ...settings,
      batchSize: query.batchSize,
      priceMethod: query.priceMethod,
    }),
    [settings, query.batchSize, query.priceMethod],
  )

  const blueprint = useMemo(() => {
    if (!sde || !Number.isFinite(productTypeId) || productTypeId <= 0) return null
    return getBlueprintForProduct(getAllBlueprints(sde.registry), productTypeId) ?? null
  }, [sde, productTypeId])

  const productName = useMemo(() => {
    if (!sde || !Number.isFinite(productTypeId)) return ''
    return buildTypeMap(sde.types).get(productTypeId)?.name ?? `Type ${productTypeId}`
  }, [sde, productTypeId])

  const rankedRow = useMemo(() => {
    const state = location.state as GraphLocationState | null
    const row = state?.rankedRow
    if (!row || row.blueprint.productTypeId !== productTypeId) return null
    return row
  }, [location.state, productTypeId])

  const handleProductChange = useCallback(
    (nextProductTypeId: number) => {
      navigate(
        { pathname: `/graph/${nextProductTypeId}`, search: searchParams.toString() },
        { replace: true },
      )
    },
    [navigate, searchParams],
  )

  const handleClose = useCallback(() => {
    navigate({ pathname: '/', search: searchParams.toString() })
  }, [navigate, searchParams])

  if (isLoading) {
    return <LoadingState />
  }

  if (!blueprint) {
    return (
      <div className="flex flex-col gap-4">
        <PageHeader
          title="Production graph"
          subtitle={
            Number.isFinite(productTypeId)
              ? `No manufacturing blueprint found for ${productName}.`
              : 'Invalid product id in URL.'
          }
        />
        <button type="button" className="btn btn-primary w-fit" onClick={handleClose}>
          Back to blueprints
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col flex-1 min-h-0 w-full self-stretch">
      <BlueprintGraphModal
        variant="page"
        blueprint={blueprint}
        rankedRow={rankedRow}
        hub={query.hub}
        priceWindow={query.window}
        settings={manufacturingSettings}
        onProductChange={handleProductChange}
        onClose={handleClose}
      />
    </div>
  )
}
