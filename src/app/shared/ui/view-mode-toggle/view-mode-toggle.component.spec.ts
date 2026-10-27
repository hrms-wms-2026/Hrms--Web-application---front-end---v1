import { TestBed } from '@angular/core/testing';
import { ViewModeOption, ViewModeToggleComponent } from './view-mode-toggle.component';

const MODES: ViewModeOption[] = [
  { value: 'tree', label: 'Tree', icon: 'tree' },
  { value: 'list', label: 'List', icon: 'list' }
];

describe('ViewModeToggleComponent', () => {
  async function setup(value: string) {
    await TestBed.configureTestingModule({ imports: [ViewModeToggleComponent] }).compileComponents();
    const fixture = TestBed.createComponent(ViewModeToggleComponent);
    fixture.componentRef.setInput('modes', MODES);
    fixture.componentRef.setInput('value', value);
    fixture.detectChanges();
    const button: HTMLButtonElement = fixture.nativeElement.querySelector('button');
    return { fixture, button };
  }

  it('renders one square button labelled with the current and next view', async () => {
    const { button } = await setup('tree');
    expect(button.classList).toContain('ui-square-btn');
    expect(button.getAttribute('aria-label')).toBe('Tree view, switch to List view');
    expect(button.getAttribute('title')).toBe('Tree view (click to switch to List)');
    expect(button.getAttribute('data-testid')).toBe('view-mode-toggle');
  });

  it('emits the next mode on click and wraps around', async () => {
    const { fixture, button } = await setup('list');
    const emitted: string[] = [];
    fixture.componentInstance.valueChange.subscribe((v) => emitted.push(v));

    button.click();

    expect(emitted).toEqual(['tree']);
  });

  it('uses the given test id', async () => {
    const { fixture } = await setup('tree');
    fixture.componentRef.setInput('testId', 'work-view-cycle-btn');
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[data-testid="work-view-cycle-btn"]')).not.toBeNull();
  });
});
