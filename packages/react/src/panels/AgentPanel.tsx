import { memo, useId, useState } from 'react'
import type {
  BeaconStatus,
  DispatchIssueResponse,
  IssuePhase,
  ProjectImpactSummary,
  ProjectWorkflow,
  SuggestionMode,
  TrackedProjectIssue,
  VibeIssue,
} from '@wcgw/vibe-check-core'
import { getAgentPrompt } from '@wcgw/vibe-check-core'
import type { TrackedIssue } from '../store/issueStore.js'
import { T } from '../tokens.js'
import { getSuggestionCached } from './suggestionCache.js'
import { IssueActions } from './IssueActions.js'
import { CopyButton } from './ui/CopyButton.js'
import { Row } from './ui/Row.js'
import { Button } from './ui/Button.js'
import { SectionHeader } from './ui/SectionHeader.js'
import { EmptyState } from './ui/EmptyState.js'
import { Tabs, tabId, type TabItem } from './ui/Tabs.js'
import { AgentConnectionStatus, getAgentDisplayState } from './AgentConnectionStatus.js'
import { IssueProgress } from './IssueProgress.js'
import { ImpactCard } from './ImpactCard.js'

interface AgentPanelProps {
  readonly tracked: readonly TrackedIssue[]
  readonly workflow?: ProjectWorkflow | null
  readonly workflowStale?: boolean
  readonly impact?: ProjectImpactSummary | null
  readonly mode: SuggestionMode
  readonly copiedId: string | null
  readonly onCopy: (text: string, id: string) => Promise<boolean>
  readonly beaconUrl?: string
  readonly beaconStatus: BeaconStatus | null
  readonly onDispatch: (issue: VibeIssue) => Promise<DispatchIssueResponse>
  readonly onMarkSent: (issueId: string) => void
  readonly onMarkResolved: (issueId: string) => void
  readonly onRequestVerification?: (issueId: string) => Promise<void>
  readonly onClearResolved: () => void
  readonly onHideFixed?: (issueKeys: readonly string[]) => void
  /** beaconUrl and projectId are both set (see IssueActions). */
  readonly hubConfigured?: boolean
}

type TabKey = 'active' | 'progress' | 'resolved'

interface PanelIssue {
  readonly tracked: TrackedIssue
  readonly workflow: TrackedProjectIssue | null
}

export const queueForPhase = (phase: IssuePhase): TabKey => {
  if (phase === 'fixed') return 'resolved'
  if (phase === 'sent' || phase === 'working' || phase === 'verifying') return 'progress'
  return 'active'
}

const localFromWorkflow = (workflow: TrackedProjectIssue): TrackedIssue => ({
  issue: workflow.issue,
  status: workflow.phase === 'fixed'
    ? 'resolved'
    : queueForPhase(workflow.phase) === 'progress'
      ? 'sent-to-agent'
      : 'new',
  firstSeen: workflow.firstSeenAt,
  lastSeen: workflow.lastSeenAt,
  sentAt: workflow.events.find((event) => event.type === 'sent')?.at ?? null,
  resolvedAt: workflow.events.find((event) => event.type === 'fixed')?.at ?? null,
})

// Evidence that tells two same-titled issues apart (the URL, image, script,
// selector or library they are about), shortened to its distinctive end.
const DISTINGUISHING_EVIDENCE = ['url', 'src', 'sourceURL', 'selector', 'library', 'method', 'check'] as const

