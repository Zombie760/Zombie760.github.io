const express = require('express');
const helmet = require('helmet');
const { v4: uuidv4 } = require('uuid');
const cron = require('node-cron');
const fs = require('fs');
const path = require('path');
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

// Reusable job creation function
async function createJob(jobDescription) {
  const jobId = uuidv4();
  const branch = `job/${jobId}`;

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
      content: Buffer.from(jobDescription).toString('base64'),
      branch: branch,
      sha: fileSha,
    }),
  });

  return { job_id: jobId, branch };
}

// POST /webhook - create a new job
app.post('/webhook', authMiddleware, async (req, res) => {
  const { job } = req.body;
  if (!job) return res.status(400).json({ error: 'Missing job field' });

  try {
    const result = await createJob(job);
    res.json(result);
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

// Load and schedule crons
function loadCrons() {
  const cronFile = path.join(__dirname, '..', 'nervous_system', 'CRONS.json');
  if (!fs.existsSync(cronFile)) {
    console.log('No CRONS.json found, skipping cron setup');
    return;
  }

  const crons = JSON.parse(fs.readFileSync(cronFile, 'utf8'));

  for (const { name, schedule, job, enabled } of crons) {
    if (enabled === false) continue;

    if (!cron.validate(schedule)) {
      console.error(`Invalid cron schedule for "${name}": ${schedule}`);
      continue;
    }

    cron.schedule(schedule, async () => {
      console.log(`Running cron: ${name}`);
      try {
        const result = await createJob(job);
        console.log(`Cron ${name} created job: ${result.job_id}`);
      } catch (err) {
        console.error(`Cron ${name} failed:`, err.message);
      }
    });

    console.log(`Scheduled cron: ${name} (${schedule})`);
  }
}

loadCrons();

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Listening on port ${PORT}`));
