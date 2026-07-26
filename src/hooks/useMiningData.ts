import { useQuery } from '@tanstack/react-query'
import type { MiningData } from '@/types'
import { publicDataUrl } from '@/lib/paths'

async function loadMiningData(): Promise<MiningData> {
  const res = await fetch(publicDataUrl('mining.json'))
  if (!res.ok) throw new Error(`Failed to load mining.json (${res.status})`)
  return res.json()
}

export function useMiningData() {
  return useQuery({
    queryKey: ['mining-data'],
    queryFn: loadMiningData,
    staleTime: 60_000,
    refetchOnMount: 'always',
  })
}
