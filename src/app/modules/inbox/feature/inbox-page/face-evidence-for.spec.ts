import { describe, expect, it } from 'vitest';
import { InboxItemDetailDto } from '../../models/inbox.dto';
import { faceEvidenceFor } from './inbox-page.component';

const evidence = { exceptionId: 'x1', type: 'IdentityAnomaly', workDate: '2026-10-13', timezone: 'UTC', faceChecks: [], checkInScans: [] };

function detail(id: string): InboxItemDetailDto {
  return {
    item: { source: 'monitoring', kind: 'exception_case', id } as InboxItemDetailDto['item'],
    extraJson: JSON.stringify(evidence)
  } as InboxItemDetailDto;
}

const renderer = () => 'exception-evidence';

describe('faceEvidenceFor', () => {
  it('returns the open ticket’s evidence', () => {
    expect(faceEvidenceFor(detail('x1'), { source: 'monitoring', kind: 'exception_case', id: 'x1' }, renderer)?.exceptionId).toBe('x1');
  });

  it('never returns the previous ticket’s evidence while the new one loads', () => {
    expect(faceEvidenceFor(detail('x1'), { source: 'monitoring', kind: 'exception_case', id: 'x2' }, renderer)).toBeNull();
    expect(faceEvidenceFor(detail('x1'), null, renderer)).toBeNull();
  });

  it('is null for kinds without the evidence renderer', () => {
    expect(faceEvidenceFor(detail('x1'), { source: 'monitoring', kind: 'exception_case', id: 'x1' }, () => null)).toBeNull();
  });
});
