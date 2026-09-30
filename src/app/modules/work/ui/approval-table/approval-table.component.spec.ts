import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ApprovalTableComponent } from './approval-table.component';
import { ApprovalFeedItemDto } from '../../models/dto/approval-feed.dto';

function feedItem(overrides: Partial<ApprovalFeedItemDto> = {}): ApprovalFeedItemDto {
  return {
    id: 'r1', source: 'engine', actionType: 'task.edit', targetType: 'task', targetId: 't1', targetTitle: 'Audit',
    moduleId: 'm1', moduleTitle: 'Payments', projectName: 'Apollo', status: 'pending', direction: 'received',
    requestedById: 'e1', requestedByName: 'Bala Kumar', approverId: 'e2', approverName: 'Anu', decidedById: null,
    decidedByName: null, decisionComment: null, createdAt: '2026-09-29T10:24:00Z', decidedAt: null,
    canDecide: true, canCancel: false, commentCount: 0, summary: null, ...overrides
  };
}

describe('ApprovalTableComponent', () => {
  let fixture: ComponentFixture<ApprovalTableComponent>;
  let el: HTMLElement;

  function render(items: ApprovalFeedItemDto[], selectedId: string | null = null): void {
    fixture.componentRef.setInput('items', items);
    fixture.componentRef.setInput('selectedId', selectedId);
    fixture.detectChanges();
  }

  const rows = () => Array.from(el.querySelectorAll<HTMLElement>('[data-testid="approval-row"]'));

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [ApprovalTableComponent] }).compileComponents();
    fixture = TestBed.createComponent(ApprovalTableComponent);
    el = fixture.nativeElement;
  });

  it('renders one row per item up to the page size and the range line', () => {
    render(Array.from({ length: 12 }, (_, i) => feedItem({ id: `r${i + 1}` })));

    expect(rows().length).toBe(10);
    expect(el.querySelector('[data-testid="approval-table-range"]')!.textContent!.trim()).toBe('Showing 1 - 10 of 12 requests');
    expect(el.textContent).toContain('Update task details');
    expect(el.textContent).toContain('Task Update');
    expect(el.textContent).toContain('Payments');
    expect(el.textContent).toContain('Apollo');
    expect(el.textContent).toContain('Bala Kumar');
  });

  it('next page shows rows 11-12', () => {
    render(Array.from({ length: 12 }, (_, i) => feedItem({ id: `r${i + 1}` })));

    (el.querySelector('[data-testid="approval-page-next"]') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(rows().map((r) => r.dataset['id'])).toEqual(['r11', 'r12']);
    expect(el.querySelector('[data-testid="approval-table-range"]')!.textContent!.trim()).toBe('Showing 11 - 12 of 12 requests');
  });

  it('clicking a row emits rowSelected and the selected row is highlighted', () => {
    const item = feedItem();
    render([item, feedItem({ id: 'r2' })], 'r2');
    let selected: ApprovalFeedItemDto | undefined;
    fixture.componentInstance.rowSelected.subscribe((i) => (selected = i));

    rows()[0].click();

    expect(selected).toEqual(item);
    expect(rows()[1].classList).toContain('approval-table__row--selected');
    expect(rows()[0].classList).not.toContain('approval-table__row--selected');
  });

  it('the 3-dot menu offers Approve for a decidable row and never Reject', () => {
    const menu = fixture.componentInstance.menuFor(feedItem());
    expect(menu.map((m) => m.id)).toEqual(['view', 'approve', 'open', 'copy']);
    expect(menu.some((m) => m.id === 'reject' || /reject|decline/i.test(m.label))).toBe(false);

    const sent = fixture.componentInstance.menuFor(feedItem({ canDecide: false, canCancel: true, direction: 'sent' }));
    expect(sent.map((m) => m.label)).toEqual(['View details', 'Open task', 'Cancel request', 'Copy link']);

    const decided = fixture.componentInstance.menuFor(feedItem({ status: 'approved', canDecide: true, targetType: 'project', targetId: null }));
    expect(decided.map((m) => m.id)).toEqual(['view', 'copy']);
  });

  it('an invitation row offers Accept', () => {
    const menu = fixture.componentInstance.menuFor(feedItem({ source: 'invitation', actionType: 'module.invitation', targetType: 'module' }));
    expect(menu.map((m) => m.label)).toEqual(['View details', 'Accept', 'Open module', 'Copy link']);
  });

  it('shows "Accepted" for an approved invitation and the comment count', () => {
    render([feedItem({ source: 'invitation', actionType: 'module.invitation', status: 'approved', commentCount: 3 })]);

    expect(el.querySelector('[data-testid="approval-status"]')!.textContent!.trim()).toBe('Accepted');
    expect(el.querySelector('[data-testid="approval-row-comments"]')!.textContent!.trim()).toBe('3');
    expect(el.textContent).toContain('Module Invitation');
  });

  it('shows the empty message when there are no rows', () => {
    render([]);
    expect(el.querySelector('[data-testid="approval-table-empty"]')!.textContent).toContain('No requests match these filters.');
    fixture.componentRef.setInput('emptyMessage', 'No approval requests in this project yet.');
    fixture.detectChanges();
    expect(el.textContent).toContain('No approval requests in this project yet.');
  });
});
