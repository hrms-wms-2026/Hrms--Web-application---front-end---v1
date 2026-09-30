import { Signal, computed, signal } from '@angular/core';

/**
 * Signal-backed set of selected row ids for list screens with bulk actions.
 * Ids persist across pagination; the header checkbox acts on the visible ids only
 * (pass them to setMany/allOf/someOf). Clearing on search/filter change is the
 * owning screen's job so users never act on rows they can no longer see.
 */
export class SelectionModel<TId extends string = string> {
  private readonly state = signal<ReadonlySet<TId>>(new Set<TId>());

  readonly selected: Signal<ReadonlySet<TId>> = this.state.asReadonly();
  readonly count = computed(() => this.state().size);

  isSelected(id: TId): boolean {
    return this.state().has(id);
  }

  toggle(id: TId, on?: boolean): void {
    const next = new Set(this.state());
    const select = on ?? !next.has(id);
    if (select) next.add(id); else next.delete(id);
    this.state.set(next);
  }

  setMany(ids: readonly TId[], on: boolean): void {
    const next = new Set(this.state());
    for (const id of ids) {
      if (on) next.add(id); else next.delete(id);
    }
    this.state.set(next);
  }

  clear(): void {
    this.state.set(new Set<TId>());
  }

  allOf(ids: readonly TId[]): boolean {
    const selected = this.state();
    return ids.length > 0 && ids.every((id) => selected.has(id));
  }

  someOf(ids: readonly TId[]): boolean {
    const selected = this.state();
    const hits = ids.filter((id) => selected.has(id)).length;
    return hits > 0 && hits < ids.length;
  }
}
