'use client';

import { useState, useEffect, useCallback } from 'react';
import { GitPullRequestIcon } from './icons.js';
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

  if (!featureEnabled) return null;

  // Locked mode: show as centered inline label
  if (locked && enabled) {
    return (
      <div className="flex justify-center">
        <div className="inline-flex items-center gap-2.5 text-sm text-muted-foreground">
          {repo && (
            <>
              <GitPullRequestIcon size={14} />
              <span>{repo}</span>
            </>
          )}
          {branch && (
            <>
              <span className="opacity-40">·</span>
              <span>{branch}</span>
            </>
          )}
        </div>
      </div>
    );
  }

  const repoOptions = repos.map((r) => ({ value: r.full_name, label: r.full_name }));
  const branchOptions = branches.map((b) => ({ value: b.name, label: b.name }));

  return (
    <div className="flex flex-col items-center gap-2">
      {/* Slide toggle + label */}
      <button
        type="button"
        onClick={handleToggle}
        className="inline-flex items-center gap-2 group"
        role="switch"
        aria-checked={enabled}
        aria-label="Toggle Claude Code mode"
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
          Claude Code
        </span>
      </button>

      {/* Repo/branch pickers */}
      {enabled && (
        <div className="flex flex-wrap justify-center gap-2">
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
