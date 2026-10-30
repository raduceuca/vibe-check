const FIRST_NAMES = [
  'Ada', 'Ben', 'Cam', 'Drew', 'Eve', 'Finn', 'Gia', 'Hugo', 'Ivy', 'Jess',
  'Kai', 'Lea', 'Mo', 'Ned', 'Ora', 'Pia', 'Quinn', 'Rio', 'Sam', 'Tess',
]

const BODIES = [
  'Holds heat through a long call.',
  'The glaze pooled just right.',
  'Heavier than it looks — in a good way.',
  'Ships with a note from the studio.',
  'Replaced every mug in the cupboard.',
  'Feels like a keeper.',
  'No chips after a month of daily use.',
  'The handle fits my hand.',
]

/** 2,000 first-name-only reviews for the Harbor mug (dom-bloat when all rendered). */
export const HARBOR_REVIEWS: readonly { readonly id: string; readonly name: string; readonly body: string }[] =
  Array.from({ length: 2000 }, (_, i) => ({
    id: `rev-${i}`,
    name: FIRST_NAMES[i % FIRST_NAMES.length]!,
    body: BODIES[i % BODIES.length]!,
  }))
