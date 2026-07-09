import type { Icon } from '@phosphor-icons/react'
import { RichText } from './RichText'

// ── Icon-led prose list ──────────────────────────────────────────────────────
// A <ul> where every item carries a fixed-width leading glyph column and prose
// in a ~65ch measure, baseline-aligned to the first text line. The glyph is a
// Phosphor icon passed by the caller (SmileySad for symptoms, Warning for root
// causes) so the two lists differ only by icon and tone. Item text runs through
// RichText, so inline code fragments become chips. Server Component — no client
// JS. The icon is imported from the SSR-safe Phosphor entry by the caller.

type IconTone = 'muted' | 'amber'

export const IconList = ({
  items,
  icon: Glyph,
  tone = 'muted',
}: {
  items: readonly string[]
  icon: Icon
  tone?: IconTone
}) => (
  <ul className="vc-iconlist" data-tone={tone}>
    {items.map((item, i) => (
      <li key={i}>
        <span className="vc-iconlist-icon" aria-hidden="true">
          <Glyph size={18} weight="regular" />
        </span>
        <span className="vc-iconlist-text">
          <RichText text={item} />
        </span>
      </li>
    ))}
  </ul>
)
