export interface CartPayload {
  readonly items: readonly {
    readonly id: string
    readonly name: string
    readonly qty: number
    readonly priceCents: number
  }[]
  readonly count: number
  readonly subtotalCents: number
}

/** Broken path: callers each fire their own fetch. */
export const fetchCartUncached = (): Promise<CartPayload> =>
  fetch('/api/cart.json').then((r) => {
    if (!r.ok) throw new Error(`cart ${r.status}`)
    return r.json() as Promise<CartPayload>
  })

let cached: Promise<CartPayload> | null = null

/** Reference fix: one module-level promise shared by Header + MiniCart. */
export const fetchCartCached = (): Promise<CartPayload> => {
  if (cached === null) {
    cached = fetchCartUncached()
  }
  return cached
}
