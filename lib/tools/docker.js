import http from 'http';

/**
 * Make a request to the Docker Engine API via Unix socket.
 * @param {string} method - HTTP method
 * @param {string} path - API path
 * @param {object} [body] - Request body
 * @returns {Promise<object>} Parsed JSON response
 */
function dockerApi(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const options = {
      socketPath: '/var/run/docker.sock',
      path,
      method,
      headers: { 'Content-Type': 'application/json' },
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: data ? JSON.parse(data) : {} });
        } catch {
          resolve({ status: res.statusCode, data: { message: data } });
        }
      });
    });

    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

/**
 * Auto-detect the Docker network by inspecting the event-handler container.
 * @returns {Promise<string>} Network name
 */
async function detectNetwork() {
  try {
    const { status, data } = await dockerApi('GET', '/containers/thepopebot-event-handler/json');
    if (status === 200 && data.NetworkSettings?.Networks) {
      const networks = Object.keys(data.NetworkSettings.Networks);
      if (networks.length > 0) return networks[0];
    }
  } catch {}
  return 'bridge';
}

/**
 * Create and start a Claude workspace Docker container.
 * @param {object} options
 * @param {string} options.containerName - Docker container name
 * @param {string} options.repo - GitHub repo full name (e.g. "owner/repo")
 * @param {string} options.branch - Git branch name
 * @returns {Promise<{containerId: string}>}
 */
async function createClaudeWorkspaceContainer({ containerName, repo, branch }) {
  const version = process.env.THEPOPEBOT_VERSION || 'latest';
  const image = `stephengpope/thepopebot:claude-workspace-${version}`;
  const network = await detectNetwork();

  const env = [
    `REPO=${repo}`,
    `BRANCH=${branch}`,
  ];
  if (process.env.CLAUDE_CODE_OAUTH_TOKEN) {
    env.push(`CLAUDE_CODE_OAUTH_TOKEN=${process.env.CLAUDE_CODE_OAUTH_TOKEN}`);
  }
  if (process.env.GH_TOKEN) {
    env.push(`GH_TOKEN=${process.env.GH_TOKEN}`);
  }

  // Create container
  const createRes = await dockerApi('POST', `/containers/create?name=${encodeURIComponent(containerName)}`, {
    Image: image,
    Env: env,
    HostConfig: {
      NetworkMode: network,
    },
  });

  if (createRes.status !== 201) {
    throw new Error(`Docker create failed (${createRes.status}): ${createRes.data?.message || JSON.stringify(createRes.data)}`);
  }

  const containerId = createRes.data.Id;

  // Start container
  const startRes = await dockerApi('POST', `/containers/${containerId}/start`);
  if (startRes.status !== 204 && startRes.status !== 304) {
    throw new Error(`Docker start failed (${startRes.status}): ${startRes.data?.message || JSON.stringify(startRes.data)}`);
  }

  return { containerId };
}

export { createClaudeWorkspaceContainer };
