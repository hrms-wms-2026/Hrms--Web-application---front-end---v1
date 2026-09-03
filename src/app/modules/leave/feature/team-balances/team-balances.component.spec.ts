import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { describe, expect, it, vi } from 'vitest';
import { TeamBalancesComponent } from './team-balances.component';
import { LeaveBalanceStore } from '../../state/leave-balance.store';

describe('TeamBalancesComponent', () => {
  async function setup() {
    const store = {
      team: signal([]),
      teamLoading: signal(false),
      teamError: signal<string | null>(null),
      teamFilters: signal({}),
      year: signal(2026),
      loadTeam: vi.fn(),
      setTeamFilters: vi.fn()
    };

    await TestBed.configureTestingModule({
      imports: [TeamBalancesComponent],
      providers: [{ provide: LeaveBalanceStore, useValue: store }]
    }).compileComponents();

    const fixture: ComponentFixture<TeamBalancesComponent> = TestBed.createComponent(TeamBalancesComponent);
    fixture.detectChanges();
    return { fixture, store };
  }

  it('shows its own header by default', async () => {
    const { fixture } = await setup();
    expect(fixture.nativeElement.querySelector('.tbc-header')).toBeTruthy();
  });

  it('hides its own header when embedded', async () => {
    const { fixture } = await setup();
    fixture.componentRef.setInput('embedded', true);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.tbc-header')).toBeNull();
  });

  it('loads the team balances for the current year on init regardless of embedded mode', async () => {
    const { store } = await setup();
    expect(store.loadTeam).toHaveBeenCalledWith(2026);
  });
});
