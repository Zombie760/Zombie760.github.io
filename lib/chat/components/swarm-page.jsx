'use client';

import { useState, useEffect, useCallback } from 'react';
import { PageLayout } from './page-layout.js';
import { SpinnerIcon, RefreshIcon } from './icons.js';
import { getSwarmStatus } from '../actions.js';

// ─────────────────────────────────────────────────────────────────────────────
// Utilities
// ─────────────────────────────────────────────────────────────────────────────

function formatDuration(seconds) {
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (minutes < 60) return `${minutes}m ${secs}s`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours}h ${mins}m`;
}

function timeAgo(timestamp) {
  const seconds = Math.floor((Date.now() - new Date(timestamp).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

function LoadingSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3">
        {[...Array(2)].map((_, i) => (
          <div key={i} className="h-20 animate-pulse rounded-md bg-border/50" />
        ))}
      </div>
      <div className="h-8 w-32 animate-pulse rounded-md bg-border/50" />
      {[...Array(3)].map((_, i) => (
        <div key={i} className="h-14 animate-pulse rounded-md bg-border/50" />
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Summary Cards
// ─────────────────────────────────────────────────────────────────────────────

function SwarmSummaryCards({ counts }) {
  const cards = [
    { label: 'Running', value: counts.running, color: 'border-l-green-500', text: 'text-green-500' },
    { label: 'Queued', value: counts.queued, color: 'border-l-yellow-500', text: 'text-yellow-500' },
  ];

  return (
    <div className="grid grid-cols-2 gap-3">
      {cards.map((card) => (
        <div
          key={card.label}
          className={`rounded-md border border-l-4 ${card.color} bg-card p-4`}
        >
          <p className="text-xs text-muted-foreground uppercase tracking-wide">{card.label}</p>
          <p className={`text-2xl font-bold mt-1 ${card.text}`}>{card.value}</p>
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Unified Workflow List
// ─────────────────────────────────────────────────────────────────────────────

const conclusionBadgeStyles = {
  success: 'bg-green-500/10 text-green-500',
  failure: 'bg-red-500/10 text-red-500',
  cancelled: 'bg-yellow-500/10 text-yellow-500',
  skipped: 'bg-muted text-muted-foreground',
};

function SwarmWorkflowList({ runs }) {
  if (!runs || runs.length === 0) {
    return (
      <div className="text-sm text-muted-foreground py-4 text-center">
        No workflow runs.
      </div>
    );
  }

  return (
    <div className="flex flex-col divide-y divide-border">
      {runs.map((run) => {
        const isActive = run.status === 'in_progress' || run.status === 'queued';
        const isRunning = run.status === 'in_progress';
        const isQueued = run.status === 'queued';

        return (
          <div key={run.run_id} className="flex items-center gap-3 py-3 px-1">
            {/* Status indicator */}
            {isRunning && (
              <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-full bg-green-500 animate-pulse" />
            )}
            {isQueued && (
              <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-full bg-yellow-500" />
            )}
            {!isActive && (
              <span
                className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium uppercase shrink-0 ${
                  conclusionBadgeStyles[run.conclusion] || 'bg-muted text-muted-foreground'
                }`}
              >
                {run.conclusion || 'unknown'}
              </span>
            )}

            {/* Workflow name */}
            <span className="text-sm font-medium truncate">
              {run.workflow_name || run.branch}
            </span>

            {/* Duration or time ago */}
            <span className="text-xs text-muted-foreground shrink-0">
              {isActive
                ? formatDuration(run.duration_seconds)
                : timeAgo(run.updated_at || run.started_at)}
            </span>

            {/* Spacer */}
            <div className="flex-1" />

            {/* Link */}
            {run.html_url && (
              <a
                href={run.html_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-blue-500 hover:underline shrink-0"
              >
                View
              </a>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Page
// ─────────────────────────────────────────────────────────────────────────────

export function SwarmPage({ session }) {
  const [runs, setRuns] = useState([]);
  const [counts, setCounts] = useState({ running: 0, queued: 0 });
  const [hasMore, setHasMore] = useState(false);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const fetchStatus = useCallback(async () => {
    try {
      const data = await getSwarmStatus();
      setCounts(data.counts || { running: 0, queued: 0 });
      setHasMore(data.hasMore || false);
      // On auto-refresh, replace page 1 runs but keep any loaded beyond page 1
      setRuns((prev) => {
        const firstPage = data.runs || [];
        if (page <= 1) return firstPage;
        const beyondPage1 = prev.slice(firstPage.length);
        return [...firstPage, ...beyondPage1];
      });
      setPage((prev) => Math.max(prev, 1));
    } catch (err) {
      console.error('Failed to fetch swarm status:', err);
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 10000);
    return () => clearInterval(interval);
  }, [fetchStatus]);

  const handleRefresh = async () => {
    setRefreshing(true);
    setPage(1);
    try {
      const data = await getSwarmStatus();
      setCounts(data.counts || { running: 0, queued: 0 });
      setRuns(data.runs || []);
      setHasMore(data.hasMore || false);
    } catch (err) {
      console.error('Failed to fetch swarm status:', err);
    }
    setRefreshing(false);
  };

  const handleLoadMore = async () => {
    const nextPage = page + 1;
    setLoadingMore(true);
    try {
      const data = await getSwarmStatus(nextPage);
      setRuns((prev) => [...prev, ...(data.runs || [])]);
      setHasMore(data.hasMore || false);
      setPage(nextPage);
    } catch (err) {
      console.error('Failed to load more:', err);
    }
    setLoadingMore(false);
  };

  return (
    <PageLayout session={session}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">Swarm</h1>
        {!loading && (
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium border border-border bg-background text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-50 disabled:pointer-events-none"
          >
            {refreshing ? (
              <>
                <SpinnerIcon size={14} />
                Refreshing...
              </>
            ) : (
              <>
                <RefreshIcon size={14} />
                Refresh
              </>
            )}
          </button>
        )}
      </div>

      {loading ? (
        <LoadingSkeleton />
      ) : (
        <div className="flex flex-col gap-6">
          {/* Summary Cards */}
          <SwarmSummaryCards counts={counts} />

          {/* Workflow Runs */}
          <div>
            <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide mb-3">
              Workflow Runs
            </h2>
            <SwarmWorkflowList runs={runs} />
            {hasMore && (
              <div className="flex justify-center mt-4">
                <button
                  onClick={handleLoadMore}
                  disabled={loadingMore}
                  className="inline-flex items-center gap-1.5 rounded-md px-4 py-2 text-sm font-medium border border-border bg-background text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-50 disabled:pointer-events-none"
                >
                  {loadingMore ? (
                    <>
                      <SpinnerIcon size={14} />
                      Loading...
                    </>
                  ) : (
                    'Load more'
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </PageLayout>
  );
}
