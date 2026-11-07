// One immutable logical marker per confirmation. Replaying a write cannot increment the count.
import { list, put } from '@vercel/blob';
import { mkdir, readdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const localPath = (room: string) => join(tmpdir(), 'heatline-shade-demo', room);
const useLocalStore = () => !process.env.VERCEL && !process.env.BLOB_READ_WRITE_TOKEN;

export async function recordShade(room: string, receipt: string) {
  if (useLocalStore()) {
    await mkdir(localPath(room), { recursive: true });
    await writeFile(join(localPath(room), receipt), '');
    return;
  }
  await put(`shade/v1/${room}/${receipt}`, '1', {
    access: 'private', addRandomSuffix: false, allowOverwrite: true,
  });
}

export async function shadeCount(room: string) {
  if (useLocalStore()) {
    try { return (await readdir(localPath(room))).length; }
    catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return 0; throw error; }
  }
  let count = 0;
  let cursor: string | undefined;
  do {
    const page = await list({ prefix: `shade/v1/${room}/`, cursor });
    count += page.blobs.length;
    cursor = page.cursor;
  } while (cursor);
  return count;
}
