export const Footer = ({
  findableFixed = false,
  quotableFixed = false,
}: {
  readonly findableFixed?: boolean
  readonly quotableFixed?: boolean
}) => (
  <footer className="foot" id="visit">
    <div className="foot-grid">
      <div>
        <h2>Tidewell</h2>
        <p style={{ margin: 0, maxWidth: 360, lineHeight: 1.55 }}>
          Tidewell is a made-up shop, built badly on purpose to show VibeCheck. Every flaw on it is
          real.
        </p>
        {quotableFixed ? (
          <p style={{ margin: '12px 0 0' }}>
            <span itemProp="author">Maya Chen</span>
            {' · '}
            <time dateTime="2026-03-01">March 1, 2026</time>
          </p>
        ) : null}
      </div>
      <div>
        <h2>Shop</h2>
        <ul>
          <li>
            <a href="#shop">Spring glazes</a>
          </li>
          <li>
            <a href="#glazes">Glaze picker</a>
          </li>
        </ul>
      </div>
      <div>
        <h2>Studio</h2>
        <ul>
          <li>
            <a href="#journal">Journal</a>
          </li>
          <li>
            <a href="#newsletter">Kiln schedule</a>
          </li>
        </ul>
      </div>
      <div>
        <h2>Help</h2>
        <ul>
          <li>
            {findableFixed ? (
              <a href="/sitemap.xml">Sitemap</a>
            ) : (
              <a href="#">Click here</a>
            )}
          </li>
          {findableFixed ? (
            <li>
              <a href="/llms.txt">llms.txt</a>
            </li>
          ) : null}
        </ul>
      </div>
    </div>
    <div className="foot-bottom">
      <span>© Tidewell (demo)</span>
      <span>Layout adapted from Formgong Stilla (MIT)</span>
    </div>
  </footer>
)
