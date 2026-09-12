import { useMemo } from 'react'
import { buildTypeMap } from '@/services/data/sdeLoader'
import type { TypeInfo } from '@/types'

export function useTypeMap(types: TypeInfo[] | undefined) {
  return useMemo(() => (types ? buildTypeMap(types) : new Map()), [types])
}
