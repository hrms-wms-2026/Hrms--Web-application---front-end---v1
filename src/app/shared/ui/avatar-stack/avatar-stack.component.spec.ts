import { TestBed } from '@angular/core/testing';
import { AvatarStackComponent } from './avatar-stack.component';

describe('AvatarStackComponent', () => {
  async function setup(
    members: { userId: string; displayName: string }[], totalCount: number, maxVisible?: number
  ) {
    await TestBed.configureTestingModule({ imports: [AvatarStackComponent] }).compileComponents();
    const fixture = TestBed.createComponent(AvatarStackComponent);
    fixture.componentRef.setInput('members', members);
    fixture.componentRef.setInput('totalCount', totalCount);
    if (maxVisible !== undefined) fixture.componentRef.setInput('maxVisible', maxVisible);
    fixture.detectChanges();
    return fixture;
  }

  it('renders one avatar per member up to maxVisible', async () => {
    const members = [
      { userId: 'u1', displayName: 'Arun Kumar' },
      { userId: 'u2', displayName: 'Diya Perera' }
    ];
    const fixture = await setup(members, 2);
    expect(fixture.nativeElement.querySelectorAll('app-avatar').length).toBe(2);
  });

  it('caps visible avatars at maxVisible even when more members are provided', async () => {
    const members = [
      { userId: 'u1', displayName: 'A' }, { userId: 'u2', displayName: 'B' },
      { userId: 'u3', displayName: 'C' }, { userId: 'u4', displayName: 'D' },
      { userId: 'u5', displayName: 'E' }
    ];
    const fixture = await setup(members, 5, 3);
    expect(fixture.nativeElement.querySelectorAll('app-avatar').length).toBe(3);
  });

  it('shows a +N overflow badge using totalCount, not just the fetched members length', async () => {
    const members = [{ userId: 'u1', displayName: 'A' }, { userId: 'u2', displayName: 'B' }];
    const fixture = await setup(members, 7, 2);
    const overflow = fixture.nativeElement.querySelector('[data-testid="avatar-overflow"]');
    expect(overflow.textContent.trim()).toBe('+5');
  });

  it('hides the overflow badge when totalCount does not exceed the visible avatars', async () => {
    const members = [{ userId: 'u1', displayName: 'A' }, { userId: 'u2', displayName: 'B' }];
    const fixture = await setup(members, 2, 4);
    expect(fixture.nativeElement.querySelector('[data-testid="avatar-overflow"]')).toBeNull();
  });

  it('renders nothing when there are no members', async () => {
    const fixture = await setup([], 0);
    expect(fixture.nativeElement.querySelectorAll('app-avatar').length).toBe(0);
    expect(fixture.nativeElement.querySelector('[data-testid="avatar-overflow"]')).toBeNull();
  });
});
