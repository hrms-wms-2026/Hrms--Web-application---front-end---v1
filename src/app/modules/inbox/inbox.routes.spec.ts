import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { INBOX_ROUTES } from './inbox.routes';

@Component({ selector: 'app-inbox-stub', standalone: true, template: '' })
class InboxStubComponent {}

describe('INBOX_ROUTES', () => {
  it('serves the list and an item deep link from one route, so selecting a row keeps the same page', async () => {
    expect(INBOX_ROUTES).toHaveLength(1);
    const { loadComponent: _, ...route } = INBOX_ROUTES[0];
    TestBed.configureTestingModule({ providers: [provideRouter([{ path: 'inbox', children: [{ ...route, component: InboxStubComponent }] }])] });
    const harness = await RouterTestingHarness.create();

    const list = await harness.navigateByUrl('/inbox', InboxStubComponent);
    const item = await harness.navigateByUrl('/inbox/work/approval/a1', InboxStubComponent);
    expect(item).toBe(list);
    await expect(harness.navigateByUrl('/inbox/work/approval')).rejects.toThrow();
  });
});
