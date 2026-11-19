import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MeetingApiService } from '../../data-access/meeting-api.service';
import { MeetingLinkResponse, MeetingLinkStatus, MeetingSeriesLinkResponse } from '../../models/meeting.models';
import { MeetingLinkPanelComponent } from './meeting-link-panel.component';

describe('MeetingLinkPanelComponent', () => {
  let fixture: ComponentFixture<MeetingLinkPanelComponent>;
  const api = { getLink: vi.fn(), createLink: vi.fn(), retryLink: vi.fn(), removeLink: vi.fn(), confirmLinkCleanup: vi.fn() };

  const link = (status: MeetingLinkStatus, over: Partial<MeetingLinkResponse> = {}): MeetingLinkResponse => ({
    linkId: 'l1', provider: 'zoom', status, joinUrl: status === 'active' ? 'https://zoom.us/j/1' : null, organizerJoinUrl: null,
    failureReason: null, generation: 1, releasePending: false, ...over,
  });
  const organizerView = (l: MeetingLinkResponse | null): MeetingSeriesLinkResponse => ({ joinUrl: l?.joinUrl ?? null, link: l });

  async function build(isOrganizer: boolean, ended = false): Promise<void> {
    fixture = TestBed.createComponent(MeetingLinkPanelComponent);
    fixture.componentRef.setInput('seriesId', 's1');
    fixture.componentRef.setInput('isOrganizer', isOrganizer);
    fixture.componentRef.setInput('ended', ended);
    fixture.detectChanges();
    await vi.advanceTimersByTimeAsync(0);
    fixture.detectChanges();
  }
  const text = () => (fixture.nativeElement as HTMLElement).textContent ?? '';
  const testId = (id: string) => fixture.nativeElement.querySelector(`[data-testid="${id}"]`) as HTMLElement | null;

  beforeEach(() => {
    vi.useFakeTimers();
    Object.values(api).forEach((f) => f.mockReset());
    TestBed.configureTestingModule({ providers: [{ provide: MeetingApiService, useValue: api }] });
  });
  afterEach(() => vi.useRealTimers());

  it('shows an attendee Join or nothing, never the link controls', async () => {
    api.getLink.mockReturnValue(of({ joinUrl: 'https://zoom.us/j/1' }));
    await build(false);
    expect((testId('meeting-link-join') as HTMLAnchorElement).href).toBe('https://zoom.us/j/1');
    expect(testId('meeting-link-add')).toBeNull();
    expect(testId('meeting-link-remove')).toBeNull();

    api.getLink.mockReturnValue(of({ joinUrl: null }));
    await build(false);
    expect(testId('meeting-link-join')).toBeNull();
    expect(text().trim()).toBe('');
  });

  it('stops polling on a terminal status and offers the next action', async () => {
    api.getLink
      .mockReturnValueOnce(of(organizerView(link('provisioning'))))
      .mockReturnValueOnce(of(organizerView(link('provisioning'))))
      .mockReturnValueOnce(of(organizerView(link('provisioning_unknown'))));
    await build(true);
    expect(api.getLink).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(3000);
    await vi.advanceTimersByTimeAsync(3000);
    fixture.detectChanges();
    expect(api.getLink).toHaveBeenCalledTimes(3);
    expect(testId('meeting-link-retry')).not.toBeNull();

    await vi.advanceTimersByTimeAsync(30000);
    expect(api.getLink).toHaveBeenCalledTimes(3);

    api.getLink.mockReturnValue(of(organizerView(link('unresolved'))));
    await build(true);
    expect(text()).toContain('Delete it in Teams/Zoom, then confirm');
    expect(testId('meeting-link-cleanup')).not.toBeNull();
  });

  it('gives up polling after 2 minutes of provisioning', async () => {
    api.getLink.mockReturnValue(of(organizerView(link('provisioning'))));
    await build(true);
    await vi.advanceTimersByTimeAsync(10 * 60 * 1000);
    expect(api.getLink.mock.calls.length).toBeLessThanOrEqual(1 + 40);
    const calls = api.getLink.mock.calls.length;
    await vi.advanceTimersByTimeAsync(60000);
    expect(api.getLink.mock.calls.length).toBe(calls);
  });

  it('offers Add for the organizer when there is no link, and regenerate when there is one', async () => {
    api.getLink.mockReturnValue(of(organizerView(null)));
    await build(true);
    expect(testId('meeting-link-add')).not.toBeNull();

    api.getLink.mockReturnValue(of(organizerView(link('active'))));
    await build(true);
    expect(testId('meeting-link-regenerate')).not.toBeNull();
    expect(text()).toContain('Active');
  });

  it('says the link is kept for other meetings in the series when the removal is pending', async () => {
    api.getLink.mockReturnValue(of(organizerView(link('active'))));
    api.removeLink.mockReturnValue(of(link('active', { releasePending: true })));
    await build(true);
    testId('meeting-link-remove')!.click();
    await vi.advanceTimersByTimeAsync(0);
    fixture.detectChanges();
    expect(text()).toContain('Kept for other meetings in this series');
  });

  it('keeps the added link on show: its address, Join and Copy', async () => {
    const writeText = vi.fn(async () => undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    api.getLink.mockReturnValue(of(organizerView(link('active', { provider: 'microsoft_teams', joinUrl: 'https://teams.microsoft.com/l/meetup-join/abc' }))));
    await build(true);

    expect(testId('meeting-link-url')?.textContent?.trim()).toBe('https://teams.microsoft.com/l/meetup-join/abc');
    expect((testId('meeting-link-join') as HTMLAnchorElement).href).toBe('https://teams.microsoft.com/l/meetup-join/abc');

    testId('meeting-link-copy')!.click();
    await vi.advanceTimersByTimeAsync(0);
    fixture.detectChanges();
    expect(writeText).toHaveBeenCalledWith('https://teams.microsoft.com/l/meetup-join/abc');
    expect(testId('meeting-link-copy')?.textContent?.trim()).toBe('Copied');
    await vi.advanceTimersByTimeAsync(2000);
    fixture.detectChanges();
    expect(testId('meeting-link-copy')?.textContent?.trim()).toBe('Copy link');
  });

  it('after the meeting the link stays, but nothing can be added or changed', async () => {
    api.getLink.mockReturnValue(of(organizerView(link('active'))));
    await build(true, true);
    expect(testId('meeting-link-url')?.textContent?.trim()).toBe('https://zoom.us/j/1');
    expect(testId('meeting-link-regenerate')).toBeNull();
    expect(testId('meeting-link-remove')).toBeNull();
    expect(testId('meeting-link-add')).toBeNull();

    api.getLink.mockReturnValue(of(organizerView(null)));
    await build(true, true);
    expect(testId('meeting-link-add')).toBeNull();
    expect(testId('meeting-link-none')?.textContent?.trim()).toBe('No online meeting link was added.');
  });
});
