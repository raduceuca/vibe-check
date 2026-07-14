# vibe-check demo

A deliberately "vibe-coded" landing page — `VibeShip` — wired up so every common
AI-generated performance mistake is present and trips a real detector. Open the
panel (bottom-right, or **Alt+Shift+V**) and watch it light up.

## Run it

Start the demo and the shared hub in separate terminals:

```bash
pnpm dev                                # from demo/ — http://localhost:5173
npx -y @wcgw/vibe-check-mcp@0.3.0 hub   # shared local hub on 127.0.0.1:4200
```

The page uses project ID `vibe-check-demo` and beacons to
`http://127.0.0.1:4200`. Without the hub the widget still measures locally, but
its agent status reports that the MCP server is offline.

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

Open the widget's **Agent** tab and choose Codex, Claude Code, or Cursor. Register
the bridge once, then restart your agent client. The commands for the first two
clients are:

```bash
codex mcp add vibe-check -- npx -y @wcgw/vibe-check-mcp@0.3.0 connect
claude mcp add --scope local vibe-check -- npx -y @wcgw/vibe-check-mcp@0.3.0 connect
```

For Cursor, merge the card's `vibe-check` entry into `mcpServers` in
`.cursor/mcp.json`; do not replace existing server entries. Then copy this
project-specific instruction:

```text
Use the vibe-check MCP tools. Call list_projects, then call watch_for_issue with project_id "vibe-check-demo" and keep waiting for the next issue I send from the widget.
```

When the widget says **Agent connected**, open **Agent**, expand a detected
issue, and click **Send to agent**. The pending tool call returns that issue and
its fix guide. **Copy prompt** remains a clipboard-only fallback. If the state
does not turn green, run
`npx -y @wcgw/vibe-check-mcp@0.3.0 doctor --project vibe-check-demo`.
