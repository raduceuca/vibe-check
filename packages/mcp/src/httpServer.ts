import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http'
import type { VibeSnapshot } from './types.js'

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

const JSON_HEADERS: Record<string, string> = {
  ...CORS_HEADERS,
  'Content-Type': 'application/json',
}

const SSE_HEADERS: Record<string, string> = {
  ...CORS_HEADERS,
  'Content-Type': 'text/event-stream',
  'Cache-Control': 'no-cache',
  'Connection': 'keep-alive',
}

type SnapshotListener = (snapshot: VibeSnapshot) => void

export interface HttpServerContext {
  readonly onSnapshot: (listener: SnapshotListener) => () => void
  readonly notifySnapshot: (snapshot: VibeSnapshot) => void
  readonly server: Server
}

const MAX_BODY_BYTES = 1_048_576

const readBody = (req: IncomingMessage): Promise<string> =>
  new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    let totalBytes = 0
    req.on('data', (chunk: Buffer) => {
      totalBytes += chunk.length
      if (totalBytes > MAX_BODY_BYTES) {
        req.destroy()
        reject(new Error('Request body too large'))
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')))
    req.on('error', reject)
  })

const isValidSnapshot = (data: unknown): data is VibeSnapshot => {
  if (typeof data !== 'object' || data === null) return false
  const obj = data as Record<string, unknown>
  return (
    typeof obj['timestamp'] === 'number' &&
    typeof obj['domNodeCount'] === 'number' &&
    typeof obj['frameRate'] === 'object' &&
    obj['frameRate'] !== null &&
    typeof obj['resources'] === 'object' &&
    obj['resources'] !== null &&
    Array.isArray(obj['issues'])
  )
}

const sendJson = (res: ServerResponse, status: number, body: unknown): void => {
  res.writeHead(status, JSON_HEADERS)
  res.end(JSON.stringify(body))
}

const handleOptions = (res: ServerResponse): void => {
  res.writeHead(204, CORS_HEADERS)
  res.end()
}

const MAX_SSE_CONNECTIONS = 10

export const createHttpServer = (
  onSnapshotReceived: (snapshot: VibeSnapshot) => void,
): HttpServerContext => {
  const listeners = new Set<SnapshotListener>()

  const onSnapshot = (listener: SnapshotListener): (() => void) => {
    listeners.add(listener)
    return () => { listeners.delete(listener) }
  }

  const notifySnapshot = (snapshot: VibeSnapshot): void => {
    for (const listener of listeners) {
      listener(snapshot)
    }
  }

  const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    const method = req.method ?? 'GET'
    const url = req.url ?? '/'

    if (method === 'OPTIONS') {
      handleOptions(res)
      return
    }

    if (url === '/api/health' && method === 'GET') {
      sendJson(res, 200, { status: 'ok' })
      return
    }

    if (url === '/api/snapshot' && method === 'POST') {
      try {
        const body = await readBody(req)
        const parsed: unknown = JSON.parse(body)

        if (!isValidSnapshot(parsed)) {
          sendJson(res, 400, { error: 'Invalid snapshot format' })
          return
        }

        onSnapshotReceived(parsed)
        notifySnapshot(parsed)
        sendJson(res, 200, { received: true })
      } catch {
        sendJson(res, 400, { error: 'Invalid JSON body' })
      }
      return
    }

    if (url === '/api/stream' && method === 'GET') {
      if (listeners.size >= MAX_SSE_CONNECTIONS) {
        sendJson(res, 503, { error: 'Too many SSE connections' })
        return
      }

      res.writeHead(200, SSE_HEADERS)
      res.write('data: {"connected":true}\n\n')

      const unsubscribe = onSnapshot((snapshot) => {
        res.write(`data: ${JSON.stringify(snapshot)}\n\n`)
      })

      req.on('close', () => {
        unsubscribe()
      })
      return
    }

    sendJson(res, 404, { error: 'Not found' })
  })

  return { onSnapshot, notifySnapshot, server }
}
