/**
 * GitHub REST API helper with authentication
 * @param {string} endpoint - API endpoint (e.g., '/repos/owner/repo/...')
 * @param {object} options - Fetch options (method, body, headers)
 * @returns {Promise<object>} - Parsed JSON response
 */
async function githubApi(endpoint, options = {}) {
  const { GH_TOKEN } = process.env;
  const res = await fetch(`https://api.github.com${endpoint}`, {
    ...options,
    headers: {
      'Authorization': `Bearer ${GH_TOKEN}`,
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

/**
 * Get workflow runs with optional status filter
 * @param {string} [status] - Filter by status (in_progress, queued, completed)
 * @returns {Promise<object>} - Workflow runs response
 */
async function getWorkflowRuns(status) {
  const { GH_OWNER, GH_REPO } = process.env;
  const params = new URLSearchParams();
  if (status) params.set('status', status);
  params.set('per_page', '20');

  const query = params.toString();
  return githubApi(`/repos/${GH_OWNER}/${GH_REPO}/actions/runs?${query}`);
}

/**
 * Get jobs for a specific workflow run
 * @param {number} runId - Workflow run ID
 * @returns {Promise<object>} - Jobs response with steps
 */
async function getWorkflowRunJobs(runId) {
  const { GH_OWNER, GH_REPO } = process.env;
  return githubApi(`/repos/${GH_OWNER}/${GH_REPO}/actions/runs/${runId}/jobs`);
}

/**
 * Get job status for running/recent jobs
 * @param {string} [jobId] - Optional specific job ID to filter by
 * @returns {Promise<object>} - Status summary with jobs array
 */
async function getJobStatus(jobId) {
  // Fetch both in_progress and queued runs
  const [inProgress, queued] = await Promise.all([
    getWorkflowRuns('in_progress'),
    getWorkflowRuns('queued'),
  ]);

  const allRuns = [...(inProgress.workflow_runs || []), ...(queued.workflow_runs || [])];

  // Filter to only job/* branches
  const jobRuns = allRuns.filter(run => run.head_branch?.startsWith('job/'));

  // If specific job requested, filter further
  const filteredRuns = jobId
    ? jobRuns.filter(run => run.head_branch === `job/${jobId}`)
    : jobRuns;

  // Get detailed job info for each run
  const jobs = await Promise.all(
    filteredRuns.map(async (run) => {
      const extractedJobId = run.head_branch.slice(4); // Remove 'job/' prefix
      const startedAt = new Date(run.created_at);
      const durationMinutes = Math.round((Date.now() - startedAt.getTime()) / 60000);

      let currentStep = null;
      let stepsCompleted = 0;
      let stepsTotal = 0;

      try {
        const jobsData = await getWorkflowRunJobs(run.id);
        if (jobsData.jobs?.length > 0) {
          const job = jobsData.jobs[0];
          stepsTotal = job.steps?.length || 0;
          stepsCompleted = job.steps?.filter(s => s.status === 'completed').length || 0;
          currentStep = job.steps?.find(s => s.status === 'in_progress')?.name || null;
        }
      } catch (err) {
        // Jobs endpoint may fail if run hasn't started yet
      }

      return {
        job_id: extractedJobId,
        branch: run.head_branch,
        status: run.status,
        started_at: run.created_at,
        duration_minutes: durationMinutes,
        current_step: currentStep,
        steps_completed: stepsCompleted,
        steps_total: stepsTotal,
        run_id: run.id,
      };
    })
  );

  // Count only job/* branches, not all workflows
  const runningCount = jobs.filter(j => j.status === 'in_progress').length;
  const queuedCount = jobs.filter(j => j.status === 'queued').length;

  return {
    jobs,
    queued: queuedCount,
    running: runningCount,
  };
}

/**
 * Get full swarm status: active + completed jobs with counts
 * @returns {Promise<object>} - { active, completed, counts }
 */
async function getSwarmStatus() {
  const [inProgress, queued, completed] = await Promise.all([
    getWorkflowRuns('in_progress'),
    getWorkflowRuns('queued'),
    getWorkflowRuns('completed'),
  ]);

  const activeRuns = [
    ...(inProgress.workflow_runs || []),
    ...(queued.workflow_runs || []),
  ].filter(run => run.head_branch?.startsWith('job/'));

  const completedRuns = (completed.workflow_runs || [])
    .filter(run => run.head_branch?.startsWith('job/'))
    .slice(0, 20);

  // Get step details for active jobs
  const active = await Promise.all(
    activeRuns.map(async (run) => {
      const jobId = run.head_branch.slice(4);
      const startedAt = new Date(run.created_at);
      const durationSeconds = Math.round((Date.now() - startedAt.getTime()) / 1000);

      let currentStep = null;
      let stepsCompleted = 0;
      let stepsTotal = 0;

      try {
        const jobsData = await getWorkflowRunJobs(run.id);
        if (jobsData.jobs?.length > 0) {
          const job = jobsData.jobs[0];
          stepsTotal = job.steps?.length || 0;
          stepsCompleted = job.steps?.filter(s => s.status === 'completed').length || 0;
          currentStep = job.steps?.find(s => s.status === 'in_progress')?.name || null;
        }
      } catch (err) {
        // Jobs endpoint may fail if run hasn't started yet
      }

      return {
        job_id: jobId,
        branch: run.head_branch,
        status: run.status,
        workflow_name: run.name,
        started_at: run.created_at,
        duration_seconds: durationSeconds,
        current_step: currentStep,
        steps_completed: stepsCompleted,
        steps_total: stepsTotal,
        run_id: run.id,
        html_url: run.html_url,
      };
    })
  );

  // Completed jobs are lighter — no step detail needed
  const completedJobs = completedRuns.map((run) => ({
    job_id: run.head_branch.slice(4),
    branch: run.head_branch,
    status: run.status,
    conclusion: run.conclusion,
    workflow_name: run.name,
    started_at: run.created_at,
    updated_at: run.updated_at,
    run_id: run.id,
    html_url: run.html_url,
  }));

  const successCount = completedJobs.filter(j => j.conclusion === 'success').length;
  const failedCount = completedJobs.length - successCount;

  return {
    active,
    completed: completedJobs,
    counts: {
      running: active.filter(j => j.status === 'in_progress').length,
      queued: active.filter(j => j.status === 'queued').length,
      succeeded: successCount,
      failed: failedCount,
    },
  };
}

/**
 * Cancel a workflow run
 * @param {number} runId - Workflow run ID
 */
async function cancelWorkflowRun(runId) {
  const { GH_OWNER, GH_REPO } = process.env;
  const res = await fetch(
    `https://api.github.com/repos/${GH_OWNER}/${GH_REPO}/actions/runs/${runId}/cancel`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.GH_TOKEN}`,
        'Accept': 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
    }
  );
  if (!res.ok && res.status !== 202) {
    const error = await res.text();
    throw new Error(`GitHub API error: ${res.status} ${error}`);
  }
  return { success: true };
}

/**
 * Re-run a workflow run (all jobs or failed only)
 * @param {number} runId - Workflow run ID
 * @param {boolean} [failedOnly=false] - Only rerun failed jobs
 */
async function rerunWorkflowRun(runId, failedOnly = false) {
  const { GH_OWNER, GH_REPO } = process.env;
  const endpoint = failedOnly
    ? `https://api.github.com/repos/${GH_OWNER}/${GH_REPO}/actions/runs/${runId}/rerun-failed-jobs`
    : `https://api.github.com/repos/${GH_OWNER}/${GH_REPO}/actions/runs/${runId}/rerun`;
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.GH_TOKEN}`,
      'Accept': 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
  });
  if (!res.ok && res.status !== 201) {
    const error = await res.text();
    throw new Error(`GitHub API error: ${res.status} ${error}`);
  }
  return { success: true };
}

/**
 * Trigger a workflow via workflow_dispatch
 * @param {string} workflowId - Workflow file name (e.g., 'upgrade-event-handler.yml')
 * @param {string} [ref='main'] - Git ref to run the workflow on
 * @param {object} [inputs={}] - Workflow inputs
 */
async function triggerWorkflowDispatch(workflowId, ref = 'main', inputs = {}) {
  const { GH_OWNER, GH_REPO } = process.env;
  const res = await fetch(
    `https://api.github.com/repos/${GH_OWNER}/${GH_REPO}/actions/workflows/${workflowId}/dispatches`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.GH_TOKEN}`,
        'Accept': 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ ref, inputs }),
    }
  );
  if (!res.ok && res.status !== 204) {
    const error = await res.text();
    throw new Error(`GitHub API error: ${res.status} ${error}`);
  }
  return { success: true };
}

export {
  githubApi,
  getWorkflowRuns,
  getWorkflowRunJobs,
  getJobStatus,
  getSwarmStatus,
  cancelWorkflowRun,
  rerunWorkflowRun,
  triggerWorkflowDispatch,
};
