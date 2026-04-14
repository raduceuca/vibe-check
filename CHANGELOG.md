# Changelog

All notable changes across the `@wcgw/vibe-check`, `@wcgw/vibe-check-core`, and
`@wcgw/vibe-check-mcp` packages. Versions are kept in lockstep.

## 0.1.2

Performance sweep — vibe-check is a perf monitor, so its own runtime cost is
mission-critical. This release removes the largest sources of allocation and
reflow in the hot paths.

### `@wcgw/vibe-check-core`

- **`FrameRateCollector` no longer allocates per rAF tick.** The previous
  implementation called `RingBuffer.toArray()` on every frame to trim the
  rolling sample window, then again every 500 ms for stat reporting — roughly
  120 throwaway arrays/sec just from the FPS collector. `RingBuffer` now
  exposes `forEach()` and `trimHeadWhile()` for zero-allocation iteration and
  in-place head trimming, and `tick()` uses both.
- **`VibeCheckEngine.getSnapshot()` / `getIssues()` no longer use
  `flatMap([...d.getIssues()])`.** Replaced with a push-loop helper that runs
  on every snapshot interval (500 ms) and every beacon poll.
- **`layoutThrashing` and `duplicateRequests` detectors** now compact their
  rolling-window arrays in place instead of `[...filter(), record]` per event.
- **`heavyLibrary` detector** short-circuits its 30 s rescan once every known
  signature has been reported, and skips entirely when the page is hidden.

### `@wcgw/vibe-check` (React)

- **`AnnotationOverlay`** now uses an `IntersectionObserver` to gate
  `getBoundingClientRect` calls — offscreen annotated elements are no longer
  measured each cycle, eliminating reflows during scroll. IO callbacks drive
  visibility-change updates with rAF coalescing. The safety-net rescan was
  bumped from 2 s → 5 s for elements that load into the DOM after detection,
  and the resize handler is now rAF-throttled.
- **`useVibeCheck`** dropped per-render `JSON.stringify(config)` diffing in
  favor of a tiny `shallowConfigEqual` over a stable ref.
- **`VibeCheck`** hoisted `navTabStyle` to module-level `NAV_TAB_ACTIVE` /
  `NAV_TAB_INACTIVE` constants so descendants get stable style identity.
- **`useIssueStore.sync()`** short-circuits when the live issue id set already
  matches the currently-tracked `new`-status set, so the store no longer
  rebuilds + writes localStorage + re-notifies subscribers every 500 ms when
  nothing has actually changed.
- Added `data-testid="vibe-check-body"` to the panel body div.

### `@wcgw/vibe-check-mcp`

- **`findIssueById`** scans the current snapshot and history arrays in place
  instead of building a concatenated `[...current, ...history]` array on
  every tool call.

### Publish metadata

All three packages now expose `author`, `homepage`, and `bugs` fields, and
`repository.url` uses the standard `git+https://…` form npm expects.
