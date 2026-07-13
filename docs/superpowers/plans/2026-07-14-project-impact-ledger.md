# Project Impact Ledger Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persist credible per-project VibeCheck outcome statistics and measured impact receipts, then make them queryable and shareable from the widget, MCP, and CLI.

**Architecture:** Derive exact lifecycle totals from the durable workflow event log and store immutable, deterministic measurement receipts for comparable before/after snapshots. Detector adapters own unit-specific attribution rules; unsupported or ambiguous improvements emit no receipt. The hub exposes a derived `ProjectImpactSummary`, while React caches and renders a compact impact card with privacy-safe Markdown/JSON export.

**Tech Stack:** TypeScript strict mode, immutable reducers, Node HTTP/MCP/CLI, React inline styles, localStorage, Vitest, Playwright.

## Global Constraints

- VibeCheck says it “caught,” “verified,” or “helped”; it does not claim to have written fixes.
- Exact and estimated values are distinguishable in both types and copy.
- No savings are emitted without comparable evidence.
- A receipt is idempotent across retries and hub restarts.
- Multiple issues may not each claim the same page-level delta.
- Clearing fixed rows does not delete impact; reset is separate and confirmed.
- Exports omit filesystem paths, agent session identifiers, and raw page content.
- Project impact remains isolated under the existing project ID and persisted state file.

---

## File Map

- Modify `packages/protocol/src/index.ts` — impact receipt/summary wire types.
- Create `packages/mcp/src/impact.ts` and tests — deterministic receipts and derived totals.
- Create `packages/mcp/src/impactAdapters.ts` and tests — detector/page measurement adapters.
- Modify `packages/mcp/src/workflow.ts`, `hubStore.ts`, `persistence.ts` and tests — create/persist receipts on confirmed fixes.
- Modify `packages/mcp/src/hubServer.ts`, `hubClient.ts`, `mcpServer.ts` and tests — impact API, reset, and MCP tool.
- Modify `packages/mcp/src/cli.ts`, `main.ts` and tests — `stats` command.
- Create `packages/react/src/panels/ImpactCard.tsx` and tests — visible impact summary.
- Create `packages/react/src/utils/impactExport.ts` and tests — privacy-safe Markdown/JSON.
- Modify `packages/react/src/panels/AgentPanel.tsx`, `monitor/MonitorView.tsx`, `SettingsPanel.tsx`, `VibeCheck.tsx` and tests — placement, export, reset.
- Modify `e2e/mcp-roundtrip/mcp-roundtrip.spec.ts` and fixture — durable, isolated impact showcase.
- Modify package READMEs — stats semantics and commands.

### Task 1: Impact receipt types and exact lifecycle totals

**Files:**
- Modify: `packages/protocol/src/index.ts`
- Create: `packages/mcp/src/impact.ts`
- Create: `packages/mcp/src/__tests__/impact.test.ts`

**Interfaces:**
- Produces: `ImpactConfidence`, `ImpactMetric`, `ImpactReceipt`, `ProjectImpactSummary`.
- Produces: `impactReceiptId`, `appendImpactReceipts`, `deriveProjectImpact`.
- Extends `ProjectWorkflow` with `impactResetAt: number | null` so resetting
  stats does not destroy issue timelines or regression baselines.

- [ ] **Step 1: Write failing exact-total/idempotency tests**

```ts
it('derives exact workflow totals and never double-counts a receipt', () => {
  const receipts = appendImpactReceipts([], [receipt, receipt])
  expect(receipts).toEqual([receipt])
  expect(deriveProjectImpact(workflow, receipts)).toMatchObject({
    detected: 1,
    sent: 1,
    uniqueIssuesFixed: 1,
    verifiedFixes: 2,
    regressionsCaught: 1,
    verificationFailures: 0,
    metrics: [{ kind: 'duplicate-requests-removed', value: 3, unit: 'requests', confidence: 'measured' }],
  })
})
```

- [ ] **Step 2: Run the impact test and verify failure**

