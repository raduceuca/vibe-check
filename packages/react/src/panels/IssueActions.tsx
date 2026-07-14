import { useState } from 'react'
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
import { Button } from './ui/Button.js'
import { CopyButton } from './ui/CopyButton.js'

type DeliveryState = DispatchIssueResponse['code'] | 'idle' | 'sending'

const DISPATCH_TIMEOUT_MS = 10_000

interface IssueActionsProps {
  readonly tracked: TrackedIssue
  readonly mode: SuggestionMode
  readonly copiedId: string | null
  readonly beaconStatus: BeaconStatus | null
  readonly onCopy: (text: string, id: string) => Promise<boolean>
  readonly onDispatch: (issue: VibeIssue) => Promise<DispatchIssueResponse>
  readonly onMarkSent: (issueId: string) => void
  readonly onMarkResolved?: (issueId: string) => void
  readonly workflow?: TrackedProjectIssue | null
  readonly onRequestVerification?: (issueId: string) => Promise<void>
}

const DELIVERY_LABEL: Partial<Record<DeliveryState, string>> = {
  dispatched: 'sent',
  'agent-not-watching': 'agent not watching',
  'queue-full': 'queue full',
  'hub-offline': 'MCP server offline',
  'invalid-issue': 'invalid issue',
  failed: 'send failed',
  unconfigured: 'MCP not configured',
}

const dispatchTitle = (status: BeaconStatus | null, canDispatch: boolean): string => {
  if (canDispatch) return 'Send this issue to the connected agent'
  if (!status) return 'Configure beaconUrl before sending to an agent'
  if (status.lastOk !== true) return 'Start the local MCP hub before sending'
  return 'Connect one agent watcher before sending'
}

const ResolveIcon = () => (
  <svg width={12} height={12} viewBox="0 0 16 16" fill="none">
    <path
      d="M3.5 8.5L6.5 11.5L12.5 4.5"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
)

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
}: IssueActionsProps) => {
  const [delivery, setDelivery] = useState<DeliveryState>('idle')
  const [verification, setVerification] = useState<'idle' | 'requesting' | 'failed'>('idle')
  const suggestion = getSuggestionCached(tracked.issue, mode)
  const canDispatch = beaconStatus?.lastOk === true
    && (beaconStatus.projectStatus?.state === 'watching'
      || beaconStatus.projectStatus?.state === 'busy')
  const workflowSent = workflow?.phase === 'sent'
    || workflow?.phase === 'working'
    || workflow?.phase === 'verifying'
    || workflow?.phase === 'fixed'
  const sent = tracked.status === 'sent-to-agent' || workflowSent || delivery === 'dispatched'
  const fixed = tracked.status === 'resolved' || workflow?.phase === 'fixed'

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
    setVerification('requesting')
    try {
      await onRequestVerification(tracked.issue.id)
      setVerification('idle')
    } catch {
      setVerification('failed')
    }
  }

  const deliveryLabel = DELIVERY_LABEL[delivery]

  return (
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
          title={sent ? 'This issue was sent to the connected agent' : dispatchTitle(beaconStatus, canDispatch)}
        >
          {delivery === 'sending'
            ? 'Sending…'
            : workflow?.phase === 'working'
              ? 'With agent'
              : workflow?.phase === 'verifying'
                ? 'Verifying'
                : sent ? 'Sent' : 'Send to agent'}
        </Button>
      )}
      <CopyButton
        copied={copiedId === tracked.issue.id}
        onClick={() => { void onCopy(suggestion.prompt, tracked.issue.id) }}
        label="Copy prompt"
      />
      {onRequestVerification && workflow && !fixed ? (
        <Button
          variant="success"
          size="sm"
          disabled={workflow.phase === 'verifying' || verification === 'requesting'}
          onClick={(event) => {
            event.stopPropagation()
            void handleVerification()
          }}
          icon={<ResolveIcon />}
        >
          {workflow.phase === 'verifying' || verification === 'requesting'
            ? (mode === 'vibe' ? 'checking fix…' : 'verifying…')
            : (mode === 'vibe' ? 'check this fix' : 'verify fix')}
        </Button>
      ) : onMarkResolved && !fixed && (
        <Button
          variant="success"
          size="sm"
          onClick={(event) => {
            event.stopPropagation()
            onMarkResolved(tracked.issue.id)
          }}
          icon={<ResolveIcon />}
        >
          {mode === 'vibe' ? 'mark as fixed' : 'resolve'}
        </Button>
      )}
      {verification === 'failed' && (
        <span role="status" style={{ color: T.red, fontSize: 13 }}>
          verification failed
        </span>
      )}
      {deliveryLabel && delivery !== 'sending' && (
        <span
          role="status"
          style={{ color: delivery === 'dispatched' ? T.green : T.red, fontSize: 13 }}
        >
          {deliveryLabel}
        </span>
      )}
    </div>
  )
}
