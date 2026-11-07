// Bundle workspace TypeScript and JSON so Vercel runs standard, resolvable Node ESM.
// SDK dependencies remain external and are traced into each serverless function.
import { build } from 'esbuild';
await build({
  entryPoints: ['server/http.ts'],
  outfile: 'server/dist/http.mjs',
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node22',
  external: ['@vercel/blob', 'openai', 'openai/*', 'zod', 'zod/*'],
});
