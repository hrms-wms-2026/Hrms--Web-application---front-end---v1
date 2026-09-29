import { TestBed } from '@angular/core/testing';
import { BulkActionResultModalComponent, BulkResultSummary } from './bulk-action-result-modal.component';

const summary: BulkResultSummary = {
  items: [
    { id: 'a', outcome: 'succeeded', reason: null },
    { id: 'c', outcome: 'failed', reason: 'This task has subtasks. Delete or move its subtasks first.' }
  ],
  succeeded: 1,
  pendingApproval: 0,
  failed: 1
};

function render(showApprovals: boolean): HTMLElement {
  const fixture = TestBed.createComponent(BulkActionResultModalComponent);
  fixture.componentRef.setInput('result', summary);
  fixture.componentRef.setInput('title', 'Delete results');
  fixture.componentRef.setInput('names', new Map([['c', 'Write docs']]));
  fixture.componentRef.setInput('showApprovals', showApprovals);
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

describe('BulkActionResultModalComponent', () => {
  it('summarises counts and lists failures by name', () => {
    const el = render(true);
    expect(el.querySelector('[data-testid="bulk-result-summary"]')!.textContent)
      .toContain('1 changed · 0 sent for approval · 1 skipped');
    expect(el.querySelector('[data-testid="bulk-result-failure-c"]')!.textContent).toContain('Write docs');
  });

  it('omits the approvals segment when not applicable', () => {
    const el = render(false);
    expect(el.querySelector('[data-testid="bulk-result-summary"]')!.textContent!.replace(/\s+/g, ' ').trim())
      .toBe('1 changed · 1 skipped');
  });
});
