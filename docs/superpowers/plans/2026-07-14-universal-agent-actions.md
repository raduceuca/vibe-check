# Universal Agent Actions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Put the real MCP **Send to agent** action on every detector-backed suggestion and prevent VibeCheck's configured MCP hub traffic from creating duplicate-request issues.

**Architecture:** A focused `IssueActions` component will own transient delivery state and render the shared Send, Copy, Resolve, and outcome controls for Agent, SEO, AEO, and annotation surfaces. The duplicate-request detector will accept boundary-aware ignored URL prefixes, and `VibeCheckEngine` will inject its configured `beaconUrl` without globally suppressing localhost traffic.

**Tech Stack:** TypeScript strict mode, React 18+, Vitest, Testing Library, Playwright, tsup, pnpm.

## Global Constraints

- Core keeps zero runtime dependencies.
- Use named arrow-function exports; no default exports.
- Keep immutable public state and inputs.
- React UI uses inline styles only.
- Copy success never marks an issue sent.
- Only a confirmed MCP dispatch marks an issue `sent-to-agent`.
- The prompt library remains clipboard-only because it does not contain `VibeIssue` payloads.
- Ignore only the configured `beaconUrl` URL tree, not localhost generally.

---

### Task 1: Filter VibeCheck's own MCP requests

**Files:**
- Modify: `packages/core/src/detectors/duplicateRequests.ts`
- Modify: `packages/core/src/detectors/__tests__/duplicateRequests.test.ts`
- Modify: `packages/core/src/engine.ts`
- Modify: `packages/core/src/__tests__/engine.test.ts`

**Interfaces:**
- Consumes: `VibeCheckConfig.beaconUrl?: string`.
- Produces: `createDuplicateRequestsDetector(ignoredUrlPrefixes?: readonly string[]): Detector`.

- [ ] **Step 1: Write detector tests that express the URL boundary**

Add tests that call the detector with `['http://127.0.0.1:4200']`, repeat MCP snapshot/status calls, and expect no issue. Repeat calls to another port, a shared-prefix hostname, and `/api/users`, and expect ordinary duplicate issues. Exercise both fetch and XHR interception:

```ts
it('ignores only requests inside the configured MCP URL tree', async () => {
  const detector = createDuplicateRequestsDetector(['http://127.0.0.1:4200/'])
  detector.start()

  await globalThis.fetch('http://127.0.0.1:4200/api/snapshot', { method: 'POST' })
  await globalThis.fetch('http://127.0.0.1:4200/api/snapshot', { method: 'POST' })
  expect(detector.getIssues()).toEqual([])

  await globalThis.fetch('http://127.0.0.1:4201/api/users')
  await globalThis.fetch('http://127.0.0.1:4201/api/users')
  expect(detector.getIssues()).toHaveLength(1)
  detector.stop()
})

it('does not ignore hosts that only share the MCP string prefix', async () => {
  const detector = createDuplicateRequestsDetector(['http://127.0.0.1:4200'])
  detector.start()
  await globalThis.fetch('http://127.0.0.1:4200.example/api/users')
  await globalThis.fetch('http://127.0.0.1:4200.example/api/users')
  expect(detector.getIssues()).toHaveLength(1)
  detector.stop()
})
```

- [ ] **Step 2: Run the detector tests and verify RED**

Run: `npx vitest run packages/core/src/detectors/__tests__/duplicateRequests.test.ts`

Expected: FAIL because `createDuplicateRequestsDetector` does not accept or apply ignored prefixes.

- [ ] **Step 3: Implement boundary-aware filtering**

Normalize trailing slashes once and return before tracking while always calling the underlying fetch/XHR implementation:

