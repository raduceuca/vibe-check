# Over-animated product shop showcase

A deliberately heavy 3D ecommerce launch page — Three.js cans, GSAP timelines, Lenis smooth scroll, bloom, spatial audio, flavor video loops — meant to look like vibe-coded Webflow energy. Vendored (copied, not submodule) from the [Ciao Energy 3D experience](https://github.com/Rahul-singh13/ciao-energy-3d-experience) by Rahul-singh13 (badge claims MIT; no `LICENSE` file in upstream).

Plain HTML/CSS/JS. CDN scripts for Three.js / GSAP / Lenis; 3D meshes, HDRI, textures, and loops are local under `assets/`. **Not** in `pnpm-workspace.yaml` — no npm install.

Use this as a heavyweight static page for future `@wcgw/vibe-check` dogfooding (pair with `examples/ai-saas-landing`). Suggested hub `project_id`: **`overanimated-shop`**.

## Run

From this directory:

```bash
python3 -m http.server 5181 --bind 127.0.0.1
```

Or:

```bash
npx --yes serve -l 5181
```

Open [http://127.0.0.1:5181](http://127.0.0.1:5181). Needs a network connection for CDN scripts and some Webflow-hosted images still referenced in the markup.

## Widget mount (later)

Mounting `@wcgw/vibe-check` on this page comes later (no React/Vite package here yet). When that lands, register/hub with `project_id` `overanimated-shop`.

## License / attribution

- Upstream repo badge: **MIT** (https://github.com/Rahul-singh13/ciao-energy-3d-experience). Upstream ships no `LICENSE` file; keep their README disclaimer with redistribution.
- Brand trademarks, logos, and packaging designs belong to **Ciao Energy**. This copy is for educational / performance-showcase use inside VibeCheck only — not a product endorsement.
- See [`NOTICE`](./NOTICE).

Source: https://github.com/Rahul-singh13/ciao-energy-3d-experience
