import { TestBed } from '@angular/core/testing';
import { ProgressRingComponent } from './progress-ring.component';

describe('ProgressRingComponent', () => {
  async function setup(progress: number, extra?: { size?: number; strokeWidth?: number; gradient?: boolean }) {
    await TestBed.configureTestingModule({ imports: [ProgressRingComponent] }).compileComponents();
    const fixture = TestBed.createComponent(ProgressRingComponent);
    fixture.componentRef.setInput('progress', progress);
    if (extra?.size !== undefined) fixture.componentRef.setInput('size', extra.size);
    if (extra?.strokeWidth !== undefined) fixture.componentRef.setInput('strokeWidth', extra.strokeWidth);
    if (extra?.gradient !== undefined) fixture.componentRef.setInput('gradient', extra.gradient);
    fixture.detectChanges();
    return fixture;
  }

  it('renders the progress percentage as text', async () => {
    const fixture = await setup(42);
    expect(fixture.nativeElement.textContent).toContain('42%');
  });

  it('clamps progress above 100 down to 100%', async () => {
    const fixture = await setup(150);
    expect(fixture.nativeElement.textContent).toContain('100%');
  });

  it('clamps negative progress up to 0%', async () => {
    const fixture = await setup(-10);
    expect(fixture.nativeElement.textContent).toContain('0%');
  });

  it('defaults to a 64px ring', async () => {
    const fixture = await setup(50);
    const svg = fixture.nativeElement.querySelector('svg') as SVGSVGElement;
    expect(svg.getAttribute('width')).toBe('64');
    expect(svg.getAttribute('height')).toBe('64');
  });

  it('renders a custom size', async () => {
    const fixture = await setup(50, { size: 96 });
    const svg = fixture.nativeElement.querySelector('svg') as SVGSVGElement;
    expect(svg.getAttribute('width')).toBe('96');
    expect(svg.getAttribute('height')).toBe('96');
  });

  it('uses a flat accent stroke when gradient is off (default)', async () => {
    const fixture = await setup(50);
    const circles = fixture.nativeElement.querySelectorAll('circle');
    const progressCircle = circles[1] as SVGCircleElement;
    expect(progressCircle.getAttribute('stroke')).toBe('var(--color-accent)');
    expect(fixture.nativeElement.querySelector('linearGradient')).toBeFalsy();
  });

  it('renders a gradient stroke referencing a linearGradient def when gradient is on', async () => {
    const fixture = await setup(50, { gradient: true });
    const gradientEl = fixture.nativeElement.querySelector('linearGradient') as SVGLinearGradientElement;
    expect(gradientEl).toBeTruthy();
    const gradientId = gradientEl.getAttribute('id')!;
    expect(gradientId).toBeTruthy();

    const circles = fixture.nativeElement.querySelectorAll('circle');
    const progressCircle = circles[1] as SVGCircleElement;
    expect(progressCircle.getAttribute('stroke')).toBe(`url(#${gradientId})`);
  });

  it('gives two ring instances distinct gradient ids', async () => {
    await TestBed.configureTestingModule({ imports: [ProgressRingComponent] }).compileComponents();

    const first = TestBed.createComponent(ProgressRingComponent);
    first.componentRef.setInput('progress', 50);
    first.componentRef.setInput('gradient', true);
    first.detectChanges();

    const second = TestBed.createComponent(ProgressRingComponent);
    second.componentRef.setInput('progress', 50);
    second.componentRef.setInput('gradient', true);
    second.detectChanges();

    const firstId = (first.nativeElement.querySelector('linearGradient') as SVGLinearGradientElement).getAttribute('id');
    const secondId = (second.nativeElement.querySelector('linearGradient') as SVGLinearGradientElement).getAttribute('id');
    expect(firstId).not.toBe(secondId);
  });
});
