import { useId, useState } from 'react'
import type {
  BeaconStatus,
  DispatchIssueResponse,
  TrackedProjectIssue,
  SuggestionMode,
  VibeIssue,
} from '@wcgw/vibe-check-core'
import type { TrackedIssue } from '../store/issueStore.js'
import { T } from '../tokens.js'
import { getSuggestionCached } from './suggestionCache.js'
import { actionBlockedReason, canSendToAgent, getAgentDisplayStateFor } from './AgentConnectionStatus.js'
import { Button } from './ui/Button.js'
import { CopyButton } from './ui/CopyButton.js'

type DeliveryState = DispatchIssueResponse['code'] | 'idle' | 'sending'

type VerificationState =
  | { readonly kind: 'idle' }
  | { readonly kind: 'requesting' }
  | { readonly kind: 'requested' }
  | { readonly kind: 'failed'; readonly message: string }

const DISPATCH_TIMEOUT_MS = 10_000

export const DISMISS_TITLE = 'Hide this issue. Without a hub, nothing gets verified.'

interface IssueActionsProps {
  readonly tracked: TrackedIssue
  readonly mode: SuggestionMode
  readonly copiedId: string | null
  readonly beaconStatus: BeaconStatus | null
  readonly onCopy: (text: string, id: string) => Promise<boolean>
  readonly onDispatch: (issue: VibeIssue) => Promise<DispatchIssueResponse>
  readonly onMarkSent: (issueId: string) => void
  /** Local dismiss, offered only when no hub is configured. */
  readonly onMarkResolved?: (issueId: string) => void
  readonly workflow?: TrackedProjectIssue | null
  /** Asks the hub to verify a fix with fresh browser evidence. */
  readonly onRequestVerification?: (issueId: string) => Promise<void>
  /**
   * True when the widget has a beaconUrl and a projectId. Without a hub the
   * resolve action is an honest "dismiss"; with one it is "check this fix".
   * Defaults to whether a beacon status exists.
   */
  readonly hubConfigured?: boolean
}

// The status line after a send. A queued issue is not delivered, so it never
// reads "sent".
const DELIVERY_LABEL: Partial<Record<DeliveryState, string>> = {
  dispatched: 'sent to agent',
  queued: 'queued for agent',
  'agent-not-watching': 'agent not watching',
  'queue-full': 'queue full',
  'hub-offline': 'MCP server offline',
  'invalid-issue': 'the hub does not know this issue yet',
  'origin-not-allowed': 'the hub refused this page',
  failed: 'send failed',
  unconfigured: 'MCP not configured',
}

const deliveryColor = (delivery: DeliveryState): string => {
  if (delivery === 'dispatched') return T.green
  if (delivery === 'queued') return T.blue
  return T.red
}

const ResolveIcon = () => (
  <svg width={12} height={12} viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <path
      d="M3.5 8.5L6.5 11.5L12.5 4.5"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
)

const sendLabel = (
  delivery: DeliveryState,
  workflow: TrackedProjectIssue | null,
  locallySent: boolean,
): string => {
  if (delivery === 'sending') return 'Sending…'
  if (workflow?.phase === 'working') return 'With agent'
  if (workflow?.phase === 'verifying') return 'Verifying'
  if (delivery === 'dispatched') return 'Sent'
  if (delivery === 'queued' || workflow?.phase === 'sent') return 'Queued'
  if (locallySent) return 'Sent'
  return 'Send to agent'
}

