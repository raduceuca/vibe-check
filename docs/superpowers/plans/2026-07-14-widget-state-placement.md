# Widget State and Placement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persist the widget’s collapsed state and provide an accessible visual setting for linked or independent collapsed/expanded corner placement.

**Architecture:** Extend the existing version-tolerant preference object and resolve its default storage key from `projectId`. Keep the existing `position` prop as the application fallback, while saved state-specific overrides win only after a user chooses them. A focused `PositionPicker` renders the four supported corners as an accessible radio group.

**Tech Stack:** React 18+, TypeScript strict mode, inline styles, localStorage, Vitest, Testing Library.

## Global Constraints

- TypeScript strict mode; no `any`.
- Named arrow function exports only; no default exports.
- React UI uses inline styles only.
- Existing callers that pass `position` or an explicit `storageKey` remain compatible.
- `startCollapsed` is the first-use fallback; a saved user choice wins afterward.
- Supported positions remain `top-left`, `top-right`, `bottom-left`, and `bottom-right`.
- Every change follows red-green-refactor and ends in a focused commit.

---

## File Map

- Modify `packages/react/src/store/preferences.ts` — version-tolerant preference schema, validation, and project-scoped key resolution.
- Create `packages/react/src/store/__tests__/preferences.test.ts` — persistence, migration, and project isolation tests.
- Modify `packages/react/src/hooks/usePreferences.ts` — initialize first-use collapsed state and use the resolved project key.
- Create `packages/react/src/panels/ui/PositionPicker.tsx` — accessible four-corner selector.
- Create `packages/react/src/panels/ui/__tests__/PositionPicker.test.tsx` — radio semantics and selection tests.
- Modify `packages/react/src/panels/SettingsPanel.tsx` — linked/independent placement controls and reset action.
- Modify `packages/react/src/panels/__tests__/SettingsPanel.test.tsx` — settings interaction tests.
- Modify `packages/react/src/VibeCheck.tsx` — derive collapsed state and effective position from preferences.
- Modify `packages/react/src/__tests__/VibeCheck.test.tsx` — refresh persistence and state-specific placement tests.
- Modify `packages/react/README.md` — document first-use defaults and saved overrides.

### Task 1: Project-scoped preference schema

**Files:**
- Create: `packages/react/src/store/__tests__/preferences.test.ts`
- Modify: `packages/react/src/store/preferences.ts`
- Modify: `packages/react/src/hooks/usePreferences.ts`

**Interfaces:**
- Produces: `resolvePreferencesKey(storageKey?: string, projectId?: string): string`
- Produces: `readPreferences(storageKey: string, firstUseCollapsed: boolean): VibeCheckPreferences`
- Produces: `usePreferences(storageKey?: string, projectId?: string, startCollapsed?: boolean)`
- Produces fields: `collapsed`, `positionsLinked`, `collapsedPosition`, `expandedPosition`

- [ ] **Step 1: Write failing storage tests**

```ts
import { beforeEach, describe, expect, it } from 'vitest'
import {
  DEFAULT_PREFERENCES_KEY,
  readPreferences,
  resolvePreferencesKey,
  writePreferences,
} from '../preferences.js'

describe('widget preferences', () => {
  beforeEach(() => localStorage.clear())

  it('scopes the default key by project while preserving explicit keys', () => {
    expect(resolvePreferencesKey(undefined, 'storefront')).toBe('vibe-check:preferences:storefront')
    expect(resolvePreferencesKey(undefined, undefined)).toBe(DEFAULT_PREFERENCES_KEY)
    expect(resolvePreferencesKey('custom', 'storefront')).toBe('custom')
  })

  it('uses startCollapsed only before a saved choice exists', () => {
    const key = resolvePreferencesKey(undefined, 'storefront')
    expect(readPreferences(key, true).collapsed).toBe(true)
    writePreferences({ ...readPreferences(key, true), collapsed: false }, key)
    expect(readPreferences(key, true).collapsed).toBe(false)
  })

  it('migrates old and malformed position fields safely', () => {
    const key = resolvePreferencesKey(undefined, 'storefront')
    localStorage.setItem(key, JSON.stringify({ mode: 'technical', collapsedPosition: 'middle' }))
    expect(readPreferences(key, false)).toMatchObject({
      mode: 'technical',
      positionsLinked: true,
      collapsedPosition: null,
      expandedPosition: null,
    })
  })
})
```

- [ ] **Step 2: Run the focused test and verify failure**

Run: `pnpm --filter @wcgw/vibe-check test -- src/store/__tests__/preferences.test.ts`

Expected: FAIL because the new fields and `resolvePreferencesKey` do not exist.

- [ ] **Step 3: Implement validated preferences and key resolution**

