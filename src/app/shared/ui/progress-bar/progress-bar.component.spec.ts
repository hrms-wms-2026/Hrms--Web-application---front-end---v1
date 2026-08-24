import { TestBed } from '@angular/core/testing';
import { ProgressBarComponent } from './progress-bar.component';

describe('ProgressBarComponent', () => {
  async function setup(progress: number) {
    await TestBed.configureTestingModule({ imports: [ProgressBarComponent] }).compileComponents();
    const fixture = TestBed.createComponent(ProgressBarComponent);
    fixture.componentRef.setInput('progress', progress);
    fixture.detectChanges();
    return fixture;
  }

  it('sets the fill width to the given progress', async () => {
    const fixture = await setup(40);
    const fill = fixture.nativeElement.querySelector('[data-testid="progress-fill"]') as HTMLElement;
    expect(fill.style.width).toBe('40%');
  });

  it('clamps progress above 100 down to 100%', async () => {
    const fixture = await setup(150);
    const fill = fixture.nativeElement.querySelector('[data-testid="progress-fill"]') as HTMLElement;
    expect(fill.style.width).toBe('100%');
  });

  it('clamps negative progress up to 0%', async () => {
    const fixture = await setup(-10);
    const fill = fixture.nativeElement.querySelector('[data-testid="progress-fill"]') as HTMLElement;
    expect(fill.style.width).toBe('0%');
  });
});
