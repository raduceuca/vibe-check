import { VibeCheck } from '@wcgw/vibe-check'

export const App = () => (
  <main>
    <h1>VibeCheck MCP fixture</h1>
    <div id="bloated-tree">
      {Array.from({ length: 1600 }, (_, index) => <span key={index}>node {index}</span>)}
    </div>
    <VibeCheck
      beaconUrl={import.meta.env.VITE_HUB_URL}
      projectId={window.location.origin}
    />
  </main>
)
