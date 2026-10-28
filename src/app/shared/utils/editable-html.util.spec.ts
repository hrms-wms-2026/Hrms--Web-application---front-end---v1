import { describe, expect, it } from 'vitest';
import { sanitizeEditableHtml } from './editable-html.util';

describe('sanitizeEditableHtml', () => {
  it('returns an empty string for empty input', () => {
    expect(sanitizeEditableHtml(null)).toBe('');
    expect(sanitizeEditableHtml(undefined)).toBe('');
    expect(sanitizeEditableHtml('')).toBe('');
  });

  it('removes inline event handlers', () => {
    const out = sanitizeEditableHtml('<img src="https://cdn.example.com/a.png" onerror="alert(1)"><div onclick="x()">hi</div>');
    expect(out).not.toMatch(/onerror|onclick/i);
    expect(out).toContain('src="https://cdn.example.com/a.png"');
    expect(out).toContain('<div>hi</div>');
  });

  it.each(['script', 'iframe', 'object', 'embed', 'svg', 'style', 'form', 'template', 'base', 'meta', 'link'])(
    'removes <%s> elements',
    (tag) => {
      const out = sanitizeEditableHtml(`<div>keep</div><${tag}>x</${tag}>`);
      expect(out).not.toContain(`<${tag}`);
      expect(out).toContain('<div>keep</div>');
    }
  );

  it.each([
    '<a href="javascript:alert(1)">x</a>',
    '<a href="JaVaScRiPt:alert(1)">x</a>',
    '<a href="java\tscript:alert(1)">x</a>',
    '<a href=" vbscript:msgbox(1)">x</a>',
    '<a href="data:text/html;base64,PHNjcmlwdD4=">x</a>'
  ])('strips script URLs: %s', (html) => {
    expect(sanitizeEditableHtml(html)).toBe('<a>x</a>');
  });

  it('keeps safe links and inline raster images', () => {
    const html = '<a href="https://example.com/doc">doc</a><img src="data:image/png;base64,iVBORw0KGgo=">';
    expect(sanitizeEditableHtml(html)).toBe(html);
  });

  it("keeps the editor's own markup", () => {
    const html =
      '<div><span contenteditable="false" data-employee-id="e-1" class="mention">@Ana</span> hi</div>' +
      '<div><input type="checkbox" checked=""> todo</div>' +
      '<div><span style="color: rgb(255, 0, 0);">red</span></div>';
    expect(sanitizeEditableHtml(html)).toBe(html);
  });
});
