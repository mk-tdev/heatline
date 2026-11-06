// Local runner. Vercel imports the same handler without opening a listening socket.
import { createServer } from 'node:http';
import { handler } from './http';
const port = Number(process.env.HEATLINE_API_PORT) || 8787;
createServer(handler).listen(port, '127.0.0.1', () => {
  console.log(`Heatline API on http://127.0.0.1:${port}`);
});
