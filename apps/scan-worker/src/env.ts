// Worker bindings. DB is the D1 database; SCAN_SECRET guards the write path;
// ALLOWED_ORIGIN is the production site origin permitted to read the feeds.
export interface Env {
  readonly DB: D1Database
  readonly SCAN_SECRET: string
  readonly ALLOWED_ORIGIN?: string
}
