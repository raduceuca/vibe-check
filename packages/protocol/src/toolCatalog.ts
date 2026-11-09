// The MCP tool catalog (since 0.4): the single source for the ten tool names,
// descriptions and parameters. packages/mcp registers its tools from it, and
// the site's /.well-known/mcp.json card is generated from it, so the count and
// the wording cannot drift between code, docs and discovery.

import { DETECTOR_NAMES, SEVERITIES } from './enums.js'
import { MAX_WATCH_WAIT_SECONDS } from './timing.js'

export const MCP_TOOL_NAMES = [
  'list_projects',
  'get_project_impact',
  'get_performance_snapshot',
  'get_detected_issues',
  'get_fix_suggestions',
  'watch_performance',
  'watch_for_issue',
  'acknowledge_issue',
  'resolve_issue',
  'release_project',
] as const
export type McpToolName = (typeof MCP_TOOL_NAMES)[number]

interface McpToolParamBase {
  readonly name: string
  readonly required: boolean
  readonly description: string
}

export type McpToolParam =
  | (McpToolParamBase & { readonly kind: 'string' })
  | (McpToolParamBase & {
      readonly kind: 'number'
      readonly min: number
      readonly max: number
      readonly default: number
    })
  | (McpToolParamBase & { readonly kind: 'enum'; readonly values: readonly string[] })

export interface McpToolDescriptor {
  readonly name: McpToolName
  readonly description: string
  readonly params: readonly McpToolParam[]
  /**
   * True when the tool claims this session's exclusive project lease (or
   * requires it): it fails with 'lease-conflict' while another session holds
   * the project.
   */
  readonly claimsLease: boolean
}

const projectId: McpToolParam = {
  name: 'project_id',
  kind: 'string',
  required: false,
  description: 'Project ID from list_projects; optional when exactly one project is active',
}

const issueId: McpToolParam = {
  name: 'issue_id',
  kind: 'string',
  required: true,
  description: 'Issue id from get_detected_issues or watch_for_issue',
}

const watchTimeout = (subject: string): McpToolParam => ({
  name: 'timeout_seconds',
  kind: 'number',
  required: false,
  min: 1,
  max: 300,
  default: 30,
  description: `Seconds to wait for ${subject} (default 30). One call waits at most ${MAX_WATCH_WAIT_SECONDS} seconds; on watch-timeout, call again to keep waiting.`,
})

export const MCP_TOOL_CATALOG: readonly McpToolDescriptor[] = [
  {
    name: 'list_projects',
    description: 'List active local VibeCheck projects and their agent state',
    params: [],
    claimsLease: false,
  },
  {
    name: 'get_project_impact',
    description: 'Get persisted, browser-verified VibeCheck outcome statistics for one project',
    params: [projectId],
    claimsLease: false,
  },
  {
    name: 'get_performance_snapshot',
    description: 'Get the latest browser performance snapshot for one project',
    params: [projectId],
    claimsLease: false,
  },
  {
    name: 'get_detected_issues',
    description: 'Get active issues for one project, optionally filtered',
    params: [
      projectId,
      {
        name: 'severity',
        kind: 'enum',
        required: false,
        values: SEVERITIES,
        description: 'Only return issues with this severity',
      },
      {
        name: 'detector',
        kind: 'enum',
        required: false,
        values: DETECTOR_NAMES,
        description: 'Only return issues from this detector',
      },
    ],
    claimsLease: false,
  },
  {
    name: 'get_fix_suggestions',
    description: 'Get a fix suggestion for one detected issue',
    params: [projectId, issueId],
    claimsLease: false,
  },
  {
    name: 'watch_performance',
    description: 'Claim one project and wait for its next browser performance snapshot',
    params: [projectId, watchTimeout('the next snapshot')],
    claimsLease: true,
  },
  {
    name: 'watch_for_issue',
    description: 'Claim one project and wait for an issue explicitly sent from its widget',
    params: [projectId, watchTimeout('the next issue sent from the widget')],
    claimsLease: true,
  },
  {
    name: 'acknowledge_issue',
    description: 'Tell the widget this session is working on one issue in the project it watches',
    params: [projectId, issueId],
    claimsLease: true,
  },
  {
    name: 'resolve_issue',
    description: 'Request browser-evidence verification after fixing an issue in one project',
    params: [
      projectId,
      issueId,
      {
        name: 'wait_seconds',
        kind: 'number',
        required: false,
        min: 0,
        max: MAX_WATCH_WAIT_SECONDS,
        default: 0,
        description: `Seconds to wait for the browser's verdict (default 0 returns at once; at most ${MAX_WATCH_WAIT_SECONDS}). The issue counts as fixed only when fresh browser snapshots no longer show it.`,
      },
    ],
    claimsLease: true,
  },
  {
    name: 'release_project',
    description: 'Release this agent session\'s project lease so another session can watch it',
    params: [],
    claimsLease: false,
  },
]

export const getMcpToolDescriptor = (name: McpToolName): McpToolDescriptor => {
  const descriptor = MCP_TOOL_CATALOG.find((tool) => tool.name === name)
  if (!descriptor) throw new Error(`Unknown VibeCheck MCP tool: ${name}`)
  return descriptor
}
