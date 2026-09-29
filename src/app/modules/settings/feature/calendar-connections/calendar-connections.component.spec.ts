import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CalendarConnectionsComponent } from './calendar-connections.component';
import { CalendarConnectionsStore } from '../../state/calendar-connections.store';

describe('CalendarConnectionsComponent', () => {
  let fixture: ComponentFixture<CalendarConnectionsComponent>;
  let storeStub: Partial<InstanceType<typeof CalendarConnectionsStore>>;

  beforeEach(async () => {
    storeStub = {
      connections: signal([]) as any,
      loading: signal(false) as any,
      loaded: signal(true) as any,
      error: signal(null) as any,
      connectingProvider: signal(null) as any,
      actionLoadingByConnectionId: signal({}) as any,
      actionErrorByConnectionId: signal({}) as any,
      load: vi.fn() as any,
      connect: vi.fn() as any,
      updateSyncDirection: vi.fn() as any,
      disconnect: vi.fn() as any,
      triggerSync: vi.fn() as any
    };
    await TestBed.configureTestingModule({
      imports: [CalendarConnectionsComponent],
      providers: [{ provide: CalendarConnectionsStore, useValue: storeStub }]
    }).compileComponents();
    fixture = TestBed.createComponent(CalendarConnectionsComponent);
    fixture.detectChanges();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders a "Connect Zoom" button', () => {
    const button = fixture.nativeElement.querySelector('[data-testid="connect-zoom"] button');
    expect(button).toBeTruthy();
    expect(button.textContent).toContain('Connect Zoom');
  });

  it('clicking the Connect Zoom button calls store.connect with "zoom"', () => {
    const button = fixture.nativeElement.querySelector('[data-testid="connect-zoom"] button') as HTMLButtonElement;
    button.click();
    expect(storeStub.connect).toHaveBeenCalledWith('zoom');
  });

  it('shows "Zoom connected" and disables the button once a Zoom connection exists', () => {
    (storeStub.connections as any).set([
      { id: 'c1', provider: 'zoom', externalAccountEmail: 'me@acme.com', externalCalendarName: null, syncDirection: 'disabled', status: 'active', lastSyncedAt: null, lastError: null }
    ]);
    fixture.detectChanges();

    const button = fixture.nativeElement.querySelector('[data-testid="connect-zoom"] button') as HTMLButtonElement;
    expect(button.textContent).toContain('Zoom connected');
    expect(button.disabled).toBe(true);
  });

  it('renders "Zoom" as the provider label for a connected Zoom row', () => {
    (storeStub.connections as any).set([
      { id: 'c1', provider: 'zoom', externalAccountEmail: 'me@acme.com', externalCalendarName: null, syncDirection: 'disabled', status: 'active', lastSyncedAt: null, lastError: null }
    ]);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Zoom');
    expect(fixture.componentInstance.providerLabel('zoom')).toBe('Zoom');
  });
});
