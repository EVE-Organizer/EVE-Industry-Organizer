import { createContext, useContext } from 'react'

const MapOverlayContext = createContext<HTMLElement | null>(null)

export const MapOverlayContextProvider = MapOverlayContext.Provider

export function useMapOverlayRoot(): HTMLElement | null {
  return useContext(MapOverlayContext)
}