```ts
import type { Position } from '../panels/types.js'

export interface VibeCheckPreferences {
  readonly mode: SuggestionMode
  readonly annotationsVisible: boolean
  readonly clearOnSend: boolean
  readonly theme: VibeCheckTheme
  readonly keepHistory: boolean
  readonly collapsed: boolean
  readonly positionsLinked: boolean
  readonly collapsedPosition: Position | null
  readonly expandedPosition: Position | null
}

const POSITIONS: readonly Position[] = [
  'top-left', 'top-right', 'bottom-left', 'bottom-right',
]

const isPosition = (value: unknown): value is Position =>
  POSITIONS.includes(value as Position)

export const resolvePreferencesKey = (
  storageKey?: string,
  projectId?: string,
): string => storageKey ?? (projectId
  ? `${DEFAULT_PREFERENCES_KEY}:${encodeURIComponent(projectId)}`
  : DEFAULT_PREFERENCES_KEY)

export const readPreferences = (
  storageKey: string = DEFAULT_PREFERENCES_KEY,
  firstUseCollapsed = false,
): VibeCheckPreferences => {
  const defaults = { ...DEFAULTS, collapsed: firstUseCollapsed }
  try {
    if (typeof localStorage === 'undefined') return defaults
    const raw = localStorage.getItem(storageKey)
    if (!raw) return defaults
    const parsed = JSON.parse(raw) as Partial<VibeCheckPreferences>
    return {
      ...defaults,
      ...parsed,
      collapsed: typeof parsed.collapsed === 'boolean' ? parsed.collapsed : firstUseCollapsed,
      positionsLinked: typeof parsed.positionsLinked === 'boolean' ? parsed.positionsLinked : true,
      collapsedPosition: isPosition(parsed.collapsedPosition) ? parsed.collapsedPosition : null,
      expandedPosition: isPosition(parsed.expandedPosition) ? parsed.expandedPosition : null,
    }
  } catch {
    return defaults
  }
}
```

Update the hook initialization to resolve the key once per inputs and write to the same key:

```ts
export const usePreferences = (
  storageKey?: string,
  projectId?: string,
  startCollapsed = false,
) => {
  const resolvedKey = resolvePreferencesKey(storageKey, projectId)
  const [prefs, setPrefs] = useState<VibeCheckPreferences>(
    () => readPreferences(resolvedKey, startCollapsed),
  )
  // Existing updatePrefs/toggleMode both call writePreferences(next, resolvedKey).
}
```

- [ ] **Step 4: Run storage tests and type-check**

Run: `pnpm --filter @wcgw/vibe-check test -- src/store/__tests__/preferences.test.ts && pnpm --filter @wcgw/vibe-check lint`

Expected: preference tests PASS and TypeScript reports no errors.

- [ ] **Step 5: Commit**

```bash
git add packages/react/src/store/preferences.ts packages/react/src/store/__tests__/preferences.test.ts packages/react/src/hooks/usePreferences.ts
git commit -m "feat: persist project widget state"
```

### Task 2: Accessible visual position picker

**Files:**
- Create: `packages/react/src/panels/ui/PositionPicker.tsx`
- Create: `packages/react/src/panels/ui/__tests__/PositionPicker.test.tsx`
- Modify: `packages/react/src/panels/SettingsPanel.tsx`
- Modify: `packages/react/src/panels/__tests__/SettingsPanel.test.tsx`

**Interfaces:**
- Consumes: `Position` and `VibeCheckPreferences` from Task 1.
- Produces: `PositionPicker({ label, value, onChange }): JSX.Element`
- Settings consumes: `defaultPosition: Position`

- [ ] **Step 1: Write failing picker and settings tests**

```tsx
it('exposes four corner choices as one labelled radio group', () => {
  const onChange = vi.fn()
  render(<PositionPicker label="Expanded" value="bottom-right" onChange={onChange} />)
  expect(screen.getByRole('radiogroup', { name: 'Expanded' })).toBeTruthy()
  expect(screen.getAllByRole('radio')).toHaveLength(4)
  fireEvent.click(screen.getByRole('radio', { name: 'Top left' }))
  expect(onChange).toHaveBeenCalledWith('top-left')
})

it('shows separate collapsed and expanded pickers when unlinked', () => {
  render(<SettingsPanel {...baseProps} prefs={{ ...prefs, positionsLinked: false }} />)
  expect(screen.getByRole('radiogroup', { name: 'Collapsed' })).toBeTruthy()
  expect(screen.getByRole('radiogroup', { name: 'Expanded' })).toBeTruthy()
})
```

- [ ] **Step 2: Run the focused tests and verify failure**

Run: `pnpm --filter @wcgw/vibe-check test -- src/panels/ui/__tests__/PositionPicker.test.tsx src/panels/__tests__/SettingsPanel.test.tsx`

