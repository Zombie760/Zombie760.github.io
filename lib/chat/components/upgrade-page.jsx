'use client';

import { useState, useEffect } from 'react';
import { PageLayout } from './page-layout.js';
import { ArrowUpCircleIcon, SpinnerIcon, CheckIcon } from './icons.js';
import { getAppVersion, triggerUpgrade } from '../actions.js';

export function UpgradePage({ session }) {
  const [version, setVersion] = useState('');
  const [updateAvailable, setUpdateAvailable] = useState(null);
  const [loading, setLoading] = useState(true);
  const [upgrading, setUpgrading] = useState(false);
  const [result, setResult] = useState(null); // 'success' | 'error'

  useEffect(() => {
    getAppVersion()
      .then(({ version, updateAvailable }) => {
        setVersion(version);
        setUpdateAvailable(updateAvailable);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleUpgrade = async () => {
    setUpgrading(true);
    setResult(null);
    try {
      await triggerUpgrade();
      setResult('success');
    } catch {
      setResult('error');
    } finally {
      setUpgrading(false);
    }
  };

  return (
    <PageLayout session={session}>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">Upgrade</h1>
      </div>

      {loading ? (
        <div className="flex flex-col gap-4">
          <div className="h-32 animate-pulse rounded-md bg-border/50" />
        </div>
      ) : (
        <div className="flex flex-col gap-6 max-w-lg">
          {/* Version info card */}
          <div className="rounded-md border bg-card p-6">
            <div className="flex items-center gap-3 mb-4">
              <ArrowUpCircleIcon size={24} />
              <div>
                <p className="text-sm text-muted-foreground">Installed version</p>
                <p className="text-lg font-mono font-semibold">v{version}</p>
              </div>
            </div>

            {updateAvailable ? (
              <div className="rounded-md border border-blue-500/30 bg-blue-500/5 p-4 mb-4">
                <p className="text-sm font-medium">
                  Version <span className="font-mono text-blue-500">v{updateAvailable}</span> is available
                </p>
              </div>
            ) : (
              <div className="rounded-md border border-green-500/30 bg-green-500/5 p-4 mb-4">
                <p className="text-sm font-medium text-green-600 dark:text-green-400">
                  You are on the latest version
                </p>
              </div>
            )}

            {/* Upgrade button */}
            {updateAvailable && (
              <button
                onClick={handleUpgrade}
                disabled={upgrading || result === 'success'}
                className="w-full inline-flex items-center justify-center gap-2 rounded-md px-4 py-2.5 text-sm font-medium bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-50 disabled:pointer-events-none"
              >
                {upgrading ? (
                  <>
                    <SpinnerIcon size={16} />
                    Triggering upgrade...
                  </>
                ) : result === 'success' ? (
                  <>
                    <CheckIcon size={16} />
                    Upgrade triggered
                  </>
                ) : (
                  <>
                    <ArrowUpCircleIcon size={16} />
                    Upgrade to v{updateAvailable}
                  </>
                )}
              </button>
            )}

            {/* Feedback */}
            {result === 'success' && (
              <p className="text-xs text-muted-foreground mt-3">
                The upgrade workflow has been triggered. The server will update, rebuild, and reload automatically. This page will reflect the new version once the process completes.
              </p>
            )}
            {result === 'error' && (
              <p className="text-xs text-red-500 mt-3">
                Failed to trigger the upgrade workflow. Check that your GitHub token has workflow permissions.
              </p>
            )}
          </div>

          {/* What happens during upgrade */}
          {updateAvailable && (
            <div className="rounded-md border bg-card p-6">
              <h2 className="text-sm font-medium mb-3">What happens during an upgrade</h2>
              <ul className="text-sm text-muted-foreground space-y-2">
                <li className="flex gap-2">
                  <span className="text-muted-foreground/60">1.</span>
                  <span>The <code className="text-xs bg-muted px-1 py-0.5 rounded">upgrade-event-handler</code> GitHub Actions workflow is triggered</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-muted-foreground/60">2.</span>
                  <span>The package is updated via <code className="text-xs bg-muted px-1 py-0.5 rounded">npm update thepopebot</code></span>
                </li>
                <li className="flex gap-2">
                  <span className="text-muted-foreground/60">3.</span>
                  <span>A new build is created alongside the current one</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-muted-foreground/60">4.</span>
                  <span>The builds are atomically swapped and the server reloads</span>
                </li>
              </ul>
            </div>
          )}
        </div>
      )}
    </PageLayout>
  );
}
