export const queryKeys = {
  sde: {
    all: ['sde'] as const,
    types: () => [...queryKeys.sde.all, 'types'] as const,
    blueprints: () => [...queryKeys.sde.all, 'blueprints'] as const,
    skills: () => [...queryKeys.sde.all, 'skills'] as const,
    stations: () => [...queryKeys.sde.all, 'stations'] as const,
    systems: () => [...queryKeys.sde.all, 'systems'] as const,
  },
  market: {
    price: (typeId: number, regionId: number) => ['market', 'price', typeId, regionId] as const,
    history: (typeId: number, regionId: number) => ['market', 'history', typeId, regionId] as const,
    costIndices: () => ['market', 'costIndices'] as const,
  },
}
