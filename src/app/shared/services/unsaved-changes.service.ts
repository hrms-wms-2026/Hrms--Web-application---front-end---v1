import { DestroyRef, Injectable, Signal, inject, signal } from '@angular/core';

export interface DirtyFormHandle {
  isDirty(): boolean;
  canSaveDraft(): boolean;
  saveDraft(): Promise<boolean>;
  discard(): void;
}

export type UnsavedChoice = 'discard' | 'keep' | 'save';
export interface UnsavedPrompt { readonly canSaveDraft: boolean; readonly saving: boolean; readonly error: string | null; }

const SAVE_FAILED = 'Could not save the draft. Try again or discard your changes.';

/**
 * Single place that decides whether an open form may be closed or navigated away from.
 * Forms register a handle while open; close buttons, the route guard and the browser's
 * beforeunload all go through here, and one app-wide dialog renders `prompt`.
 */
@Injectable({ providedIn: 'root' })
export class UnsavedChangesService {
  private readonly handles: DirtyFormHandle[] = [];
  private readonly promptState = signal<UnsavedPrompt | null>(null);
  private pendingChoice: ((choice: UnsavedChoice) => void) | null = null;

  readonly prompt: Signal<UnsavedPrompt | null> = this.promptState.asReadonly();

  constructor() {
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (this.hasDirtyForm()) {
        event.preventDefault();
        event.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    inject(DestroyRef).onDestroy(() => window.removeEventListener('beforeunload', onBeforeUnload));
  }

  register(handle: DirtyFormHandle): () => void {
    this.handles.push(handle);
    return () => {
      const index = this.handles.indexOf(handle);
      if (index >= 0) this.handles.splice(index, 1);
    };
  }

  hasDirtyForm(): boolean {
    return this.handles.some((h) => h.isDirty());
  }

  async requestClose(handle: DirtyFormHandle | undefined = this.handles.at(-1)): Promise<boolean> {
    if (!handle || !handle.isDirty()) return true;
    this.promptState.set({ canSaveDraft: handle.canSaveDraft(), saving: false, error: null });
    for (;;) {
      const choice = await new Promise<UnsavedChoice>((resolve) => (this.pendingChoice = resolve));
      if (choice === 'keep') {
        this.promptState.set(null);
        return false;
      }
      if (choice === 'discard') {
        this.promptState.set(null);
        handle.discard();
        return true;
      }
      this.promptState.update((p) => (p ? { ...p, saving: true, error: null } : p));
      const saved = await handle.saveDraft().catch(() => false);
      if (saved) {
        this.promptState.set(null);
        return true;
      }
      this.promptState.update((p) => (p ? { ...p, saving: false, error: SAVE_FAILED } : p));
    }
  }

  choose(choice: UnsavedChoice): void {
    const resolve = this.pendingChoice;
    this.pendingChoice = null;
    resolve?.(choice);
  }
}
