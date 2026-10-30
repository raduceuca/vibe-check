// Leaf module: the timing contract shared by the hub, the bridge, the widget
// and user-facing copy (since 0.4). The hub must import these rather than
// redefine them, so the lease-conflict message and the widget never disagree
// with the hub's behaviour.

/** A lease with no heartbeat for this long is released. */
export const LEASE_EXPIRE_MS = 15_000

/** 'watching' persists this long after a watch_for_issue call ends without a dispatch. */
export const WATCH_GRACE_MS = 5_000

/** A delivered dispatch with no bridge receipt for this long is re-queued at the front. */
export const DELIVERY_ACK_TIMEOUT_MS = 15_000

/**
 * Longest single long-poll the bridge holds open. MCP clients commonly time a
 * request out after 60 s, so longer waits are split and the agent calls again.
 */
export const MAX_WATCH_WAIT_SECONDS = 55
