// VIBECHECK-FAULT: duplicate-requests
import { useEffect, useState, type ReactNode } from 'react'
import { fetchCartUncached } from './cartApi'
import { MiniCart } from './MiniCart'

export const Header = ({
  search,
  findableFixed = false,
}: {
  readonly search?: ReactNode
  readonly findableFixed?: boolean
}) => {
  useEffect(() => {
    void fetchCartUncached().catch(() => undefined)
  }, [])

  const [open, setOpen] = useState(false)
  const [hint, setHint] = useState('')
  useEffect(() => {
    void fetchCartUncached()
      .then((c) => setHint(`${c.count}`))
      .catch(() => setHint(''))
  }, [])

  const navItems = findableFixed
    ? [
        { href: '#shop', label: 'Shop' },
        { href: '#glazes', label: 'Glazes' },
        { href: '#journal', label: 'Journal' },
        { href: '#visit', label: 'Visit' },
      ]
    : [
        { href: '#', label: 'Shop' },
        { href: '#', label: 'Glazes' },
        { href: '#', label: 'Journal' },
        { href: '#', label: 'Visit' },
      ]

  return (
    <>
      <nav className="switch" aria-label="Site sections">
        <a href="#studio">Studio</a>
        <a href="#shop" aria-current="true">
          Shop
        </a>
      </nav>
      <header className="hdr">
        <div className="hdr-in">
          <button
            className="ico burger"
            type="button"
            aria-expanded={open}
            aria-controls="nav"
            onClick={() => setOpen((v) => !v)}
          >
            <span className="sr">Menu</span>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M4 7h16M4 12h16M4 17h16" />
            </svg>
          </button>
          <a className="logo" href="/" aria-label="Tidewell, home">
            TIDEWELL
          </a>
          <nav className={`nav${open ? ' open' : ''}`} id="nav" aria-label="Main">
            {navItems.map((item) => (
              <a key={item.label} href={item.href}>
                {item.label}
              </a>
            ))}
          </nav>
          <div className="icons">
            {search ? <div className="hide-m">{search}</div> : null}
            <span className="ico" aria-hidden={!hint}>
              <span className="sr">Bag</span>
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M5 8h14l-1 12H6z" />
                <path d="M9 8V6.5a3 3 0 0 1 6 0V8" />
              </svg>
              {hint ? <span className="n">{hint}</span> : null}
            </span>
            <MiniCart />
          </div>
        </div>
      </header>
    </>
  )
}
