import { TestBed } from '@angular/core/testing';
import { TaskKind } from '../../utils/task-kind';
import { TaskKindIconComponent } from './task-kind-icon.component';

describe('TaskKindIconComponent', () => {
  function render(kind: TaskKind, tile = false): HTMLElement {
    const fixture = TestBed.createComponent(TaskKindIconComponent);
    fixture.componentRef.setInput('kind', kind);
    fixture.componentRef.setInput('tile', tile);
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
});
