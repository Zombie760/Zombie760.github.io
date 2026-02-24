import { v4 as uuidv4 } from 'uuid';
import { githubApi } from './github.js';

/**
 * Create a new job branch with updated job.md
 * @param {string} jobDescription - The job description to write to job.md
 * @param {Object} [options] - Optional overrides
 * @param {string} [options.llmProvider] - LLM provider override (e.g. 'openai', 'anthropic')
 * @param {string} [options.llmModel] - LLM model override (e.g. 'gpt-4o', 'claude-sonnet-4-5-20250929')
 * @returns {Promise<{job_id: string, branch: string}>} - Job ID and branch name
 */
async function createJob(jobDescription, options = {}) {
  const { GH_OWNER, GH_REPO } = process.env;
  const jobId = uuidv4();
  const branch = `job/${jobId}`;
  const repo = `/repos/${GH_OWNER}/${GH_REPO}`;

  // 1. Get main branch SHA and its tree SHA
  const mainRef = await githubApi(`${repo}/git/ref/heads/main`);
  const mainSha = mainRef.object.sha;
  const mainCommit = await githubApi(`${repo}/git/commits/${mainSha}`);
  const baseTreeSha = mainCommit.tree.sha;

  // 2. Build tree entries — always job.md, conditionally job.config.json
  const treeEntries = [
    {
      path: `logs/${jobId}/job.md`,
      mode: '100644',
      type: 'blob',
      content: jobDescription,
    },
  ];

  const config = {};
  if (options.llmProvider) config.llm_provider = options.llmProvider;
  if (options.llmModel) config.llm_model = options.llmModel;
  if (Object.keys(config).length > 0) {
    treeEntries.push({
      path: `logs/${jobId}/job.config.json`,
      mode: '100644',
      type: 'blob',
      content: JSON.stringify(config, null, 2),
    });
  }

  // 3. Create tree (base_tree preserves all existing files)
  const tree = await githubApi(`${repo}/git/trees`, {
    method: 'POST',
    body: JSON.stringify({
      base_tree: baseTreeSha,
      tree: treeEntries,
    }),
  });

  // 4. Create a single commit with all job files
  const commit = await githubApi(`${repo}/git/commits`, {
    method: 'POST',
    body: JSON.stringify({
      message: `job: ${jobId}`,
      tree: tree.sha,
      parents: [mainSha],
    }),
  });

  // 5. Create branch pointing to the commit (triggers run-job.yml)
  await githubApi(`${repo}/git/refs`, {
    method: 'POST',
    body: JSON.stringify({
      ref: `refs/heads/${branch}`,
      sha: commit.sha,
    }),
  });

  return { job_id: jobId, branch };
}

export { createJob };
