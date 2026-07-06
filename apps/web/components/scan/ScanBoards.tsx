'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import type { ScanBoardEntry } from '@/lib/scan/types'

// ── Shared scan history: Recently scanned + Leaderboard ───────────────────────
// Two read-only feeds fetched from the scan-worker (NEXT_PUBLIC_SCAN_API). Same
// Quiet-Instrument treatment as the scorecard: mono, pure neutrals, fault-red
// only for a low score. Every host links to a fresh scan of itself. If the API
// isn't configured, the whole block renders nothing (no error, no empty state).

const API = process.env.NEXT_PUBLIC_SCAN_API

interface FeedResponse {
  readonly entries: readonly ScanBoardEntry[]
}

const timeAgo = (ms: number): string => {
  const diff = Math.max(0, Date.now() - ms)
  const s = Math.floor(diff / 1000)
  if (s < 60) return `${s}s ago`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  return `${d}d ago`
}

const pct = (score: number): number => Math.round(score * 100)

// Fault-red only when a site is badly broken; amber mid; calm ink otherwise.
const scoreTone = (score: number): string =>
  score >= 0.75 ? 'ok' : score >= 0.4 ? 'warn' : 'bad'

const rescanHref = (host: string): string => `/scan?url=${encodeURIComponent(host)}`

const fetchFeed = async (path: string): Promise<readonly ScanBoardEntry[]> => {
  const response = await fetch(`${API}${path}`, { cache: 'no-store' })
  if (!response.ok) throw new Error(`feed ${path} responded ${response.status}`)
  const data = (await response.json()) as FeedResponse
  return Array.isArray(data.entries) ? data.entries : []
}

const Scores = ({ entry }: { entry: ScanBoardEntry }) => (
  <span className="vc-board-scores">
    SEO {entry.seo.passed}/{entry.seo.total}
    <span className="vc-board-sep" aria-hidden="true">
      ·
    </span>
    AEO {entry.aeo.passed}/{entry.aeo.total}
  </span>
)

export const ScanBoards = () => {
  const [recent, setRecent] = useState<readonly ScanBoardEntry[]>([])
  const [leaders, setLeaders] = useState<readonly ScanBoardEntry[]>([])
  const [ready, setReady] = useState(false)

  const load = useCallback(async () => {
    if (!API) return
    try {
      const [recentData, leaderData] = await Promise.all([
        fetchFeed('/recent?limit=12'),
        fetchFeed('/leaderboard?limit=10'),
      ])
      setRecent(recentData)
      setLeaders(leaderData)
      setReady(true)
    } catch {
      // Best-effort: keep whatever we had, never surface an error here.
    }
  }, [])

  useEffect(() => {
    void load()
    // A scan just recorded → refresh so the fresh host shows up immediately.
    const onRecorded = () => void load()
    window.addEventListener('vc-scan-recorded', onRecorded)
    return () => window.removeEventListener('vc-scan-recorded', onRecorded)
  }, [load])

  // API unset, or nothing scanned yet → render nothing.
  if (!API || (!ready && recent.length === 0 && leaders.length === 0)) return null
  if (recent.length === 0 && leaders.length === 0) return null

  return (
    <section className="vc-boards" aria-label="Shared scan history">
      <div className="vc-board">
        <div className="vc-board-head">
          <span className="vc-board-title">Recently scanned</span>
          <span className="vc-board-sub">live feed</span>
        </div>
        <ul className="vc-board-list">
          {recent.map((entry) => (
            <li key={`recent-${entry.host}`}>
              <Link className="vc-board-row" href={rescanHref(entry.host)}>
                <span className="vc-board-host">{entry.host}</span>
                <Scores entry={entry} />
                <span className="vc-board-time">{timeAgo(entry.at)}</span>
              </Link>
            </li>
          ))}
        </ul>
      </div>

      <div className="vc-board">
        <div className="vc-board-head">
          <span className="vc-board-title">Leaderboard</span>
          <span className="vc-board-sub">top scorers</span>
        </div>
        <ul className="vc-board-list">
          {leaders.map((entry, i) => (
            <li key={`leader-${entry.host}`}>
              <Link className="vc-board-row" href={rescanHref(entry.host)}>
                <span className="vc-board-rank">{i + 1}</span>
                <span className="vc-board-host">{entry.host}</span>
                <span className="vc-board-pct" data-tone={scoreTone(entry.score)}>
                  {pct(entry.score)}%
                </span>
                <Scores entry={entry} />
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