Run: `pnpm --filter @wcgw/vibe-check-mcp test -- src/__tests__/impact.test.ts`

Expected: FAIL because impact types/functions do not exist.

- [ ] **Step 3: Implement deterministic receipts and derived totals**

```ts
export type ImpactConfidence = 'measured' | 'estimated'
export type ImpactMetricKind =
  | 'duplicate-requests-removed'
  | 'console-calls-reduced'
  | 'dom-nodes-reduced'
  | 'transfer-kb-reduced'
  | 'blocking-ms-reduced'

export interface ImpactReceipt {
  readonly id: string
  readonly issueKey: string
  readonly occurrence: number
  readonly detector: DetectorName
  readonly pageUrl: string
  readonly baselineSnapshotAt: number
  readonly verificationSnapshotAt: number
  readonly kind: ImpactMetricKind
  readonly before: number
  readonly after: number
  readonly delta: number
  readonly unit: 'requests' | 'calls' | 'nodes' | 'KB' | 'ms'
  readonly confidence: ImpactConfidence
}

export interface ImpactMetric {
  readonly kind: ImpactMetricKind
  readonly value: number
  readonly unit: ImpactReceipt['unit']
  readonly confidence: ImpactConfidence
  readonly label: string
  readonly scope: string
}

export interface ProjectImpactSummary {
  readonly projectId: string
  readonly detected: number
  readonly sent: number
  readonly uniqueIssuesFixed: number
  readonly verifiedFixes: number
  readonly regressionsCaught: number
  readonly verificationFailures: number
  readonly medianFixTimeMs: number | null
  readonly metrics: readonly ImpactMetric[]
}
```

`impactReceiptId` joins issue key, occurrence, verification timestamp, and metric kind. `appendImpactReceipts` maps by ID and returns at most one record per ID. `deriveProjectImpact` counts event types, uses a Set for unique fixed issue keys, calculates median positive sent-to-fixed durations by occurrence, and groups receipt deltas only when kind/unit/confidence match.

```ts
export const impactReceiptId = (
  issueKey: string,
  occurrence: number,
  verificationSnapshotAt: number,
  kind: ImpactMetricKind,
): string => [issueKey, occurrence, verificationSnapshotAt, kind].map(encodeURIComponent).join('|')

export const appendImpactReceipts = (
  current: readonly ImpactReceipt[],
  incoming: readonly ImpactReceipt[],
): readonly ImpactReceipt[] => {
  const byId = new Map(current.map((receipt) => [receipt.id, receipt]))
  for (const receipt of incoming) byId.set(receipt.id, receipt)
  return [...byId.values()]
}

const visibleEvents = workflow.issues.flatMap((issue) => issue.events)
  .filter((event) => workflow.impactResetAt === null || event.at > workflow.impactResetAt)
const visibleReceipts = receipts
  .filter((receipt) => workflow.impactResetAt === null || receipt.verificationSnapshotAt > workflow.impactResetAt)
```

- [ ] **Step 4: Run impact/protocol tests**

Run: `pnpm --filter @wcgw/vibe-check-mcp test -- src/__tests__/impact.test.ts && pnpm --filter @wcgw/vibe-check-protocol test`

