// Hand-drawn inline-SVG diagram kit for the VibeCheck site. Every diagram is a
// pure, accessible, theme-aware server component: neutrals derive from
// `currentColor`; the fault / ok / amber accents come from the `--vc-dg-*` tokens
// in app/global.css. Import from '@/components/diagrams' in .mdx or app pages.

export { PipelineDiagram } from './PipelineDiagram'
export { ArchitectureDiagram } from './ArchitectureDiagram'
export { CollectorFlow } from './CollectorFlow'
export { EngineLifecycle } from './EngineLifecycle'
export { BeaconRoundTrip } from './BeaconRoundTrip'
export { IssueLifecycle } from './IssueLifecycle'
