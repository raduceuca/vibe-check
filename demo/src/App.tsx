import { useState, useEffect } from 'react'
import { VibeCheck } from '@wcgw/vibe-check'

// ══════════════════════════════════════════════════════════════════════════════
// A "vibe coded" landing page with VISIBLE performance anti-patterns.
// Every problem is something you'd actually see on an AI-built site.
// ══════════════════════════════════════════════════════════════════════════════

const FONT = '-apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", system-ui, sans-serif'

// ── Nav ─────────────────────────────────────────────────────────────────────

const Nav = () => {
  // Anti-pattern: fetching user data on every mount without caching
  useEffect(() => {
    fetch('https://jsonplaceholder.typicode.com/users/1').catch(() => {})
    fetch('https://jsonplaceholder.typicode.com/users/1').catch(() => {})
  }, [])

  return (
    <nav style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '16px 40px', borderBottom: '1px solid rgba(255,255,255,0.06)',
    }}>
      <div style={{ fontSize: 18, fontWeight: 700, color: '#fff', letterSpacing: '-0.02em' }}>
        VibeShip
      </div>
      <div style={{ display: 'flex', gap: 24, fontSize: 14, color: 'rgba(255,255,255,0.5)' }}>
        <span>Product</span><span>Pricing</span><span>Docs</span>
        <button style={{
          padding: '6px 16px', borderRadius: 6, border: 'none',
          background: '#fff', color: '#000', fontSize: 13, fontWeight: 600,
          cursor: 'pointer', fontFamily: FONT,
        }}>Sign Up</button>
      </div>
    </nav>
  )
}

// ── What's New band (showcases the 0.2.0 improvements) ──────────────────────

const NewCard = ({ tag, title, body }: { tag: string; title: string; body: string }) => (
  <div style={{
    padding: '16px 18px', borderRadius: 12,
    background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)',
  }}>
    <div style={{ fontSize: 11, fontWeight: 600, color: '#4ade80', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
      {tag}
    </div>
    <div style={{ fontSize: 15, fontWeight: 600, color: '#fff', marginBottom: 6, letterSpacing: '-0.01em' }}>{title}</div>
    <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)', lineHeight: 1.55 }}>{body}</div>
  </div>
)

const WhatsNew = () => (
  <section style={{
    padding: '36px 40px', borderBottom: '1px solid rgba(255,255,255,0.06)',
    background: 'rgba(255,255,255,0.015)',
  }}>
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 4 }}>
      <span style={{ fontSize: 12, fontWeight: 700, color: '#4ade80', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
        vibe-check 0.2.0
      </span>
      <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.25)' }}>what&apos;s new</span>
    </div>
    <h2 style={{ fontSize: 26, fontWeight: 700, color: '#fff', margin: '0 0 4px', letterSpacing: '-0.02em' }}>
      Sharper signal, honest status, zero footprint
    </h2>
    <p style={{ fontSize: 15, color: 'rgba(255,255,255,0.45)', margin: '0 0 24px', maxWidth: 620, lineHeight: 1.6 }}>
      The page below is intentionally full of performance anti-patterns. Open the panel (bottom-right) to see these improvements live.
    </p>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
      <NewCard
        tag="Settings tab"
        title="Live MCP status"
        body="The connection dot now reflects real beacon delivery — inactive → connecting → active — instead of just 'a URL is set'."
      />
      <NewCard
        tag="Agent tab"
        title="Accurate AI fixes"
        body="Fix suggestions read each detector's real evidence, so the agent gets actual numbers instead of 'unknown MB and growing'."
      />
      <NewCard
        tag="Under the hood"
        title="Never hijacks console"
        body="Monitoring restores your console.* exactly on stop — no dead wrapper left behind, even after toggling the panel repeatedly."
      />
      <NewCard
        tag="Type-safe"
        title="Drift-proof contract"
        body="A shared protocol package makes a detector and its fix-suggestion disagreeing a compile error, not a silent bug."
      />
    </div>
  </section>
)

// ── Hero with oversized background image ────────────────────────────────────

