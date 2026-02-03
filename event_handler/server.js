const express = require('express');
const helmet = require('helmet');
require('dotenv').config();

const { createJob } = require('./tools/create-job');
const { loadCrons } = require('./cron');

const app = express();

app.use(helmet());
app.use(express.json());

const { API_KEY } = process.env;

// x-api-key auth middleware
const authMiddleware = (req, res, next) => {
  if (req.headers['x-api-key'] !== API_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
};

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

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Listening on port ${PORT}`);
  loadCrons();
});