Expected: FAIL because `PositionPicker` and the placement settings do not exist.

- [ ] **Step 3: Implement the picker and settings wiring**

```tsx
const OPTIONS: readonly { readonly value: Position; readonly label: string }[] = [
  { value: 'top-left', label: 'Top left' },
  { value: 'top-right', label: 'Top right' },
  { value: 'bottom-left', label: 'Bottom left' },
  { value: 'bottom-right', label: 'Bottom right' },
]

export const PositionPicker = ({ label, value, onChange }: PositionPickerProps) => {
  const name = useId()
  const [focused, setFocused] = useState<Position | null>(null)
  return (
    <div role="radiogroup" aria-label={label} style={{
      display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8,
      padding: 10, border: `1px solid ${T.borderSubtle}`, borderRadius: T.radiusMd,
    }}>
      {OPTIONS.map((option) => {
        const selected = value === option.value
        return (
          <label key={option.value} style={{
            minHeight: 42,
            display: 'grid', placeItems: 'center',
            borderRadius: T.radiusSm,
            border: `1px solid ${selected ? T.green : T.borderSubtle}`,
            background: selected ? T.bgHover : T.bg,
            color: selected ? T.green : T.textTertiary,
            boxShadow: focused === option.value ? `0 0 0 2px ${T.blue}` : 'none',
            cursor: 'pointer',
          }}>
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={selected}
              aria-label={option.label}
              onChange={() => onChange(option.value)}
              onFocus={() => setFocused(option.value)}
              onBlur={() => setFocused(null)}
              style={{ position: 'absolute', opacity: 0, width: 1, height: 1 }}
            />
            {option.label}
          </label>
        )
      })}
    </div>
  )
}
```

In `SettingsPanel`, add a “Widget position” section, a `ToggleRow` for “Use one position for both,” and choose `prefs.*Position ?? defaultPosition`. When linked, one selection writes both overrides. Reset writes both overrides to `null`.

```tsx
const linkedPosition = prefs.expandedPosition ?? prefs.collapsedPosition ?? defaultPosition

<ToggleRow
  label="Use one position for both"
  checked={prefs.positionsLinked}
  onChange={(positionsLinked) => onUpdate({
    positionsLinked,
    ...(positionsLinked
      ? { collapsedPosition: linkedPosition, expandedPosition: linkedPosition }
      : {}),
  })}
/>
{prefs.positionsLinked ? (
  <PositionPicker
    label="Widget position"
    value={linkedPosition}
    onChange={(value) => onUpdate({ collapsedPosition: value, expandedPosition: value })}
  />
) : (
  <>
    <PositionPicker label="Collapsed" value={prefs.collapsedPosition ?? defaultPosition}
      onChange={(collapsedPosition) => onUpdate({ collapsedPosition })} />
    <PositionPicker label="Expanded" value={prefs.expandedPosition ?? defaultPosition}
      onChange={(expandedPosition) => onUpdate({ expandedPosition })} />
  </>
)}
<Button variant="ghost" fullWidth onClick={() => onUpdate({
  collapsedPosition: null,
  expandedPosition: null,
})}>Reset to app default</Button>
```

- [ ] **Step 4: Run picker/settings tests and type-check**

Run: `pnpm --filter @wcgw/vibe-check test -- src/panels/ui/__tests__/PositionPicker.test.tsx src/panels/__tests__/SettingsPanel.test.tsx && pnpm --filter @wcgw/vibe-check lint`

Expected: focused tests PASS and TypeScript reports no errors.

- [ ] **Step 5: Commit**

```bash
git add packages/react/src/panels/ui/PositionPicker.tsx packages/react/src/panels/ui/__tests__/PositionPicker.test.tsx packages/react/src/panels/SettingsPanel.tsx packages/react/src/panels/__tests__/SettingsPanel.test.tsx
git commit -m "feat: add visual widget placement settings"
```

### Task 3: Apply and restore state-specific placement

**Files:**
- Modify: `packages/react/src/VibeCheck.tsx`
- Modify: `packages/react/src/__tests__/VibeCheck.test.tsx`

**Interfaces:**
- Consumes: persisted preferences and picker updates from Tasks 1–2.
- Produces: effective position `prefs.collapsedPosition ?? position` or `prefs.expandedPosition ?? position`.

- [ ] **Step 1: Write failing integration tests**

