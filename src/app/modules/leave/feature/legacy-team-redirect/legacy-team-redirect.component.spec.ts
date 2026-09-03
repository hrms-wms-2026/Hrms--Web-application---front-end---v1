import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { describe, expect, it, vi } from 'vitest';
import { LegacyTeamRedirectComponent } from './legacy-team-redirect.component';

describe('LegacyTeamRedirectComponent', () => {
  it('redirects to the Team hub with replacement navigation', async () => {
    const navigate = vi.fn().mockResolvedValue(true);
    await TestBed.configureTestingModule({
      imports: [LegacyTeamRedirectComponent],
      providers: [{ provide: Router, useValue: { navigate } }]
    }).compileComponents();

    const fixture = TestBed.createComponent(LegacyTeamRedirectComponent);
    fixture.detectChanges();

    expect(navigate).toHaveBeenCalledWith(['/time-off/team'], { replaceUrl: true });
  });
});
