import { useSdeData } from '@/hooks/useSdeData'
import { getAllBlueprints, getBlueprintForBpo } from '@/services/data/sdeLoader'
import { EveImage } from '@/components/EveImage'

interface BpoImageProps {
  blueprintTypeId: number
  size?: number
  alt?: string
  framed?: boolean
}

/** Blueprint icon with automatic fallback to the manufactured product icon. */
export function BpoImage({ blueprintTypeId, size = 32, alt = '', framed = true }: BpoImageProps) {
  const { data: sde } = useSdeData()
  const productTypeId = sde
    ? getBlueprintForBpo(getAllBlueprints(sde.registry), blueprintTypeId)?.productTypeId
    : undefined

  return (
    <EveImage
      id={blueprintTypeId}
      variant="bp"
      productTypeId={productTypeId}
      size={size}
      alt={alt}
      framed={framed}
    />
  )
}

/** Default BPO in sample data that has a CDN blueprint image. */
export const DEFAULT_BPO_TYPE_ID = 688
