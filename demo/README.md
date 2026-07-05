# vibe-check demo

A deliberately "vibe-coded" landing page — `VibeShip` — wired up so every common
AI-generated performance mistake is present and trips a real detector. Open the
panel (bottom-right, or **Ctrl+Shift+P**) and watch it light up.

## Run it

Two commands, two terminals:

```bash
pnpm dev                     # from this demo/ folder — starts the page on http://localhost:5173
npx @wcgw/vibe-check-mcp      # the MCP server on :4200, so the Settings dot goes live and an agent can read issues
```

The page beacons snapshots to `http://127.0.0.1:4200`; without the MCP server the
widget still works, but the Settings connection dot stays inactive.

## What the page does wrong (and which detector catches it)

Everything below is baked into the page — no clicking required.

| Section (`src/App.tsx`) | Anti-pattern | Detector |
|-------------------------|--------------|----------|
| `Nav` | Fetches `/users/1` twice on mount, uncached | `duplicate-requests` |
| `Hero` | `picsum.photos/2400/1200` background image — no `width`/`height`, no `loading="lazy"` | `unoptimized-images`, `large-images` |
| `LogoBar` | A "tracking" script logs to the console every 3s | `console-spam` |
| `Showcase` | Grid of images with no dimensions/lazy; 1600px sources rendered ~200px | `unoptimized-images`, `large-images` |
| `Testimonials` | Renders all 200 items with no virtualization | `dom-bloat` |
| `LiveCounter` | `setState` every 50ms + 30 animated bars | frame-rate drop |
| document `<head>` | Whatever the demo page is missing (title, meta, lang, JSON-LD, …) | `web-essentials`, `seo`, `aeo` |

The **SEO** and **AEO** tabs audit the demo page itself, so their scores reflect
this page's `<head>` and markup.

## Trigger buttons (left sidebar)

For on-demand extras beyond the baked-in issues:

| Button | Fires | Detector |
|--------|-------|----------|
| **3 Console Errors** | 3× `console.error` | `console-spam` |
| **Fire 5 Warnings** | 5× `console.warn` | `console-spam` |
| **3x Duplicate Fetch** | same URL fetched 3× | `duplicate-requests` |
| **Block Thread 500ms** | busy-loops the main thread | `long-task-attribution` |
| **Block Thread 1s** | busy-loops the main thread | `long-task-attribution` |

## Agent round-trip

With the MCP server running, point your AI agent at it
(`claude mcp add vibe-check -- npx @wcgw/vibe-check-mcp`), then use the **Agent**
tab's "copy & send" prompts — or have the agent call `get_detected_issues` and
`get_fix_suggestions` directly against the live page.
