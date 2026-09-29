import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { TeamBalancesComponent } from './team-balances.component';

describe('TeamBalancesComponent', () => {
  it('redirects the old Team Balances URL into the combined Balances page', async () => {
    await TestBed.configureTestingModule({
      imports: [TeamBalancesComponent],
      providers: [provideRouter([])]
    }).compileComponents();

    const router = TestBed.inject(Router);
    const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    TestBed.createComponent(TeamBalancesComponent);

    expect(navigate).toHaveBeenCalledWith(['/time-off'], { queryParams: { view: 'team' }, replaceUrl: true });
  });
});
