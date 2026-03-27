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

Detectors analyze snapshots and flag issues:

| Detector | What it catches |
|----------|----------------|
| `dom-bloat` | Excessive DOM nodes, deep nesting |
| `duplicate-requests` | Repeated fetches to the same URL |
| `console-spam` | High-volume console output |
| `memory-leak` | Steadily growing heap usage |
| `layout-thrashing` | Forced synchronous layouts |
| `unoptimized-images` | Images without width/height, missing lazy loading |
| `large-images` | Oversized images for web delivery |
| `long-task-attribution` | Scripts blocking the main thread |
| `resource-bloat` | Too many or oversized resources |
| `web-essentials` | Missing viewport meta, lang attribute, etc. |

## API

### `VibeCheckEngine`

- `start()` -- Begin monitoring
- `stop()` -- Stop monitoring and clean up
- `getSnapshot(): VibeSnapshot` -- Current performance snapshot
- `onSnapshot(cb): () => void` -- Subscribe to snapshot updates (every 500ms)

### Types

All types are exported: `VibeSnapshot`, `VibeIssue`, `FrameRateStats`, `WebVitalsStats`, `ConsoleStats`, `Collector`, `Detector`, etc.

## License

MIT
