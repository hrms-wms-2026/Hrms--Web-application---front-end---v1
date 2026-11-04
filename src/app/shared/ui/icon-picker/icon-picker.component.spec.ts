import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { IconPickerComponent } from './icon-picker.component';

@Component({
  standalone: true,
  imports: [IconPickerComponent],
  template: `
    <app-icon-picker [icon]="icon()" [color]="color()" name="Apollo" [defaultIcon]="defaultIcon()"
                     (iconChange)="picked.push($event); icon.set($event)" (colorChange)="colors.push($event)" />
  `
})
class HostComponent {
  readonly icon = signal<string | null>(null);
  readonly color = signal<string | null>('#6366F1');
  readonly defaultIcon = signal<string | null>(null);
  readonly picked: (string | null)[] = [];
  readonly colors: string[] = [];
}

describe('IconPickerComponent', () => {
  async function setup() {
    await TestBed.configureTestingModule({ imports: [HostComponent] }).compileComponents();
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    return fixture;
  }

  const panel = () => document.querySelector('[data-testid="icon-picker-panel"]');
  const all = (testId: string) => Array.from(document.querySelectorAll<HTMLElement>(`[data-testid="${testId}"]`));

  function open(fixture: Awaited<ReturnType<typeof setup>>): void {
    (fixture.nativeElement.querySelector('[data-testid="icon-picker-trigger"]') as HTMLButtonElement).click();
    fixture.detectChanges();
  }

  afterEach(() => document.querySelectorAll('.cdk-overlay-container').forEach(c => c.replaceChildren()));

  it('opens on the Icons tab and emits the picked Lucide value, then closes', async () => {
    const fixture = await setup();
    open(fixture);
    expect(panel()).toBeTruthy();

    const rocket = all('icon-picker-icon').find(b => b.getAttribute('aria-label') === 'rocket')!;
    rocket.click();
    fixture.detectChanges();

    expect(fixture.componentInstance.picked).toEqual(['lucide:rocket']);
    expect(panel()).toBeNull();
  });

  it('filters icons by name and keyword', async () => {
    const fixture = await setup();
    open(fixture);
    const search = document.querySelector<HTMLInputElement>('[data-testid="icon-picker-search"]')!;
    search.value = 'vacation';
    search.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    const names = all('icon-picker-icon').map(b => b.getAttribute('aria-label'));
    expect(names).toContain('tree-palm');
    expect(names).not.toContain('rocket');
  });

  it('emits swatch colours without closing, and Remove only shows once something is picked', async () => {
    const fixture = await setup();
    open(fixture);
    expect(document.querySelector('[data-testid="icon-picker-remove"]')).toBeNull();

    all('icon-picker-color')[3].click();
    fixture.detectChanges();
    expect(fixture.componentInstance.colors).toEqual(['#EF4444']);
    expect(panel()).toBeTruthy();

    fixture.componentInstance.icon.set('emoji:🚀');
    fixture.detectChanges();
    (document.querySelector('[data-testid="icon-picker-remove"]') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(fixture.componentInstance.picked).toEqual([null]);
  });

  it('shows the default icon on the trigger without emitting it', async () => {
    const fixture = await setup();
    fixture.componentInstance.defaultIcon.set('lucide:tree-palm');
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[data-testid="icon-picker-trigger"] svg path')).toBeTruthy();
    expect(fixture.componentInstance.picked).toEqual([]);
  });
});
