import { createContext, useContext } from 'react'
import type { VibeEngine } from '@wcgw/vibe-check-core'

// VibeEngine (not the concrete VibeCheckEngine) so a scripted/mock engine that
// implements the same surface can be provided for demos.
const VibeCheckContext = createContext<VibeEngine | null>(null)

export const VibeCheckProvider = VibeCheckContext.Provider

export const useVibeCheckEngine = (): VibeEngine | null =>
  useContext(VibeCheckContext)
