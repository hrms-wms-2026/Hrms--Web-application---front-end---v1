import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ToastHostComponent } from './toast-host.component';
import { NotificationService } from '../../../core/services/notification.service';
import { By } from '@angular/platform-browser';

describe('ToastHostComponent', () => {
  let fixture: ComponentFixture<ToastHostComponent>;
  let notificationService: NotificationService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ToastHostComponent],
      providers: [NotificationService]
    }).compileComponents();

    fixture = TestBed.createComponent(ToastHostComponent);
    notificationService = TestBed.inject(NotificationService);
    fixture.detectChanges();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders no toasts initially when notifications list is empty', () => {
    const toastItems = fixture.debugElement.queryAll(By.css('.toast-item'));
    expect(toastItems.length).toBe(0);
  });

  it('renders success, error, info, and warning toast variants visibly with proper accessibility attributes', () => {
    notificationService.success('Success message');
    notificationService.error('Error message');
    notificationService.info('Info message');
    notificationService.warning('Warning message');
    fixture.detectChanges();

    const toastItems = fixture.debugElement.queryAll(By.css('.toast-item'));
    expect(toastItems.length).toBe(4);

    const successToast = toastItems[0].nativeElement as HTMLElement;
    expect(successToast.classList.contains('toast-item--success')).toBe(true);
    expect(successToast.getAttribute('role')).toBe('status');
    expect(successToast.getAttribute('aria-live')).toBe('polite');
    expect(successToast.textContent).toContain('Success message');

    const errorToast = toastItems[1].nativeElement as HTMLElement;
    expect(errorToast.classList.contains('toast-item--error')).toBe(true);
    expect(errorToast.getAttribute('role')).toBe('alert');
    expect(errorToast.getAttribute('aria-live')).toBe('assertive');
    expect(errorToast.textContent).toContain('Error message');

    const infoToast = toastItems[2].nativeElement as HTMLElement;
    expect(infoToast.classList.contains('toast-item--info')).toBe(true);
    expect(infoToast.getAttribute('role')).toBe('status');
    expect(infoToast.getAttribute('aria-live')).toBe('polite');
    expect(infoToast.textContent).toContain('Info message');

    const warningToast = toastItems[3].nativeElement as HTMLElement;
    expect(warningToast.classList.contains('toast-item--warning')).toBe(true);
    expect(warningToast.getAttribute('role')).toBe('status');
    expect(warningToast.getAttribute('aria-live')).toBe('polite');
    expect(warningToast.textContent).toContain('Warning message');
  });

  it('dismisses a toast when clicking the close button', () => {
    notificationService.error('Operation failed');
    fixture.detectChanges();

    let toastItems = fixture.debugElement.queryAll(By.css('.toast-item'));
    expect(toastItems.length).toBe(1);

    const closeBtn = fixture.debugElement.query(By.css('.toast-item__close'));
    closeBtn.nativeElement.click();
    fixture.detectChanges();

    toastItems = fixture.debugElement.queryAll(By.css('.toast-item'));
    expect(toastItems.length).toBe(0);
  });

  it('auto-dismisses success toast after 5 seconds', async () => {
    vi.useFakeTimers();
    notificationService.success('Auto dismiss test');
    fixture.detectChanges();

    expect(fixture.debugElement.queryAll(By.css('.toast-item')).length).toBe(1);

    await vi.advanceTimersByTimeAsync(5000);
    fixture.detectChanges();

    expect(fixture.debugElement.queryAll(By.css('.toast-item')).length).toBe(0);
  });

  it('auto-dismisses error toast after 8 seconds', async () => {
    vi.useFakeTimers();
    notificationService.error('Error auto dismiss test');
    fixture.detectChanges();

    expect(fixture.debugElement.queryAll(By.css('.toast-item')).length).toBe(1);

    await vi.advanceTimersByTimeAsync(5000);
    fixture.detectChanges();
    // Error stays visible at 5s
    expect(fixture.debugElement.queryAll(By.css('.toast-item')).length).toBe(1);

    await vi.advanceTimersByTimeAsync(3000);
    fixture.detectChanges();
    // Dismisses at 8s
    expect(fixture.debugElement.queryAll(By.css('.toast-item')).length).toBe(0);
  });

  it('prevents consecutive duplicate notifications', () => {
    notificationService.error('Same error');
    notificationService.error('Same error');
    fixture.detectChanges();

    const toastItems = fixture.debugElement.queryAll(By.css('.toast-item'));
    expect(toastItems.length).toBe(1);
  });
});
