'use client';

import { useState, useEffect, useRef } from 'react';
import { ClusterIcon, TrashIcon, SearchIcon, PlusIcon, PencilIcon } from '../../chat/components/icons.js';
import { getClusters, deleteCluster, renameCluster, starCluster, createCluster } from '../actions.js';
import { ConfirmDialog } from '../../chat/components/ui/confirm-dialog.js';
import { cn } from '../../chat/utils.js';

function groupByDate(items) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 86400000);
  const last7Days = new Date(today.getTime() - 7 * 86400000);
  const last30Days = new Date(today.getTime() - 30 * 86400000);

  const groups = {
    Starred: [],
    Today: [],
    Yesterday: [],
    'Last 7 Days': [],
    'Last 30 Days': [],
    Older: [],
  };

  for (const item of items) {
    if (item.starred) {
      groups.Starred.push(item);
      continue;
    }
    const date = new Date(item.updatedAt);
    if (date >= today) groups.Today.push(item);
    else if (date >= yesterday) groups.Yesterday.push(item);
    else if (date >= last7Days) groups['Last 7 Days'].push(item);
    else if (date >= last30Days) groups['Last 30 Days'].push(item);
    else groups.Older.push(item);
  }

  return groups;
}

function timeAgo(date) {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
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

export function ClustersPage() {
  const [clusters, setClusters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');

  const loadClusters = async () => {
    try {
      const result = await getClusters();
      setClusters(result);
    } catch (err) {
      console.error('Failed to load clusters:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadClusters();
  }, []);

  const handleCreate = async () => {
    const cluster = await createCluster();
    window.location.href = `/cluster/${cluster.id}`;
  };

  const handleDelete = async (clusterId) => {
    setClusters((prev) => prev.filter((c) => c.id !== clusterId));
    const { success } = await deleteCluster(clusterId);
    if (!success) loadClusters();
  };

  const handleStar = async (clusterId) => {
    setClusters((prev) =>
      prev.map((c) => (c.id === clusterId ? { ...c, starred: c.starred ? 0 : 1 } : c))
    );
    const { success } = await starCluster(clusterId);
    if (!success) loadClusters();
  };

  const handleRename = async (clusterId, name) => {
    setClusters((prev) =>
      prev.map((c) => (c.id === clusterId ? { ...c, name } : c))
    );
    const { success } = await renameCluster(clusterId, name);
    if (!success) loadClusters();
  };

  const filtered = query
    ? clusters.filter((c) => c.name?.toLowerCase().includes(query.toLowerCase()))
    : clusters;

  const grouped = groupByDate(filtered);

  return (
    <>
      {/* Actions bar */}
      <div className="flex items-center justify-between mb-4">
        <div className="relative flex-1 max-w-sm">
          <input
            type="text"
            placeholder="Search clusters..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full rounded-md border border-input bg-background px-9 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none">
            <SearchIcon size={16} />
          </div>
        </div>
        <button
          onClick={handleCreate}
          className="inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium bg-foreground text-background hover:bg-foreground/90"
        >
          <PlusIcon size={16} />
          New cluster
        </button>
      </div>

      <p className="text-sm text-muted-foreground mb-4">
        {filtered.length} {filtered.length === 1 ? 'cluster' : 'clusters'}
      </p>

      {loading ? (
        <div className="flex flex-col gap-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-14 animate-pulse rounded-md bg-border/50" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">
          {query ? 'No clusters match your search.' : 'No clusters yet. Create one to get started!'}
        </p>
      ) : (
        <div className="flex flex-col">
          {Object.entries(grouped).map(([label, groupItems]) =>
            groupItems.length > 0 ? (
              <div key={label} className="mb-4">
                <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                  {label}
                </h2>
                <div className="flex flex-col divide-y divide-border">
                  {groupItems.map((cluster) => (
                    <ClusterRow
                      key={cluster.id}
                      cluster={cluster}
                      onDelete={handleDelete}
                      onStar={handleStar}
                      onRename={handleRename}
                    />
                  ))}
                </div>
              </div>
            ) : null
          )}
        </div>
      )}
    </>
  );
}

function ClusterRow({ cluster, onDelete, onStar, onRename }) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(cluster.name || '');
  const inputRef = useRef(null);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  const startRename = () => {
    setEditName(cluster.name || '');
    setEditing(true);
  };

  const saveRename = () => {
    const trimmed = editName.trim();
    if (trimmed && trimmed !== cluster.name) {
      onRename(cluster.id, trimmed);
    }
    setEditing(false);
  };

  const cancelRename = () => {
    setEditing(false);
    setEditName(cluster.name || '');
  };

  return (
    <>
      <a
        href={`/cluster/${cluster.id}/console`}
        className="relative group flex items-center gap-3 px-3 py-3 cursor-pointer hover:bg-muted/50 rounded-md"
        style={{ textDecoration: 'inherit', color: 'inherit' }}
        onClick={(e) => {
          if (editing) { e.preventDefault(); return; }
        }}
      >
        <ClusterIcon size={16} />
        <div className="flex-1 min-w-0">
          {editing ? (
            <input
              ref={inputRef}
              type="text"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') saveRename();
                if (e.key === 'Escape') cancelRename();
              }}
              onBlur={saveRename}
              onClick={(e) => e.stopPropagation()}
              className="w-full text-sm bg-background border border-input rounded px-1.5 py-0.5 focus:outline-none focus:ring-2 focus:ring-ring"
            />
          ) : (
            <span className="text-sm truncate block">
              {cluster.name || 'New Cluster'}
            </span>
          )}
          <span className="text-xs text-muted-foreground">
            Updated {timeAgo(cluster.updatedAt)}
          </span>
        </div>
        {!editing && (
          <div className="shrink-0 flex items-center gap-1">
            <button
              className="rounded-md p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted"
              aria-label="Rename"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                startRename();
              }}
            >
              <PencilIcon size={16} />
            </button>
            <button
              className="rounded-md p-1.5 text-muted-foreground hover:text-destructive hover:bg-muted"
              aria-label="Delete"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setConfirmDelete(true);
              }}
            >
              <TrashIcon size={16} />
            </button>
          </div>
        )}
      </a>
      <ConfirmDialog
        open={confirmDelete}
        title="Delete cluster?"
        description="This will permanently delete this cluster and all its workers."
        confirmLabel="Delete"
        onConfirm={() => {
          setConfirmDelete(false);
          onDelete(cluster.id);
        }}
        onCancel={() => setConfirmDelete(false)}
      />
    </>
  );
}
