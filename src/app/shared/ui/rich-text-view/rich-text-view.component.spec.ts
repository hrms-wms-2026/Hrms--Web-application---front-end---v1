import { TestBed } from '@angular/core/testing';
import { RichTextViewComponent } from './rich-text-view.component';

describe('RichTextViewComponent', () => {
  function render(value: string | null): HTMLElement {
    const fixture = TestBed.createComponent(RichTextViewComponent);
    fixture.componentRef.setInput('value', value);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('renders rich text as formatted markup', () => {
    const host = render('<ul><li>One</li><li>Two</li></ul>');

    expect(host.querySelectorAll('li').length).toBe(2);
  });

  // Review finding M3: neither app has the typography plugin, so the view styles its own content.
  it('styles lists and headings itself', () => {
    const host = render('<h2>Title</h2><ul><li>One</li></ul><ol><li>Two</li></ol>');
    document.body.appendChild(host);

    expect(getComputedStyle(host.querySelector('ul')!).listStyleType).toBe('disc');
    expect(getComputedStyle(host.querySelector('ol')!).listStyleType).toBe('decimal');
    expect(getComputedStyle(host.querySelector('ul')!).paddingLeft).toBe('1.25rem');
    expect(getComputedStyle(host.querySelector('h2')!).fontWeight).toBe('600');
    host.remove();
  });

  it('shows old plain text as text and keeps its line breaks', () => {
    const host = render('error at line 5 < 6\nnext');
    const block = host.querySelector('[data-testid="rich-text-plain"]') as HTMLElement;

    expect(block.textContent).toBe('error at line 5 < 6\nnext');
    expect(block.className).toContain('whitespace-pre-wrap');
    expect(host.querySelector('[data-testid="rich-text-html"]')).toBeNull();
  });

  it('never puts active content into the page', () => {
    const host = render('<p>Hi<script>window.__rtv = 1</script><img src="x" onerror="window.__rtv = 1"></p>');

    expect(host.querySelector('script')).toBeNull();
    expect(host.querySelector('img')).toBeNull();
    expect(host.textContent).toContain('Hi');
  });

  it('renders nothing for an empty value', () => {
    const host = render(null);

    expect(host.textContent?.trim()).toBe('');
  });
});
