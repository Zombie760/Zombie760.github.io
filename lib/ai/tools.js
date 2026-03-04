import fs from 'fs';
import path from 'path';
import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { createJob } from '../tools/create-job.js';
import { getJobStatus } from '../tools/github.js';
import { claudeMd, skillGuidePath, skillsDir } from '../paths.js';

const createJobTool = tool(
  async ({ job_description }) => {
    const result = await createJob(job_description);
    return JSON.stringify({
      success: true,
      job_id: result.job_id,
      branch: result.branch,
      title: result.title,
    });
  },
  {
    name: 'create_job',
    description:
      'Create an autonomous job that runs a Docker agent in a container. The Docker agent has full filesystem access, web search, browser automation, and other abilities. The job description you provide becomes the Docker agent\'s task prompt. Returns the job ID and branch name.',
    schema: z.object({
      job_description: z
        .string()
        .describe(
          'Detailed job description including context and requirements. Be specific about what needs to be done.'
        ),
    }),
  }
);

const getJobStatusTool = tool(
  async ({ job_id }) => {
    const result = await getJobStatus(job_id);
    return JSON.stringify(result);
  },
  {
    name: 'get_job_status',
    description:
      'Check status of running jobs. Returns list of active workflow runs with timing and current step. Use when user asks about job progress, running jobs, or job status.',
    schema: z.object({
      job_id: z
        .string()
        .optional()
        .describe(
          'Optional: specific job ID to check. If omitted, returns all running jobs.'
        ),
    }),
  }
);

const getSystemTechnicalSpecsTool = tool(
  async () => {
    try {
      return fs.readFileSync(claudeMd, 'utf8');
    } catch {
      return 'No technical documentation found (CLAUDE.md not present in project root).';
    }
  },
  {
    name: 'get_system_technical_specs',
    description:
      'Read the system architecture and technical documentation (CLAUDE.md). You MUST call this before modifying any config file (CRONS.json, TRIGGERS.json, etc.) or system infrastructure — config entries have advanced fields (per-entry LLM overrides, webhook options, etc.) that are only documented here. Also use this when you need to understand how the system works — event handler, Docker agent, API routes, database, GitHub Actions, deployment, or file structure. NOT for skill creation (use get_skill_building_guide for that).',
    schema: z.object({}),
  }
);

/**
 * Scan skills/ for all skill directories and build an inventory
 * showing which are active vs available (inactive).
 */
function loadSkillInventory() {
  const activeDir = path.join(skillsDir, 'active');
  const SKIP = new Set(['active', 'LICENSE', 'README.md', '.git', '.github']);

  try {
    // Get all skill directories
    const allEntries = fs.existsSync(skillsDir)
      ? fs.readdirSync(skillsDir, { withFileTypes: true })
          .filter(e => (e.isDirectory() || e.isSymbolicLink()) && !SKIP.has(e.name))
      : [];

    // Get active skill names
    const activeNames = new Set();
    if (fs.existsSync(activeDir)) {
      for (const entry of fs.readdirSync(activeDir, { withFileTypes: true })) {
        if (entry.isDirectory() || entry.isSymbolicLink()) {
          activeNames.add(entry.name);
        }
      }
    }

    // Read frontmatter for each skill
    const skills = [];
    for (const entry of allEntries) {
      const skillMdPath = path.join(skillsDir, entry.name, 'SKILL.md');
      if (!fs.existsSync(skillMdPath)) continue;

      const content = fs.readFileSync(skillMdPath, 'utf8');
      const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
      if (!frontmatterMatch) continue;

      const frontmatter = frontmatterMatch[1];
      const nameMatch = frontmatter.match(/^name:\s*(.+)$/m);
      const descMatch = frontmatter.match(/^description:\s*(.+)$/m);

      skills.push({
        dirName: entry.name,
        name: nameMatch ? nameMatch[1].trim() : entry.name,
        description: descMatch ? descMatch[1].trim() : 'No description',
        active: activeNames.has(entry.name),
      });
    }

    if (skills.length === 0) return '';

    const active = skills.filter(s => s.active);
    const inactive = skills.filter(s => !s.active);

    let inventory = '## Current Skills\n\n';

    if (active.length > 0) {
      inventory += '### Active\n';
      for (const s of active) {
        inventory += `- **${s.dirName}** — ${s.description}\n`;
      }
      inventory += '\n';
    }

    if (inactive.length > 0) {
      inventory += '### Available (not active)\n';
      for (const s of inactive) {
        inventory += `- **${s.dirName}** — ${s.description}\n`;
      }
      inventory += '\n';
    }

    inventory += 'Use `get_skill_details` with a skill name to read its full documentation, setup requirements, and usage.\n\n---\n\n';

    return inventory;
  } catch {
    return '';
  }
}

