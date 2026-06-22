import type { CSSProperties } from 'react'
import type { SuggestionMode } from '@wcgw/vibe-check-core'
import { PROACTIVE_PROMPTS } from '@wcgw/vibe-check-core'
import { T, sectionHeaderStyle } from '../tokens.js'
import { CopyButton } from './ui/CopyButton.js'

interface PromptsPanelProps {
  readonly mode: SuggestionMode
  readonly copiedId: string | null
  readonly onCopy: (text: string, id: string) => Promise<boolean>
}

const cardStyle: CSSProperties = {
  padding: '10px 12px',
  borderRadius: 8,
  background: 'rgba(var(--vc-fg,255,255,255),0.02)',
  border: '1px solid rgba(var(--vc-fg,255,255,255),0.05)',
  marginBottom: 6,
  transition: 'all 0.2s ease',
}

export const PromptsPanel = ({ mode, copiedId, onCopy }: PromptsPanelProps) => (
  <div style={{ paddingTop: 4 }}>
    <div style={sectionHeaderStyle}>
      {mode === 'vibe' ? 'Ask Your AI To...' : 'Proactive Prompts'}
    </div>

    <div style={{ maxHeight: 320, overflowY: 'auto' }}>
      {PROACTIVE_PROMPTS.map((prompt) => (
        <div key={prompt.id} style={cardStyle}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 8,
          }}>
            <span style={{
              fontSize: 14,
              fontWeight: 600,
              color: 'rgba(var(--vc-fg,255,255,255),0.8)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              flex: 1,
            }}>
              {prompt.title}
            </span>
            <CopyButton
              copied={copiedId === prompt.id}
              onClick={() => onCopy(prompt.prompt, prompt.id)}
              size="sm"
            />
          </div>
          <div style={{
            fontSize: 14,
            color: T.textTertiary,
            marginTop: 4,
            lineHeight: 1.45,
          }}>
            {prompt.description}
          </div>
        </div>
      ))}
    </div>
  </div>
)