const Hero = () => (
  <section style={{
    position: 'relative', padding: '100px 40px 80px', textAlign: 'center',
    overflow: 'hidden',
  }}>
    {/* Anti-pattern: massive image as background, no lazy, no dimensions */}
    <img
      src="https://picsum.photos/2400/1200"
      alt=""
      style={{
        position: 'absolute', inset: 0, width: '100%', height: '100%',
        objectFit: 'cover', opacity: 0.15, zIndex: 0,
      }}
    />
    <div style={{ position: 'relative', zIndex: 1 }}>
      <h1 style={{
        fontSize: 56, fontWeight: 800, letterSpacing: '-0.04em', lineHeight: 1.05,
        color: '#fff', margin: '0 0 20px',
      }}>
        Build apps at the<br />speed of thought
      </h1>
      <p style={{
        fontSize: 20, color: 'rgba(255,255,255,0.5)', maxWidth: 520,
        margin: '0 auto 36px', lineHeight: 1.6,
      }}>
        The AI-native platform for teams that ship fast. From idea to production in minutes, not months.
      </p>
      <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
        <button style={{
          padding: '14px 32px', borderRadius: 8, border: 'none',
          background: '#fff', color: '#000', fontSize: 16, fontWeight: 600,
          cursor: 'pointer', fontFamily: FONT,
        }}>Start Building Free</button>
        <button style={{
          padding: '14px 32px', borderRadius: 8,
          border: '1px solid rgba(255,255,255,0.15)', background: 'transparent',
          color: 'rgba(255,255,255,0.7)', fontSize: 16, fontWeight: 500,
          cursor: 'pointer', fontFamily: FONT,
        }}>Watch Demo</button>
      </div>
    </div>
  </section>
)

// ── Logos / Social Proof ────────────────────────────────────────────────────

const LogoBar = () => {
  // Anti-pattern: console spam from a "tracking" script left in prod
  useEffect(() => {
    const id = setInterval(() => {
      console.log('[Analytics] Tracking impression:', { section: 'logos', timestamp: Date.now() })
      console.log('[Analytics] Session heartbeat:', { alive: true })
    }, 3000)
    return () => clearInterval(id)
  }, [])

  return (
    <section style={{
      padding: '32px 40px', textAlign: 'center',
      borderBottom: '1px solid rgba(255,255,255,0.06)',
    }}>
      <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.25)', marginBottom: 16, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
        Trusted by teams at
      </div>
      <div style={{ display: 'flex', justifyContent: 'center', gap: 48, alignItems: 'center' }}>
        {['Vercel', 'Stripe', 'Linear', 'Notion', 'Figma'].map((name) => (
          <span key={name} style={{ fontSize: 18, fontWeight: 600, color: 'rgba(255,255,255,0.15)', letterSpacing: '-0.01em' }}>
            {name}
          </span>
        ))}
      </div>
    </section>
  )
}

// ── Image Showcase (all unoptimized) ────────────────────────────────────────

const Showcase = () => (
  <section style={{ padding: '60px 40px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
    <h2 style={sectionTitle}>Featured Projects</h2>
    <p style={sectionSub}>Real apps built on our platform by real teams.</p>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginTop: 28 }}>
      {/* Anti-pattern: no width, no height, no lazy loading, large source images */}
      <ShowcaseCard src="https://picsum.photos/800/600" title="Dashboard Pro" tag="SaaS" />
      <ShowcaseCard src="https://picsum.photos/801/601" title="Commerce Kit" tag="E-commerce" />
      <ShowcaseCard src="https://picsum.photos/802/602" title="Studio Flow" tag="Creative" />
    </div>

    {/* Anti-pattern: enormous images rendered small */}
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginTop: 16 }}>
      <SmallCard src="https://picsum.photos/1600/1200" label="Mobile App" />
      <SmallCard src="https://picsum.photos/1601/1201" label="API Platform" />
      <SmallCard src="https://picsum.photos/1602/1202" label="Analytics" />
      <SmallCard src="https://picsum.photos/1603/1203" label="Auth System" />
    </div>
  </section>
)

const ShowcaseCard = ({ src, title, tag }: { src: string; title: string; tag: string }) => (
  <div style={{
    borderRadius: 12, overflow: 'hidden',
    background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)',
  }}>
    {/* No width, height, or loading="lazy" — will trigger unoptimized-images */}
    <img src={src} alt={title} style={{ width: '100%', height: 200, objectFit: 'cover', display: 'block' }} />
    <div style={{ padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <span style={{ fontSize: 15, fontWeight: 600, color: 'rgba(255,255,255,0.8)' }}>{title}</span>
      <span style={{
        fontSize: 12, color: 'rgba(255,255,255,0.35)', background: 'rgba(255,255,255,0.05)',
        padding: '2px 8px', borderRadius: 4,
      }}>{tag}</span>
    </div>
  </div>
)

const SmallCard = ({ src, label }: { src: string; label: string }) => (
  <div style={{
    borderRadius: 8, overflow: 'hidden',
    background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)',
  }}>
    {/* 1600px images rendered at ~200px — vibe-check should flag these */}
    <img src={src} alt={label} style={{ width: '100%', height: 100, objectFit: 'cover', display: 'block' }} />
    <div style={{ padding: '8px 10px', fontSize: 13, color: 'rgba(255,255,255,0.5)' }}>{label}</div>
  </div>
)

// ── Stats ───────────────────────────────────────────────────────────────────

