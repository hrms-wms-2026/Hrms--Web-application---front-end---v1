import { TestBed } from '@angular/core/testing';
import { NotificationService } from './notification.service';

describe('NotificationService', () => {
  it('adds an error notification', () => {
    const service = TestBed.inject(NotificationService);
    service.error('Something broke');
    expect(service.notifications()).toEqual([{ id: expect.any(Number), kind: 'error', message: 'Something broke' }]);
  });

  it('adds a success notification', () => {
    const service = TestBed.inject(NotificationService);
    service.success('Saved');
    expect(service.notifications()[0].kind).toBe('success');
  });

  it('adds a warning notification', () => {
    const service = TestBed.inject(NotificationService);
    service.warning('Warning test');
    expect(service.notifications()[0].kind).toBe('warning');
    expect(service.notifications()[0].message).toBe('Warning test');
  });

  it('dismisses a notification by id', () => {
    const service = TestBed.inject(NotificationService);
    service.error('First');
    service.error('Second');
    const [first] = service.notifications();

    service.dismiss(first.id);

    expect(service.notifications()).toHaveLength(1);
    expect(service.notifications()[0].message).toBe('Second');
  });

  it('assigns increasing unique ids across calls', () => {
    const service = TestBed.inject(NotificationService);
    service.error('A');
    service.error('B');
    const [a, b] = service.notifications();
    expect(b.id).toBeGreaterThan(a.id);
  });
});
