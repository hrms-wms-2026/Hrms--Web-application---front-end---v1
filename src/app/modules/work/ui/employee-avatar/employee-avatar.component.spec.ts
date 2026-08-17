import { ComponentFixture, TestBed } from '@angular/core/testing';
import { EmployeeAvatarComponent } from './employee-avatar.component';
import { EmployeeDirectoryStore } from '../../state/employee-directory.store';
import { vi } from 'vitest';

describe('EmployeeAvatarComponent', () => {
  let fixture: ComponentFixture<EmployeeAvatarComponent>;
  let store: { get: ReturnType<typeof vi.fn>; ensureLoaded: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    store = {
      get: vi.fn().mockReturnValue({ id: 'emp-1', name: 'Nevi Peiris', initials: 'NP', avatarUrl: null }),
      ensureLoaded: vi.fn().mockResolvedValue(undefined)
    };
    await TestBed.configureTestingModule({
      imports: [EmployeeAvatarComponent],
      providers: [{ provide: EmployeeDirectoryStore, useValue: store }]
    }).compileComponents();
    fixture = TestBed.createComponent(EmployeeAvatarComponent);
    fixture.componentRef.setInput('employeeId', 'emp-1');
    fixture.detectChanges();
  });

  it('calls ensureLoaded for the given employeeId on init', () => {
    expect(store.ensureLoaded).toHaveBeenCalledWith(['emp-1']);
  });

  it('renders initials when no avatarUrl is present', () => {
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('NP');
  });

  it('never renders the raw employeeId as text', () => {
    const text = fixture.nativeElement.textContent as string;
    expect(text).not.toContain('emp-1');
  });
});
