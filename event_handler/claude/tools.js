const { createJob } = require('../tools/create-job');

const toolDefinitions = [
  {
    name: 'create_job',
    description:
      'Create an autonomous job for thepopebot to execute. Use when the user wants code changes, file updates, or tasks requiring the full agent. Returns the job ID and branch name.',
    input_schema: {
      type: 'object',
      properties: {
        job_description: {
          type: 'string',
          description:
            'Detailed job description including context and requirements. Be specific about what needs to be done.',
        },
      },
      required: ['job_description'],
    },
  },
];

const toolExecutors = {
  create_job: async (input) => {
    const result = await createJob(input.job_description);
    return {
      success: true,
      job_id: result.job_id,
      branch: result.branch,
    };
  },
};

module.exports = { toolDefinitions, toolExecutors };
