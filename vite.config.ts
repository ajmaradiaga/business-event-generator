import { defineConfig } from 'vitest/config';
import { nodePolyfills } from 'vite-plugin-node-polyfills';
import type { Plugin, Connect } from 'vite';
import https from 'https';
import http from 'http';
import type { IncomingMessage, ServerResponse } from 'http';

function emisDevProxy(): Plugin {
  return {
    name: 'emis-dev-proxy',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/emis-proxy', (req: Connect.IncomingMessage, res: ServerResponse) => {
        const rawTarget = new URL(req.url ?? '/', 'http://localhost').searchParams.get('target');
        if (!rawTarget) {
          res.writeHead(400);
          res.end(JSON.stringify({ error: 'Missing target query parameter' }));
          return;
        }

        let targetUrl: URL;
        try {
          targetUrl = new URL(rawTarget);
        } catch {
          res.writeHead(400);
          res.end(JSON.stringify({ error: 'Invalid target URL' }));
          return;
        }

        const chunks: Buffer[] = [];
        req.on('data', (c: Buffer) => chunks.push(c));
        req.on('end', () => {
          const body = Buffer.concat(chunks);
          const transport = targetUrl.protocol === 'https:' ? https : http;
          const port = targetUrl.port ? parseInt(targetUrl.port) : (targetUrl.protocol === 'https:' ? 443 : 80);

          const proxyReq = (transport as typeof https).request(
            {
              hostname: targetUrl.hostname,
              port,
              path: targetUrl.pathname + targetUrl.search,
              method: (req as IncomingMessage).method ?? 'POST',
              headers: {
                authorization: (req.headers as Record<string, string>).authorization ?? '',
                'content-type': (req.headers as Record<string, string>)['content-type'] ?? 'application/json',
                'x-qos': (req.headers as Record<string, string>)['x-qos'] ?? '0',
                'content-length': body.length.toString(),
              },
            },
            (proxyRes) => {
              res.writeHead(proxyRes.statusCode ?? 502, {
                'access-control-allow-origin': '*',
              });
              proxyRes.pipe(res);
            },
          );
          proxyReq.on('error', (err) => {
            res.writeHead(502);
            res.end(JSON.stringify({ error: err.message }));
          });
          proxyReq.write(body);
          proxyReq.end();
        });
      });
    },
  };
}

export default defineConfig({
  plugins: [
    nodePolyfills({
      globals: { process: true, Buffer: true, global: true },
    }),
    emisDevProxy(),
  ],
  base: process.env.VITE_BASE_URL || '/business-event-generator/',
  optimizeDeps: {
    include: ['solclientjs'],
  },
  test: {
    environment: 'jsdom',
    passWithNoTests: true,
  },
});
