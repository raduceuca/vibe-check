# Tidewell (VibeCheck demo)

A fictional small-batch ceramics shop — **Tidewell** — with every common
vibe-coding fault baked in on purpose. Project id: `tidewell`.

> Tidewell is a made-up shop, built badly on purpose to show VibeCheck. Every
> flaw on it is real.

Shop chrome is adapted from **Formgong Stilla** (MIT) — sticky header, photo
hero, product cards, split stories, newsletter. Layout CSS/images live under
`public/shop-assets/` (see `STILLA-LICENSE.txt`). Ceramic product shots under
`public/images/` are still local placeholders until real mug photos land — no
picsum, no jsonplaceholder, no fake trusted-by logos or star totals.

Lifestyle photos in the split/newsletter blocks are Stilla’s (activewear) for
layout density; treat them as temporary stand-ins for studio photography.

## Run it

```bash
pnpm install
pnpm --filter demo dev
```

In another terminal, start the hub (pin the MCP package version from setup /
`MCP_PACKAGE_SPEC` — do not copy a hard-coded version from memory):

```bash
npx -y @wcgw/vibe-check-mcp up --project tidewell --agent claude-code
```

Open http://localhost:5173. The widget mounts only in Vite dev
(`VibeCheckDevtools`) and beacons to `http://127.0.0.1:4200`.

## Scenario drawer

Bottom-left **Scenario** control (14px+ type, collapses to a 44px button):

- Master: **As the agent shipped it** / **With reference fixes**
- Per-vibe Broken / Fixed toggles (Smooth, Light, Clean, Findable, Quotable)
- `applies on reload` badges for head, server, and script faults — use **Reload now**
- State: `?fixed=smooth,light` + cookie `tidewell_fixed`
- Presets: `?scenario=broken` · `?scenario=fixed`

Broken implementations live in `src/shop/*` (one file per fault, marked
`// VIBECHECK-FAULT: …`). Reference fixes live in `src/shop/fixed/*`.
`git checkout -- demo/src/shop` re-breaks the shop sources.

## Fix it with your agent

Works with **Claude Code**, **Codex**, and **Cursor** (any first-class client).
Pick the matching `--agent` when you start the hub (`claude-code`, `codex`, or
`cursor`).

1. `pnpm install && pnpm --filter demo dev`
2. `npx -y @wcgw/vibe-check-mcp up --project tidewell --agent claude-code`
   (swap `--agent` for Codex / Cursor; pin `@wcgw/vibe-check-mcp` to the version
   your setup / release uses)
3. Paste the watch instruction for project `tidewell` into your agent.
4. In the panel, press **Send to agent** on something like
   "Your page still has a placeholder title".
5. Watch **Verifying**, then **Fixed**.

Copy-prompt alone does **not** mean delivery — only a successful
`watch_for_issue` result confirms widget → agent dispatch.

## Regenerating assets

```bash
node demo/scripts/gen-assets.mjs    # hero + product placeholders (+ SVG mugs)
node demo/scripts/gen-catalog.mjs   # ~700 KB catalog-full.json
```

`public/vendor/moment.min.js` is a **tiny Tidewell stub** (not real Moment.js)
so the `moment.min.js` URL still trips `heavy-library`. Vendoring real MIT
Moment needs `[ok-to-add-dep]` consent first.

Hero AVIF/WebP for the reference fix is **[UNVERIFIED]** — fixed Hero uses
smaller JPEG stand-ins with `srcset` and dimensions instead.

## Fault map (summary)

| Vibe | As shipped | Detector |
|------|------------|----------|
| Smooth | Late banners, busy glaze configurator, 50ms stock ticker | layout-thrashing, long-task-attribution, FPS |
| Light | 2k reviews, duplicate cart fetch, memory leak, huge hero, oversized products, moment stub, static catalog | dom-bloat, duplicate-requests, memory-leak, large/unoptimized-images, heavy-library, resource-bloat |
| Clean | console.log every 300ms; bare `<head>` | console-spam, web-essentials |
| Findable | `Vite + React` title, two h1s, empty alts, "Click here" | seo |
| Quotable | no JSON-LD / main / llms / markdown; robots block GPTBot | aeo |
