# AI SaaS landing showcase

A deliberately fancy AI SaaS launch page — Three.js scroll scene, GSAP ScrollTrigger, Lenis smooth scroll — meant to look like vibe-coded Webflow energy. Vendored (copied, not submodule) from the MIT [Lumen SaaS landing template](https://github.com/MiddleSugar7000/lumen-saas-landing-page-template) by [Vantle](https://vantle.studio) / MiddleSugar7000.

Plain HTML/CSS/JS. CDN scripts only (Three.js, GSAP, Lenis). **Not** in `pnpm-workspace.yaml` — no npm install.

Use this as a heavyweight static page for future `@wcgw/vibe-check` dogfooding. Suggested hub `project_id`: **`ai-saas-landing`**.

## Run

From this directory:

```bash
python3 -m http.server 5176
```

Or:

```bash
npx --yes serve -l 5176
```

Open [http://localhost:5176](http://localhost:5176). Needs a network connection for CDN + Google Fonts.

## Widget mount (later)

Mounting `@wcgw/vibe-check` on this page comes later (no React/Vite package here yet). When that lands, register/hub with `project_id` `ai-saas-landing`.

## License / attribution

Upstream template is **MIT**. See [`LICENSE`](./LICENSE) (Copyright (c) 2026 MiddleSugar7000). Keep that notice with any redistribution of these files.

Source: https://github.com/MiddleSugar7000/lumen-saas-landing-page-template