```ts
const normalizePrefix = (prefix: string): string => prefix.replace(/\/+$/, '')

const isInsideIgnoredTree = (url: string, prefixes: readonly string[]): boolean =>
  prefixes.some((rawPrefix) => {
    const prefix = normalizePrefix(rawPrefix)
    return prefix.length > 0 && (url === prefix || url.startsWith(`${prefix}/`))
  })

export const createDuplicateRequestsDetector = (
  ignoredUrlPrefixes: readonly string[] = [],
): Detector => {
  const ignored = ignoredUrlPrefixes.map(normalizePrefix).filter(Boolean)
  const trackRequest = (method: string, url: string): void => {
    if (isInsideIgnoredTree(url, ignored)) return
    const key = `${method.toUpperCase()}:${url}`
    const now = Date.now()
    const cutoff = now - DUPLICATE_WINDOW_MS
    const current = requestMap.get(key)
    const record = current ?? { timestamps: [now] }
    if (current) compactTimestamps(record.timestamps, cutoff, now)
    else requestMap.set(key, record)

    if (record.timestamps.length >= 2 && !reportedKeys.has(key)) {
      reportedKeys.add(key)
      issues = [...issues, createIssue(
        'duplicate-requests',
        'warning',
        `Duplicate ${method.toUpperCase()} request`,
        `${url} was called ${record.timestamps.length} times within ${DUPLICATE_WINDOW_MS}ms. This may indicate unnecessary refetching or missing request deduplication.`,
        { url, method: method.toUpperCase(), count: record.timestamps.length, windowMs: DUPLICATE_WINDOW_MS },
      )]
    }
  }
  // patchFetch and patchXhr call trackRequest before invoking their saved originals.
}
```

- [ ] **Step 4: Run the detector tests and verify GREEN**

Run: `npx vitest run packages/core/src/detectors/__tests__/duplicateRequests.test.ts`

Expected: all duplicate-request tests pass, including fetch/XHR exclusions and the localhost boundary cases.

- [ ] **Step 5: Write the engine integration test and verify RED**

Add a fake-timer test using a 50 ms beacon interval and only the duplicate detector enabled. Mock successful hub responses, advance through several snapshot/status cycles, and assert no duplicate issue is returned:

```ts
it('does not detect its configured beacon traffic as duplicate application requests', async () => {
  vi.stubGlobal('fetch', vi.fn(async (input) => {
    const url = String(input)
    return url.endsWith('/status')
      ? new Response(JSON.stringify({ projectId: 'project-a', state: 'no-agent', queueDepth: 0, leaseExpiresAt: null, conflictAt: null }))
      : new Response(null, { status: 200 })
  }) as typeof fetch)
  const engine = new VibeCheckEngine({
    beaconUrl: 'http://127.0.0.1:4200',
    beaconIntervalMs: 50,
    detectors: {
      domBloat: false, duplicateRequests: true, consoleSpam: false,
      memoryLeak: false, layoutThrashing: false, unoptimizedImages: false,
      longTaskAttribution: false, resourceBloat: false, largeImages: false,
      webEssentials: false, heavyLibrary: false, seo: false, aeo: false,
    },
  })
  engine.start()
  await vi.advanceTimersByTimeAsync(150)
  expect(engine.getIssues()).toEqual([])
  engine.stop()
})
```

Run: `npx vitest run packages/core/src/__tests__/engine.test.ts`

Expected: FAIL with a `duplicate-requests` issue until the engine supplies its beacon URL.

- [ ] **Step 6: Wire the engine and verify GREEN**

Replace the duplicate detector factory entry with:

```ts
[detectorConfig.duplicateRequests, () => createDuplicateRequestsDetector(
  this.config.beaconUrl ? [this.config.beaconUrl] : [],
)],
```

Run: `npx vitest run packages/core/src/__tests__/engine.test.ts packages/core/src/detectors/__tests__/duplicateRequests.test.ts`

Expected: both files pass.

- [ ] **Step 7: Commit the core behavior**

```bash
git add packages/core/src/detectors/duplicateRequests.ts packages/core/src/detectors/__tests__/duplicateRequests.test.ts packages/core/src/engine.ts packages/core/src/__tests__/engine.test.ts
git commit -m "fix: ignore VibeCheck MCP traffic in duplicate detection"
```

