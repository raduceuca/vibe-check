export class RingBuffer<T> {
  private readonly buffer: (T | undefined)[]
  private head = 0
  private tail = 0
  private count = 0
  readonly capacity: number

  constructor(capacity: number) {
    if (capacity < 1) {
      throw new Error('RingBuffer capacity must be at least 1')
    }
    this.capacity = capacity
    this.buffer = new Array<T | undefined>(capacity).fill(undefined)
  }

  push(item: T): void {
    this.buffer[this.tail] = item
    this.tail = (this.tail + 1) % this.capacity

    if (this.count === this.capacity) {
      // Buffer is full — oldest item is overwritten, advance head
      this.head = (this.head + 1) % this.capacity
    } else {
      this.count += 1
    }
  }

  /**
   * Iterate items oldest-first without allocating. Preferred over `toArray()`
   * on hot paths (e.g. per-frame).
   */
  forEach(callback: (item: T) => void): void {
    for (let i = 0; i < this.count; i++) {
      const index = (this.head + i) % this.capacity
      callback(this.buffer[index] as T)
    }
  }

  /**
   * Drop items from the head (oldest) while the predicate returns true,
   * stopping at the first item that fails the predicate. Zero allocation.
   * Used to trim rolling windows in place.
   */
  trimHeadWhile(predicate: (item: T) => boolean): void {
    while (this.count > 0) {
      const item = this.buffer[this.head] as T
      if (!predicate(item)) return
      this.buffer[this.head] = undefined
      this.head = (this.head + 1) % this.capacity
      this.count -= 1
    }
  }

  toArray(): readonly T[] {
    if (this.count === 0) {
      return []
    }

    const result: T[] = new Array(this.count)
    for (let i = 0; i < this.count; i++) {
      const index = (this.head + i) % this.capacity
      result[i] = this.buffer[index] as T
    }

    return result
  }

  clear(): void {
    this.buffer.fill(undefined)
    this.head = 0
    this.tail = 0
    this.count = 0
  }

  get size(): number {
    return this.count
  }

  get isEmpty(): boolean {
    return this.count === 0
  }

  peek(): T | undefined {
    if (this.count === 0) {
      return undefined
    }
    return this.buffer[this.head]
  }

  peekLast(): T | undefined {
    if (this.count === 0) {
      return undefined
    }
    const lastIndex = (this.tail - 1 + this.capacity) % this.capacity
    return this.buffer[lastIndex]
  }
}
