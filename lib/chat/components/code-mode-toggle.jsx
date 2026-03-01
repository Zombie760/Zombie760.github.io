'use client';

import { useState, useEffect, useCallback } from 'react';
import { CodeIcon } from './icons.js';
import { Combobox } from './ui/combobox.js';
import { cn } from '../utils.js';

/**
 * Code mode toggle with repo/branch pickers.
 *
 * @param {object} props
 * @param {boolean} props.enabled - Whether code mode is on
 * @param {Function} props.onToggle - Toggle callback
 * @param {string} props.repo - Selected repo
 * @param {Function} props.onRepoChange - Repo change callback
 * @param {string} props.branch - Selected branch
 * @param {Function} props.onBranchChange - Branch change callback
 * @param {boolean} props.locked - Whether the controls are locked (after first message)
 * @param {boolean} props.featureEnabled - Whether the feature flag is enabled
 * @param {Function} props.getRepositories - Server action to fetch repos
 * @param {Function} props.getBranches - Server action to fetch branches
 */
export function CodeModeToggle({
  enabled,
  onToggle,
  repo,
  onRepoChange,
  branch,
  onBranchChange,
  locked,
  featureEnabled,
  getRepositories,
  getBranches,
}) {
  const [repos, setRepos] = useState([]);
  const [branches, setBranches] = useState([]);
  const [loadingRepos, setLoadingRepos] = useState(false);
  const [loadingBranches, setLoadingBranches] = useState(false);
  const [reposLoaded, setReposLoaded] = useState(false);

  if (!featureEnabled) return null;

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

  // Locked mode: show as static labels
  if (locked && enabled) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <div className={cn(
          'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium',
          'bg-primary text-primary-foreground'
        )}>
          <CodeIcon size={12} />
          <span>Claude Code</span>
        </div>
        {repo && (
          <span className="text-xs text-muted-foreground">
            {repo}
          </span>
        )}
        {branch && (
          <span className="text-xs text-muted-foreground">
            {branch}
          </span>
        )}
      </div>
    );
  }

  const repoOptions = repos.map((r) => ({ value: r.full_name, label: r.full_name }));
  const branchOptions = branches.map((b) => ({ value: b.name, label: b.name }));

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={handleToggle}
        className={cn(
          'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors self-start',
          enabled
            ? 'bg-primary text-primary-foreground'
            : 'border border-border text-muted-foreground hover:text-foreground hover:border-foreground/30'
        )}
      >
        <CodeIcon size={12} />
        <span>Claude Code</span>
      </button>

      {enabled && (
        <div className="flex flex-wrap gap-2">
          <div className="w-full sm:w-auto sm:min-w-[220px]">
            <Combobox
              options={repoOptions}
              value={repo}
              onChange={onRepoChange}
              placeholder="Select repository..."
              loading={loadingRepos}
            />
          </div>
          {repo && (
            <div className="w-full sm:w-auto sm:min-w-[180px]">
              <Combobox
                options={branchOptions}
                value={branch}
                onChange={onBranchChange}
                placeholder="Select branch..."
                loading={loadingBranches}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
