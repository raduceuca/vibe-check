# Show HN: VibeCheck – perf and SEO overlay that sends issues to your coding agent

## Plain pitch (first sentence)

VibeCheck is a perf + SEO monitor that runs in your React app, catches vibe-coding defects, and sends one concrete finding to your coding agent over MCP — then verifies the fix with fresh browser evidence.

## Short body (Show HN / Reddit)

Agents ship frontends that look done and still thrash, leak memory, double-fetch, bloat the DOM, and fail SEO/AEO. Lighthouse is a one-shot score. Chrome DevTools MCP is a general browser microscope. VibeCheck stays on while you build: continuous detectors, on-page marks, **Send to agent**, a durable workflow, and an impact ledger that only counts fixes the browser has verified.

Demo (real widget → real MCP round-trip, not a mock):
https://github.com/raduceuca/vibe-check/blob/main/apps/web/public/demo/vibe-check-agent-roundtrip.gif

Site: https://vibecheck.wcgw.fun  
Repo: https://github.com/raduceuca/vibe-check  
npm: `@wcgw/vibe-check` · `@wcgw/vibe-check-mcp`

### 3-step try

```bash
npx -y @wcgw/vibe-check-mcp@latest setup --agent codex --project my-app
# mount <VibeCheckDevtools /> once near the root
npx -y @wcgw/vibe-check-mcp@latest up --project my-app --agent codex
```

In the widget: **Copy full setup pack** (or paste the watch instruction printed by `up`), wait for green **Agent connected**, click **Send to agent** on an issue.

### What it is not

- Not hosted APM (Datadog/Sentry)
- Not a Lighthouse clone
- Not a general browser automation MCP (complementary to Chrome DevTools MCP)

### Screenshots

TODO: re-capture after the 0.4.0 widget lands. The current `docs/screenshots/*.png`
show retired branding; do not post them.

---

## X / short thread bullets

1. Your agent shipped the UI. Did anyone check it in a real browser?
2. VibeCheck watches the live page for jank, DOM bloat, duplicate fetches, SEO/AEO gaps.
3. Click **Send to agent** — one MCP watcher gets the exact issue + fix guide.
4. Fix is only “fixed” when browser evidence clears. Regressions reopen.
5. Local-first hub. React today. MIT. vibecheck.wcgw.fun
