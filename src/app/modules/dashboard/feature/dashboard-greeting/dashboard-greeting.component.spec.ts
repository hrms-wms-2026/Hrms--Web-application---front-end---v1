import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { AuthStore } from '../../../../core/auth/state/auth.store';
import { DashboardGreetingComponent } from './dashboard-greeting.component';

describe('DashboardGreetingComponent', () => {
  afterEach(() => TestBed.resetTestingModule());

  async function setup(email: string | null): Promise<ComponentFixture<DashboardGreetingComponent>> {
    await TestBed.configureTestingModule({
      imports: [DashboardGreetingComponent],
      providers: [{ provide: AuthStore, useValue: { email: signal(email) } }]
    }).compileComponents();

    const fixture = TestBed.createComponent(DashboardGreetingComponent);
    fixture.detectChanges();
    return fixture;
  }

  it('derives a display name from the email local-part, title-cased', async () => {
    const fixture = await setup('arjun.kumar@onevo.dev');
    expect(fixture.nativeElement.textContent).toContain('Arjun Kumar');
  });

  it('handles a single-word local-part', async () => {
    const fixture = await setup('arjun@onevo.dev');
    expect(fixture.nativeElement.textContent).toContain('Arjun');
  });

  it('falls back to a generic greeting when there is no email', async () => {
    const fixture = await setup(null);
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Good');
    expect(text).not.toContain('null');
    expect(text).not.toContain('undefined');
  });

  it('shows today\'s date', async () => {
    const fixture = await setup('arjun@onevo.dev');
    const expected = new Intl.DateTimeFormat(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date());
    expect(fixture.nativeElement.textContent).toContain(expected);
  });

  it('shows the fixed subtitle', async () => {
    const fixture = await setup('arjun@onevo.dev');
    expect(fixture.nativeElement.textContent).toContain('Here\'s what\'s happening with your work today.');
  });
});
