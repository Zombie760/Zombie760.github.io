'use client';

import { useState, useEffect, useCallback } from 'react';
import { GitBranchIcon } from './icons.js';
import { Combobox } from './ui/combobox.js';
import { cn } from '../utils.js';

/**
 * Code mode toggle with repo/branch pickers.
 * When locked (after first message), shows branch bar + headless/interactive toggle.
 *
 * @param {object} props
 * @param {boolean} props.enabled - Whether code mode is on
 * @param {Function} props.onToggle - Toggle callback
 * @param {string} props.repo - Selected repo
 * @param {Function} props.onRepoChange - Repo change callback
 * @param {string} props.branch - Selected branch
 * @param {Function} props.onBranchChange - Branch change callback
 * @param {boolean} props.locked - Whether the controls are locked (after first message)
 * @param {Function} props.getRepositories - Server action to fetch repos
 * @param {Function} props.getBranches - Server action to fetch branches
 * @param {object} [props.workspace] - Workspace object (id, repo, branch, containerName, featureBranch)
 * @param {boolean} [props.isInteractiveActive] - Whether interactive container is running
 */
export function CodeModeToggle({
  enabled,
  onToggle,
  repo,
  onRepoChange,
  branch,
  onBranchChange,
  locked,
  getRepositories,
  getBranches,
  workspace,
  isInteractiveActive,
}) {
  const [repos, setRepos] = useState([]);
  const [branches, setBranches] = useState([]);
  const [loadingRepos, setLoadingRepos] = useState(false);
  const [loadingBranches, setLoadingBranches] = useState(false);
  const [reposLoaded, setReposLoaded] = useState(false);
  const [closingInteractive, setClosingInteractive] = useState(false);

  // Load repos on first toggle-on
  const handleToggle = useCallback(() => {
    if (locked) return;
    const next = !enabled;
    onToggle(next);
    if (next && !reposLoaded) {
      setLoadingRepos(true);
      getRepositories().then((data) => {
        setRepos(data || []);
        setReposLoaded(true);
        setLoadingRepos(false);
      }).catch(() => setLoadingRepos(false));
    }
    if (!next) {
      onRepoChange('');
      onBranchChange('');
      setBranches([]);
    }
  }, [locked, enabled, reposLoaded, onToggle, onRepoChange, onBranchChange, getRepositories]);

  // Load branches when repo changes
  useEffect(() => {
    if (!repo || locked) return;
    setLoadingBranches(true);
    setBranches([]);
    getBranches(repo).then((data) => {
      const branchList = data || [];
      setBranches(branchList);
      // Auto-select default branch
      const defaultBranch = branchList.find((b) => b.isDefault);
      if (defaultBranch) {
        onBranchChange(defaultBranch.name);
      }
      setLoadingBranches(false);
    }).catch(() => setLoadingBranches(false));
  }, [repo]);

  const handleCloseInteractive = useCallback(async () => {
    if (!workspace?.id || closingInteractive) return;
    setClosingInteractive(true);
    try {
      const { closeInteractiveMode } = await import('../../code/actions.js');
      await closeInteractiveMode(workspace.id);
      window.location.reload();
    } catch (err) {
      console.error('Failed to close interactive mode:', err);
      setClosingInteractive(false);
    }
  }, [workspace?.id, closingInteractive]);

  if (!process.env.NEXT_PUBLIC_CODE_WORKSPACE) return null;

  // Locked mode: show branch bar with feature branch + mode toggle
  if (locked && enabled) {
    const featureBranch = workspace?.featureBranch;
    // Truncate long branch names
    const truncate = (str, max = 30) => str && str.length > max ? str.slice(0, max) + '...' : str;

    return (
      <div className="flex items-center justify-between gap-2 text-sm min-w-0">
        {/* Left: branch flow */}
        <div className="flex items-center gap-1.5 text-muted-foreground min-w-0 overflow-hidden">
          <GitBranchIcon size={14} className="shrink-0" />
          {repo && <span className="shrink-0 truncate max-w-[160px]" title={repo}>{repo}</span>}
          {branch && (
            <>
              <span className="shrink-0 text-muted-foreground/50">&rarr;</span>
              <span className="shrink-0 font-medium text-foreground" title={branch}>{truncate(branch, 20)}</span>
            </>
          )}
          {featureBranch && (
            <>
              <span className="shrink-0 text-muted-foreground/50">&rarr;</span>
              <span className="shrink-0 text-primary truncate max-w-[200px]" title={featureBranch}>{truncate(featureBranch)}</span>
            </>
          )}
        </div>

        {/* Right: mode indicator */}
        <div className="flex items-center gap-2 shrink-0">
          {isInteractiveActive ? (
            <button
              type="button"
              onClick={handleCloseInteractive}
              disabled={closingInteractive}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-colors',
                'bg-primary/10 text-primary hover:bg-primary/20',
                closingInteractive && 'opacity-50 cursor-not-allowed'
              )}
            >
              <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
              {closingInteractive ? 'Closing...' : 'Interactive'}
            </button>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
              Headless
            </span>
          )}
        </div>
      </div>
    );
  }

  const repoOptions = repos.map((r) => ({ value: r.full_name, label: r.full_name }));
  const branchOptions = branches.map((b) => ({ value: b.name, label: b.name }));

  return (
    <div className="flex flex-wrap items-center justify-center gap-3">
      {/* Slide toggle + label */}
      <button
        type="button"
        onClick={handleToggle}
        className="inline-flex items-center gap-2 group"
        role="switch"
        aria-checked={enabled}
        aria-label="Toggle Code mode"
      >
        {/* Track */}
        <span
          className={cn(
            'relative inline-flex h-5 w-9 shrink-0 rounded-full transition-colors duration-200',
            enabled ? 'bg-primary' : 'bg-muted-foreground/30'
          )}
        >
          {/* Knob */}
          <span
            className={cn(
              'absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform duration-200',
              enabled && 'translate-x-4'
            )}
          />
        </span>
        {/* Label */}
        <span className={cn(
          'text-xs font-medium transition-colors',
          enabled ? 'text-foreground' : 'text-muted-foreground group-hover:text-foreground'
        )}>
          Code
        </span>
      </button>

      {/* Repo/branch pickers — inline, both always visible */}
      {enabled && (
        <>
          <div className="w-full sm:w-auto sm:min-w-[220px]">
            <Combobox
              options={repoOptions}
              value={repo}
              onChange={onRepoChange}
              placeholder="Select repository..."
              loading={loadingRepos}
            />
          </div>
          <div className={cn("w-full sm:w-auto sm:min-w-[180px]", !repo && "opacity-50 pointer-events-none")}>
            <Combobox
              options={branchOptions}
              value={branch}
              onChange={onBranchChange}
              placeholder="Select branch..."
              loading={loadingBranches}
            />
          </div>
        </>
      )}
    </div>
  );
}
