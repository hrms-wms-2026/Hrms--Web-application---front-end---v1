import { Component, input, output } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ProjectApiService } from '../../../work/data-access/project-api.service';
import { PagedResultDto, ProjectListItemDto } from '../../../work/models/dto/project.dto';
import { TaskFormModalComponent } from '../../../work/ui/task-form-modal/task-form-modal.component';
import { QuickCreateTaskComponent } from './quick-create-task.component';
import { widgetShadeFor } from '../../utils/widget-palette';

/** Stands in for Work's task form, which pulls in the whole Work module. */
@Component({ selector: 'app-task-form-modal', standalone: true, template: `<div data-testid="task-form-stub" [attr.data-open]="open()" [attr.data-project]="projectId()"></div>` })
class TaskFormModalStubComponent {
  readonly open = input(false);
  readonly mode = input('create');
  readonly projectId = input('');
  readonly created = output<string>();
  readonly closed = output<void>();
}

function project(id: string, overrides: Partial<ProjectListItemDto> = {}): ProjectListItemDto {
  return { id, name: `Project ${id}`, identifier: `P${id}`, color: null, isActive: true, isAchieved: false, ...overrides } as ProjectListItemDto;
}

function page(items: ProjectListItemDto[]): PagedResultDto<ProjectListItemDto> {
  return { items, pageNumber: 1, pageSize: 100, totalCount: items.length, totalPages: 1, hasNext: false, hasPrevious: false };
}

describe('QuickCreateTaskComponent', () => {
  afterEach(() => TestBed.resetTestingModule());

  async function setup(listMine: ReturnType<typeof vi.fn>): Promise<{ fixture: ComponentFixture<QuickCreateTaskComponent>; closed: ReturnType<typeof vi.fn> }> {
    await TestBed.configureTestingModule({
      imports: [QuickCreateTaskComponent],
      providers: [{ provide: ProjectApiService, useValue: { listMine } }]
    })
      .overrideComponent(QuickCreateTaskComponent, {
        remove: { imports: [TaskFormModalComponent] },
        add: { imports: [TaskFormModalStubComponent] }
      })
      .compileComponents();
    const fixture = TestBed.createComponent(QuickCreateTaskComponent);
    const closed = vi.fn();
    fixture.componentInstance.closed.subscribe(closed);
    fixture.componentRef.setInput('open', true);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return { fixture, closed };
  }

  const q = (fixture: ComponentFixture<unknown>, id: string): HTMLElement | null =>
    (fixture.nativeElement as HTMLElement).querySelector(`[data-testid="${id}"]`);

  it('lists active projects to pick from, then opens the task form for the chosen one', async () => {
    const { fixture } = await setup(vi.fn().mockReturnValue(of(page([project('1'), project('2'), project('3', { isAchieved: true })]))));
    expect(q(fixture, 'quick-create-task-project-1')).not.toBeNull();
    expect(q(fixture, 'quick-create-task-project-2')).not.toBeNull();
    expect(q(fixture, 'quick-create-task-project-3')).toBeNull();
    expect(q(fixture, 'task-form-stub')).toBeNull();

    q(fixture, 'quick-create-task-project-2')!.click();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const form = q(fixture, 'task-form-stub')!;
    expect(form.dataset['open']).toBe('true');
    expect(form.dataset['project']).toBe('2');
    expect(q(fixture, 'quick-create-task-project-1')).toBeNull();
  });

  it('shows each project in a theme shade picked from its id, not its stored colour', async () => {
    const { fixture } = await setup(vi.fn().mockReturnValue(of(page([project('p-1', { color: '#ff0000' }), project('p-2', { color: '#00ff00' })]))));
    const swatch = (id: string) =>
      ((fixture.nativeElement as HTMLElement).querySelector(`[data-testid="quick-create-task-project-${id}"] span`) as HTMLElement).style.backgroundColor;
    expect(swatch('p-1')).toBe(widgetShadeFor('p-1'));
    expect(swatch('p-2')).toBe(widgetShadeFor('p-2'));
  });

  it('skips the picker when there is exactly one active project', async () => {
    const { fixture } = await setup(vi.fn().mockReturnValue(of(page([project('only')]))));
    expect(q(fixture, 'task-form-stub')?.dataset['project']).toBe('only');
  });

  it('explains when there is no active project, and offers a retry on failure', async () => {
    const none = await setup(vi.fn().mockReturnValue(of(page([]))));
    expect(q(none.fixture, 'quick-create-task-none')).not.toBeNull();
    TestBed.resetTestingModule();

    const listMine = vi.fn().mockReturnValueOnce(throwError(() => new Error('boom'))).mockReturnValue(of(page([project('1'), project('2')])));
    const failed = await setup(listMine);
    q(failed.fixture, 'quick-create-task-error')!.querySelector('button')!.click();
    failed.fixture.detectChanges();
    expect(q(failed.fixture, 'quick-create-task-project-1')).not.toBeNull();
  });

  it('closes when the task form closes', async () => {
    const { fixture, closed } = await setup(vi.fn().mockReturnValue(of(page([project('only')]))));
    const stub = fixture.debugElement.query((el) => el.componentInstance instanceof TaskFormModalStubComponent);
    (stub.componentInstance as TaskFormModalStubComponent).closed.emit();
    expect(closed).toHaveBeenCalledOnce();
  });
});
