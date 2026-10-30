import { describe, expect, it } from 'vitest'
import {
  DETECTOR_NAMES,
  MAX_WATCH_WAIT_SECONDS,
  MCP_TOOL_CATALOG,
  MCP_TOOL_NAMES,
  SEVERITIES,
  getMcpToolDescriptor,
} from '../index.js'

const BANNED = /\b(proof|press check|plate|register|cmyk|crop|quiet instrument)\b/i

describe('MCP_TOOL_CATALOG', () => {
  it('lists exactly the ten tools, once each, in catalog order', () => {
    expect(MCP_TOOL_NAMES).toHaveLength(10)
    expect(MCP_TOOL_CATALOG.map((tool) => tool.name)).toEqual([...MCP_TOOL_NAMES])
    expect(new Set(MCP_TOOL_NAMES).size).toBe(10)
  })

  it('describes resolve_issue as a verification request, never as marking it fixed (SITE-05)', () => {
    expect(getMcpToolDescriptor('resolve_issue').description)
      .toBe('Request browser-evidence verification after fixing an issue in one project')
    for (const tool of MCP_TOOL_CATALOG) {
      expect(tool.description).not.toMatch(/mark(s|ed)? .*(resolved|fixed)/i)
    }
  })

  it('uses plain language in every description and parameter', () => {
    for (const tool of MCP_TOOL_CATALOG) {
      expect(tool.description.length).toBeGreaterThan(10)
      expect(tool.description).not.toMatch(BANNED)
      for (const param of tool.params) expect(param.description).not.toMatch(BANNED)
    }
  })

  it('flags exactly the tools that claim the project lease', () => {
    const claiming = MCP_TOOL_CATALOG.filter((tool) => tool.claimsLease).map((tool) => tool.name)
    expect(claiming).toEqual(['watch_performance', 'watch_for_issue', 'acknowledge_issue', 'resolve_issue'])
  })

  it('carries enough parameter detail to build the bridge schemas', () => {
    const issues = getMcpToolDescriptor('get_detected_issues')
    expect(issues.params.map((param) => param.name)).toEqual(['project_id', 'severity', 'detector'])
    const severity = issues.params[1]
    const detector = issues.params[2]
    expect(severity?.kind === 'enum' ? severity.values : null).toEqual(SEVERITIES)
    expect(detector?.kind === 'enum' ? detector.values : null).toEqual(DETECTOR_NAMES)

    const watch = getMcpToolDescriptor('watch_for_issue').params.find((param) => param.name === 'timeout_seconds')
    expect(watch).toMatchObject({ kind: 'number', min: 1, max: 300, default: 30, required: false })

    const wait = getMcpToolDescriptor('resolve_issue').params.find((param) => param.name === 'wait_seconds')
    expect(wait).toMatchObject({ kind: 'number', min: 0, max: MAX_WATCH_WAIT_SECONDS, default: 0, required: false })

    for (const tool of MCP_TOOL_CATALOG) {
      const projectParam = tool.params.find((param) => param.name === 'project_id')
      if (projectParam) expect(projectParam.required).toBe(false)
      const issueParam = tool.params.find((param) => param.name === 'issue_id')
      if (issueParam) expect(issueParam).toMatchObject({ kind: 'string', required: true })
    }
  })
})
