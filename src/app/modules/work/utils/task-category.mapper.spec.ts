import { toTaskCategoryColumn } from './task-category.mapper';

describe('toTaskCategoryColumn', () => {
  it('maps the system flags', () => {
    expect(toTaskCategoryColumn({ id: 'm', name: 'meeting', displayOrder: 4, systemKey: 'meeting', isSystem: true, kind: 'meeting' }))
      .toEqual({ id: 'm', name: 'meeting', displayOrder: 4, systemKey: 'meeting', isSystem: true, kind: 'meeting', icon: null });
  });

  it('carries a picked icon', () => {
    expect(toTaskCategoryColumn({ id: 'b', name: 'bug', displayOrder: 1, kind: 'bug', icon: 'lucide:bug' }).icon).toBe('lucide:bug');
  });

  it('defaults the flags, the kind to task and the icon to none, when the API omits them', () => {
    expect(toTaskCategoryColumn({ id: 't', name: 'task', displayOrder: 0 }))
      .toEqual({ id: 't', name: 'task', displayOrder: 0, systemKey: null, isSystem: false, kind: 'task', icon: null });
  });
});
