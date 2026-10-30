import { describe, expect, it } from 'vitest'
import {
  HUB_ERROR_CODES,
  isHostHeaderAllowed,
  isJsonContentType,
  isLoopbackHostname,
  isLoopbackOrigin,
  isOriginAllowed,
  normalizeOriginPattern,
  parseAllowedOrigins,
  safeDecodePathSegments,
} from '../index.js'

describe('loopback detection', () => {
  it('recognises loopback hostnames', () => {
    for (const host of ['localhost', 'LOCALHOST', 'app.localhost', '127.0.0.1', '127.1.2.3', '::1', '[::1]', 'localhost.']) {
      expect(isLoopbackHostname(host)).toBe(true)
    }
    for (const host of ['localhost.evil.example', 'evil.example', '128.0.0.1', '127.0.0.256', '0.0.0.0', '10.0.0.1']) {
      expect(isLoopbackHostname(host)).toBe(false)
    }
  })

  it('recognises loopback origins on any port', () => {
    expect(isLoopbackOrigin('http://localhost:5173')).toBe(true)
    expect(isLoopbackOrigin('https://shop.localhost')).toBe(true)
    expect(isLoopbackOrigin('http://[::1]:3000')).toBe(true)
    expect(isLoopbackOrigin('https://evil.example')).toBe(false)
    expect(isLoopbackOrigin('null')).toBe(false)
    expect(isLoopbackOrigin('file://')).toBe(false)
  })
})

describe('origin allowlist (MCP-01)', () => {
  it('normalizes patterns and rejects anything that is not an origin', () => {
    expect(normalizeOriginPattern('HTTP://MyApp.test:3000/')).toBe('http://myapp.test:3000')
    expect(normalizeOriginPattern('https://myapp.test:443')).toBe('https://myapp.test')
    expect(normalizeOriginPattern('https://*.example.test')).toBe('https://*.example.test')
    expect(normalizeOriginPattern('http://192.168.1.5:*')).toBe('http://192.168.1.5:*')
    expect(normalizeOriginPattern('*')).toBeNull()
    expect(normalizeOriginPattern('myapp.test')).toBeNull()
    expect(normalizeOriginPattern('https://myapp.test/path')).toBeNull()
    expect(normalizeOriginPattern('ftp://myapp.test')).toBeNull()
    expect(normalizeOriginPattern('http://myapp.test:99999')).toBeNull()
  })

  it('parses env and repeated flags, dropping invalid entries and duplicates', () => {
    expect(parseAllowedOrigins('http://myapp.test:3000, https://*.example.test  bogus,http://myapp.test:3000'))
      .toEqual(['http://myapp.test:3000', 'https://*.example.test'])
    expect(parseAllowedOrigins(['http://a.test', 'http://b.test:8080'])).toEqual(['http://a.test', 'http://b.test:8080'])
    expect(parseAllowedOrigins(undefined)).toEqual([])
  })

  it('always allows loopback, allows listed origins, and refuses everything else', () => {
    const allowlist = parseAllowedOrigins('http://myapp.test:3000,https://*.example.test,http://192.168.1.5:*')
    expect(isOriginAllowed('http://localhost:5173')).toBe(true)
    expect(isOriginAllowed('http://myapp.test:3000', allowlist)).toBe(true)
    expect(isOriginAllowed('http://myapp.test:3001', allowlist)).toBe(false)
    expect(isOriginAllowed('https://a.example.test', allowlist)).toBe(true)
    expect(isOriginAllowed('https://a.b.example.test', allowlist)).toBe(true)
    expect(isOriginAllowed('https://example.test', allowlist)).toBe(false)
    expect(isOriginAllowed('http://a.example.test', allowlist)).toBe(false)
    expect(isOriginAllowed('http://192.168.1.5:5173', allowlist)).toBe(true)
    expect(isOriginAllowed('https://evil.example', allowlist)).toBe(false)
    expect(isOriginAllowed('null', allowlist)).toBe(false)
    expect(isOriginAllowed(undefined, allowlist)).toBe(false)
  })
})

describe('Host header check (DNS rebinding)', () => {
  it('accepts loopback names on the hub port only', () => {
    expect(isHostHeaderAllowed('127.0.0.1:4200', 4200)).toBe(true)
    expect(isHostHeaderAllowed('localhost:4200', 4200)).toBe(true)
    expect(isHostHeaderAllowed('[::1]:4200', 4200)).toBe(true)
    expect(isHostHeaderAllowed('app.localhost:4200', 4200)).toBe(true)
    expect(isHostHeaderAllowed('127.0.0.1:4201', 4200)).toBe(false)
    expect(isHostHeaderAllowed('rebind.evil.example:4200', 4200)).toBe(false)
    expect(isHostHeaderAllowed(undefined, 4200)).toBe(false)
    expect(isHostHeaderAllowed('localhost', 80)).toBe(true)
  })

  it('accepts explicitly allowed hosts', () => {
    expect(isHostHeaderAllowed('192.168.1.5:4200', 4200, ['192.168.1.5'])).toBe(true)
    expect(isHostHeaderAllowed('192.168.1.5:4300', 4200, ['192.168.1.5:4300'])).toBe(true)
    expect(isHostHeaderAllowed('192.168.1.5:4201', 4200, ['192.168.1.5'])).toBe(false)
  })
})

describe('request parsing helpers', () => {
  it('decodes path segments without throwing on malformed escapes (MCP-02)', () => {
    expect(safeDecodePathSegments('/api/projects/my%20app/status')).toEqual(['api', 'projects', 'my app', 'status'])
    expect(safeDecodePathSegments('/%')).toBeNull()
    expect(safeDecodePathSegments('/api/projects/%E0%A4%A/status')).toBeNull()
  })

  it('requires a JSON content type', () => {
    expect(isJsonContentType('application/json')).toBe(true)
    expect(isJsonContentType('Application/JSON; charset=utf-8')).toBe(true)
    expect(isJsonContentType('text/plain')).toBe(false)
    expect(isJsonContentType(undefined)).toBe(false)
  })

  it('names the hub error codes the widget and CLI map to plain language', () => {
    expect(HUB_ERROR_CODES).toContain('origin-not-allowed')
    expect(HUB_ERROR_CODES).toContain('host-not-allowed')
    expect(HUB_ERROR_CODES).toContain('payload-too-large')
    expect(new Set(HUB_ERROR_CODES).size).toBe(HUB_ERROR_CODES.length)
  })
})