Expected: all focused tests PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/protocol/src/index.ts packages/mcp/src/impact.ts packages/mcp/src/__tests__/impact.test.ts
git commit -m "feat: derive project impact totals"
```

### Task 2: Honest before/after measurement adapters

**Files:**
- Create: `packages/mcp/src/impactAdapters.ts`
- Create: `packages/mcp/src/__tests__/impactAdapters.test.ts`
- Modify: `packages/mcp/src/workflow.ts`
- Modify: `packages/mcp/src/hubStore.ts`
- Modify: `packages/mcp/src/__tests__/workflow.test.ts`
- Modify: `packages/mcp/src/__tests__/hubStore.test.ts`

**Interfaces:**
- Produces: `createImpactReceipts(input: ImpactComparison): readonly ImpactReceipt[]`.
- Extends persisted project workflow with `impactReceipts: readonly ImpactReceipt[]`.

- [ ] **Step 1: Write failing adapter tests**

```ts
it('measures duplicate excess and page totals only from comparable snapshots', () => {
  expect(createImpactReceipts({
    tracked: duplicateTracked({ count: 5 }),
    baseline: snapshot({ timestamp: 10, domNodeCount: 1200, transferKB: 900, blockingMs: 300 }),
    verification: snapshot({ timestamp: 20, domNodeCount: 800, transferKB: 600, blockingMs: 100 }),
    verifyingIssueKeys: [DUPLICATE_KEY],
  })).toEqual(expect.arrayContaining([
    expect.objectContaining({ kind: 'duplicate-requests-removed', before: 4, after: 0, delta: 4 }),
    expect.objectContaining({ kind: 'dom-nodes-reduced', delta: 400 }),
    expect.objectContaining({ kind: 'transfer-kb-reduced', delta: 300 }),
    expect.objectContaining({ kind: 'blocking-ms-reduced', delta: 200 }),
  ]))
})

it('does not duplicate one page-level delta across simultaneous fixes', () => {
  const receipts = createImpactReceipts({ ...comparison, verifyingIssueKeys: ['a', 'b'] })
  expect(receipts.filter((item) => item.kind === 'transfer-kb-reduced')).toHaveLength(1)
  expect(receipts.find((item) => item.kind === 'transfer-kb-reduced')?.issueKey).toBe('batch:a,b')
})

it('omits negative, cross-page, stale, and incomparable changes', () => {
  expect(createImpactReceipts(crossPageComparison)).toEqual([])
})
```

- [ ] **Step 2: Run adapter tests and verify failure**

Run: `pnpm --filter @wcgw/vibe-check-mcp test -- src/__tests__/impactAdapters.test.ts`

Expected: FAIL because detector adapters do not exist.

- [ ] **Step 3: Implement measurement rules**

For duplicate requests, `before = max(0, count - 1)` and `after = 0` only after the key is browser-verified absent. For console calls, compare the baseline issue’s call count with a comparable same-method issue or zero when verified absent. For page-level DOM, total transfer, and blocking values, require matching normalized page URL, newer timestamps, and positive deltas. If multiple keys verify in the same snapshot pair, emit one batch receipt with sorted keys. Never emit zero/negative deltas.

Call the adapter exactly when `recordWorkflowSnapshot` confirms Fixed. Append returned receipts idempotently before persisting the next workflow revision.

```ts
export const createImpactReceipts = ({
  tracked, baseline, verification, verifyingIssueKeys,
}: ImpactComparison): readonly ImpactReceipt[] => {
  if (normalizePageUrl(tracked.pageUrl) !== normalizePageUrl(verification.pageUrl)) return []
  if (verification.snapshot.timestamp <= baseline.snapshot.timestamp) return []
  const receipts: ImpactReceipt[] = []
  const duplicateCount = tracked.issue.detector === 'duplicate-requests'
    ? Number(tracked.issue.evidence['count'] ?? 0)
    : 0
  if (duplicateCount > 1) receipts.push(receipt({
    tracked, baseline, verification,
    kind: 'duplicate-requests-removed',
    before: duplicateCount - 1,
    after: 0,
    unit: 'requests',
    confidence: 'measured',
  }))
  const consoleCalls = tracked.issue.detector === 'console-spam'
    ? Number(tracked.issue.evidence['callCount'] ?? 0)
    : 0
  const afterConsoleCalls = verification.snapshot.console.totalCount
  if (consoleCalls > 0
    && baseline.snapshot.console.totalCount === consoleCalls
    && consoleCalls > afterConsoleCalls) receipts.push(receipt({
    tracked, baseline, verification,
    kind: 'console-calls-reduced',
    before: consoleCalls,
    after: afterConsoleCalls,
    unit: 'calls',
    confidence: 'measured',
  }))
  const batchKey = `batch:${[...verifyingIssueKeys].sort().join(',')}`
  const pageMetrics = [
    ['dom-nodes-reduced', baseline.snapshot.domNodeCount, verification.snapshot.domNodeCount, 'nodes'],
    ['transfer-kb-reduced', baseline.snapshot.resources.totalTransferKB, verification.snapshot.resources.totalTransferKB, 'KB'],
    ['blocking-ms-reduced', baseline.snapshot.longFrames.entries.reduce((sum, item) => sum + item.blockingDuration, 0), verification.snapshot.longFrames.entries.reduce((sum, item) => sum + item.blockingDuration, 0), 'ms'],
  ] as const
  for (const [kind, before, after, unit] of pageMetrics) {
    if (before > after) receipts.push(batchReceipt({
      batchKey, tracked, baseline, verification, kind, before, after, unit,
    }))
  }
  return receipts
}
```

- [ ] **Step 4: Run workflow/adapter/hub tests**

Run: `pnpm --filter @wcgw/vibe-check-mcp test -- src/__tests__/impactAdapters.test.ts src/__tests__/workflow.test.ts src/__tests__/hubStore.test.ts`

Expected: focused suites PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/mcp/src/impactAdapters.ts packages/mcp/src/__tests__/impactAdapters.test.ts packages/mcp/src/workflow.ts packages/mcp/src/hubStore.ts packages/mcp/src/__tests__/workflow.test.ts packages/mcp/src/__tests__/hubStore.test.ts
git commit -m "feat: record verified performance impact"
```