### Task 2: Create the shared issue-action component

**Files:**
- Create: `packages/react/src/panels/IssueActions.tsx`
- Create: `packages/react/src/panels/__tests__/IssueActions.test.tsx`
- Modify: `packages/react/src/panels/AgentPanel.tsx`
- Modify: `packages/react/src/panels/__tests__/AgentPanel.test.tsx`

**Interfaces:**
- Consumes: `TrackedIssue`, `BeaconStatus`, `DispatchIssueResponse`, `SuggestionMode`, and existing Copy/dispatch/store callbacks.
- Produces: named `IssueActions` component with optional `onMarkResolved`.

- [ ] **Step 1: Write failing shared-action tests**

Create a focused test file covering a healthy watcher, confirmed delivery,
already-sent state, clipboard independence, no watcher, hub offline, queue full,
and thrown dispatch:

```tsx
render(<IssueActions
  tracked={tracked}
  mode="technical"
  copiedId={null}
  beaconStatus={connected}
  onCopy={onCopy}
  onDispatch={onDispatch}
  onMarkSent={onMarkSent}
  onMarkResolved={onMarkResolved}
/>)
fireEvent.click(screen.getByRole('button', { name: /send to agent/i }))
await waitFor(() => expect(onDispatch).toHaveBeenCalledWith(issue))
expect(onMarkSent).toHaveBeenCalledWith(issue.id)
```

For `queue-full`, return `{ ok: false, code: 'queue-full', projectId: 'project-a', queueDepth: 10 }`, assert the status text is `queue full`, and assert `onMarkSent` was not called.

- [ ] **Step 2: Run the shared-action tests and verify RED**

Run: `npx vitest run packages/react/src/panels/__tests__/IssueActions.test.tsx`

Expected: FAIL because `IssueActions.tsx` does not exist.

- [ ] **Step 3: Implement `IssueActions`**

Use the existing result codes and render Send first, Copy second, and optional Resolve third:

```tsx
type DeliveryState = DispatchIssueResponse['code'] | 'idle' | 'sending'

interface IssueActionsProps {
  readonly tracked: TrackedIssue
  readonly mode: SuggestionMode
  readonly copiedId: string | null
  readonly beaconStatus: BeaconStatus | null
  readonly onCopy: (text: string, id: string) => Promise<boolean>
  readonly onDispatch: (issue: VibeIssue) => Promise<DispatchIssueResponse>
  readonly onMarkSent: (issueId: string) => void
  readonly onMarkResolved?: (issueId: string) => void
}

const DELIVERY_LABEL: Partial<Record<DeliveryState, string>> = {
  dispatched: 'sent',
  'agent-not-watching': 'agent not watching',
  'queue-full': 'queue full',
  'hub-offline': 'MCP server offline',
  'invalid-issue': 'invalid issue',
  failed: 'send failed',
  unconfigured: 'MCP not configured',
}

const dispatchTitle = (status: BeaconStatus | null, canDispatch: boolean): string => {
  if (canDispatch) return 'Send this issue to the connected agent'
  if (!status) return 'Configure beaconUrl before sending to an agent'
  if (status.lastOk !== true) return 'Start the local MCP hub before sending'
  return 'Connect one agent watcher before sending'
}

const DeliveryStatus = ({ delivery }: { readonly delivery: DeliveryState }) => {
  const label = DELIVERY_LABEL[delivery]
  if (!label || delivery === 'sending') return null
  return <span role="status" style={{ color: delivery === 'dispatched' ? T.green : T.red, fontSize: 13 }}>{label}</span>
}

export const IssueActions = ({
  tracked, mode, copiedId, beaconStatus,
  onCopy, onDispatch, onMarkSent, onMarkResolved,
}: IssueActionsProps) => {
  const [delivery, setDelivery] = useState<DispatchIssueResponse['code'] | 'idle' | 'sending'>('idle')
  const suggestion = getSuggestionCached(tracked.issue, mode)
  const canDispatch = beaconStatus?.lastOk === true
    && (beaconStatus.projectStatus?.state === 'watching' || beaconStatus.projectStatus?.state === 'busy')
  const sent = tracked.status === 'sent-to-agent' || delivery === 'dispatched'

  const dispatch = async () => {
    setDelivery('sending')
    try {
      const result = await onDispatch(tracked.issue)
      setDelivery(result.code)
      if (result.ok) onMarkSent(tracked.issue.id)
    } catch {
      setDelivery('failed')
    }
  }

  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
      <Button
        size="sm"
        disabled={!canDispatch || delivery === 'sending' || sent}
        onClick={(event) => { event.stopPropagation(); void dispatch() }}
        testId={`vibe-check-send-${tracked.issue.id}`}
        title={dispatchTitle(beaconStatus, canDispatch)}
      >
        {delivery === 'sending' ? 'Sending…' : sent ? 'Sent' : 'Send to agent'}
      </Button>
      <CopyButton
        copied={copiedId === tracked.issue.id}
        onClick={() => { void onCopy(suggestion.prompt, tracked.issue.id) }}
        label="Copy prompt"
      />
      {onMarkResolved && tracked.status !== 'resolved' && (
        <Button variant="success" size="sm" onClick={() => onMarkResolved(tracked.issue.id)}>
          {mode === 'vibe' ? 'mark as fixed' : 'resolve'}
        </Button>
      )}
      <DeliveryStatus delivery={delivery} />
    </div>
  )
}
```

