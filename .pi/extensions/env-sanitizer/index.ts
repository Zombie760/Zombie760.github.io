/**
 * Env Sanitizer Extension - Protects credentials from AI agent access
 *
 * Uses Pi's spawnHook to filter sensitive env vars from bash subprocess calls
 * while keeping them available in the main process for:
 * - Anthropic SDK (needs ANTHROPIC_API_KEY at init)
 * - GitHub CLI (needs GH_TOKEN)
 * - Other extensions that may need credentials
 *
 * Dynamically filters all keys defined in the SECRETS JSON env var.
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { createBashTool } from "@mariozechner/pi-coding-agent";

// Parse SECRETS JSON to get list of keys to filter
function getSecretKeys(): string[] {
  const keys: string[] = [];
  if (process.env.SECRETS) {
    try {
      const secrets = JSON.parse(process.env.SECRETS);
      keys.push(...Object.keys(secrets));
    } catch {
      // Invalid JSON, ignore
    }
  }
  // Always filter SECRETS itself
  keys.push("SECRETS");
  return [...new Set(keys)]; // Dedupe
}

export default function (pi: ExtensionAPI) {
  const secretKeys = getSecretKeys();

  // Override bash tool with filtered environment for subprocesses
  const bashTool = createBashTool(process.cwd(), {
    spawnHook: ({ command, cwd, env }) => {
      // Filter all secret keys from subprocess environment
      const filteredEnv = { ...env };
      for (const key of secretKeys) {
        delete filteredEnv[key];
      }
      return { command, cwd, env: filteredEnv };
    },
  });

  pi.registerTool(bashTool);

  // Notify on session start
  pi.on("session_start", async (_event, ctx) => {
    if (ctx.hasUI) {
      ctx.ui.notify(
        `Env sanitizer active: filtering ${secretKeys.length} secret keys from bash`,
        "info"
      );
    }
  });

  // Command to show protection status
  pi.registerCommand("secrets", {
    description: "Show secrets protection status",
    handler: async (_args, ctx) => {
      const status = `Env Sanitizer Active:
- Filtered from bash: ${secretKeys.join(", ")}
- Main process: credentials available for SDK/extensions`;
      if (ctx.hasUI) {
        ctx.ui.notify(status, "info");
      }
    },
  });
}