### Task 3: Hub API, MCP tool, reset, and stats CLI

**Files:**
- Modify: `packages/mcp/src/hubServer.ts`
- Modify: `packages/mcp/src/hubClient.ts`
- Modify: `packages/mcp/src/mcpServer.ts`
- Modify: `packages/mcp/src/cli.ts`
- Modify: `packages/mcp/src/main.ts`
- Modify: `packages/mcp/src/__tests__/hubServer.test.ts`
- Modify: `packages/mcp/src/__tests__/hubClient.test.ts`
- Modify: `packages/mcp/src/__tests__/mcpServer.test.ts`
- Modify: `packages/mcp/src/__tests__/main.test.ts`

**Interfaces:**
- Produces browser/internal `GET /api/projects/:projectId/impact`.
- Produces browser/internal `POST /api/projects/:projectId/impact/reset`.
- Produces `HubClient.getProjectImpact()` and `HubClient.resetProjectImpact()`.
- Produces MCP tool `get_project_impact`.
- Produces CLI `stats --project <id> [--json|--markdown]`.

- [ ] **Step 1: Write failing API/tool/CLI tests**

```ts
it('returns isolated impact and resets only the selected project', async () => {
  expect((await json(`${base}/api/projects/project-a/impact`)).body)
    .toMatchObject({ projectId: 'project-a', verifiedFixes: 1 })
  await post(`${base}/api/projects/project-a/impact/reset`, {})
  expect((await json(`${base}/api/projects/project-a/impact`)).body)
    .toMatchObject({ verifiedFixes: 0 })
  expect((await json(`${base}/api/projects/project-b/impact`)).body)
    .toMatchObject({ verifiedFixes: 1 })
})

it('exposes impact through MCP without filesystem details', async () => {
  const result = await call(context, 'get_project_impact', { project_id: 'project-a' })
  expect(result.text).toContain('verifiedFixes')
  expect(result.text).not.toContain('/Users/')
})
```

- [ ] **Step 2: Run MCP tests and verify failure**

Run: `pnpm --filter @wcgw/vibe-check-mcp test -- src/__tests__/hubServer.test.ts src/__tests__/hubClient.test.ts src/__tests__/mcpServer.test.ts src/__tests__/main.test.ts`

Expected: FAIL because impact routes/tool/CLI do not exist.