export const IssueActions = ({
  tracked,
  mode,
  copiedId,
  beaconStatus,
  onCopy,
  onDispatch,
  onMarkSent,
  onMarkResolved,
  workflow = null,
  onRequestVerification,
  hubConfigured = beaconStatus !== null,
}: IssueActionsProps) => {
  const reasonId = useId()
  const [delivery, setDelivery] = useState<DeliveryState>('idle')
  const [verification, setVerification] = useState<VerificationState>({ kind: 'idle' })
  const suggestion = getSuggestionCached(tracked.issue, mode)
  const displayState = getAgentDisplayStateFor(hubConfigured, beaconStatus)
  const canDispatch = canSendToAgent(beaconStatus)
  const hubReachable = beaconStatus?.lastOk === true
  const workflowSent = workflow?.phase === 'sent'
    || workflow?.phase === 'working'
    || workflow?.phase === 'verifying'
    || workflow?.phase === 'fixed'
  const sent = tracked.status === 'sent-to-agent' || workflowSent
    || delivery === 'dispatched' || delivery === 'queued'
  const fixed = tracked.status === 'resolved' || workflow?.phase === 'fixed'
  const offersCheck = hubConfigured && onRequestVerification !== undefined
  const offersDismiss = !hubConfigured && onMarkResolved !== undefined

  // One visible sentence explains a disabled action, so keyboard and screen
  // reader users get the reason too (a title on a disabled button is unreachable).
  const blockedReason = actionBlockedReason(displayState) ?? 'Checking the hub…'
  const sendBlocked = !fixed && !sent && !canDispatch
  const checkBlocked = !fixed && offersCheck && !hubReachable
  const reason = sendBlocked || checkBlocked ? blockedReason : null

  const handleDispatch = async (): Promise<void> => {
    setDelivery('sending')
    let timeoutId: ReturnType<typeof setTimeout> | undefined
    try {
      const timeout = new Promise<never>((_resolve, reject) => {
        timeoutId = setTimeout(() => reject(new Error('dispatch timed out')), DISPATCH_TIMEOUT_MS)
      })
      const result = await Promise.race([onDispatch(tracked.issue), timeout])
      setDelivery(result.code)
      if (result.ok) onMarkSent(tracked.issue.id)
    } catch {
      setDelivery('failed')
    } finally {
      if (timeoutId !== undefined) clearTimeout(timeoutId)
    }
  }

  const handleVerification = async (): Promise<void> => {
    if (!onRequestVerification) return
    setVerification({ kind: 'requesting' })
    try {
      await onRequestVerification(tracked.issue.id)
      setVerification({ kind: 'requested' })
    } catch (error) {
      setVerification({
        kind: 'failed',
        message: error instanceof Error && error.message ? error.message : 'The hub could not start the check.',
      })
    }
  }

  const deliveryLabel = DELIVERY_LABEL[delivery]
  const checking = workflow?.phase === 'verifying'
    || verification.kind === 'requesting'
    || (verification.kind === 'requested' && workflow === null)

  return (
    <div>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
        {!fixed && (
          <Button
            size="sm"
            disabled={!canDispatch || delivery === 'sending' || sent}
            onClick={(event) => {
              event.stopPropagation()
              void handleDispatch()
            }}
            testId={`vibe-check-send-${tracked.issue.id}`}
            describedBy={sendBlocked ? reasonId : undefined}
          >
            {sendLabel(delivery, workflow, tracked.status === 'sent-to-agent')}
          </Button>
        )}
        <CopyButton
          copied={copiedId === tracked.issue.id}
          onClick={() => { void onCopy(suggestion.prompt, tracked.issue.id) }}
          label="Copy prompt"
        />
        {!fixed && offersCheck && (
          <Button
            variant="success"
            size="sm"
            disabled={checkBlocked || checking}
            onClick={(event) => {
              event.stopPropagation()
              void handleVerification()
            }}
            icon={<ResolveIcon />}
            describedBy={checkBlocked ? reasonId : undefined}
          >
            {checking
              ? (mode === 'vibe' ? 'checking fix…' : 'verifying…')
              : (mode === 'vibe' ? 'check this fix' : 'verify fix')}
          </Button>
        )}
        {!fixed && offersDismiss && (
          <Button
            size="sm"
            onClick={(event) => {
              event.stopPropagation()
              onMarkResolved?.(tracked.issue.id)
            }}
            title={DISMISS_TITLE}
          >
            dismiss
          </Button>
        )}
        {deliveryLabel && delivery !== 'sending' && (
          <span role="status" style={{ color: deliveryColor(delivery), fontSize: 14 }}>
            {deliveryLabel}
          </span>
        )}
      </div>
      {reason && (
        <div id={reasonId} style={{ color: T.textTertiary, fontSize: 14, lineHeight: 1.45, marginTop: 6 }}>
          {reason}
        </div>
      )}
      {verification.kind === 'failed' && (
        <div role="status" style={{ color: T.red, fontSize: 14, lineHeight: 1.45, marginTop: 6 }}>
          {verification.message}
        </div>
      )}
    </div>
  )
}
