import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import {defineConfig, Plugin} from 'vite';

// Load .env if present and override any placeholder environment variables (e.g. YOUR_PROJECT_REF)
let localEnv: Record<string, string> = {};
if (fs.existsSync(path.resolve(__dirname, '.env'))) {
  try {
    localEnv = dotenv.parse(fs.readFileSync(path.resolve(__dirname, '.env')));
    for (const [k, v] of Object.entries(localEnv)) {
      if (v && !v.includes('YOUR_PROJECT_REF')) {
        process.env[k] = v;
      }
    }
  } catch (err) {
    console.error('Failed to parse .env:', err);
  }
}

function resolveSupabaseConfig() {
  const envUrl = localEnv.VITE_SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
  const url = (envUrl && !envUrl.includes('YOUR_PROJECT_REF'))
    ? envUrl
    : 'https://edjzkpdygnfghkcjfsgg.supabase.co';

  const envKey = localEnv.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY || '';
  const key = (envKey && !envKey.includes('sb_publishable_...'))
    ? envKey
    : 'sb_publishable_a5kemPfSHDz9PzOiNssUnw_jmG_uZii';

  return { url, key };
}

function supabaseProxyPlugin(targetUrl: string): Plugin {
  return {
    name: 'supabase-proxy',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith('/rest/v1') && !req.url?.startsWith('/auth/v1')) {
          return next();
        }

        try {
          const target = new URL(req.url, targetUrl);

          const chunks: Buffer[] = [];
          for await (const chunk of req) {
            chunks.push(chunk);
          }
          const body = ['GET', 'HEAD'].includes(req.method || '') ? undefined : Buffer.concat(chunks);

          const headers = new Headers();
          for (const [k, v] of Object.entries(req.headers)) {
            if (k.toLowerCase() === 'host') continue;
            if (v) headers.set(k, Array.isArray(v) ? v.join(',') : v);
          }

          const response = await fetch(target.href, {
            method: req.method,
            headers,
            body,
          });

          res.statusCode = response.status;
          response.headers.forEach((val, key) => {
            if (key.toLowerCase() !== 'content-encoding') {
              res.setHeader(key, val);
            }
          });

          const resBuf = Buffer.from(await response.arrayBuffer());
          res.end(resBuf);
        } catch (err: any) {
          console.error('[Supabase Proxy Error]:', err?.message, err?.cause);
          res.statusCode = 502;
          res.end(JSON.stringify({ error: err?.message || 'Proxy error', cause: String(err?.cause) }));
        }
      });
    },
  };
}

export default defineConfig(() => {
  const { url: supabaseUrl, key: supabaseKey } = resolveSupabaseConfig();

  return {
    define: {
      'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(supabaseUrl),
      'import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY': JSON.stringify(supabaseKey),
    },
    plugins: [react(), tailwindcss(), supabaseProxyPlugin(supabaseUrl)],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      host: '0.0.0.0',
      port: 3000,
      allowedHosts: true as const,
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
