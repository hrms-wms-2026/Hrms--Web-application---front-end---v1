import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { Subject, of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { ActivationApiService } from '../../data-access/activation-api.service';
import { ConnectDeviceComponent } from './connect-device.component';

describe('ConnectDeviceComponent', () => {
  let fixture: ComponentFixture<ConnectDeviceComponent>;
  let component: ConnectDeviceComponent;
  let activationApi: { generate: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    activationApi = { generate: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [ConnectDeviceComponent],
      providers: [{ provide: ActivationApiService, useValue: activationApi }]
    }).compileComponents();

    fixture = TestBed.createComponent(ConnectDeviceComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('generates an activation code as soon as the employee opens the page', () => {
    activationApi.generate.mockReturnValue(of({ code: 'APDBSJNA', expires_in_seconds: 600 }));

    fixture.detectChanges();

    expect(activationApi.generate).toHaveBeenCalledTimes(1);
    expect(fixture.debugElement.query(By.css('[data-testid="activation-code"]')).nativeElement.textContent.trim()).toBe(
      'APDBSJNA'
    );
  });

  it('presents activation as a three-step desktop connection journey', () => {
    activationApi.generate.mockReturnValue(of({ code: 'APDBSJNA', expires_in_seconds: 600 }));

    fixture.detectChanges();

    const page = fixture.debugElement.query(By.css('[data-testid="workspace-activation"]'));
    const steps = fixture.debugElement.queryAll(By.css('[data-testid="activation-step"]'));

    expect(page.nativeElement.textContent).toContain('Activate your OneXso Workspace');
    expect(fixture.debugElement.query(By.css('[data-testid="copy-code"]'))).toBeTruthy();
    expect(steps).toHaveLength(3);
  });

  it('generates a code and starts a 10-minute countdown', () => {
    activationApi.generate.mockReturnValue(of({ code: 'APDBSJNA', expires_in_seconds: 600 }));
    fixture.detectChanges();

    component.generate();
    fixture.detectChanges();

    expect(activationApi.generate).toHaveBeenCalledTimes(1);
    expect(component.code()).toBe('APDBSJNA');
    expect(component.formattedTime()).toBe('10:00');

    const codeEl = fixture.debugElement.query(By.css('[data-testid="activation-code"]'));
    expect(codeEl.nativeElement.textContent.trim()).toBe('APDBSJNA');
  });

  it('copies the code to the clipboard and shows a confirmation that clears after 1.5s', async () => {
    vi.useFakeTimers();
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
      configurable: true
    });
    activationApi.generate.mockReturnValue(of({ code: 'APDBSJNA', expires_in_seconds: 600 }));

    fixture.detectChanges();
    component.generate();
    fixture.detectChanges();

    component.copyCode();
    fixture.detectChanges();

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('APDBSJNA');
    expect(component.copied()).toBe(true);

    await vi.advanceTimersByTimeAsync(1500);
    fixture.detectChanges();
    expect(component.copied()).toBe(false);
  });

  it('counts down every second and expires the code at zero', async () => {
    vi.useFakeTimers();
    activationApi.generate.mockReturnValue(of({ code: 'APDBSJNA', expires_in_seconds: 2 }));

    fixture.detectChanges();
    component.generate();
    fixture.detectChanges();
    expect(component.secondsRemaining()).toBe(2);

    await vi.advanceTimersByTimeAsync(1000);
    fixture.detectChanges();
    expect(component.secondsRemaining()).toBe(1);
    expect(component.code()).toBe('APDBSJNA');

    await vi.advanceTimersByTimeAsync(1000);
    fixture.detectChanges();
    expect(component.code()).toBeNull();
    expect(component.expired()).toBe(true);
    expect(fixture.debugElement.query(By.css('[data-testid="generate-code"]'))).toBeTruthy();
  });

  it('resets the loading state on error without throwing, and shows no code', () => {
    activationApi.generate.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 429 })));
    fixture.detectChanges();

    component.generate();
    fixture.detectChanges();

    expect(component.generating()).toBe(false);
    expect(component.code()).toBeNull();
  });

  it('ignores a second generate() call while one is already in flight', () => {
    activationApi.generate.mockReturnValue(of({ code: 'APDBSJNA', expires_in_seconds: 600 }));
    fixture.detectChanges();

    component.generate();
    component.generate();

    expect(activationApi.generate).toHaveBeenCalledTimes(1);
  });

  it('allows a second, later generate() call after the first one settles', async () => {
    activationApi.generate.mockReturnValue(of({ code: 'APDBSJNA', expires_in_seconds: 600 }));
    fixture.detectChanges();

    component.generate();
    await Promise.resolve(); // let the queued microtask release the re-entrancy guard
    component.generate();

    expect(activationApi.generate).toHaveBeenCalledTimes(2);
  });

  it('does not start a countdown when a response arrives after component destruction', () => {
    const response$ = new Subject<{ code: string; expires_in_seconds: number }>();
    activationApi.generate.mockReturnValue(response$.asObservable());
    fixture.detectChanges();

    component.generate();
    fixture.destroy();
    response$.next({ code: 'APDBSJNA', expires_in_seconds: 600 });

    expect(component.code()).toBeNull();
    expect(component.secondsRemaining()).toBe(0);
  });
});
