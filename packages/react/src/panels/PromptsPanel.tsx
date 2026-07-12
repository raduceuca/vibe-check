import { memo } from 'react'
import type { SuggestionMode } from '@wcgw/vibe-check-core'
import { PROACTIVE_PROMPTS } from '@wcgw/vibe-check-core'
import { T } from '../tokens.js'
import { CopyButton } from './ui/CopyButton.js'
import { SectionHeader } from './ui/SectionHeader.js'
import { rowFrame } from './ui/Row.js'

interface PromptsPanelProps {
  readonly mode: SuggestionMode
  readonly copiedId: string | null
  readonly onCopy: (text: string, id: string) => Promise<boolean>
}

// Reuse the shared list-row frame instead of re-implementing padding + divider.
const cardStyle = rowFrame

export const PromptsPanel = memo(({ mode, copiedId, onCopy }: PromptsPanelProps) => (
  <div style={{ paddingTop: 4 }}>
    <SectionHeader>
      {mode === 'vibe' ? 'Ask Your AI To...' : 'Proactive Prompts'}
    </SectionHeader>

    <div>
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
              color: T.text,
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
))