const getSkillBuildingGuideTool = tool(
  async () => {
    const inventory = loadSkillInventory();
    try {
      const guide = fs.readFileSync(skillGuidePath, 'utf8');
      return inventory + guide;
    } catch {
      return inventory || 'Skill guide not found.';
    }
  },
  {
    name: 'get_skill_building_guide',
    description:
      'Load the skill building guide and a full inventory of all skills (active and available-but-inactive). You MUST call this before creating or modifying any skill — the guide contains required file structure, naming conventions, SKILL.md frontmatter format, activation steps, and testing procedures that are only documented there. Also use this when you need to check what skills already exist — it shows both active and inactive skills with descriptions. Skills are lightweight bash/Node.js wrappers in `skills/` that extend what agents can do. NOT for understanding the system architecture (use get_system_technical_specs for that).',
    schema: z.object({}),
  }
);

const getSkillDetailsTool = tool(
  async ({ skill_name }) => {
    const skillMdPath = path.join(skillsDir, skill_name, 'SKILL.md');
    try {
      return fs.readFileSync(skillMdPath, 'utf8');
    } catch {
      return `Skill "${skill_name}" not found. Use get_skill_building_guide to see available skills.`;
    }
  },
  {
    name: 'get_skill_details',
    description:
      'Read the full documentation for a specific skill by name. Returns the complete SKILL.md including setup requirements, usage examples, and credential needs. Use this to understand what a skill does before suggesting it to the user, or to get credential setup details. Works with both active and inactive skills.',
    schema: z.object({
      skill_name: z.string(),
    }),
  }
);

/**
 * Create a start_coding tool bound to a specific workspace context.
 * @param {object} context
 * @param {string} context.repo - GitHub repo (e.g. "owner/repo")
 * @param {string} context.branch - Git branch
 * @param {string} context.workspaceId - Pre-created workspace row ID
 * @returns {import('@langchain/core/tools').StructuredTool}
 */
function createStartCodingTool({ repo, branch, workspaceId }) {
  return tool(
    async ({ task_description }) => {
      try {
        const { randomUUID } = await import('crypto');
        const containerName = `code-workspace-${randomUUID().slice(0, 8)}`;

        const { getCodeWorkspaceById, updateContainerName } = await import('../db/code-workspaces.js');
        const workspace = getCodeWorkspaceById(workspaceId);
        const codingAgent = workspace?.codingAgent || 'claude-code';
        const featureBranch = workspace?.featureBranch;

        const { createCodeWorkspaceContainer } = await import('../tools/docker.js');
        await createCodeWorkspaceContainer({ containerName, repo, branch, codingAgent, featureBranch, workspaceId });

        updateContainerName(workspaceId, containerName);

        return JSON.stringify({
          success: true,
          workspaceId,
          workspaceUrl: `/code/${workspaceId}`,
        });
      } catch (err) {
        console.error('[start_coding] Failed to launch workspace:', err);
        return JSON.stringify({
          success: false,
          error: err.message || 'Failed to launch workspace',
        });
      }
    },
    {
      name: 'start_coding',
      description:
        'Launch a live code workspace in a Docker container. Only call this when the user explicitly says they are ready to start coding (e.g. "let\'s start coding", "okay let\'s get started", "launch it"). Returns a link to the live workspace.',
      schema: z.object({
        task_description: z.string(),
      }),
    }
  );
}

/**
 * Create a get_repository_details tool bound to a specific repo/branch.
 * Fetches CLAUDE.md and README.md from the repo via GitHub API.
 * @param {object} context
 * @param {string} context.repo - GitHub repo (e.g. "owner/repo")
 * @param {string} context.branch - Git branch
 * @returns {import('@langchain/core/tools').StructuredTool}
 */
