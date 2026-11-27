import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ProjectApiService } from '../../../work/data-access/project-api.service';
import { PagedResultDto, ProjectListItemDto } from '../../../work/models/dto/project.dto';
import { fakeWidgetData } from '../../widgets/widget-data.testing';
import { widgetShadeFor } from '../../../../shared/utils/widget-palette';
import { ActiveProjectsCardComponent } from './active-projects-card.component';

function project(id: string, overrides: Partial<ProjectListItemDto> = {}): ProjectListItemDto {
  return {
    id,
    name: `Project ${id}`,
    color: null,
    isActive: true,
    isAchieved: false,
    allocatedHours: 10,
    completedHours: 5,
    ...overrides
  } as ProjectListItemDto;
}

function page(items: ProjectListItemDto[]): PagedResultDto<ProjectListItemDto> {
  return { items, pageNumber: 1, pageSize: 100, totalCount: items.length, totalPages: 1, hasNext: false, hasPrevious: false };
}

describe('ActiveProjectsCardComponent', () => {
  afterEach(() => TestBed.resetTestingModule());

  async function setup(listMine: ReturnType<typeof vi.fn>): Promise<ComponentFixture<ActiveProjectsCardComponent>> {
    await TestBed.configureTestingModule({
      imports: [ActiveProjectsCardComponent],
      providers: [provideRouter([]), { provide: ProjectApiService, useValue: { listMine } }]
    }).compileComponents();
    const fixture = TestBed.createComponent(ActiveProjectsCardComponent);
    fixture.detectChanges();
    return fixture;
  }

  const q = (fixture: ComponentFixture<unknown>, id: string): HTMLElement | null =>
    (fixture.nativeElement as HTMLElement).querySelector(`[data-testid="${id}"]`);

  it('the hover refresh button reloads the projects and keeps the list on screen', async () => {
    const listMine = vi.fn(() => of(page([project('a', { isActive: true })])));
    const fixture = await setup(listMine);
    const el: HTMLElement = fixture.nativeElement;
    const refresh = el.querySelector('[data-testid="popout-refresh"]') as HTMLButtonElement;
    expect(el.querySelector('[data-testid="popout-expand"]')).toBeNull();
    expect(el.querySelector('[data-testid="popout-close"]')).toBeNull();
    refresh.click();
    fixture.detectChanges();
    expect(listMine).toHaveBeenCalledTimes(2);
    expect(el.querySelector('[data-testid="refreshed-label"]')).toBeNull();
  });

  it('colours each project by a theme shade picked from its id, never its stored colour', async () => {
    const listMine = vi.fn(() => of(page([project('p-1', { color: '#ff0000' }), project('p-2', { color: '#00ff00' }), project('p-3')])));
    const fixture = await setup(listMine);
    const swatches = () =>
      Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('[data-testid="active-projects-swatch"]')).map(
        (s) => (s as HTMLElement).style.backgroundColor
      );
    expect(swatches()).toEqual([widgetShadeFor('p-1'), widgetShadeFor('p-2'), widgetShadeFor('p-3')]);
    // The same project keeps its shade when the list reloads in another order.
    listMine.mockReturnValue(of(page([project('p-3', { myOpenHours: 5 }), project('p-1', { color: '#ff0000' })])));
    (fixture.nativeElement.querySelector('[data-testid="popout-refresh"]') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(swatches()).toEqual([widgetShadeFor('p-3'), widgetShadeFor('p-1')]);
  });

  it('counts only active, not-achieved projects and previews the first four', async () => {
    const listMine = vi
      .fn()
      .mockReturnValue(
        of(page([project('1'), project('2', { isAchieved: true }), project('3', { isActive: false }), project('4'), project('5'), project('6'), project('7')]))
      );
    const fixture = await setup(listMine);
    expect(listMine).toHaveBeenCalledWith(1, 100);
    expect(q(fixture, 'active-projects-count')?.textContent?.trim()).toBe('5');
    expect(fixture.nativeElement.querySelectorAll('[data-testid="active-projects-item"]').length).toBe(4);
    expect(q(fixture, 'active-projects-more')?.textContent?.trim()).toBe('+1 more');
  });

  it('shows my own allocated task hours, what is still open and how much is done - not the project budget', async () => {
    const fixture = await setup(
      vi.fn().mockReturnValue(
        of(page([project('1', { name: 'portal Revamp', allocatedHours: 200, completedHours: 120, myAllocatedHours: 20, myOpenHours: 8, myOpenTaskCount: 3 })]))
      )
    );
    const item = q(fixture, 'active-projects-item')!;
    expect(item.textContent).toContain('P');
    expect(q(fixture, 'active-projects-hours')?.textContent?.trim()).toBe('20h');
    expect(q(fixture, 'active-projects-tasks')?.textContent?.trim()).toBe('8h open · 3 tasks');
    expect(q(fixture, 'active-projects-percent')?.getAttribute('data-percent')).toBe('60');
  });

  it('orders projects by my open task hours, then my allocated hours, with no-task projects last', async () => {
    const fixture = await setup(
      vi.fn().mockReturnValue(
        of(
          page([
            project('office', { name: 'Office' }),
            project('small', { name: 'Small', myAllocatedHours: 4, myOpenHours: 2, myOpenTaskCount: 1 }),
            project('big', { name: 'Big', myAllocatedHours: 30, myOpenHours: 18, myOpenTaskCount: 5 }),
            project('done', { name: 'Done', myAllocatedHours: 40, myOpenHours: 0, myOpenTaskCount: 0 })
          ])
        )
      )
    );
    const names = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('[data-testid="active-projects-item"]')).map((el) =>
      el.querySelector('span.truncate')?.textContent?.trim()
    );
    expect(names).toEqual(['Big', 'Small', 'Done', 'Office']);
    expect(q(fixture, 'active-projects-focus')?.closest('[data-testid="active-projects-item"]')?.textContent).toContain('Big');
    const labels = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('[data-testid="active-projects-tasks"]')).map((el) =>
      el.textContent?.trim()
    );
    expect(labels).toEqual(['18h open · 5 tasks', '2h open · 1 task', 'All your tasks done', 'No tasks assigned to you']);
  });

  it('shows no Focus chip and 0% rather than NaN when I have no tasks anywhere', async () => {
    const fixture = await setup(vi.fn().mockReturnValue(of(page([project('1')]))));
    expect(q(fixture, 'active-projects-percent')?.getAttribute('data-percent')).toBe('0');
    expect(q(fixture, 'active-projects-hours')?.textContent?.trim()).toBe('0h');
    expect(q(fixture, 'active-projects-focus')).toBeNull();
    expect(fixture.nativeElement.textContent).not.toContain('NaN');
  });

  it('shows an empty state with no active projects', async () => {
    const fixture = await setup(vi.fn().mockReturnValue(of(page([project('1', { isAchieved: true })]))));
    expect(q(fixture, 'active-projects-count')?.textContent?.trim()).toBe('0');
    expect(q(fixture, 'active-projects-empty')).not.toBeNull();
  });

  it('shows an error with retry when the request fails', async () => {
    const listMine = vi
      .fn()
      .mockReturnValueOnce(throwError(() => new Error('boom')))
      .mockReturnValue(of(page([project('1')])));
    const fixture = await setup(listMine);
    const error = q(fixture, 'active-projects-error');
    expect(error).not.toBeNull();
    error?.querySelector('button')?.click();
    fixture.detectChanges();
    expect(q(fixture, 'active-projects-count')?.textContent?.trim()).toBe('1');
  });
  describe('inside a dashboard frame', () => {
    async function setupInFrame(widget: ReturnType<typeof fakeWidgetData>, listMine: ReturnType<typeof vi.fn>) {
      await TestBed.configureTestingModule({
        imports: [ActiveProjectsCardComponent],
        providers: [provideRouter([]), { provide: ProjectApiService, useValue: { listMine } }, widget.provider]
      }).compileComponents();
      const fixture = TestBed.createComponent(ActiveProjectsCardComponent);
      fixture.detectChanges();
      return fixture;
    }

    it('uses_bootstrap_payload_without_calling_its_api', async () => {
      const listMine = vi.fn().mockReturnValue(of(page([])));
      const widget = fakeWidgetData(
        'success',
        page([project('1'), project('2', { isAchieved: true }), project('3'), project('4'), project('5'), project('6')])
      );
      const fixture = await setupInFrame(widget, listMine);

      expect(listMine).not.toHaveBeenCalled();
      expect(widget.refresh).not.toHaveBeenCalled();
      expect(q(fixture, 'active-projects-count')?.textContent?.trim()).toBe('5');
      expect(fixture.nativeElement.querySelectorAll('[data-testid="active-projects-item"]').length).toBe(4);
      expect(q(fixture, 'active-projects-more')?.textContent?.trim()).toBe('+1 more');
    });

    it('falls_back_to_own_api_outside_dashboard', async () => {
      const listMine = vi.fn().mockReturnValue(of(page([project('1')])));
      const fixture = await setup(listMine);
      expect(listMine).toHaveBeenCalledWith(1, 100);
      expect(q(fixture, 'active-projects-count')?.textContent?.trim()).toBe('1');
    });

    it('falls back to its own api, with its own error and retry, when the bootstrap state is an error', async () => {
      const listMine = vi
        .fn()
        .mockReturnValueOnce(throwError(() => new Error('boom')))
        .mockReturnValue(of(page([project('1'), project('2')])));
      const fixture = await setupInFrame(fakeWidgetData('error'), listMine);
      expect(listMine).toHaveBeenCalledWith(1, 100);
      const error = q(fixture, 'active-projects-error');
      expect(error).not.toBeNull();
      error?.querySelector('button')?.click();
      fixture.detectChanges();
      expect(q(fixture, 'active-projects-count')?.textContent?.trim()).toBe('2');
    });
  });
});
