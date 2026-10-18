/**
 * Backward-compatible re-export: the filter bar moved to shared/ui/filter-bar (app-filter-bar).
 * Kept only so the People module's employee filter popover keeps compiling without edits.
 * New code must import FilterBarComponent from shared/ui/filter-bar directly.
 */
export {
  FilterBarComponent as TaskFilterBarComponent,
  HIGHLIGHT_SWATCHES
} from '../../../../shared/ui/filter-bar/filter-bar.component';
export type {
  FilterFieldConfig as TaskFilterFieldConfig,
  FilterFieldIcon as TaskFilterFieldIcon
} from '../../../../shared/ui/filter-bar/filter-bar.component';