function createGetRepositoryDetailsTool({ repo, branch }) {
  return tool(
    async () => {
      const { githubApi } = await import('../tools/github.js');
      const files = ['CLAUDE.md', 'README.md'];
      const results = {};

      for (const file of files) {
        try {
          const data = await githubApi(`/repos/${repo}/contents/${file}?ref=${branch}`);
          results[file] = Buffer.from(data.content, 'base64').toString('utf8');
        } catch {
          results[file] = 'Not found';
        }
      }

      return JSON.stringify(results);
    },
    {
      name: 'get_repository_details',
      description:
        'Fetch CLAUDE.md and README.md from the selected repository and branch. Call this as your first action when the user sends their first message to understand the project context.',
      schema: z.object({}),
    }
  );
}

/**
 * Create a start_headless_coding tool bound to a specific workspace context.
 * Launches an ephemeral headless container that runs a task, commits, and merges back.
 * @param {object} context
 * @param {string} context.repo - GitHub repo
 * @param {string} context.branch - Base branch
 * @param {string} context.workspaceId - Pre-created workspace row ID
 * @returns {import('@langchain/core/tools').StructuredTool}
 */
function createStartHeadlessCodingTool({ repo, branch, workspaceId }) {
  return tool(
    async ({ task_description }) => {
      try {
        const { randomUUID } = await import('crypto');
        const containerName = `code-headless-${randomUUID().slice(0, 8)}`;

        const { getCodeWorkspaceById } = await import('../db/code-workspaces.js');
        const workspace = getCodeWorkspaceById(workspaceId);
        const featureBranch = workspace?.featureBranch || `thepopebot/new-chat-${workspaceId.replace(/-/g, '').slice(0, 8)}`;

        const { createHeadlessCodeContainer, tailContainerLogs, waitForContainer, removeContainer, removeCodeWorkspaceVolume } =
          await import('../tools/docker.js');

        // Launch headless container
        await createHeadlessCodeContainer({
          containerName, repo, branch, featureBranch, workspaceId,
          taskPrompt: task_description,
        });

        // Tail logs (blocks until container exits)
        const logStream = await tailContainerLogs(containerName);
        let output = '';
        for await (const chunk of logStream) {
          // Docker multiplexed stream: first 8 bytes per frame are header, rest is payload
          // For simplicity, decode as string and strip non-printable header bytes
          const text = chunk.toString('utf8').replace(/[\x00-\x08]/g, '');
          output += text;
        }

        // Check exit code
        const exitCode = await waitForContainer(containerName);

        // Cleanup container
        await removeContainer(containerName);

        if (exitCode === 0) {
          // Success — destroy volume (work is merged back to base)
          await removeCodeWorkspaceVolume(workspaceId);
          return JSON.stringify({
            success: true,
            message: 'Task completed and merged back to base branch.',
            output: output.slice(-4000), // last 4k chars of output
          });
        } else {
          // Failure — leave volume for interactive recovery
          return JSON.stringify({
            success: false,
            message: 'Task failed. The user can switch to interactive mode to investigate.',
            exitCode,
            output: output.slice(-4000),
          });
        }
      } catch (err) {
        console.error('[start_headless_coding] Failed:', err);
        return JSON.stringify({
          success: false,
          error: err.message || 'Failed to run headless coding task',
        });
      }
    },
    {
      name: 'start_headless_coding',
      description:
        'Execute a coding task headlessly in a Docker container. The task runs Claude Code, commits changes, and merges back to the base branch automatically. Use this as the default when the user wants to implement something. The tool blocks while the task runs and returns the result.',
      schema: z.object({
        task_description: z.string().describe(
          'Detailed description of the coding task. Include context, requirements, and any specific instructions.'
        ),
      }),
    }
  );
}

export { createJobTool, getJobStatusTool, getSystemTechnicalSpecsTool, getSkillBuildingGuideTool, getSkillDetailsTool, createStartCodingTool, createStartHeadlessCodingTool, createGetRepositoryDetailsTool };
