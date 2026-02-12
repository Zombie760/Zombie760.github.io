const { tool } = require('@langchain/core/tools');
const { z } = require('zod');
const { createJob } = require('../tools/create-job');
const { getJobStatus } = require('../tools/github');

const createJobTool = tool(
  async ({ job_description }) => {
    const result = await createJob(job_description);
    return JSON.stringify({
      success: true,
      job_id: result.job_id,
      branch: result.branch,
    });
  },
  {
    name: 'create_job',
    description:
      'Create an autonomous job for thepopebot to execute. Use this tool liberally - if the user asks for ANY task to be done, create a job. Jobs can handle code changes, file updates, research tasks, web scraping, data analysis, or anything requiring autonomous work. When the user explicitly asks for a job, ALWAYS use this tool. Returns the job ID and branch name.',
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

module.exports = { createJobTool, getJobStatusTool };