- [ ] **Step 3: Implement API, MCP tool, and CLI formatting**

```ts
export interface HubClient {
  getProjectImpact(projectId: string): Promise<ProjectImpactSummary | null>
  resetProjectImpact(projectId: string): Promise<void>
}
```

The browser GET is CORS-enabled and contains only the derived summary. Reset
sets `impactResetAt` to the current time, increments workflow revision, and
schedules persistence; it does not erase issue timelines or regression
baselines. MCP `get_project_impact` uses existing project resolution/lease
isolation.

```ts
if (method === 'GET' && parts[0] === 'api' && parts[1] === 'projects' && parts[3] === 'impact') {
  const project = store.projects.get(parts[2] ?? '')
  const impact = project ? deriveProjectImpact(project.workflow, project.workflow.impactReceipts) : null
  sendJson(res, impact ? 200 : 404, impact ?? { error: 'Project not found' }, true)
  return
}

if (method === 'POST' && parts[0] === 'api' && parts[1] === 'projects'
  && parts[3] === 'impact' && parts[4] === 'reset') {
  store = resetProjectImpact(store, parts[2] ?? '', now())
  schedulePersist(parts[2] ?? '')
  sendJson(res, 200, { reset: true, projectId: parts[2] }, true)
  return
}
```

Add CLI config:

```ts
| {
    readonly role: 'stats'
    readonly hubUrl: string
    readonly projectId: string
    readonly format: 'human' | 'json' | 'markdown'
  }
```

Human/Markdown copy uses “caught,” “verified,” and “helped.” JSON returns the wire summary unchanged. Missing projects exit `1` with the exact available-project guidance used by doctor.

```ts
export const formatImpactMarkdown = (impact: ProjectImpactSummary): string => {
  const metrics = impact.metrics.map((metric) =>
    `- ${metric.value} ${metric.unit} ${metric.label}${metric.confidence === 'estimated' ? ' (estimated)' : ''}`,
  )
  return [
    `## VibeCheck impact — ${impact.projectId}`,
    '',
    `VibeCheck caught ${impact.regressionsCaught} regressions and helped verify ${impact.verifiedFixes} fixes.`,
    '',
    ...metrics,
  ].join('\n')
}
```

- [ ] **Step 4: Run the full MCP suite and type-check**

Run: `pnpm --filter @wcgw/vibe-check-mcp test && pnpm --filter @wcgw/vibe-check-mcp lint`

Expected: all MCP tests and lint PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/mcp/src
git commit -m "feat: expose project impact stats"
```

### Task 4: Impact card, export, and reset UI

**Files:**
- Create: `packages/react/src/panels/ImpactCard.tsx`
- Create: `packages/react/src/panels/__tests__/ImpactCard.test.tsx`
- Create: `packages/react/src/utils/impactExport.ts`
- Create: `packages/react/src/utils/__tests__/impactExport.test.ts`
- Modify: `packages/react/src/panels/AgentPanel.tsx`
- Modify: `packages/react/src/panels/monitor/MonitorView.tsx`
- Modify: `packages/react/src/panels/SettingsPanel.tsx`
- Modify: `packages/react/src/VibeCheck.tsx`
- Modify: associated component tests.

**Interfaces:**
- Produces: `ImpactCard({ impact, compact, onCopy }): JSX.Element`.
- Produces: `formatImpactMarkdown(summary): string` and `formatImpactJson(summary): string`.

- [ ] **Step 1: Write failing card/export tests**

```tsx
it('shows earned metrics and honest share copy without empty claims', async () => {
  const onCopy = vi.fn()
  render(<ImpactCard impact={impact} compact={false} onCopy={onCopy} />)
  expect(screen.getByText('12 verified fixes')).toBeTruthy()
  expect(screen.getByText('3 regressions caught')).toBeTruthy()
  expect(screen.getByText(/4 duplicate requests removed/)).toBeTruthy()
  expect(screen.queryByText(/transfer/)).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: /copy impact summary/i }))
  expect(onCopy).toHaveBeenCalledWith(expect.stringContaining('helped verify 12 fixes'))
})

it('omits private fields from Markdown and JSON exports', () => {
  expect(formatImpactMarkdown(impact)).not.toMatch(/session|filesystem|\/Users\//i)
  expect(JSON.parse(formatImpactJson(impact))).toEqual(impact)
})
```