const Stats = () => (
  <section style={{ padding: '48px 40px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
      <StatCard value="10K+" label="Active Users" />
      <StatCard value="99.9%" label="Uptime" />
      <StatCard value="<50ms" label="Avg Response" />
      <StatCard value="150+" label="Integrations" />
    </div>
  </section>
)

const StatCard = ({ value, label }: { value: string; label: string }) => (
  <div style={{
    textAlign: 'center', padding: '28px 16px', borderRadius: 12,
    background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)',
  }}>
    <div style={{ fontSize: 32, fontWeight: 700, color: '#fff', letterSpacing: '-0.02em' }}>{value}</div>
    <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.35)', marginTop: 4 }}>{label}</div>
  </div>
)

// ── Feature Grid ────────────────────────────────────────────────────────────

const Features = () => (
  <section style={{ padding: '60px 40px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
    <h2 style={sectionTitle}>Everything you need</h2>
    <p style={sectionSub}>Built for speed, designed for developers, loved by teams.</p>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginTop: 28 }}>
      <FeatureCard title="Lightning Fast" desc="Sub-50ms response times with edge caching and smart prefetching built in." />
      <FeatureCard title="AI-Powered" desc="Intelligent suggestions, auto-fixes, and code generation right in your workflow." />
      <FeatureCard title="Scale Infinitely" desc="From prototype to millions of users. Infrastructure that grows with you." />
      <FeatureCard title="Developer First" desc="CLI tools, VS Code extension, GitHub integration, and comprehensive APIs." />
      <FeatureCard title="Secure by Default" desc="SOC 2 certified, end-to-end encryption, automatic vulnerability scanning." />
      <FeatureCard title="Real-time Analytics" desc="Live dashboards, custom events, and funnel analysis out of the box." />
    </div>
  </section>
)

const FeatureCard = ({ title, desc }: { title: string; desc: string }) => (
  <div style={{
    padding: '24px', borderRadius: 12,
    background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)',
  }}>
    <div style={{ fontSize: 16, fontWeight: 600, color: '#fff', marginBottom: 8 }}>{title}</div>
    <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.4)', lineHeight: 1.6 }}>{desc}</div>
  </div>
)

// ── Bloated testimonial list (intentional DOM bloat) ────────────────────────

const Testimonials = () => {
  // Anti-pattern: rendering hundreds of items without virtualization
  const testimonials = Array.from({ length: 200 }, (_, i) => ({
    id: i,
    text: [
      'This completely changed how we ship features.',
      'The AI suggestions alone saved us hundreds of hours.',
      'Best developer tool we have adopted this year.',
      'Our deploy times went from hours to minutes.',
      'The team productivity increase was immediate and measurable.',
    ][i % 5],
    author: ['Sarah Chen', 'Marcus Rivera', 'Aisha Patel', 'James O\'Brien', 'Yuki Tanaka'][i % 5],
    role: ['CTO at Acme', 'Lead at Pulse', 'VP Eng at Flow', 'Founder at Dock', 'Staff at Wave'][i % 5],
  }))

  return (
    <section style={{ padding: '60px 40px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
      <h2 style={sectionTitle}>What 10,000+ teams say</h2>
      <p style={sectionSub}>Don&apos;t take our word for it. Here&apos;s what our customers think.</p>

      {/* Anti-pattern: rendering ALL 200 items, no virtualization, excessive DOM nodes */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12,
        marginTop: 24, maxHeight: 400, overflow: 'auto',
        borderRadius: 12, border: '1px solid rgba(255,255,255,0.05)', padding: 12,
      }}>
        {testimonials.map((t) => (
          <div key={t.id} style={{
            padding: '14px', borderRadius: 8,
            background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)',
          }}>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', lineHeight: 1.5, fontStyle: 'italic', marginBottom: 8 }}>
              &ldquo;{t.text}&rdquo;
            </div>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.6)' }}>{t.author}</div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)' }}>{t.role}</div>
          </div>
        ))}
      </div>
    </section>
  )
}

// ── Animated counter (causes constant re-renders + FPS drop) ────────────────

const LiveCounter = () => {
  const [count, setCount] = useState(0)

  // Anti-pattern: state update every 50ms, forces constant re-renders
  useEffect(() => {
    const id = setInterval(() => setCount((c) => c + 1), 50)
    return () => clearInterval(id)
  }, [])

  return (
    <section style={{ padding: '48px 40px', textAlign: 'center', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
      <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.25)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12 }}>
        Requests served today
      </div>
      <div style={{ fontSize: 48, fontWeight: 800, color: '#fff', letterSpacing: '-0.03em', fontVariantNumeric: 'tabular-nums' }}>
        {(1_847_293 + count).toLocaleString()}
      </div>
      {/* Anti-pattern: inline style objects recreated on every render + color cycling */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: 3, marginTop: 16 }}>
        {Array.from({ length: 30 }, (_, i) => (
          <div key={i} style={{
            width: 6, height: 20 + Math.sin((count + i) * 0.2) * 12,
            borderRadius: 3,
            background: `rgba(255,255,255,${0.05 + Math.sin((count + i) * 0.15) * 0.05})`,
            transition: 'height 0.1s ease',
          }} />
        ))}
      </div>
    </section>
  )
}

