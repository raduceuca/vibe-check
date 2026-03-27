import { describe, it, expect } from 'vitest'
import { RingBuffer } from '../ringBuffer'

describe('RingBuffer', () => {
  describe('constructor', () => {
    it('throws when capacity is less than 1', () => {
      expect(() => new RingBuffer(0)).toThrow('RingBuffer capacity must be at least 1')
      expect(() => new RingBuffer(-5)).toThrow('RingBuffer capacity must be at least 1')
    })

    it('creates a buffer with the given capacity', () => {
      const buf = new RingBuffer<number>(10)
      expect(buf.capacity).toBe(10)
      expect(buf.size).toBe(0)
      expect(buf.isEmpty).toBe(true)
    })
  })

  describe('push and toArray', () => {
    it('returns items in insertion order', () => {
      const buf = new RingBuffer<number>(5)
      buf.push(1)
      buf.push(2)
      buf.push(3)

      expect(buf.toArray()).toEqual([1, 2, 3])
    })

    it('returns an empty array when buffer is empty', () => {
      const buf = new RingBuffer<string>(3)
      expect(buf.toArray()).toEqual([])
    })

    it('returns a new array instance on each call', () => {
      const buf = new RingBuffer<number>(3)
      buf.push(1)
      const a = buf.toArray()
      const b = buf.toArray()
      expect(a).toEqual(b)
      expect(a).not.toBe(b)
    })
  })

  describe('overflow wrapping', () => {
    it('drops oldest items when capacity is exceeded', () => {
      const buf = new RingBuffer<number>(3)
      buf.push(1)
      buf.push(2)
      buf.push(3)
      buf.push(4) // drops 1

      expect(buf.toArray()).toEqual([2, 3, 4])
      expect(buf.size).toBe(3)
    })

    it('handles multiple overflows correctly', () => {
      const buf = new RingBuffer<number>(3)
      buf.push(1)
      buf.push(2)
      buf.push(3)
      buf.push(4) // drops 1
      buf.push(5) // drops 2
      buf.push(6) // drops 3

      expect(buf.toArray()).toEqual([4, 5, 6])
    })

    it('handles wrapping far beyond capacity', () => {
      const buf = new RingBuffer<number>(3)
      for (let i = 1; i <= 100; i++) {
        buf.push(i)
      }
      expect(buf.toArray()).toEqual([98, 99, 100])
      expect(buf.size).toBe(3)
    })
  })

  describe('size', () => {
    it('stays at capacity after overflow', () => {
      const buf = new RingBuffer<number>(2)
      buf.push(1)
      expect(buf.size).toBe(1)
      buf.push(2)
      expect(buf.size).toBe(2)
      buf.push(3)
      expect(buf.size).toBe(2)
      buf.push(4)
      expect(buf.size).toBe(2)
    })

    it('tracks size correctly during filling', () => {
      const buf = new RingBuffer<string>(5)
      expect(buf.size).toBe(0)
      buf.push('a')
      expect(buf.size).toBe(1)
      buf.push('b')
      expect(buf.size).toBe(2)
      buf.push('c')
      expect(buf.size).toBe(3)
    })
  })

  describe('clear', () => {
    it('resets the buffer to empty', () => {
      const buf = new RingBuffer<number>(5)
      buf.push(1)
      buf.push(2)
      buf.push(3)

      buf.clear()

      expect(buf.size).toBe(0)
      expect(buf.isEmpty).toBe(true)
      expect(buf.toArray()).toEqual([])
      expect(buf.peek()).toBeUndefined()
      expect(buf.peekLast()).toBeUndefined()
    })

    it('allows pushing after clear', () => {
      const buf = new RingBuffer<number>(3)
      buf.push(1)
      buf.push(2)
      buf.clear()
      buf.push(10)
      buf.push(20)

      expect(buf.toArray()).toEqual([10, 20])
      expect(buf.size).toBe(2)
    })
  })

  describe('peek', () => {
    it('returns the oldest item', () => {
      const buf = new RingBuffer<number>(3)
      buf.push(10)
      buf.push(20)
      buf.push(30)

      expect(buf.peek()).toBe(10)
    })

    it('returns the oldest item after overflow', () => {
      const buf = new RingBuffer<number>(3)
      buf.push(10)
      buf.push(20)
      buf.push(30)
      buf.push(40) // drops 10

      expect(buf.peek()).toBe(20)
    })

    it('returns undefined when buffer is empty', () => {
      const buf = new RingBuffer<number>(3)
      expect(buf.peek()).toBeUndefined()
    })
  })

  describe('peekLast', () => {
    it('returns the newest item', () => {
      const buf = new RingBuffer<number>(3)
      buf.push(10)
      buf.push(20)
      buf.push(30)

      expect(buf.peekLast()).toBe(30)
    })

    it('returns the newest item after overflow', () => {
      const buf = new RingBuffer<number>(3)
      buf.push(10)
      buf.push(20)
      buf.push(30)
      buf.push(40)

      expect(buf.peekLast()).toBe(40)
    })

    it('returns undefined when buffer is empty', () => {
      const buf = new RingBuffer<number>(3)
      expect(buf.peekLast()).toBeUndefined()
    })
  })

  describe('single item buffer', () => {
    it('always holds only the last item pushed', () => {
      const buf = new RingBuffer<string>(1)
      buf.push('a')
      expect(buf.toArray()).toEqual(['a'])
      expect(buf.peek()).toBe('a')
      expect(buf.peekLast()).toBe('a')
      expect(buf.size).toBe(1)

      buf.push('b')
      expect(buf.toArray()).toEqual(['b'])
      expect(buf.peek()).toBe('b')
      expect(buf.peekLast()).toBe('b')
      expect(buf.size).toBe(1)
    })
  })

  describe('large capacity', () => {
    it('handles a large buffer correctly', () => {
      const capacity = 10_000
      const buf = new RingBuffer<number>(capacity)

      for (let i = 0; i < capacity; i++) {
        buf.push(i)
      }

      expect(buf.size).toBe(capacity)
      expect(buf.peek()).toBe(0)
      expect(buf.peekLast()).toBe(capacity - 1)

      const arr = buf.toArray()
      expect(arr.length).toBe(capacity)
      expect(arr[0]).toBe(0)
      expect(arr[capacity - 1]).toBe(capacity - 1)
    })

    it('handles overflow on a large buffer', () => {
      const capacity = 1_000
      const buf = new RingBuffer<number>(capacity)

      for (let i = 0; i < capacity + 500; i++) {
        buf.push(i)
      }

      expect(buf.size).toBe(capacity)
      expect(buf.peek()).toBe(500)
      expect(buf.peekLast()).toBe(capacity + 499)

      const arr = buf.toArray()
      expect(arr.length).toBe(capacity)
      expect(arr[0]).toBe(500)
      expect(arr[capacity - 1]).toBe(capacity + 499)
    })
  })

  describe('isEmpty', () => {
    it('is true for a new buffer', () => {
      const buf = new RingBuffer<number>(5)
      expect(buf.isEmpty).toBe(true)
    })

    it('is false after pushing an item', () => {
      const buf = new RingBuffer<number>(5)
      buf.push(1)
      expect(buf.isEmpty).toBe(false)
    })

    it('is true after clear', () => {
      const buf = new RingBuffer<number>(5)
      buf.push(1)
      buf.clear()
      expect(buf.isEmpty).toBe(true)
    })
  })

  describe('type safety', () => {
    it('works with object types', () => {
      interface Point {
        readonly x: number
        readonly y: number
      }

      const buf = new RingBuffer<Point>(2)
      buf.push({ x: 1, y: 2 })
      buf.push({ x: 3, y: 4 })

      expect(buf.toArray()).toEqual([
        { x: 1, y: 2 },
        { x: 3, y: 4 },
      ])
    })
  })
})