Keep `dispatchTitle` and `DeliveryStatus` internal. Map all current structured
failure codes to the existing user-facing labels.

- [ ] **Step 4: Run shared-action tests and verify GREEN**

Run: `npx vitest run packages/react/src/panels/__tests__/IssueActions.test.tsx`

Expected: all shared-action tests pass with no unhandled promise warnings.

- [ ] **Step 5: Replace AgentPanel's local delivery implementation**

Delete `IssueRow`'s delivery state, result mapping, handlers, and duplicate
buttons. Keep the prompt preview, then render:

```tsx
<IssueActions
  tracked={tracked}
  mode={mode}
  copiedId={copiedId}
  beaconStatus={beaconStatus}
  onCopy={onCopy}
  onDispatch={onDispatch}
  onMarkSent={onMarkSent}
  onMarkResolved={onMarkResolved}
/>
```

Remove the old prompt-card CopyButton so each issue has one copy action.

- [ ] **Step 6: Run AgentPanel and shared-action tests**

Run: `npx vitest run packages/react/src/panels/__tests__/AgentPanel.test.tsx packages/react/src/panels/__tests__/IssueActions.test.tsx`

Expected: existing delivery tests and the new shared contract pass.

- [ ] **Step 7: Commit the shared component**

```bash
git add packages/react/src/panels/IssueActions.tsx packages/react/src/panels/__tests__/IssueActions.test.tsx packages/react/src/panels/AgentPanel.tsx packages/react/src/panels/__tests__/AgentPanel.test.tsx
git commit -m "feat: share issue delivery actions"
```

### Task 3: Put Send to agent on every detector-backed suggestion

**Files:**
- Modify: `packages/react/src/panels/AuditPanel.tsx`
- Create: `packages/react/src/panels/__tests__/AuditPanel.test.tsx`
- Modify: `packages/react/src/panels/AnnotationOverlay.tsx`
- Create: `packages/react/src/panels/__tests__/AnnotationOverlay.test.tsx`
- Modify: `packages/react/src/VibeCheck.tsx`
- Modify: `packages/react/src/__tests__/VibeCheck.test.tsx`

**Interfaces:**
- Consumes: `IssueActions` from Task 2 and VibeCheck's existing `beaconStatus`, `handleDispatch`, and `handleMarkSent` values.
- Produces: AuditPanel and AnnotationOverlay props for `beaconStatus`, `onDispatch`, and `onMarkSent`.

