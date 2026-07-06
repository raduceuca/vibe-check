import { Node, Arrow, Label, DiagramSvg, DiagramFigure } from './primitives'

// CollectorFlow — how a snapshot becomes issues. Six collectors sample the page
// and fan in to one immutable Snapshot every 500ms; that snapshot fans out to the
// detectors, which analyze it and emit the issues your agent reads. Used on both
// the Collectors and Detectors concept pages.

const COLLECTORS = ['fps', 'loaf', 'memory', 'web vitals', 'resources', 'console']
const DETECTORS = ['dom-bloat', 'memory-leak', 'seo audit']

// Column geometry
const COL_X = 14
const COL_W = 116
const PILL_H = 26
const PILL_STEP = 40
const COL_Y0 = 16

const SNAP_X = 206
const SNAP_W = 134
const CENTER_Y = 129

const DET_X = 406
const DET_W = 150
const DET_Y = [64, 104, 144]

const ISS_X = 600
const ISS_W = 104

export const CollectorFlow = () => (
  <DiagramFigure
    maxWidth={700}
    caption="Six collectors fan in to one immutable snapshot every 500ms; the snapshot fans out to the detectors, which emit the issues your agent reads."
  >
    <DiagramSvg
      viewBox="0 0 720 300"
      minWidth={600}
      title="How a snapshot becomes issues"
      desc="The six collectors — fps, long frames, memory, web vitals, resources, console — fan in to one immutable snapshot taken every 500 milliseconds. The snapshot fans out to the detectors, which analyze it and emit issues as a VibeIssue array."
    >
      {/* Column labels */}
      <Label x={COL_X + COL_W / 2} y={8} kind="kicker">
        Collectors
      </Label>
      <Label x={DET_X + DET_W / 2} y={40} kind="kicker">
        Detectors
      </Label>

      {/* Collectors + fan-in to the snapshot */}
      {COLLECTORS.map((name, i) => {
        const y = COL_Y0 + i * PILL_STEP
        return (
          <g key={name}>
            <Node x={COL_X} y={y} w={COL_W} h={PILL_H} label={name} mono />
            <Arrow
              x1={COL_X + COL_W}
              y1={y + PILL_H / 2}
              x2={SNAP_X}
              y2={CENTER_Y}
            />
          </g>
        )
      })}

      {/* The snapshot */}
      <Node
        x={SNAP_X}
        y={97}
        w={SNAP_W}
        h={64}
        kicker="Every 500ms"
        label="Snapshot"
        detail="one immutable object"
      />

      {/* Fan-out to detectors */}
      {DETECTORS.map((name, i) => (
        <g key={name}>
          <Arrow
            x1={SNAP_X + SNAP_W}
            y1={CENTER_Y}
            x2={DET_X}
            y2={DET_Y[i] + PILL_H / 2}
          />
          <Node x={DET_X} y={DET_Y[i]} w={DET_W} h={PILL_H} label={name} mono />
          <Arrow
            x1={DET_X + DET_W}
            y1={DET_Y[i] + PILL_H / 2}
            x2={ISS_X}
            y2={CENTER_Y}
          />
        </g>
      ))}
      <Label x={DET_X + DET_W / 2} y={186} opacity={0.42}>
        + 10 more
      </Label>

      {/* Issues */}
      <Node
        x={ISS_X}
        y={97}
        w={ISS_W}
        h={64}
        kicker="Output"
        label="issues"
        detail="VibeIssue[]"
        accent="sig"
      />
    </DiagramSvg>
  </DiagramFigure>
)