// ── CTA ─────────────────────────────────────────────────────────────────────

const CTA = () => (
  <section style={{ padding: '80px 40px', textAlign: 'center' }}>
    <h2 style={{ fontSize: 36, fontWeight: 700, color: '#fff', margin: '0 0 12px', letterSpacing: '-0.03em' }}>
      Ready to ship?
    </h2>
    <p style={{ fontSize: 17, color: 'rgba(255,255,255,0.4)', margin: '0 0 28px' }}>
      Start for free. No credit card required.
    </p>
    <button style={{
      padding: '14px 36px', borderRadius: 8, border: 'none',
      background: '#fff', color: '#000', fontSize: 16, fontWeight: 600,
      cursor: 'pointer', fontFamily: FONT,
    }}>Get Started Free</button>
  </section>
)

// ── Sidebar: extra triggers ─────────────────────────────────────────────────

const Sidebar = () => (
  <aside style={{
    position: 'fixed', top: 0, left: 0, bottom: 0, zIndex: 200,
    width: 180, padding: '20px 12px',
    background: '#0a0a0a', borderRight: '1px solid rgba(255,255,255,0.06)',
    fontFamily: FONT, fontSize: 13, display: 'flex', flexDirection: 'column', gap: 4,
    overflowY: 'auto',
  }}>
    <div style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>
      Triggers
    </div>
    <TriggerBtn label="3 Console Errors" onClick={() => {
      console.error('TypeError: Cannot read properties of undefined')
      console.error('Error: Failed to fetch', { status: 500 })
      console.error('Each child should have a unique "key" prop')
    }} />
    <TriggerBtn label="Block Thread 500ms" onClick={() => {
      const start = performance.now()
      while (performance.now() - start < 500) Math.random()
    }} />
    <TriggerBtn label="3x Duplicate Fetch" onClick={() => {
      const url = 'https://jsonplaceholder.typicode.com/posts/1'
      fetch(url).catch(() => {})
      fetch(url).catch(() => {})
      fetch(url).catch(() => {})
    }} />
    <TriggerBtn label="Fire 5 Warnings" onClick={() => {
      console.warn('componentWillMount has been renamed')
      console.warn('No routes matched location "/undefined"')
      console.warn('Can\'t perform state update on unmounted component')
      console.warn('[Deprecation] SharedArrayBuffer')
      console.warn('React does not recognize the `isActive` prop')
    }} />
    <TriggerBtn label="Block Thread 1s" onClick={() => {
      const start = performance.now()
      while (performance.now() - start < 1000) Math.random()
    }} />
    <div style={{ marginTop: 'auto', fontSize: 11, color: 'rgba(255,255,255,0.15)', lineHeight: 1.5, paddingTop: 16 }}>
      Page already has baked-in issues. Use these for extras.
    </div>
  </aside>
)

const TriggerBtn = ({ label, onClick }: { label: string; onClick: () => void }) => (
  <button onClick={onClick} style={{
    width: '100%', padding: '8px 10px', borderRadius: 6, border: 'none',
    background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.6)',
    fontSize: 13, fontWeight: 500, fontFamily: 'inherit',
    cursor: 'pointer', textAlign: 'left', transition: 'background 0.15s ease',
  }}>{label}</button>
)

// ── Shared styles ───────────────────────────────────────────────────────────

const sectionTitle: React.CSSProperties = {
  fontSize: 28, fontWeight: 700, color: '#fff', margin: 0, letterSpacing: '-0.02em',
}
const sectionSub: React.CSSProperties = {
  fontSize: 16, color: 'rgba(255,255,255,0.4)', margin: '8px 0 0', lineHeight: 1.5,
}

// ── App ─────────────────────────────────────────────────────────────────────

const App = () => (
  <div style={{ fontFamily: FONT, color: '#e5e5e5', minHeight: '100vh', background: '#050505', marginLeft: 180 }}>
    <Sidebar />
    <Nav />
    <WhatsNew />
    <Hero />
    <LogoBar />
    <Showcase />
    <Stats />
    <LiveCounter />
    <Features />
    <Testimonials />
    <CTA />
    {/* Wired to the local MCP server so the panel's connection status is live
        (Settings tab) and beacon delivery actually happens. Start it with:
        node packages/mcp/dist/index.js  (or: npx @wcgw/vibe-check-mcp) */}
    <VibeCheck
      enabled
      position="bottom-right"
      beaconUrl="http://127.0.0.1:4200"
      projectId="vibe-check-demo"
    />
  </div>
)

export default App