- [ ] **Step 1: Write failing AuditPanel tests**

Render SEO and AEO rows with a healthy watcher. Expand a row and assert both
actions exist. Click Send and prove the exact issue is dispatched and marked
sent only after success:

```tsx
fireEvent.click(screen.getByRole('button', { name: issue.title }))
fireEvent.click(screen.getByRole('button', { name: /send to agent/i }))
await waitFor(() => expect(onDispatch).toHaveBeenCalledWith(issue))
expect(onMarkSent).toHaveBeenCalledWith(issue.id)
expect(screen.getByRole('button', { name: /copy prompt/i })).toBeTruthy()
```

- [ ] **Step 2: Write failing AnnotationOverlay tests**

Create a target element whose selector is present in issue evidence, stub a
non-zero `getBoundingClientRect`, render the overlay, open its marker, and assert
Send, Copy, and Resolve are present. Use `IntersectionObserver = undefined` for
the direct-measurement fallback.

```tsx
const target = document.createElement('div')
target.id = 'problem-target'
target.getBoundingClientRect = () => ({
  x: 20, y: 20, top: 20, left: 20, right: 120, bottom: 80,
  width: 100, height: 60, toJSON: () => ({}),
})
document.body.append(target)
vi.stubGlobal('IntersectionObserver', undefined)
render(<AnnotationOverlay
  tracked={[{ ...tracked, issue: { ...issue, evidence: { selector: '#problem-target' } } }]}
  visible mode="technical" theme="dark" copiedId={null}
  beaconStatus={connected} onCopy={onCopy} onDispatch={onDispatch}
  onMarkSent={onMarkSent} onMarkResolved={onMarkResolved}
/>)
fireEvent.click(screen.getByRole('button', { name: /1 issue:/i }))
expect(screen.getByRole('button', { name: /send to agent/i })).toBeTruthy()
expect(screen.getByRole('button', { name: /copy prompt/i })).toBeTruthy()
expect(screen.getByRole('button', { name: /resolve/i })).toBeTruthy()
```

- [ ] **Step 3: Run surface tests and verify RED**

Run: `npx vitest run packages/react/src/panels/__tests__/AuditPanel.test.tsx packages/react/src/panels/__tests__/AnnotationOverlay.test.tsx`

Expected: FAIL because both panels lack the shared delivery props/action.

- [ ] **Step 4: Wire AuditPanel**

Add `BeaconStatus`, `DispatchIssueResponse`, and `VibeIssue` types to its props,
remove its bespoke CopyButton/handler, and render:

```tsx
<IssueActions
  tracked={tracked}
  mode={mode}
  copiedId={copiedId}
  beaconStatus={beaconStatus}
  onCopy={onCopy}
  onDispatch={onDispatch}
  onMarkSent={onMarkSent}
/>
```

- [ ] **Step 5: Wire AnnotationOverlay**

Pass the same three delivery props through `AnnotationOverlay` to `Marker`, and
replace its per-issue Copy/Resolve row with:

```tsx
<IssueActions
  tracked={t}
  mode={mode}
  copiedId={copiedId}
  beaconStatus={beaconStatus}
  onCopy={onCopy}
  onDispatch={onDispatch}
  onMarkSent={onMarkSent}
  onMarkResolved={onMarkResolved}
/>
```

- [ ] **Step 6: Wire VibeCheck once**

For both AuditPanel instances and AnnotationOverlay, pass:

```tsx
beaconStatus={beaconStatus}
onDispatch={handleDispatch}
onMarkSent={handleMarkSent}
```

Do not construct a new engine or beacon client inside a panel.

- [ ] **Step 7: Verify all React surface tests GREEN**

Run: `pnpm --filter @wcgw/vibe-check test`

Expected: Agent, Audit, Annotation, and VibeCheck tests all pass.

- [ ] **Step 8: Commit the complete UI wiring**

