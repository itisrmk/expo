import { createHash } from 'node:crypto';
import * as fs from 'node:fs';

function getTarget(filename: string, data: string | Buffer) {
  const hash = createHash('sha256').update(data).digest('base64url');
  return `${filename}.${hash}`;
}

export interface WriteFileAtomicOptions {
  mode?: fs.Mode;
}

export function writeFileAtomicSync(
  filename: string,
  data: string | Buffer,
  options: WriteFileAtomicOptions = {}
): void {
  let mode = options.mode;
  if (mode === undefined) {
    try {
      const stat = fs.lstatSync(filename);
      mode = stat.isFile() ? stat.mode : undefined;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error;
      }
    }
  }
  const tmpfile = getTarget(filename, data);
  fs.writeFileSync(tmpfile, data, mode !== undefined ? { mode } : undefined);
  fs.renameSync(tmpfile, filename);
  if (mode !== undefined) {
    fs.chmodSync(filename, mode);
  }
}

export async function writeFileAtomic(
  filename: string,
  data: string | Buffer,
  options: WriteFileAtomicOptions = {}
): Promise<void> {
  let mode = options.mode;
  if (mode === undefined) {
    try {
      const stat = await fs.promises.lstat(filename);
      mode = stat.isFile() ? stat.mode : undefined;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error;
      }
    }
  }
  const tmpfile = getTarget(filename, data);
  await fs.promises.writeFile(tmpfile, data, mode !== undefined ? { mode } : undefined);
  await fs.promises.rename(tmpfile, filename);
  if (mode !== undefined) {
    await fs.promises.chmod(filename, mode);
  }
}
