import { Component, input, output, signal } from '@angular/core';
import { WorkspaceOptionDto } from '../../models/dto/workspace-selection.dto';

/**
 * Shared post-login workspace picker for password and Google sign-in (backend 202 answer).
 * Renders only the server-provided workspaces; the login challenge itself never reaches this
 * component - the parent submits the chosen slug through AuthStore.selectWorkspace().
 */
@Component({
  selector: 'app-workspace-selector',
  standalone: true,
  template: `
    <form class="workspace-selector" (submit)="$event.preventDefault(); submit()">
      <fieldset class="workspace-selector__group" [disabled]="busy()">
        <legend class="workspace-selector__title">Choose a workspace</legend>
        <ul class="workspace-selector__list">
          @for (workspace of workspaces(); track workspace.slug) {
            <li>
              <label
                class="workspace-selector__option"
                [class.workspace-selector__option--active]="chosen() === workspace.slug"
              >
                <input
                  type="radio"
                  name="workspace"
                  class="workspace-selector__radio"
                  [value]="workspace.slug"
                  [checked]="chosen() === workspace.slug"
                  (change)="chosen.set(workspace.slug)"
                />
                <span>{{ workspace.displayName }}</span>
              </label>
            </li>
          }
        </ul>
      </fieldset>

      @if (error()) {
        <p class="workspace-selector__error" role="alert">{{ error() }}</p>
      }

      <button type="submit" class="workspace-selector__continue" [disabled]="!chosen() || busy()">
        {{ busy() ? 'Signing in…' : 'Continue' }}
      </button>
      <button
        type="button"
        class="workspace-selector__cancel"
        [disabled]="busy()"
        (click)="cancelled.emit()"
      >
        Use another account
      </button>
    </form>
  `,
  styles: [
    `
      .workspace-selector {
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
      }
      .workspace-selector__group {
        margin: 0;
        padding: 0;
        border: none;
        min-width: 0;
      }
      .workspace-selector__title {
        margin-bottom: 0.75rem;
        padding: 0;
        font-size: 1rem;
        font-weight: 600;
        color: var(--color-text-primary);
      }
      .workspace-selector__list {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
        margin: 0;
        padding: 0;
        list-style: none;
      }
      .workspace-selector__option {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        min-height: 44px;
        padding: 0 1rem;
        border-radius: 8px;
        border: 1px solid var(--color-border-strong);
        background: var(--color-surface);
        color: var(--color-text-primary);
        font-size: 0.875rem;
        font-weight: 600;
        cursor: pointer;
      }
      .workspace-selector__option--active {
        border-color: var(--color-accent);
      }
      .workspace-selector__option:focus-within {
        outline: 2px solid var(--color-focus-ring);
        outline-offset: 2px;
      }
      .workspace-selector__error {
        margin: 0;
        padding: 0.625rem 0.875rem;
        border-radius: 8px;
        background: var(--color-danger-subtle);
        color: var(--color-danger-text);
        font-size: 0.8125rem;
        text-align: center;
      }
      .workspace-selector__continue {
        height: 44px;
        border: none;
        border-radius: 8px;
        background: var(--color-accent);
        color: var(--color-text-on-solid);
        font-size: 0.875rem;
        font-weight: 600;
        cursor: pointer;
      }
      .workspace-selector__continue:hover:not(:disabled) {
        background: var(--color-accent-hover);
      }
      .workspace-selector__continue:disabled {
        background: var(--color-border-strong);
        cursor: not-allowed;
      }
      .workspace-selector__cancel {
        align-self: center;
        border: none;
        background: none;
        color: var(--color-text-secondary);
        font-size: 0.875rem;
        cursor: pointer;
      }
      .workspace-selector__continue:focus-visible,
      .workspace-selector__cancel:focus-visible {
        outline: 2px solid var(--color-focus-ring);
        outline-offset: 2px;
      }
    `,
  ],
})
export class WorkspaceSelectorComponent {
  readonly workspaces = input.required<WorkspaceOptionDto[]>();
  readonly busy = input(false);
  readonly error = input<string | null>(null);

  readonly selected = output<string>();
  readonly cancelled = output<void>();

  readonly chosen = signal<string | null>(null);

  submit(): void {
    const slug = this.chosen();
    if (!slug || this.busy()) return;
    if (!this.workspaces().some((w) => w.slug === slug)) return;
    this.selected.emit(slug);
  }
}
