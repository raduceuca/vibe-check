export interface Product {
  readonly id: string
  readonly name: string
  readonly glaze: string
  readonly price: string
  readonly shipsBy: string
  readonly image: string
}

export const PRODUCTS: readonly Product[] = [
  { id: 'harbor', name: 'Harbor mug', glaze: 'Tide Blue', price: '$42', shipsBy: '2026-11-12', image: '/images/product-1.jpg' },
  { id: 'fog', name: 'Fog bowl', glaze: 'Harbor Fog', price: '$48', shipsBy: '2026-11-14', image: '/images/product-2.jpg' },
  { id: 'ash', name: 'Ash plate', glaze: 'Kiln Ash', price: '$36', shipsBy: '2026-11-10', image: '/images/product-3.jpg' },
  { id: 'salt', name: 'Salt pourer', glaze: 'Sea Salt', price: '$28', shipsBy: '2026-11-18', image: '/images/product-4.jpg' },
  { id: 'moss', name: 'Moss cup', glaze: 'Moss Green', price: '$32', shipsBy: '2026-11-11', image: '/images/product-5.jpg' },
  { id: 'ember', name: 'Ember jar', glaze: 'Ember', price: '$54', shipsBy: '2026-11-20', image: '/images/product-6.jpg' },
  { id: 'bone', name: 'Bone vase', glaze: 'Bone White', price: '$68', shipsBy: '2026-11-22', image: '/images/product-7.jpg' },
  { id: 'iron', name: 'Iron tray', glaze: 'Iron Speckle', price: '$44', shipsBy: '2026-11-15', image: '/images/product-8.jpg' },
]

export const GLAZE_OPTIONS = [
  'Tide Blue',
  'Harbor Fog',
  'Kiln Ash',
  'Sea Salt',
  'Moss Green',
  'Ember',
] as const
