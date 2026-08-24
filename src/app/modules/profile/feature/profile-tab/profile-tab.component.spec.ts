import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { ProfileTabComponent } from './profile-tab.component';
import { ProfileStore } from '../../state/profile.store';

describe('ProfileTabComponent', () => {
  const baseStoreMock = () => ({
    profile: signal(null),
    loading: signal(false),
    saving: signal(false),
    saveError: signal(null),
    error: signal(null),
    loadProfile: vi.fn()
  });

  it('shows a loading skeleton while the profile loads', async () => {
    const storeMock = { ...baseStoreMock(), loading: signal(true) };
    await TestBed.configureTestingModule({
      imports: [ProfileTabComponent],
      providers: [{ provide: ProfileStore, useValue: storeMock }]
    }).compileComponents();

    const fixture = TestBed.createComponent(ProfileTabComponent);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[aria-busy="true"]')).toBeTruthy();
  });

  it('shows an error banner when loading fails', async () => {
    const storeMock = { ...baseStoreMock(), error: signal('Failed to load profile.') };
    await TestBed.configureTestingModule({
      imports: [ProfileTabComponent],
      providers: [{ provide: ProfileStore, useValue: storeMock }]
    }).compileComponents();

    const fixture = TestBed.createComponent(ProfileTabComponent);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Failed to load profile.');
  });

  it('shows the active sub-tab panel once loaded', async () => {
    const storeMock = {
      ...baseStoreMock(),
      profile: signal({
        personalInformation: { firstName: 'Jane', lastName: 'Doe', email: 'jane@example.com' },
        jobInformation: {},
        emergencyContacts: [],
        dependents: [],
        payroll: {},
        security: {}
      })
    };
    await TestBed.configureTestingModule({
      imports: [ProfileTabComponent],
      providers: [{ provide: ProfileStore, useValue: storeMock }]
    }).compileComponents();

    const fixture = TestBed.createComponent(ProfileTabComponent);
    fixture.componentRef.setInput('activeSubTab', 'personal');
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('app-personal-info-form')).toBeTruthy();
    expect(fixture.nativeElement.querySelectorAll('.profile-subtab-btn').length).toBe(0);
  });

  it('calls loadProfile on init', async () => {
    const storeMock = baseStoreMock();
    await TestBed.configureTestingModule({
      imports: [ProfileTabComponent],
      providers: [{ provide: ProfileStore, useValue: storeMock }]
    }).compileComponents();

    TestBed.createComponent(ProfileTabComponent).detectChanges();
    expect(storeMock.loadProfile).toHaveBeenCalled();
  });
});
