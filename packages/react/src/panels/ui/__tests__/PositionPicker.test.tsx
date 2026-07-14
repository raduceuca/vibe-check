import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { PositionPicker } from '../PositionPicker.js'

describe('PositionPicker', () => {
  it('exposes four native radio choices in one labelled group', () => {
    const onChange = vi.fn()
    render(<PositionPicker label="Expanded" value="bottom-right" onChange={onChange} />)

    expect(screen.getByRole('radiogroup', { name: 'Expanded' })).toBeTruthy()
    expect(screen.getAllByRole('radio')).toHaveLength(4)
    expect(screen.getByRole('radio', { name: 'Bottom right' }).getAttribute('aria-checked')).toBeNull()
    expect((screen.getByRole('radio', { name: 'Bottom right' }) as HTMLInputElement).checked).toBe(true)

    fireEvent.click(screen.getByRole('radio', { name: 'Top left' }))
    expect(onChange).toHaveBeenCalledWith('top-left')
  })

  it('shows visible focus treatment for keyboard users', () => {
    render(<PositionPicker label="Collapsed" value="top-left" onChange={vi.fn()} />)
    const radio = screen.getByRole('radio', { name: 'Top right' })

    fireEvent.focus(radio)

    expect(radio.parentElement?.style.boxShadow).toContain('var(--wcgw-sev-info)')
  })
})