export const issueDistinguisher = (issue: VibeIssue): string | null => {
  for (const key of DISTINGUISHING_EVIDENCE) {
    const value = issue.evidence[key]
    if (typeof value === 'string' && value.length > 0) {
      const bare = value.replace(/^[a-z][a-z0-9+.-]*:\/\//i, '')
      return bare.length > 36 ? `…${bare.slice(-35)}` : bare
    }
  }
  return null
}

const IssueRow = ({
  tracked,
  mode,
  copiedId,
  onCopy,
  beaconStatus,
  onDispatch,
  onMarkSent,
  onMarkResolved,
  workflow,
  onRequestVerification,
  hubConfigured,
  titleSuffix,
}: {
  readonly tracked: TrackedIssue
  readonly workflow: TrackedProjectIssue | null
  readonly mode: SuggestionMode
  readonly copiedId: string | null
  readonly onCopy: (text: string, id: string) => Promise<boolean>
  readonly beaconStatus: BeaconStatus | null
  readonly onDispatch: (issue: VibeIssue) => Promise<DispatchIssueResponse>
  readonly onMarkSent: (issueId: string) => void
  readonly onMarkResolved: (issueId: string) => void
  readonly onRequestVerification?: (issueId: string) => Promise<void>
  readonly hubConfigured?: boolean
  readonly titleSuffix?: string | null
}) => {
  const { issue } = tracked
  const suggestion = getSuggestionCached(issue, mode)
  const isResolved = tracked.status === 'resolved'

  return (
    <Row
      severity={issue.severity}
      title={`${mode === 'vibe' ? suggestion.title : issue.title}${titleSuffix ? ` · ${titleSuffix}` : ''}`}
      titleColor={isResolved ? T.textMuted : undefined}
      strikethrough={isResolved}
    >
      {workflow && <IssueProgress tracked={workflow} mode={mode} />}
      <div style={{
        fontSize: 14, color: T.textTertiary,
        lineHeight: 1.55, marginBottom: 10, paddingLeft: 2,
      }}>
        {suggestion.explanation}
      </div>

      <IssueActions
        tracked={tracked}
        mode={mode}
        copiedId={copiedId}
        beaconStatus={beaconStatus}
        onCopy={onCopy}
        onDispatch={onDispatch}
        onMarkSent={onMarkSent}
        onMarkResolved={onMarkResolved}
        workflow={workflow}
        onRequestVerification={onRequestVerification}
        hubConfigured={hubConfigured}
      />
    </Row>
  )
}

export const AgentPanel = memo(({
  tracked, workflow = null, workflowStale = false, impact = null, mode, copiedId, onCopy,
  beaconUrl, beaconStatus, onDispatch, onMarkSent, onMarkResolved,
  onRequestVerification, onClearResolved, onHideFixed, hubConfigured = Boolean(beaconUrl),
}: AgentPanelProps) => {
  const [activeTab, setActiveTab] = useState<TabKey>('active')
  const queueTabsId = useId()
  const queuePanelId = `${queueTabsId}-panel`

  const panelIssues: readonly PanelIssue[] = workflow
    ? workflow.issues.map((item) => ({ tracked: localFromWorkflow(item), workflow: item }))
    : tracked.map((item) => ({ tracked: item, workflow: null }))
  const queueFor = (item: PanelIssue): TabKey => item.workflow
    ? queueForPhase(item.workflow.phase)
    : item.tracked.status === 'resolved'
      ? 'resolved'
      : item.tracked.status === 'sent-to-agent'
        ? 'progress'
        : 'active'
  const active = panelIssues.filter((item) => queueFor(item) === 'active')
  const progress = panelIssues.filter((item) => queueFor(item) === 'progress')
  const resolved = panelIssues.filter((item) => queueFor(item) === 'resolved')

  const tabIssues: Record<TabKey, readonly PanelIssue[]> = { active, progress, resolved }
  const currentIssues = tabIssues[activeTab]

  // Vibe titles describe the problem, not the instance, so two duplicate
  // requests read the same. Add what tells them apart when titles collide.
  const vibeTitleCounts = new Map<string, number>()
  if (mode === 'vibe') {
    for (const item of currentIssues) {
      const title = getSuggestionCached(item.tracked.issue, 'vibe').title
      vibeTitleCounts.set(title, (vibeTitleCounts.get(title) ?? 0) + 1)
    }
  }
  const titleSuffixFor = (issue: VibeIssue): string | null => {
    if (mode !== 'vibe') return null
    const title = getSuggestionCached(issue, 'vibe').title
    if ((vibeTitleCounts.get(title) ?? 0) < 2) return null
    return issueDistinguisher(issue) ?? issue.title
  }

  const tabItems: readonly TabItem[] = [
    { key: 'active', content: mode === 'vibe' ? `to fix (${active.length})` : `active (${active.length})` },
    { key: 'progress', content: `in progress (${progress.length})` },
    { key: 'resolved', content: mode === 'vibe' ? `fixed (${resolved.length})` : `resolved (${resolved.length})` },
  ]

  const handleCopyAll = async () => {
    const issues = currentIssues.map((item) => item.tracked.issue)
    const prompt = getAgentPrompt(issues, mode)
    await onCopy(prompt, 'all')
  }

  const displayState = getAgentDisplayState(beaconUrl, beaconStatus)
  const agentReady = displayState === 'connected' || displayState === 'busy'
  const leadWithIssues = agentReady && active.length > 0

  return (
    <div style={{ paddingTop: 4 }}>
      <AgentConnectionStatus
        mode={mode}
        beaconUrl={beaconUrl}
        status={beaconStatus}
        compactWhenReady={leadWithIssues}
      />
      {impact && !leadWithIssues && (
        <ImpactCard
          impact={impact}
          compact={false}
          onCopy={(text) => onCopy(text, 'impact-summary')}
        />
      )}
      <SectionHeader
        count={active.length}
        action={currentIssues.length > 0 ? (
          <CopyButton
            copied={copiedId === 'all'}
            onClick={handleCopyAll}
            size="sm"
            label={mode === 'vibe' ? 'copy all' : 'copy all prompts'}
          />
        ) : undefined}
      >
        {mode === 'vibe' ? 'AI Fixes' : 'Agent Queue'}
      </SectionHeader>

      {workflowStale && workflow && (
        <div role="status" style={{ color: T.yellow, fontSize: 14, margin: '-2px 0 8px' }}>
          last known progress — hub offline
        </div>
      )}

      <Tabs
        items={tabItems}
        activeKey={activeTab}
        onSelect={(k) => setActiveTab(k as TabKey)}
        variant="underline"
        edge="bottom"
        hairline
        ariaLabel="Issue queues"
        idBase={queueTabsId}
        panelId={queuePanelId}
        tabStyle={{ padding: '8px 0 10px', minHeight: 40, whiteSpace: 'nowrap' }}
        containerStyle={{ marginBottom: 10 }}
      />

      <div role="tabpanel" id={queuePanelId} aria-labelledby={tabId(queueTabsId, activeTab)}>
        {currentIssues.length === 0 ? (
          <EmptyState
            showDot={activeTab === 'active'}
            label={activeTab === 'active'
              ? (mode === 'vibe' ? 'All good! No problems found' : 'No active issues')
              : activeTab === 'progress'
                ? (mode === 'vibe' ? 'Nothing in progress yet' : 'No agent work in progress')
                : (mode === 'vibe' ? 'Nothing fixed yet' : 'No resolved issues')}
          />
        ) : (
          <div>
            {currentIssues.map((item) => (
              <IssueRow
                key={item.workflow?.issueKey ?? item.tracked.issue.id}
                tracked={item.tracked} workflow={item.workflow} mode={mode} copiedId={copiedId}
                onCopy={onCopy} beaconStatus={beaconStatus} onDispatch={onDispatch}
                onMarkSent={onMarkSent} onMarkResolved={onMarkResolved}
                onRequestVerification={onRequestVerification}
                hubConfigured={hubConfigured}
                titleSuffix={titleSuffixFor(item.tracked.issue)}
              />
            ))}
          </div>
        )}
      </div>

      {activeTab === 'resolved' && resolved.length > 0 && (
        <div style={{ marginTop: 8 }}>
          <Button
            variant="ghost"
            fullWidth
            onClick={() => {
              if (workflow && onHideFixed) {
                onHideFixed(resolved.flatMap((item) => item.workflow?.issueKey ?? []))
              } else {
                onClearResolved()
              }
            }}
          >
            {mode === 'vibe' ? 'clear all fixed issues' : 'clear resolved'}
          </Button>
        </div>
      )}
      {impact && leadWithIssues && (
        <div style={{ marginTop: 12 }}>
          <ImpactCard
            impact={impact}
            compact
            onCopy={(text) => onCopy(text, 'impact-summary')}
          />
        </div>
      )}
    </div>
  )
})
