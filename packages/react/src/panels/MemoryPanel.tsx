import type { CSSProperties } from 'react'
import type { HeapMemory } from '@wcgw/vibe-check-core'
import { Panel } from './ui/Panel.js'
import { Row } from './ui/Row.js'

interface MemoryPanelProps {
  readonly memory: HeapMemory | null
}

const heapColor = (mb: number): string => {
  if (mb <= 50) return '#4ade80'
  if (mb <= 150) return '#fbbf24'
  if (mb <= 300) return '#fb923c'
  return '#f87171'
}

const usedPctColor = (pct: number): string => {
  if (pct <= 50) return '#4ade80'
  if (pct <= 75) return '#fbbf24'
  if (pct <= 90) return '#fb923c'
  return '#f87171'
}

const unavailableStyle: CSSProperties = {
  fontSize: 11,
  color: 'rgba(var(--vc-fg,255,255,255), 0.18)',
  padding: '2px 0',
}

export const MemoryPanel = ({ memory }: MemoryPanelProps) => (
  <Panel title="Memory" borderTop>
    {memory ? (
      <>
        <Row
          label="JS Heap"
          value={`${memory.jsHeapSizeMB.toFixed(1)} MB`}
          color={heapColor(memory.jsHeapSizeMB)}
          bold
        />
        <Row
          label="Used"
          value={`${memory.usedPct.toFixed(0)}%`}
          color={usedPctColor(memory.usedPct)}
        />
      </>
    ) : (
      <div style={unavailableStyle}>Chrome only</div>
    )}
  </Panel>
)
