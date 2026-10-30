import { LANDING_COPY } from '@/lib/landingCopy'

/** Both strings are always in the HTML; CSS media queries swap which one shows. */
export const HeroNote = () => (
  <aside className="vc-hero-note" aria-label="About the live widget">
    <p className="vc-hero-note-wide">{LANDING_COPY.hero.noteWide}</p>
    <p className="vc-hero-note-narrow">{LANDING_COPY.hero.noteNarrow}</p>
  </aside>
)