```bash
git add packages/react/src/panels/AuditPanel.tsx packages/react/src/panels/__tests__/AuditPanel.test.tsx packages/react/src/panels/AnnotationOverlay.tsx packages/react/src/panels/__tests__/AnnotationOverlay.test.tsx packages/react/src/VibeCheck.tsx packages/react/src/__tests__/VibeCheck.test.tsx
git commit -m "feat: send every issue suggestion to an agent"
```

### Task 4: Prove the public contract and refresh the showcase

**Files:**
- Modify: `packages/react/README.md`
- Modify: `apps/web/content/docs/quickstart.mdx`
- Modify: `e2e/mcp-roundtrip/mcp-roundtrip.spec.ts`

**Interfaces:**
- Consumes: the packed `@wcgw/vibe-check` action surfaces and existing `watch_for_issue` MCP tool.
- Produces: user-facing documentation and a packed-package audit-surface dispatch test.

- [ ] **Step 1: Add a packed E2E for an audit-surface dispatch**

Open the SEO tab, expand its first finding, connect one watcher, click that
row's `vibe-check-send-*` control, and assert the pending MCP tool returns a
`seo` issue for the correct project. Keep the existing DOM-bloat E2E unchanged.

```ts
test('dispatches an SEO suggestion from its audit tab to the watching agent', async ({ page }) => {
  const agent = await connectClient('audit-agent')
  try {
    await page.goto(appAUrl)
    await page.getByRole('tab', { name: /SEO/ }).click()
    const finding = page.locator('[role="button"][aria-expanded="false"]')
      .filter({ hasText: /Missing|Multiple/ }).first()
    await expect(finding).toBeVisible({ timeout: 20_000 })
    await finding.click()
    const send = page.locator('[data-testid^="vibe-check-send-"]').first()
    const receivedPromise = watch(agent.client, appAUrl)
    await expect(page.getByTestId('vibe-check-agent-connection-dot')).toHaveAttribute('data-state', /connected|busy/)
    await send.click()
    const received = payload(await receivedPromise)
    expect(received.projectId).toBe(appAUrl)
    expect(received.issue?.detector).toBe('seo')
  } finally {
    await agent.close()
  }
})
```

- [ ] **Step 2: Run the packed E2E and verify it passes**

Run: `pnpm test:e2e:mcp`

Expected: five Playwright tests pass, including the original Agent-tab dispatch
and the new audit-surface dispatch.

- [ ] **Step 3: Update documentation**

State that every detected issue surface exposes **Send to agent**, while the
Prompt Library remains copy-only. Document that VibeCheck automatically excludes
requests beneath its configured `beaconUrl` from duplicate-request detection.

- [ ] **Step 4: Run the complete verification matrix**

Run, in order:

```bash
pnpm test
pnpm lint
pnpm build
pnpm --filter web lint
pnpm --filter @wcgw/vibe-check size
pnpm test:e2e:mcp
pnpm --filter web cf:build
pnpm --filter web exec wrangler deploy --dry-run
git diff --check
```

Expected: zero failures; widget gzip remains under 45 KB; OpenNext and Wrangler
dry-run complete successfully.

- [ ] **Step 5: Restart and verify the local showcase**

Start the freshly built web app on port 3101, open the widget's SEO/AEO and Agent
surfaces, and confirm every detector suggestion displays the connection-aware
Send action. Confirm the duplicate-request issue does not list the configured
MCP hub snapshot/status URLs.

- [ ] **Step 6: Commit documentation and E2E proof**

```bash
git add packages/react/README.md apps/web/content/docs/quickstart.mdx e2e/mcp-roundtrip/mcp-roundtrip.spec.ts
git commit -m "test: prove universal MCP issue dispatch"
```

- [ ] **Step 7: Push and monitor PR checks**

Push `codex/release-automation-onboarding`, post the verification evidence to
PR #5, and wait for CI and CodeRabbit to finish. Resolve only review threads
whose fixes are present and verified.
