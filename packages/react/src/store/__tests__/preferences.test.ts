import { beforeEach, describe, expect, it } from 'vitest'
import {
  DEFAULT_PREFERENCES_KEY,
  readPreferences,
  resolvePreferencesKey,
  writePreferences,
} from '../preferences.js'

describe('widget preferences', () => {
  beforeEach(() => localStorage.clear())

  it('scopes the default key by project while preserving explicit keys', () => {
    expect(resolvePreferencesKey(undefined, 'storefront')).toBe('vibe-check:preferences:storefront')
    expect(resolvePreferencesKey(undefined, undefined)).toBe(DEFAULT_PREFERENCES_KEY)
    expect(resolvePreferencesKey('custom', 'storefront')).toBe('custom')
  })

  it('uses startCollapsed only before a saved choice exists', () => {
    const key = resolvePreferencesKey(undefined, 'storefront')
    expect(readPreferences(key, true).collapsed).toBe(true)

    writePreferences({ ...readPreferences(key, true), collapsed: false }, key)

    expect(readPreferences(key, true).collapsed).toBe(false)
  })

  it('migrates old and malformed placement fields safely', () => {
    const key = resolvePreferencesKey(undefined, 'storefront')
    localStorage.setItem(key, JSON.stringify({
      mode: 'technical',
      collapsedPosition: 'middle',
      expandedPosition: 42,
      positionsLinked: 'yes',
    }))

    expect(readPreferences(key, false)).toMatchObject({
      mode: 'technical',
      collapsed: false,
      positionsLinked: true,
      collapsedPosition: null,
      expandedPosition: null,
    })
  })

  it('keeps saved state isolated between projects', () => {
    const storefront = resolvePreferencesKey(undefined, 'storefront')
    const admin = resolvePreferencesKey(undefined, 'admin')
    writePreferences({
      ...readPreferences(storefront, false),
      collapsed: true,
      collapsedPosition: 'top-left',
    }, storefront)

    expect(readPreferences(storefront, false)).toMatchObject({
      collapsed: true,
      collapsedPosition: 'top-left',
    })
    expect(readPreferences(admin, false)).toMatchObject({
      collapsed: false,
      collapsedPosition: null,
    })
  })
})
