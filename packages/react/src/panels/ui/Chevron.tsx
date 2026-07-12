import type { CSSProperties } from 'react'

// Line chevron (not a solid caret); rotates when its row expands.
export const Chevron = ({ open }: { open: boolean }) => {
  const style: CSSProperties = {
    flexShrink: 0,
    color: 'rgba(var(--wcgw-fg),0.5)',
    transform: open ? 'rotate(180deg)' : 'none',
    transition: 'transform var(--wcgw-duration-fast) var(--wcgw-ease)',
  }
  return (
    <svg width={14} height={14} viewBox="0 0 16 16" fill="none" aria-hidden="true" style={style}>
      <path d="M4 6.5 8 10.5l4-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
