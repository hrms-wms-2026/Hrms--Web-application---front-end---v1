import { IconName } from '../../../shared/ui/icon/icon.component';

/**
 * A summary card on a wide 2-row dashboard widget (design 2026-11-07). Each card summarises one section of the
 * widget's popup; `section` is that section's id, so a click opens the popup there.
 */

/** A hex colour: the card's tint, a bar or a chip. */
export type SummaryTone = string;

/** "+2.0 pp" with whether that change is good news, then the comparison it is against ("vs last week"). */
export interface SummaryDelta {
  readonly text: string;
  readonly good: boolean;
  readonly suffix: string;
}

export interface SummaryChip {
  readonly text: string;
  readonly tone: SummaryTone;
}

export interface SummaryRankRow {
  readonly id: string;
  readonly name: string;
  readonly avatarFileId: string | null;
  readonly chips: readonly SummaryChip[];
}

export interface SummaryPersonRow {
  readonly id: string;
  readonly name: string;
  readonly avatarFileId: string | null;
  readonly chip: string;
}

export type SummaryCardBody =
  | { readonly kind: 'spark'; readonly figure: string; readonly delta: SummaryDelta | null; readonly points: readonly (number | null)[] }
  | { readonly kind: 'bars'; readonly figure: string; readonly delta: SummaryDelta | null; readonly values: readonly number[] }
  | {
      readonly kind: 'pair';
      readonly figure: string;
      readonly delta: SummaryDelta | null;
      readonly pairs: readonly (readonly [number, number])[];
      readonly legend: readonly [string, string];
    }
  | { readonly kind: 'meter'; readonly figure: string; readonly delta: SummaryDelta | null; readonly percent: number | null; readonly caption: string }
  | {
      readonly kind: 'hbars';
      readonly headline: string;
      readonly rows: readonly { readonly label: string; readonly percent: number | null; readonly tone: SummaryTone }[];
    }
  | { readonly kind: 'rank'; readonly count: string | null; readonly countLabel: string; readonly rows: readonly SummaryRankRow[]; readonly empty: string }
  | { readonly kind: 'people'; readonly count: string; readonly countLabel: string; readonly rows: readonly SummaryPersonRow[]; readonly empty: string }
  | {
      readonly kind: 'chips';
      readonly count: string;
      readonly countLabel: string;
      readonly items: readonly { readonly label: string; readonly value: number; readonly tone: SummaryTone }[];
    };

export interface SummaryCardModel {
  /** Stable id, e.g. 'att-rate'. */
  readonly id: string;
  readonly title: string;
  readonly icon: IconName;
  readonly tone: SummaryTone;
  /** The popup section this card summarises. */
  readonly section: string;
  readonly state: 'ready' | 'loading' | 'error';
  /** Set when ready. */
  readonly body: SummaryCardBody | null;
}
