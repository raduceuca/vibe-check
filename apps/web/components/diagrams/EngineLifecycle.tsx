import { Node, Arrow, Label, DiagramSvg, DiagramFigure } from './primitives'

// EngineLifecycle — the engine as a loop. start() enters a three-step cycle that
// repeats every 500ms — collect → build snapshot → onSnapshot(cb) — and stop()
// tears it down. The three nodes sit at the corners of a triangle so the
// directional arrows read unmistakably as a cycle.

export const EngineLifecycle = () => (
  <DiagramFigure
    maxWidth={480}
    caption="start() enters the loop; every 500ms the engine collects, builds a snapshot, and notifies subscribers; stop() tears it down in reverse."
  >
    <DiagramSvg
      viewBox="0 0 480 268"
      minWidth={360}
      title="The VibeCheckEngine lifecycle loop"
      desc="Calling start() begins a cycle that repeats every 500 milliseconds: collect reads all six collectors, build snapshot assembles and runs the detectors, and onSnapshot notifies subscribers, then the cycle repeats. Calling stop() ends the loop."
    >
      {/* start() → into the loop */}
      <Node x={14} y={14} w={104} h={34} label="start()" mono />
      <Arrow x1={100} y1={48} x2={166} y2={70} />

      {/* stop() ← out of the loop */}
      <Node x={362} y={14} w={104} h={34} label="stop()" mono />
      <Arrow dashed x1={408} y1={200} x2={416} y2={50} />

      {/* Cycle: collect → build snapshot → onSnapshot(cb) → collect */}
      <Node
        x={165}
        y={56}
        w={150}
        h={52}
        kicker="Step 1"
        label="collect"
        detail="read all six"
      />
      <Node
        x={285}
        y={200}
        w={170}
        h={52}
        kicker="Step 2"
        label="build snapshot"
        detail="assemble + detect"
      />
      <Node
        x={25}
        y={200}
        w={170}
        h={52}
        kicker="Step 3"
        label="onSnapshot(cb)"
        detail="notify subscribers"
        mono
      />

      <Arrow x1={272} y1={108} x2={345} y2={200} />
      <Arrow x1={285} y1={226} x2={197} y2={226} />
      <Arrow x1={133} y1={200} x2={208} y2={108} />

      {/* Center hint */}
      <Label x={240} y={165} opacity={0.5}>
        repeats
      </Label>
      <Label x={240} y={181} opacity={0.5}>
        every 500ms
      </Label>
    </DiagramSvg>
  </DiagramFigure>
)
