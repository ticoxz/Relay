import { execSync } from 'child_process';
import path from 'path';

describe('relay doctor', () => {
  it('runs doctor --json in project root', () => {
    const root = path.resolve(__dirname, '..');
    const out = execSync('node dist/cli/index.js doctor --json', {
      cwd: root,
      encoding: 'utf-8',
    });
    const parsed = JSON.parse(out);
    expect(parsed).toHaveProperty('checks');
    expect(Array.isArray(parsed.checks)).toBe(true);
    expect(parsed.checks.some((c: { name: string }) => c.name === 'node')).toBe(true);
  });
});
