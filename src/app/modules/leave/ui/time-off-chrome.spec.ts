import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

function walkHtml(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...walkHtml(full));
    else if (name.endsWith('.html')) out.push(full);
  }
  return out;
}

describe('Time Off visual chrome', () => {
  const featureDir = join(__dirname, '../feature');
  const templates = walkHtml(featureDir);

  it('feature pages use shared to-page chrome', () => {
    const pages = templates.filter((path) => !path.includes('time-off-shell') && !path.includes('team-balances'));
    for (const file of pages) {
      const html = readFileSync(file, 'utf8');
      expect(html, file).toContain('to-page');
      expect(html, file).toContain('to-kicker');
    }
  });

  it('feature templates do not use native select or date inputs', () => {
    for (const file of templates) {
      const html = readFileSync(file, 'utf8');
      expect(html, file).not.toMatch(/<select\b/);
      expect(html, file).not.toMatch(/<input[^>]*type="date"/);
    }
  });

  it('keeps Balances MY/TEAM test ids', () => {
    const html = readFileSync(join(featureDir, 'my-balances/my-balances.component.html'), 'utf8');
    expect(html).toContain('data-testid="balances-view-toggle"');
    expect(html).toContain('data-testid="balances-view-my"');
    expect(html).toContain('data-testid="balances-view-team"');
    expect(html).toContain('data-testid="new-request-button"');
  });
});
