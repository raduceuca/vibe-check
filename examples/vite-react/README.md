# Vite + React example

An honest SPA mount of `@wcgw/vibe-check`. Smooth, Light, Clean and Findable
pass at rest. Quotable reports **exactly three** documented misses.

| Check | Severity | Why |
|---|---|---|
| `content-requires-js` | warning | SPA shell |
| `markdown-negotiation-missing` | info | static host |
| `mcp-discovery-missing` | info | optional |

Replace the `https://example.com/` canonical / OG URLs before you ship a real site.

## Run

```bash
pnpm install
pnpm --filter vite-react-example dev
```

Hub + agent (from the repo root, after the packages are linked):

```bash
npx -y @wcgw/vibe-check-mcp up --project vite-react-example --agent cursor
```

Paste this into your agent:

```
Use the vibe-check MCP tools. Call list_projects, then call watch_for_issue with project_id "vite-react-example" and keep waiting for the next issue I send from the widget.
```

Open the widget with **Alt+Shift+V**. The pill should read **3 problems**.
