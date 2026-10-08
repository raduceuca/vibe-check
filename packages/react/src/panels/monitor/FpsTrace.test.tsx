import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { FpsTrace } from './FpsTrace.js'

describe('FpsTrace', () => {
  it('draws a single fps polyline', () => {
    const { container } = render(<FpsTrace fps={42} tick={1} color="#f00" />)

    expect(container.querySelectorAll('polyline')).toHaveLength(1)
  })
})
