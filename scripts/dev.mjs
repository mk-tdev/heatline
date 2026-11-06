// Start the API server and the web app together. Ctrl+C stops both.
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';

const envFile = existsSync('.env') ? ['--env-file=.env'] : [];
const children = [
  spawn(process.execPath, [...envFile, '--import', 'tsx', '--watch', 'server/index.ts'], { stdio: 'inherit' }),
  spawn('npm', ['run', 'dev', '--workspace', '@heatline/web'], { stdio: 'inherit' }),
];
const stop = () => children.forEach((c) => c.kill('SIGTERM'));
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
children.forEach((c) => c.on('exit', (code) => code && code !== 0 && stop()));
