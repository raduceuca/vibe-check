# Chrome DevTools MCP vs VibeCheck

They solve different problems. Use both if you want.

| | Chrome DevTools MCP | VibeCheck |
|--|---------------------|-----------|
| **Job** | General browser introspection & control for agents | Opinionated quality conscience for vibe-coded frontends |
| **Metaphor** | Microscope | Press check |
| **Primary UX** | Agent-driven tools | In-app widget + optional agent dispatch |
| **Install** | MCP to Chrome / DevTools | npm widget + local hub + MCP bridge |
| **Findings** | Whatever the agent queries | 13 named detectors + SEO/AEO audits |
| **Workflow** | Open-ended debugging | Detect → send → verify → impact ledger |
| **Framework** | Any page Chrome can open | React overlay today; core is framework-agnostic |

## When to use which

- **DevTools MCP** when the agent needs to drive the browser, inspect network traces, or debug arbitrary runtime state.
- **VibeCheck** when you want continuous detection of the defects AI UIs keep shipping, one-click handoff of a single issue, and honest verification that the page actually improved.

## Complementary flow

1. VibeCheck marks DOM bloat and **Send to agent**.
2. Agent fixes the list virtualization.
3. VibeCheck verifies clean snapshots and records impact.
4. If something deeper is still wrong, open DevTools MCP for a full trace.
