import { WebSocketServer, WebSocket } from 'ws';

export function attachCodeProxy(server) {
  const wss = new WebSocketServer({ noServer: true, perMessageDeflate: false });

  server.on('upgrade', (req, socket, head) => {
    const match = req.url.match(/^\/code\/([^/]+)\/ws$/);
    if (!match) return;

    const container = match[1];

    wss.handleUpgrade(req, socket, head, (clientWs) => {
      const backendWs = new WebSocket(`ws://${container}:7681/ws`, 'tty');

      backendWs.on('open', () => {
        console.log(`[ws-proxy] connected: ${container}`);
      });

      backendWs.on('message', (data, isBinary) => {
        if (clientWs.readyState === WebSocket.OPEN) {
          clientWs.send(data, { binary: isBinary });
        }
      });

      clientWs.on('message', (data, isBinary) => {
        if (backendWs.readyState === WebSocket.OPEN) {
          backendWs.send(data, { binary: isBinary });
        }
      });

      backendWs.on('error', (err) => {
        console.error(`[ws-proxy] backend error: ${err.message}`);
        clientWs.close();
      });

      backendWs.on('close', () => clientWs.close());
      clientWs.on('error', () => backendWs.close());
      clientWs.on('close', () => backendWs.close());
    });
  });
}
