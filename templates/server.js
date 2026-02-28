import { createServer } from 'http';
import { parse } from 'url';
import next from 'next';
import { attachCodeProxy } from 'thepopebot/code/ws-proxy';

const app = next({ dev: false });
const handle = app.getRequestHandler();

// Prevent Next.js from registering its own WebSocket upgrade handler
// (it would write HTTP 502 responses on our already-upgraded sockets)
app.didWebSocketSetup = true;

app.prepare().then(() => {
  const server = createServer((req, res) => {
    handle(req, res, parse(req.url, true));
  });

  attachCodeProxy(server);

  const port = process.env.PORT || 80;
  server.listen(port, () => {
    console.log(`> Ready on http://localhost:${port}`);
  });
});
