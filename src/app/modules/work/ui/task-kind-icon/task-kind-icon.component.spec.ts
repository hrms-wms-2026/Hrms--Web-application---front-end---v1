import { TestBed } from '@angular/core/testing';
import { TaskKind } from '../../utils/task-kind';
import { TaskKindIconComponent } from './task-kind-icon.component';

describe('TaskKindIconComponent', () => {
  function render(kind: TaskKind, tile = false, icon: string | null = null): HTMLElement {
    const fixture = TestBed.createComponent(TaskKindIconComponent);
    fixture.componentRef.setInput('kind', kind);
    fixture.componentRef.setInput('tile', tile);
    fixture.componentRef.setInput('icon', icon);
    fixture.detectChanges();
    return fixture.nativeElement.querySelector('[data-testid="task-kind-icon"]') as HTMLElement;
  }

  it('draws the kind icon in its colour, labelled for screen readers', () => {
    const el = render('bug');

    expect(el.getAttribute('data-kind')).toBe('bug');
    expect(el.className).toContain('text-red-600');
    expect(el.querySelector('svg')).not.toBeNull();
    expect(el.getAttribute('aria-label')).toBe('Bug');
  });

  it('as a tile, sits on the kind tint', () => {
    const el = render('story', true);

    expect(el.className).toContain('bg-violet-50');
    expect(el.className).toContain('rounded');
  });

  it('shows a picked icon in the kind colour', () => {
    const el = render('bug', false, 'emoji:🐞');

    expect(el.className).toContain('text-red-600');
    expect(el.querySelector('[data-testid="task-kind-picked-icon"]')!.textContent).toContain('🐞');
  });

  it('falls back to the kind icon for an icon this build does not offer', () => {
    const el = render('bug', false, 'lucide:no-such-icon');

    expect(el.querySelector('[data-testid="task-kind-picked-icon"]')).toBeNull();
    expect(el.querySelector('svg')).not.toBeNull();
  });
});
