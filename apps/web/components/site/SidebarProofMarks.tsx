import { StructuralRuleMark } from '@/components/brand/ProofMarks'

export const SidebarRailTerminals = () => (
  <span className="vc-side-rail-marks" aria-hidden="true">
    <StructuralRuleMark
      className="vc-side-rail-mark vc-side-rail-mark-top"
      orientation="vertical"
    />
    <StructuralRuleMark
      className="vc-side-rail-mark vc-side-rail-mark-bottom"
      orientation="vertical"
    />
  </span>
)

export const SidebarBoundary = ({
  className = '',
}: {
  readonly className?: string
}) => (
  <span
    className={`vc-side-boundary ${className}`.trim()}
    data-vc-sidebar-boundary=""
    aria-hidden="true"
  >
    <StructuralRuleMark orientation="horizontal" color />
  </span>
)
