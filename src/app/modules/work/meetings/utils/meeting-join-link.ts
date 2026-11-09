import { MeetingPlatform, MeetingSeriesLinkResponse } from '../models/meeting.models';

/** Where a Join button goes, and the app it opens. */
export interface MeetingJoinLink {
  readonly url: string;
  readonly label: string;
}

const PLATFORM_LABELS: Record<MeetingPlatform, string> = { microsoft_teams: 'Teams', zoom: 'Zoom' };

/** The organizer joins by their own link when the provider gave one; everyone else by the shared one. Only http(s). */
export function joinLinkOf(response: MeetingSeriesLinkResponse): MeetingJoinLink | null {
  const url = (response.link?.organizerJoinUrl || response.joinUrl || '').trim();
  if (!/^https?:\/\//i.test(url)) return null;
  const provider = response.link?.provider;
  return { url, label: provider ? `Join on ${PLATFORM_LABELS[provider]}` : 'Join meeting' };
}