- [ ] **Step 2: Run React tests and verify failure**

Run: `pnpm --filter @wcgw/vibe-check test -- src/panels/__tests__/ImpactCard.test.tsx src/utils/__tests__/impactExport.test.ts`

Expected: FAIL because impact UI/export modules do not exist.

- [ ] **Step 3: Implement compact impact rendering**

Render exact fixes and regressions first. Map only present metric kinds to human labels with their unit/scope and a confidence tooltip. `compact` renders the first two exact stats; full mode renders all earned metrics. Add the compact card to Monitor and full card below Agent connection status.

```tsx
export const ImpactCard = ({ impact, compact, onCopy }: ImpactCardProps) => {
  const summary = formatImpactMarkdown(impact)
  const metrics = compact ? impact.metrics.slice(0, 1) : impact.metrics
  return (
    <section aria-label="VibeCheck impact" style={{
      border: `1px solid ${T.borderSubtle}`,
      borderRadius: T.radiusMd,
      padding: 12,
      background: T.bgSubtle,
    }}>
      <div>{impact.verifiedFixes} verified fixes</div>
      <div>{impact.regressionsCaught} regressions caught</div>
      {metrics.map((metric) => (
        <div key={`${metric.kind}:${metric.confidence}`} title={metric.scope}>
          {metric.value} {metric.label}{metric.confidence === 'estimated' ? ' (estimated)' : ''}
        </div>
      ))}
      {!compact && <Button onClick={() => onCopy(summary)}>Copy impact summary</Button>}
    </section>
  )
}
```

Settings adds “Export impact as Markdown,” “Export impact as JSON,” and a two-click reset confirmation whose second label is “Confirm reset impact stats.” Use the existing clipboard helper; do not initiate filesystem downloads from the embedded widget.

```tsx
const [confirmImpactReset, setConfirmImpactReset] = useState(false)

<Button fullWidth onClick={() => { void onCopyImpact(formatImpactMarkdown(impact)) }}>
  Export impact as Markdown
</Button>
<Button fullWidth onClick={() => { void onCopyImpact(formatImpactJson(impact)) }}>
  Export impact as JSON
</Button>
<Button variant="danger" fullWidth onClick={() => {
  if (!confirmImpactReset) { setConfirmImpactReset(true); return }
  setConfirmImpactReset(false)
  void onResetImpact()
}}>
  {confirmImpactReset ? 'Confirm reset impact stats' : 'Reset impact stats'}
</Button>
```

- [ ] **Step 4: Run React suite/lint/build**

Run: `pnpm --filter @wcgw/vibe-check test && pnpm --filter @wcgw/vibe-check lint && pnpm --filter @wcgw/vibe-check build`

