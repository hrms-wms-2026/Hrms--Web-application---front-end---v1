import { buildTaskDeepLink, copyTextToClipboard } from './task-deep-link.util';

describe('task deep links', () => {
  it('builds a canonical board URL that identifies the task', () => {
    expect(buildTaskDeepLink('https://onexso.com', 'project 1', 'task/2')).toBe(
      'https://onexso.com/work/project%201/board?taskId=task%2F2'
    );
  });

  it('adds a comment fragment without losing the task identifier', () => {
    expect(buildTaskDeepLink('https://onexso.com', 'p1', 't1', 'c1')).toBe(
      'https://onexso.com/work/p1/board?taskId=t1#comment-c1'
    );
  });

  it('uses the Clipboard API when it is available', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });

    await expect(copyTextToClipboard('task-link')).resolves.toBe(true);
    expect(writeText).toHaveBeenCalledWith('task-link');
  });
});