```tsx
it('restores collapsed state for one project after remount', () => {
  const first = render(<VibeCheck enabled projectId="storefront" />)
  fireEvent.click(screen.getByTestId('vibe-check-header'))
  expect(screen.queryByTestId('vibe-check-body')).toBeNull()
  first.unmount()
  render(<VibeCheck enabled projectId="storefront" />)
  expect(screen.queryByTestId('vibe-check-body')).toBeNull()
})

it('uses independent saved positions for collapsed and expanded forms', () => {
  localStorage.setItem('vibe-check:preferences:storefront', JSON.stringify({
    collapsed: true,
    positionsLinked: false,
    collapsedPosition: 'top-left',
    expandedPosition: 'bottom-right',
  }))
  render(<VibeCheck enabled projectId="storefront" position="top-right" />)
  expect(screen.getByTestId('vibe-check-collapsed').style.left).toBe('12px')
  fireEvent.click(screen.getByTestId('vibe-check-header'))
  const overlay = screen.getByTestId('vibe-check-overlay')
  expect(overlay.style.bottom).toBe('12px')
  expect(overlay.style.right).toBe('12px')
})
```

- [ ] **Step 2: Run the focused integration test and verify failure**

Run: `pnpm --filter @wcgw/vibe-check test -- src/__tests__/VibeCheck.test.tsx`

Expected: FAIL because collapsed state is component-local and placement ignores preferences.

- [ ] **Step 3: Make preferences authoritative for toggle and placement**

```tsx
const { prefs, updatePrefs, toggleMode } = usePreferences(
  storageKey,
  projectId,
  startCollapsed,
)
const collapsed = prefs.collapsed
const effectivePosition = collapsed
  ? prefs.collapsedPosition ?? position
  : prefs.expandedPosition ?? position
const pos = POS[effectivePosition]
const toggle = useCallback(
  () => updatePrefs({ collapsed: !collapsed }),
  [collapsed, updatePrefs],
)
```

Pass `defaultPosition={position}` to `SettingsPanel`. Remove the component-local collapsed `useState`. Keep the existing focus-transfer refs and effects unchanged.

- [ ] **Step 4: Run the React package suite**

Run: `pnpm --filter @wcgw/vibe-check test && pnpm --filter @wcgw/vibe-check lint && pnpm --filter @wcgw/vibe-check build`

Expected: all React tests PASS, lint PASS, and both ESM/CJS builds succeed.

- [ ] **Step 5: Commit**

```bash
git add packages/react/src/VibeCheck.tsx packages/react/src/__tests__/VibeCheck.test.tsx
git commit -m "feat: restore widget state and placement"
```

### Task 4: Documentation and browser verification

**Files:**
- Modify: `packages/react/README.md`
- Modify: `e2e/mcp-roundtrip/mcp-roundtrip.spec.ts`

**Interfaces:**
- Consumes the completed preference UI.
- Produces a packed-package refresh regression test.

- [ ] **Step 1: Extend the packed E2E test**

```ts
test('restores widget state and placement after refresh', async ({ page }) => {
  await page.goto(appAUrl)
  await page.evaluate(() => localStorage.clear())
  await page.reload()
  await page.getByRole('tab', { name: /Settings/ }).click()
  await page.getByRole('checkbox', { name: 'Use one position for both' }).uncheck()
  await page.getByRole('radiogroup', { name: 'Collapsed' })
    .getByRole('radio', { name: 'Top left' }).click()
  await page.getByRole('radiogroup', { name: 'Expanded' })
    .getByRole('radio', { name: 'Bottom right' }).click()
  await page.getByTestId('vibe-check-header').click()
  await page.reload()
  const collapsed = page.getByTestId('vibe-check-collapsed')
  await expect(collapsed).toHaveCSS('top', '12px')
  await expect(collapsed).toHaveCSS('left', '12px')
  await collapsed.getByTestId('vibe-check-header').click()
  const expanded = page.getByTestId('vibe-check-overlay')
  await expect(expanded).toHaveCSS('bottom', '12px')
  await expect(expanded).toHaveCSS('right', '12px')
})
```

- [ ] **Step 2: Run the E2E test and verify it passes against packed packages**

Run: `pnpm test:e2e:mcp -- --grep "restores widget state and placement"`

Expected: 1 Playwright test PASS.

- [ ] **Step 3: Document preference precedence**

Add this text to the preference section:

```md
`position` is the application fallback. A user-selected corner in Settings is
saved per `projectId` and overrides that fallback. Pass `storageKey` to own the
preference bucket explicitly. `startCollapsed` applies only on first use; after
the user expands or collapses the widget, that choice survives refreshes.
```

- [ ] **Step 4: Run final verification**

Run: `pnpm --filter @wcgw/vibe-check test && pnpm --filter @wcgw/vibe-check lint && pnpm test:e2e:mcp -- --grep "restores widget state and placement"`

Expected: all commands PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/react/README.md e2e/mcp-roundtrip/mcp-roundtrip.spec.ts
git commit -m "test: cover persisted widget placement"
```
