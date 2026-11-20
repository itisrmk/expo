import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { writeFileAtomic, writeFileAtomicSync } from '../writeAtomic';

describe.each([
  ['sync', writeFileAtomicSync],
  ['async', writeFileAtomic],
] as const)('%s atomic writes', (_name, write) => {
  let directory: string;

  beforeEach(() => {
    directory = fs.mkdtempSync(path.join(os.tmpdir(), 'expo-json-file-'));
  });

  afterEach(() => {
    fs.rmSync(directory, { recursive: true, force: true });
  });

  it.each([0o600, 0o755])('preserves the existing file mode %s', async (mode) => {
    const filename = path.join(directory, 'app.json');
    fs.writeFileSync(filename, '{}', { mode });

    await write(filename, '');

    expect(fs.statSync(filename).mode & 0o777).toBe(mode);
    expect(fs.readFileSync(filename, 'utf8')).toBe('');
  });
});
