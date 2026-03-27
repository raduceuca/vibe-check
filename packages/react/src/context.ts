import { createContext, useContext } from 'react'
import type { VibeCheckEngine } from '@wcgw/vibe-check-core'

const VibeCheckContext = createContext<VibeCheckEngine | null>(null)

export const VibeCheckProvider = VibeCheckContext.Provider

export const useVibeCheckEngine = (): VibeCheckEngine | null =>
  useContext(VibeCheckContext)
