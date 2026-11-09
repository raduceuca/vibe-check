// VIBECHECK-FAULT: layout-thrashing
// VIBECHECK-FAULT: long-task-attribution
// VIBECHECK-FAULT: fps (collector) — Lenis + GSAP ScrollTrigger scrub + forced reflow loop
//
// Classic vibe-coded Webflow energy: smooth-scroll library, scrubbed parallax on
// every card, character-split headlines, and a rAF loop that reads layout then
// writes styles. Looks fancy; tanks the main thread. CDN only — no npm dep.
import { useEffect } from 'react'

const GSAP_SRC = 'https://cdn.jsdelivr.net/npm/gsap@3.12.5/dist/gsap.min.js'
const ST_SRC = 'https://cdn.jsdelivr.net/npm/gsap@3.12.5/dist/ScrollTrigger.min.js'
const LENIS_SRC = 'https://cdn.jsdelivr.net/npm/lenis@1.1.18/dist/lenis.min.js'

type GsapLike = {
  registerPlugin: (...args: unknown[]) => void
  ticker: { add: (fn: (time: number) => void) => void; remove: (fn: (time: number) => void) => void; lagSmoothing: (n: number) => void }
  utils: { toArray: (sel: string) => Element[] }
  set: (target: unknown, vars: Record<string, unknown>) => void
  to: (target: unknown, vars: Record<string, unknown>) => { kill: () => void }
  fromTo: (target: unknown, from: Record<string, unknown>, to: Record<string, unknown>) => { kill: () => void }
  context: (fn: () => void) => { revert: () => void }
}

type ScrollTriggerLike = {
  update: () => void
  refresh: () => void
  getAll: () => Array<{ kill: () => void }>
}

type LenisLike = {
  on: (event: string, cb: (e: { scroll: number }) => void) => void
  raf: (time: number) => void
  destroy: () => void
  scrollTo: (target: number | string, opts?: Record<string, unknown>) => void
}

declare global {
  interface Window {
    gsap?: GsapLike
    ScrollTrigger?: ScrollTriggerLike
    Lenis?: new (opts?: Record<string, unknown>) => LenisLike
  }
}

const when = (predicate: () => boolean, label: string, timeoutMs = 8_000): Promise<void> =>
  new Promise((resolve, reject) => {
    if (predicate()) {
      resolve()
      return
    }
    const started = Date.now()
    const id = window.setInterval(() => {
      if (predicate()) {
        window.clearInterval(id)
        resolve()
        return
      }
      if (Date.now() - started > timeoutMs) {
        window.clearInterval(id)
        reject(new Error(`Timed out waiting for ${label}`))
      }
    }, 16)
  })

const loadScript = (src: string, id: string): Promise<void> =>
  new Promise((resolve, reject) => {
    const existing = document.getElementById(id) as HTMLScriptElement | null
    if (existing) {
      // Already finished (or StrictMode remount while still downloading).
      if (existing.dataset.loaded === '1' || existing.getAttribute('data-loaded') === '1') {
        resolve()
        return
      }
      existing.addEventListener(
        'load',
        () => {
          existing.dataset.loaded = '1'
          resolve()
        },
        { once: true },
      )
      existing.addEventListener('error', () => reject(new Error(`Failed to load ${src}`)), {
        once: true,
      })
      return
    }
    const script = document.createElement('script')
    script.id = id
    script.src = src
    script.async = true
    script.onload = () => {
      script.dataset.loaded = '1'
      resolve()
    }
    script.onerror = () => reject(new Error(`Failed to load ${src}`))
    document.head.appendChild(script)
  })

const splitChars = (el: Element): void => {
  if (el.getAttribute('data-tidewell-split') === '1') return
  const text = el.textContent ?? ''
  el.setAttribute('data-tidewell-split', '1')
  el.textContent = ''
  for (const ch of text) {
    const span = document.createElement('span')
    span.className = 'tidewell-char'
    span.style.display = 'inline-block'
    span.style.willChange = 'transform, opacity'
    span.textContent = ch === ' ' ? '\u00a0' : ch
    el.appendChild(span)
  }
}

