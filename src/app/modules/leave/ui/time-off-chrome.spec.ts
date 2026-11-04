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

  it('feature pages use shared to-page chrome, shared header and shared KPI tiles', () => {
    const pages = templates.filter((path) => !path.includes('time-off-shell'));
    for (const file of pages) {
      const html = readFileSync(file, 'utf8');
      expect(html, file).toContain('to-page');
      expect(html, file).toContain('<app-breadcrumb-header');
      expect(html, file).not.toContain('to-kicker');
      expect(html, file).not.toContain('to-metric');
      // Compact header bar like the rest of the app: no big visible title block.
      expect(html, file).not.toContain('to-title');
    }
  });

  it('feature templates do not use native select or date inputs', () => {
    for (const file of templates) {
      const html = readFileSync(file, 'utf8');
      expect(html, file).not.toMatch(/<select\b/);
      expect(html, file).not.toMatch(/<input[^>]*type="date"/);
    }
  });

  it('keeps the hub test ids', () => {
    const html = readFileSync(join(featureDir, 'time-off-hub/time-off-hub.component.html'), 'utf8');
    expect(html).toContain('data-testid="new-request-button"');
    expect(html).toContain('data-testid="balance-card"');
    expect(html).toContain('data-testid="time-off-setup"');
  });
});