Expected: all React checks PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/react/src
git commit -m "feat: show and share VibeCheck impact"
```

### Task 5: Durable bragging-rights E2E and documentation

**Files:**
- Modify: `e2e/mcp-roundtrip/fixtures/src/App.tsx`
- Modify: `e2e/mcp-roundtrip/mcp-roundtrip.spec.ts`
- Modify: `packages/mcp/README.md`
- Modify: `packages/react/README.md`
- Modify: `apps/web/components/landing/RealAgentDemo.tsx`
- Modify: `apps/web/__tests__/real-agent-demo.test.tsx`

**Interfaces:**
- Consumes complete impact implementation.
- Produces packed persistence/isolation proof and a demoable impact receipt.

- [ ] **Step 1: Add packed impact assertions**

Extend the restart/regression scenario to assert one unique issue, two verified fix cycles after the regression is fixed again, one regression caught, and no duplicate receipt after a second hub restart. Assert app B remains all zeroes.

```ts
const completeFixAndRegressionCycle = async (page: Page, projectUrl: string): Promise<void> => {
  const agent = await connectClient('impact-agent')
  try {
    await openAgentIssue(page, projectUrl)
    let receivedPromise = watch(agent.client, projectUrl)
    await page.getByTestId(/vibe-check-send-/).click()
    let received = payload(await receivedPromise)
    if (!received.issue?.id) throw new Error('Missing first issue ID')
    await agent.client.callTool({
      name: 'resolve_issue', arguments: { project_id: projectUrl, issue_id: received.issue.id },
    })
    await page.getByRole('button', { name: 'Apply fix' }).click()
    await expect(page.getByRole('tab', { name: /fixed \(1\)/i })).toBeVisible()

    await page.getByRole('button', { name: 'Reintroduce regression' }).click()
    receivedPromise = watch(agent.client, projectUrl)
    await page.getByTestId(/vibe-check-send-/).click()
    received = payload(await receivedPromise)
    if (!received.issue?.id) throw new Error('Missing regression issue ID')
    await agent.client.callTool({
      name: 'resolve_issue', arguments: { project_id: projectUrl, issue_id: received.issue.id },
    })
    await page.getByRole('button', { name: 'Apply fix' }).click()
    await expect(page.getByRole('tab', { name: /fixed \(1\)/i })).toBeVisible()
  } finally {
    await agent.close()
  }
}

test('persists project impact without double counting', async ({ page }) => {
  await completeFixAndRegressionCycle(page, appAUrl)
  const before = await fetch(`${hubUrl}/api/projects/${encodeURIComponent(appAUrl)}/impact`).then((res) => res.json())
  expect(before).toMatchObject({
    uniqueIssuesFixed: 1,
    verifiedFixes: 2,
    regressionsCaught: 1,
  })
  await restartHub()
  const after = await fetch(`${hubUrl}/api/projects/${encodeURIComponent(appAUrl)}/impact`).then((res) => res.json())
  expect(after).toEqual(before)
  const other = await fetch(`${hubUrl}/api/projects/${encodeURIComponent(appBUrl)}/impact`).then((res) => res.json())
  expect(other).toMatchObject({ verifiedFixes: 0, regressionsCaught: 0, metrics: [] })
})
```

- [ ] **Step 2: Run the packed scenario**

Run: `pnpm test:e2e:mcp -- --grep "persists project impact without double counting"`

Expected: 1 Playwright test PASS.

- [ ] **Step 3: Add the visible showcase receipt**

The recording shell’s receipt card shows verified fixes, regressions caught, and duplicate requests removed after the real MCP/browser round trip. `RealAgentDemo` copy explicitly says the numbers come from a persisted local project ledger.

```tsx
<section data-testid="vibe-check-demo-impact" style={cardStyle}>
  <div style={labelStyle}>Persisted project impact</div>
  <strong>{impact.verifiedFixes} verified fixes</strong>
  <div>{impact.regressionsCaught} regressions caught</div>
  {impact.metrics.map((metric) => (
    <div key={metric.kind}>{metric.value} {metric.label}</div>
  ))}
</section>
```

```tsx
<p>
  Every number in this demo comes from VibeCheck’s persisted local project
  ledger and a verified browser/MCP round trip.
</p>
```

- [ ] **Step 4: Run complete repository verification**

Run: `pnpm test && pnpm lint && pnpm build && pnpm test:e2e:mcp && pnpm --filter web test && pnpm --filter web build`

Expected: all tests, package builds, E2E scenarios, and the production website build PASS.

- [ ] **Step 5: Commit**

```bash
git add e2e/mcp-roundtrip packages/mcp/README.md packages/react/README.md apps/web/components/landing/RealAgentDemo.tsx apps/web/__tests__/real-agent-demo.test.tsx
git commit -m "test: showcase persisted VibeCheck impact"
```
