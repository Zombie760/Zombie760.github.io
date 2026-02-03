const express = require('express');
const helmet = require('helmet');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

const app = express();

app.use(helmet());
app.use(express.json());

const { GITHUB_TOKEN, GITHUB_OWNER, GITHUB_REPO, API_KEY } = process.env;

// x-api-key auth middleware
const authMiddleware = (req, res, next) => {
  if (req.headers['x-api-key'] !== API_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
};

// GitHub API helper
async function githubApi(endpoint, options = {}) {
  const res = await fetch(`https://api.github.com${endpoint}`, {
    ...options,
    headers: {
      'Authorization': `Bearer ${GITHUB_TOKEN}`,
      'Accept': 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      ...options.headers,
    },
  });

  if (!res.ok) {
    const error = await res.text();
    throw new Error(`GitHub API error: ${res.status} ${error}`);
  }

  return res.json();
}

// POST /webhook - create a new job
app.post('/webhook', authMiddleware, async (req, res) => {
  const { job } = req.body;
  if (!job) return res.status(400).json({ error: 'Missing job field' });

  const jobId = uuidv4();
  const branch = `job/${jobId}`;

  try {
    // 1. Get main branch SHA
    const mainRef = await githubApi(`/repos/${GITHUB_OWNER}/${GITHUB_REPO}/git/ref/heads/main`);
    const mainSha = mainRef.object.sha;

    // 2. Create new branch
    await githubApi(`/repos/${GITHUB_OWNER}/${GITHUB_REPO}/git/refs`, {
      method: 'POST',
      body: JSON.stringify({
        ref: `refs/heads/${branch}`,
        sha: mainSha,
      }),
    });

    // 3. Get current job.md file SHA
    const fileInfo = await githubApi(
      `/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/workspace/job.md?ref=${branch}`
    );
    const fileSha = fileInfo.sha;

    // 4. Update workspace/job.md with job content
    await githubApi(`/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/workspace/job.md`, {
      method: 'PUT',
      body: JSON.stringify({
        message: `job: ${jobId}`,
        content: Buffer.from(job).toString('base64'),
        branch: branch,
        sha: fileSha,
      }),
    });

    res.json({ job_id: jobId, branch });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create job' });
  }
});

// Error handler - don't leak stack traces
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Listening on port ${PORT}`));
