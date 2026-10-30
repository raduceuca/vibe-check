export const GET = (): Response => {
  const body = `# Next.js App Router, checked

This example is what passing looks like on a real App Router site. Four vibes
pass. Quotable keeps one info-level miss — \`mcp-discovery-missing\` — because
this site does not invent an MCP server.

Open the widget with Alt+Shift+V. The pill should read **1 problem**.
`
  return new Response(body, {
    headers: { 'Content-Type': 'text/markdown; charset=utf-8' },
  })
}
