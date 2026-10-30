# Next.js App Router example

What passing looks like. Four vibes pass at rest in `next dev`. Quotable keeps
**exactly one** intentional miss:

| Check | Severity | Why |
|---|---|---|
| `mcp-discovery-missing` | info | optional; we do not invent an MCP server |

The pill reads **1 problem**. The README says why.

Replace the `https://example.com/` canonical / OG URLs before you ship a real site.

## Run

```bash
pnpm install
pnpm --filter next-app-router-example dev
```

Hub + agent:

```bash
npx -y @wcgw/vibe-check-mcp up --project next-example --agent cursor
```

Paste this into your agent:

```
Use the vibe-check MCP tools. Call list_projects, then call watch_for_issue with project_id "next-example" and keep waiting for the next issue I send from the widget.
```

## Note on resource-bloat

Next.js dev chunks may exceed the 500 KB dev `resource-bloat` threshold. If the
widget reports that here, treat it as a detector false positive to fix in core —
do not hide it in this example.
