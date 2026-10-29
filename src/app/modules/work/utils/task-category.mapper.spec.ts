import { toTaskCategoryColumn } from './task-category.mapper';

describe('toTaskCategoryColumn', () => {
  it('maps the system flags', () => {
    expect(toTaskCategoryColumn({ id: 'm', name: 'meeting', displayOrder: 4, systemKey: 'meeting', isSystem: true, kind: 'meeting' }))
      .toEqual({ id: 'm', name: 'meeting', displayOrder: 4, systemKey: 'meeting', isSystem: true, kind: 'meeting' });
  });

  it('defaults the flags, and the kind to task, when the API omits them', () => {
    expect(toTaskCategoryColumn({ id: 't', name: 'task', displayOrder: 0 }))
      .toEqual({ id: 't', name: 'task', displayOrder: 0, systemKey: null, isSystem: false, kind: 'task' });
  });
});
