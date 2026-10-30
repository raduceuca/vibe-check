# Pre-launch checklist

## Discovery

- [x] GitHub homepage → https://vibecheck.wcgw.fun
- [x] GitHub topics (mcp, performance, web-vitals, claude-code, cursor, react, devtools, ai-coding)
- [x] README plain-language lead
- [ ] README screenshots: re-capture after the 0.4.0 widget lands (the old ones show retired branding and were removed)
- [x] AGENTS.md / CLAUDE.md match the 0.4 hub/bridge model
- [x] Skill lists all 10 tools + verify semantics

## Product

- [x] `vibe-check-mcp up` guided hub
- [x] Widget **Copy full setup pack**
- [x] Setup CLI nextSteps prefer `up`
- [x] Impact Markdown export already in widget/settings/`stats`

## Assets

- [ ] `docs/screenshots/*` (hero, monitor, agent, seo, aeo, prompts, settings, annotations): re-capture without the retired branding
- [x] Real MCP GIF already on site/README
- [x] Launch copy: `docs/launch/show-hn.md`
- [x] Comparison: `docs/launch/devtools-mcp-vs-vibecheck.md`

## Before you post

- [ ] Spot-check live site https://vibecheck.wcgw.fun
- [ ] `pnpm smoke:production` green
- [ ] `pnpm release:validate -- <version>` passes (doc pins, CHANGELOG, generated version) and that version is on npm
- [ ] You are ready to answer “React only?” and “local-only hub?”

## Explicitly not done by this plan (needs separate ask)

- [ ] git commit / push
- [ ] npm publish / version bump
- [ ] Actually post to HN / X / Reddit
