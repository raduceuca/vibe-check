# @wcgw/vibe-check-core

Framework-agnostic browser performance monitoring engine with AI/vibe-coding issue detection. Zero runtime dependencies.

## Installation

```bash
npm install @wcgw/vibe-check-core
```

## Usage

```typescript
import { VibeCheckEngine } from '@wcgw/vibe-check-core'

const engine = new VibeCheckEngine()
engine.start()

// Get a performance snapshot
const snapshot = engine.getSnapshot()
console.log(snapshot.frameRate.fps)
console.log(snapshot.issues)

// Subscribe to snapshot updates
const unsubscribe = engine.onSnapshot((snapshot) => {
  if (snapshot.issues.length > 0) {
    console.warn('Performance issues detected:', snapshot.issues)
  }
})

// Clean up
engine.stop()
unsubscribe()
```

## Configuration

```typescript
const engine = new VibeCheckEngine({
  // Send snapshots to an MCP server
  beaconUrl: 'http://localhost:4200',
})
```

## Collectors

Collectors measure browser metrics continuously:

- **Frame Rate** -- FPS, frame times, dropped frames via `requestAnimationFrame`
- **Long Frames** -- Long Animation Frames (LoAF) API with script attribution
- **Web Vitals** -- LCP, CLS, INP via PerformanceObserver
- **Memory** -- JS heap size via `performance.memory`
- **Resources** -- Resource loading performance and sizes
- **Console** -- Tracks console.log/warn/error volume

## Detectors

Detectors analyze snapshots and flag issues. All eleven are enabled by default; toggle them via `config.detectors`.

| Detector | What it catches |
|----------|----------------|
| `dom-bloat` | Excessive DOM nodes, deep nesting |
| `duplicate-requests` | Repeated fetches to the same URL within 2s |
| `console-spam` | High-volume console output |
| `memory-leak` | Steadily growing heap usage |
| `layout-thrashing` | Clusters of layout shifts without user input |
| `unoptimized-images` | Images without width/height, missing lazy loading |
| `large-images` | Oversized images for web delivery |
| `long-task-attribution` | Long animation frames + script attribution (LoAF API) |
| `resource-bloat` | Too many or oversized JS/CSS/image/font resources |
| `web-essentials` | Missing viewport meta, lang attribute, etc. |
| `heavy-library` | Detects 17 known heavy libraries (Three.js, MUI, Moment.js, Lottie, …) and warns about their performance pitfalls |

## API

### `VibeCheckEngine`

- `start()` — begin monitoring
- `stop()` — stop monitoring and clean up
- `isRunning(): boolean` — whether the engine is currently running
- `getSnapshot(): VibeSnapshot` — current performance snapshot
- `getIssues(): readonly VibeIssue[]` — current issues from all enabled detectors
- `clearIssues(): void` — clear the issues buffer on every detector
- `onSnapshot(cb): () => void` — subscribe to snapshot updates (fires every 500ms). Returns an unsubscribe function.

### Types

All types are exported: `VibeSnapshot`, `VibeIssue`, `FrameRateStats`, `LongFrameStats`, `WebVitalsStats`, `HeapMemory`, `ResourceStats`, `ConsoleStats`, `VibeCheckConfig`, `Collector`, `Detector`, `DetectorName`, `Severity`, etc. See [`src/types.ts`](./src/types.ts) for the full surface.

## License

MIT
