import { DatePipe } from '@angular/common';
import { Component, OnInit, inject, input, output, signal } from '@angular/core';
import { SprintListStore } from '../../state/sprint-list.store';
import { InputComponent } from '../../../../shared/ui/input/input.component';
import { ButtonComponent } from '../../../../shared/ui/button/button.component';
import { Sprint } from '../../models/sprint.model';

@Component({
  selector: 'app-sprint-list',
  standalone: true,
  imports: [DatePipe, InputComponent, ButtonComponent],
  template: `
    <div class="sprint-list">
      <div class="sprint-list__header">
        <h3 class="sprint-list__title">Sprints</h3>
        @if (isObjectiveOwner()) {
          <app-button variant="secondary" (pressed)="creating.set(!creating())">
            {{ creating() ? 'Cancel' : 'Create sprint' }}
          </app-button>
        }
      </div>

      @if (creating()) {
        <div class="sprint-list__create-form">
          <app-input label="Name" [value]="newName()" (valueChange)="newName.set($event)" />
          <app-input label="Start date" type="date" [value]="newStart()" (valueChange)="newStart.set($event)" />
          <app-input label="End date" type="date" [value]="newEnd()" (valueChange)="newEnd.set($event)" />
          <app-button variant="primary" (pressed)="submitCreate()">Save</app-button>
        </div>
      }

      @if (store.error()) {
        <p class="sprint-list__error" role="alert">{{ store.error() }}</p>
      }

      <ul class="sprint-list__items">
        @for (sprint of store.sprints(); track sprint.id) {
          <li class="sprint-list__item" [class.sprint-list__item--selected]="selectedId() === sprint.id">
            <button type="button" class="sprint-list__item-button" (click)="select(sprint)">
              <span class="sprint-list__item-name">{{ sprint.name }}</span>
              <span class="sprint-list__item-status" [attr.data-status]="sprint.status">{{ sprint.status }}</span>
              <span class="sprint-list__item-dates">{{ sprint.startDate | date: 'MMM d' }} – {{ sprint.endDate | date: 'MMM d' }}</span>
            </button>
            @if (isObjectiveOwner()) {
              <div class="sprint-list__item-actions">
                @if (sprint.status === 'active') {
                  <app-button variant="secondary" (pressed)="complete(sprint.id)">Complete</app-button>
                }
                @if (sprint.status !== 'achieved') {
                  <app-button variant="secondary" (pressed)="achieve(sprint.id)">Achieve</app-button>
                }
              </div>
            }
          </li>
        }
      </ul>
    </div>
  `,
  styles: [`
    .sprint-list__header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
    .sprint-list__title { font-size: 14px; font-weight: 600; color: var(--color-text-primary); margin: 0; }
    .sprint-list__create-form { display: flex; flex-direction: column; gap: 8px; margin-bottom: 12px; padding: 10px; border: 1px solid var(--color-border); border-radius: 8px; }
    .sprint-list__error { color: var(--color-danger-text); font-size: 12px; }
    .sprint-list__items { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 6px; }
    .sprint-list__item { display: flex; align-items: center; justify-content: space-between; gap: 8px; border: 1px solid var(--color-border); border-radius: 8px; padding: 8px 10px; }
    .sprint-list__item--selected { border-color: var(--color-focus-ring); }
    .sprint-list__item-button { flex: 1; display: flex; gap: 10px; align-items: center; background: none; border: none; text-align: left; cursor: pointer; color: var(--color-text-primary); font-size: 13px; }
    .sprint-list__item-status { font-size: 11px; text-transform: capitalize; color: var(--color-text-secondary); }
    .sprint-list__item-status[data-status="incomplete"] { color: var(--color-danger-text); }
    .sprint-list__item-dates { font-size: 11px; color: var(--color-text-secondary); }
    .sprint-list__item-actions { display: flex; gap: 6px; }
  `]
})
export class SprintListComponent implements OnInit {
  protected readonly store = inject(SprintListStore);

  objectiveId = input.required<string>();
  isObjectiveOwner = input.required<boolean>();
  sprintSelected = output<Sprint | null>();
  sprintsChanged = output<void>();

  protected readonly creating = signal(false);
  protected readonly newName = signal('');
  protected readonly newStart = signal('');
  protected readonly newEnd = signal('');
  protected readonly selectedId = signal<string | null>(null);

  ngOnInit(): void {
    void this.store.load(this.objectiveId(), !this.isObjectiveOwner());
  }

  select(sprint: Sprint): void {
    const next = this.selectedId() === sprint.id ? null : sprint.id;
    this.selectedId.set(next);
    this.sprintSelected.emit(next ? sprint : null);
  }

  async submitCreate(): Promise<void> {
    const ok = await this.store.create(this.objectiveId(), {
      name: this.newName().trim(),
      startDate: this.newStart(),
      endDate: this.newEnd()
    }, !this.isObjectiveOwner());
    if (ok) {
      this.creating.set(false);
      this.newName.set('');
      this.newStart.set('');
      this.newEnd.set('');
      this.sprintsChanged.emit();
    }
  }

  async complete(sprintId: string): Promise<void> {
    const ok = await this.store.complete(sprintId, this.objectiveId(), !this.isObjectiveOwner());
    if (ok) this.sprintsChanged.emit();
  }

  async achieve(sprintId: string): Promise<void> {
    const ok = await this.store.achieve(sprintId, this.objectiveId(), !this.isObjectiveOwner());
    if (ok) this.sprintsChanged.emit();
  }
}
