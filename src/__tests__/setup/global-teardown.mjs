import { rmSync } from 'node:fs';

export default function globalTeardown() {
  const dir = process.env['TEST_DB_DIR'];
  if (dir) rmSync(dir, { recursive: true, force: true });
}
