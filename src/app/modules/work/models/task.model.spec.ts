import { toBulkResultSummary } from './task.model';

describe('toBulkResultSummary', () => {
  it('carries the sent-for-approval count through to the result popup', () => {
    const summary = toBulkResultSummary({
      items: [
        { taskId: 't1', outcome: 'succeeded', reason: null },
        { taskId: 't2', outcome: 'pendingApproval', reason: null },
        { taskId: 't3', outcome: 'failed', reason: 'This task has subtasks.' }
      ],
      succeeded: 1,
      failed: 1,
      pendingApproval: 1
    });

    expect(summary.pendingApproval).toBe(1);
    expect(summary.items.map((i) => i.outcome)).toEqual(['succeeded', 'pendingApproval', 'failed']);
  });

  it('treats a response without the count as zero approvals', () => {
    expect(toBulkResultSummary({ items: [], succeeded: 0, failed: 0 }).pendingApproval).toBe(0);
  });
});
