'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

export type AgentId = 'claude-code' | 'codex' | 'cursor'

const AGENTS: readonly { readonly id: AgentId; readonly label: string }[] = [
  { id: 'claude-code', label: 'Claude Code' },
  { id: 'codex', label: 'Codex' },
  { id: 'cursor', label: 'Cursor' },
] as const

const STORAGE_KEY = 'vibecheck-site:agent'

interface AgentPickerContextValue {
  readonly agent: AgentId
  readonly setAgent: (agent: AgentId) => void
}

const AgentPickerContext = createContext<AgentPickerContextValue | null>(null)

const readStoredAgent = (): AgentId => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw === 'claude-code' || raw === 'codex' || raw === 'cursor') return raw
  } catch {
    // Storage unavailable — fall through to default.
  }
  return 'claude-code'
}

const writeStoredAgent = (agent: AgentId): void => {
  try {
    localStorage.setItem(STORAGE_KEY, agent)
  } catch {
    // Storage unavailable.
  }
}

export const AgentPickerProvider = ({ children }: { readonly children: ReactNode }) => {
  const [agent, setAgentState] = useState<AgentId>('claude-code')
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    setAgentState(readStoredAgent())
    setHydrated(true)
  }, [])

  const setAgent = useCallback((next: AgentId) => {
    setAgentState(next)
    writeStoredAgent(next)
  }, [])

  const value = useMemo(
    () => ({ agent: hydrated ? agent : 'claude-code', setAgent }),
    [agent, hydrated, setAgent],
  )

  return (
    <AgentPickerContext.Provider value={value}>
      {children}
    </AgentPickerContext.Provider>
  )
}

export const useAgentPicker = (): AgentPickerContextValue => {
  const ctx = useContext(AgentPickerContext)
  if (!ctx) {
    throw new Error('useAgentPicker must be used within AgentPickerProvider')
  }
  return ctx
}

export const AgentPicker = ({ name = 'vc-agent' }: { readonly name?: string }) => {
  const { agent, setAgent } = useAgentPicker()

  return (
    <div
      role="radiogroup"
      aria-label="Coding agent"
      style={{ display: 'inline-flex', flexWrap: 'wrap', gap: 8 }}
    >
      {AGENTS.map((option) => {
        const checked = agent === option.id
        return (
          <label
            key={option.id}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 14,
              fontWeight: 500,
              color: 'var(--vc-ink)',
              cursor: 'pointer',
            }}
          >
            <input
              type="radio"
              name={name}
              value={option.id}
              checked={checked}
              onChange={() => setAgent(option.id)}
            />
            {option.label}
          </label>
        )
      })}
    </div>
  )
}