/** Over-animated motion theatre — mount only in the broken Smooth scenario. */
export const OverTheTopMotion = () => {
  useEffect(() => {
    let cancelled = false
    let lenis: LenisLike | null = null
    let ctx: { revert: () => void } | null = null
    let tickerFn: ((time: number) => void) | null = null
    let reflowRaf = 0
    let mouseX = 0
    let mouseY = 0

    const onMove = (e: MouseEvent) => {
      mouseX = e.clientX
      mouseY = e.clientY
    }

    const boot = async () => {
      await loadScript(GSAP_SRC, 'tidewell-gsap')
      await when(() => Boolean(window.gsap), 'window.gsap')
      await loadScript(ST_SRC, 'tidewell-scrolltrigger')
      await when(() => Boolean(window.ScrollTrigger), 'window.ScrollTrigger')
      await loadScript(LENIS_SRC, 'tidewell-lenis')
      await when(() => Boolean(window.Lenis), 'window.Lenis')
      if (cancelled) return

      const gsap = window.gsap
      const ScrollTrigger = window.ScrollTrigger
      const LenisCtor = window.Lenis
      if (!gsap || !ScrollTrigger || !LenisCtor) return

      gsap.registerPlugin(ScrollTrigger)

      // Momentum scroll — every wheel tick becomes a long interpolation.
      lenis = new LenisCtor({
        duration: 1.4,
        smoothWheel: true,
        syncTouch: true,
      })
      lenis.on('scroll', () => {
        ScrollTrigger.update()
        // Deliberate: refresh on scroll forces layout work continuously.
        if (Math.random() < 0.08) ScrollTrigger.refresh()
      })
      tickerFn = (time: number) => {
        lenis?.raf(time * 1000)
      }
      gsap.ticker.add(tickerFn)
      gsap.ticker.lagSmoothing(0)

      document.documentElement.classList.add('lenis')
      window.addEventListener('mousemove', onMove, { passive: true })

      ctx = gsap.context(() => {
        const heroImg = document.querySelector('.hero img')
        if (heroImg) {
          gsap.fromTo(
            heroImg,
            { scale: 1.25, yPercent: -8 },
            {
              scale: 1,
              yPercent: 8,
              ease: 'none',
              scrollTrigger: {
                trigger: '.hero',
                start: 'top top',
                end: 'bottom top',
                scrub: 1.2,
              },
            },
          )
        }

        for (const heading of gsap.utils.toArray('.intro h2, .split-tx h2, .row-head h1, .row-head h2, .hero-tx h1')) {
          splitChars(heading)
          gsap.fromTo(
            heading.querySelectorAll('.tidewell-char'),
            { yPercent: 120, opacity: 0, rotate: 8 },
            {
              yPercent: 0,
              opacity: 1,
              rotate: 0,
              stagger: 0.03,
              duration: 1.1,
              ease: 'power3.out',
              scrollTrigger: {
                trigger: heading,
                start: 'top 85%',
                toggleActions: 'play none none reverse',
              },
            },
          )
        }

        for (const card of gsap.utils.toArray('.card')) {
          gsap.set(card, { transformOrigin: '50% 50%' })
          gsap.fromTo(
            card,
            { y: 80, rotateX: 12, opacity: 0.2 },
            {
              y: 0,
              rotateX: 0,
              opacity: 1,
              ease: 'none',
              scrollTrigger: {
                trigger: card,
                start: 'top 95%',
                end: 'top 40%',
                scrub: 0.8,
              },
            },
          )
          // Continuous float — never settles, keeps compositor + main thread busy.
          gsap.to(card, {
            y: '+=14',
            duration: 1.6 + Math.random(),
            yoyo: true,
            repeat: -1,
            ease: 'sine.inOut',
            delay: Math.random(),
          })
        }

        for (const img of gsap.utils.toArray('.split-img img, .news .split-img img')) {
          gsap.fromTo(
            img,
            { scale: 1.2, filter: 'blur(8px)' },
            {
              scale: 1,
              filter: 'blur(0px)',
              ease: 'none',
              scrollTrigger: {
                trigger: img,
                start: 'top bottom',
                end: 'bottom top',
                scrub: true,
              },
            },
          )
        }

      })

      // Forced reflow + magnetic CTAs: read geometry, then write transforms.
      const thrash = () => {
        const cards = document.querySelectorAll('.card')
        let sum = 0
        for (const card of cards) {
          const el = card as HTMLElement
          const r = el.getBoundingClientRect()
          sum += r.top + r.height
          el.style.setProperty('--tidewell-parallax', `${(mouseY - r.top) * 0.02}px`)
          // Reading offsetHeight after a write guarantees layout thrashing.
          sum += el.offsetHeight
        }
        for (const btn of document.querySelectorAll('.btn')) {
          const el = btn as HTMLElement
          const r = el.getBoundingClientRect()
          const dx = (mouseX - (r.left + r.width / 2)) * 0.08
          const dy = (mouseY - (r.top + r.height / 2)) * 0.08
          el.style.transform = `translate(${dx}px, ${dy}px)`
          sum += el.offsetWidth
        }
        document.documentElement.style.setProperty('--tidewell-bloat', `${sum % 97}px`)
        reflowRaf = window.requestAnimationFrame(thrash)
      }
      reflowRaf = window.requestAnimationFrame(thrash)
    }

    void boot().catch(() => {
      // CDN failure — leave the rest of the broken shop alone.
    })

    return () => {
      cancelled = true
      window.removeEventListener('mousemove', onMove)
      window.cancelAnimationFrame(reflowRaf)
      ctx?.revert()
      window.ScrollTrigger?.getAll().forEach((t) => t.kill())
      if (tickerFn && window.gsap) window.gsap.ticker.remove(tickerFn)
      lenis?.destroy()
      document.documentElement.classList.remove('lenis')
      document.documentElement.style.removeProperty('--tidewell-bloat')
    }
  }, [])

  return null
}
