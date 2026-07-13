import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { FpsTrace } from './FpsTrace.js'

describe('FpsTrace', () => {
  it('adds process echoes only for a faulted trace', () => {
    const { container, rerender } = render(
      <FpsTrace fps={42} tick={1} color="#f00" faulted={false} />,
    )

    expect(container.querySelectorAll('[data-wcgw-proof-echo]')).toHaveLength(0)

    rerender(<FpsTrace fps={38} tick={2} color="#f00" faulted />)

    expect(container.querySelectorAll('[data-wcgw-proof-echo]')).toHaveLength(2)
  })
})
