// Tiny progress ring for the collapsed pill (FPS out of 60). SVG stroke takes a
// CSS var directly; the glow uses color-mix so it works with a var colour too.
export const MiniRing = ({ value, max, color }: { value: number; max: number; color: string }) => {
  const sw = 2; const size = 20; const r = (size - sw * 2) / 2; const c = 2 * Math.PI * r
  const offset = c * (1 - Math.min(value / max, 1)); const mid = size / 2
  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)', flexShrink: 0 }}>
      <circle cx={mid} cy={mid} r={r} fill="none" stroke="rgba(var(--wcgw-fg),0.08)" strokeWidth={sw} />
      <circle cx={mid} cy={mid} r={r} fill="none" stroke={color} strokeWidth={sw}
        strokeDasharray={c} strokeDashoffset={offset} strokeLinecap="round"
        style={{ filter: `drop-shadow(0 0 3px color-mix(in srgb, ${color} 31%, transparent))`, transition: 'stroke-dashoffset var(--wcgw-duration-normal) var(--wcgw-ease)' }}
      />
    </svg>
  )
}
