import { toTaskCategoryColumn } from './task-category.mapper';

describe('toTaskCategoryColumn', () => {
  it('maps the system flags', () => {
    expect(toTaskCategoryColumn({ id: 'm', name: 'meeting', displayOrder: 4, systemKey: 'meeting', isSystem: true }))
      .toEqual({ id: 'm', name: 'meeting', displayOrder: 4, systemKey: 'meeting', isSystem: true });
  });

  it('defaults the flags when the API omits them', () => {
    expect(toTaskCategoryColumn({ id: 't', name: 'task', displayOrder: 0 }))
      .toEqual({ id: 't', name: 'task', displayOrder: 0, systemKey: null, isSystem: false });
  });
});
