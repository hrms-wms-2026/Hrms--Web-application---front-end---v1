# Attendance Detail Drawer (List Extraction, Layout, Wiring) Implementation Plan — Part 2

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract a trimmed, reusable `AttendanceHistoryListComponent` (used by both "My attendance history" and "Team attendance"), wire it and the Part 1 drawer into `time-tracking.component`, put "My attendance history" and "My requests" side by side, and extract `MyRequestsPanelComponent` out of the now-thinner parent.

**Architecture:** Task 5 builds the list component standalone (same pattern as Part 1's drawer). Task 6 does all the parent wiring in one pass (layout + both row-selection paths + drawer + correction-relocation) since these changes are interdependent and must land together for the page to render correctly. Task 7 — ordered **last**, deliberately — extracts the "My requests" tabbed panel (corrections + work-area-change history) into its own component; it's the highest-collision, lowest-incremental-value slice, so everything else is done and stable before touching it.

**Tech Stack:** Angular 21 (standalone components, signals), Vitest + Angular `TestBed`.

## Global Constraints

- Depends on Part 1 (`part-1.md` in this same folder) being complete: `AttendanceDetailDrawerComponent`, `AttendanceDetailSelection`, and the `attendance-formatters.ts` module (including `formatWorkAreaDate`) must exist before starting Task 6.
- Depends on the companion backend plan's Task 2 (`GET .../history-detail`) for the *manual verification* step at the end of Task 6 and for Task 7's browser check — none of the automated tests in this part need a live backend.
- **Employee id resolution is view-specific and must not be guessed:** `GetMyAttendanceHistoryQuery` builds `AttendanceHistoryRow` with `includeEmployee: false`, so `row.employee` is `null` for every row in "My attendance history". The employee id for a My-view row comes from `store.today()?.employeeId` instead (present on `AttendanceTodayResponse`). Team-view rows use `includeEmployee: true`, so `row.employee!.employeeId` is populated there. `AttendanceHistoryListComponent` itself stays employeeId-agnostic — it only emits the clicked `AttendanceHistoryRow`; the parent resolves which id to pair it with, per view.
- Every task ends with a normal `git add`/`git commit` (the pre-existing WIP was already committed as a baseline before Part 1 was written).
- `AttendanceHistoryRow.canViewDetails` is currently always `true` server-side — still gate row clicks on it, but don't build extra branching around it ever being `false`.

---

### Task 5: `AttendanceHistoryListComponent`

**Files:**
- Create: `src/app/modules/attendance/feature/time-tracking/attendance-history-list/attendance-history-list.component.ts`
- Create: `src/app/modules/attendance/feature/time-tracking/attendance-history-list/attendance-history-list.component.html`
- Create: `src/app/modules/attendance/feature/time-tracking/attendance-history-list/attendance-history-list.component.css`
- Create: `src/app/modules/attendance/feature/time-tracking/attendance-history-list/attendance-history-list.component.spec.ts`

**Interfaces:**
- Consumes: `formatDate/formatDateTime/formatMinutes/statusLabel` from Part 1's `attendance-formatters.ts`.
- Produces: component selector `app-attendance-history-list` with inputs `rows: readonly AttendanceHistoryRow[]` (default `[]`), `loading: boolean` (default `false`), `error: string | null` (default `null`), `page: number` (default `1`), `pageSize: number` (default `20`), `totalCount: number` (default `0`), `displayTimezone: string` (default `'UTC'`), `emptyMessage: string` (default `'No attendance records for this date range.'`), `showEmployeeColumn: boolean` (default `false`), `retryDisabledMessage: string | null` (default `null` — when `error() === retryDisabledMessage()`, the retry button is suppressed, matching the existing Team-attendance behavior of not offering "Try again" on the 403 forbidden message); outputs `pageChange: number`, `retryRequested: void`, `rowSelected: AttendanceHistoryRow` (emitted only when the clicked row's `canViewDetails` is `true`). Task 6 wires this exact contract into both the My-history and Team-attendance sections.

- [ ] **Step 1: Write the failing component tests**

Create `src/app/modules/attendance/feature/time-tracking/attendance-history-list/attendance-history-list.component.spec.ts`:

```ts
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AttendanceHistoryRow } from '../../../models/time-tracking.model';
import { AttendanceHistoryListComponent } from './attendance-history-list.component';

const row: AttendanceHistoryRow = {
  attendanceRecordId: 'record-1',
  workDate: '2026-08-22',
  employee: { employeeId: 'employee-2', displayName: 'Jordan Lee', employeeNumber: 'EMP-002', position: 'Designer', department: 'Product', avatarFileId: null },
  clockInAt: '2026-08-22T09:05:00+05:30',
  clockOutAt: null,
  isActive: true,
  breakMinutes: 0,
  totalWorkedMinutes: 120,
  expectedWorkMode: 'remote',
  attendanceSource: 'web',
  status: 'clocked_in',
  canViewDetails: true,
  canRequestCorrection: false,
  canRequestWorkAreaChange: false,
  canCorrect: false,
  statusLabel: null,
  attentionType: null,
  attentionLabel: null,
  attentionSeverity: null,
  breakOverageMinutes: 0,
  isOverBreakAllowance: false
};

describe('AttendanceHistoryListComponent', () => {
  afterEach(() => TestBed.resetTestingModule());

  async function setup(options: {
    rows?: readonly AttendanceHistoryRow[];
    loading?: boolean;
    error?: string | null;
    showEmployeeColumn?: boolean;
    retryDisabledMessage?: string | null;
    page?: number;
    pageSize?: number;
    totalCount?: number;
  } = {}): Promise<{ fixture: ComponentFixture<AttendanceHistoryListComponent> }> {
    await TestBed.configureTestingModule({ imports: [AttendanceHistoryListComponent] }).compileComponents();
    const fixture = TestBed.createComponent(AttendanceHistoryListComponent);
    const rows = options.rows ?? [row];
    fixture.componentRef.setInput('rows', rows);
    fixture.componentRef.setInput('loading', options.loading ?? false);
    fixture.componentRef.setInput('error', options.error ?? null);
    fixture.componentRef.setInput('showEmployeeColumn', options.showEmployeeColumn ?? false);
    fixture.componentRef.setInput('retryDisabledMessage', options.retryDisabledMessage ?? null);
    fixture.componentRef.setInput('page', options.page ?? 1);
    fixture.componentRef.setInput('pageSize', options.pageSize ?? 20);
    fixture.componentRef.setInput('totalCount', options.totalCount ?? rows.length);
    fixture.detectChanges();
    return { fixture };
  }

  it('renders the trimmed columns without Break/Work mode/Source', async () => {
    const { fixture } = await setup();
    const headerText = fixture.nativeElement.querySelector('thead')?.textContent ?? '';
    expect(headerText).toContain('Date');
    expect(headerText).toContain('Clock in');
    expect(headerText).toContain('Clock out');
    expect(headerText).toContain('Worked time');
    expect(headerText).toContain('Status');
    expect(headerText).not.toContain('Break');
    expect(headerText).not.toContain('Work mode');
  });

  it('shows the Employee column only when showEmployeeColumn is true', async () => {
    const withoutColumn = await setup({ showEmployeeColumn: false });
    expect(withoutColumn.fixture.nativeElement.querySelector('thead')?.textContent ?? '').not.toContain('Employee');

    const withColumn = await setup({ showEmployeeColumn: true });
    const text = withColumn.fixture.nativeElement.querySelector('thead')?.textContent ?? '';
    expect(text).toContain('Employee');
    expect((withColumn.fixture.nativeElement as HTMLElement).textContent).toContain('Jordan Lee');
  });

  it('renders the loading state', async () => {
    const { fixture } = await setup({ loading: true });
    expect((fixture.nativeElement as HTMLElement).querySelector('[aria-busy="true"]')).toBeTruthy();
  });

  it('renders a retryable error state and emits retryRequested when clicked', async () => {
    const { fixture } = await setup({ error: 'Could not load attendance history. Try again.' });
    const retry = vi.fn();
    fixture.componentInstance.retryRequested.subscribe(retry);
    (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('.time-tracking-message button')!.click();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Could not load attendance history. Try again.');
    expect(retry).toHaveBeenCalledTimes(1);
  });

  it('suppresses the retry button when the error matches retryDisabledMessage', async () => {
    const { fixture } = await setup({
      error: 'You do not have access to view team attendance.',
      retryDisabledMessage: 'You do not have access to view team attendance.'
    });
    expect((fixture.nativeElement as HTMLElement).querySelector('app-button')).toBeNull();
  });

  it('renders the configured empty message when there are no rows', async () => {
    const { fixture } = await setup({ rows: [] });
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('No attendance records for this date range.');
  });

  it('emits rowSelected only when canViewDetails is true', async () => {
    const hidden = { ...row, attendanceRecordId: 'record-2', canViewDetails: false };
    const { fixture } = await setup({ rows: [row, hidden] });
    const selected = vi.fn();
    fixture.componentInstance.rowSelected.subscribe(selected);

    const rows = (fixture.nativeElement as HTMLElement).querySelectorAll('tbody tr');
    (rows[0] as HTMLElement).click();
    (rows[1] as HTMLElement).click();

    expect(selected).toHaveBeenCalledTimes(1);
    expect(selected).toHaveBeenCalledWith(row);
  });

  it('shows Previous/Next pagination only when totalCount exceeds pageSize', async () => {
    const { fixture: withoutPaging } = await setup({ totalCount: 5, pageSize: 20 });
    expect(withoutPaging.nativeElement.querySelector('.tt-pagination')).toBeNull();

    const { fixture: withPaging } = await setup({ totalCount: 45, pageSize: 20, page: 2 });
    expect(withPaging.nativeElement.querySelector('.tt-pagination-info')?.textContent).toContain('Page 2 of 3');
  });

  it('emits pageChange when Next is clicked', async () => {
    const { fixture } = await setup({ totalCount: 45, pageSize: 20, page: 1 });
    const pageChange = vi.fn();
    fixture.componentInstance.pageChange.subscribe(pageChange);
    const buttons = (fixture.nativeElement as HTMLElement).querySelectorAll('.tt-pagination-buttons button');
    (buttons[1] as HTMLButtonElement).click();
    expect(pageChange).toHaveBeenCalledWith(2);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/app/modules/attendance/feature/time-tracking/attendance-history-list/attendance-history-list.component.spec.ts`
Expected: FAIL — the component doesn't exist yet.

- [ ] **Step 3: Create the component class**

Create `src/app/modules/attendance/feature/time-tracking/attendance-history-list/attendance-history-list.component.ts`:

```ts
import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { ButtonComponent } from '../../../../../shared/ui/button/button.component';
import { AttendanceHistoryRow } from '../../../models/time-tracking.model';
import { formatDate, formatDateTime, formatMinutes, statusLabel } from '../../../utils/attendance-formatters';

@Component({
  selector: 'app-attendance-history-list',
  standalone: true,
  imports: [ButtonComponent],
  templateUrl: './attendance-history-list.component.html',
  styleUrl: './attendance-history-list.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AttendanceHistoryListComponent {
  readonly rows = input<readonly AttendanceHistoryRow[]>([]);
  readonly loading = input(false);
  readonly error = input<string | null>(null);
  readonly page = input(1);
  readonly pageSize = input(20);
  readonly totalCount = input(0);
  readonly displayTimezone = input<string>('UTC');
  readonly emptyMessage = input('No attendance records for this date range.');
  readonly showEmployeeColumn = input(false);
  readonly retryDisabledMessage = input<string | null>(null);

  readonly pageChange = output<number>();
  readonly retryRequested = output<void>();
  readonly rowSelected = output<AttendanceHistoryRow>();

  readonly Math = Math;

  readonly formatDate = formatDate;
  readonly formatDateTime = formatDateTime;
  readonly formatMinutes = formatMinutes;
  readonly statusLabel = statusLabel;

  employeeLabel(row: AttendanceHistoryRow): string {
    return row.employee?.displayName ?? 'Current employee';
  }

  selectRow(row: AttendanceHistoryRow): void {
    if (row.canViewDetails) {
      this.rowSelected.emit(row);
    }
  }
}
```

- [ ] **Step 4: Create the template**

Create `src/app/modules/attendance/feature/time-tracking/attendance-history-list/attendance-history-list.component.html`:

```html
@if (loading()) {
  <div class="table-skeleton" aria-busy="true" aria-label="Loading attendance history"></div>
} @else if (error()) {
  <div class="time-tracking-message time-tracking-message--error" role="alert">
    <p>{{ error() }}</p>
    @if (error() !== retryDisabledMessage()) {
      <app-button type="button" variant="secondary" size="sm" (pressed)="retryRequested.emit()">Try again</app-button>
    }
  </div>
} @else if (rows().length === 0) {
  <p class="empty-copy">{{ emptyMessage() }}</p>
} @else {
  <div class="table-scroll">
    <table class="attendance-table">
      <thead>
        <tr>
          @if (showEmployeeColumn()) { <th scope="col">Employee</th> }
          <th scope="col">Date</th>
          <th scope="col">Clock in</th>
          <th scope="col">Clock out</th>
          <th scope="col">Worked time</th>
          <th scope="col">Status</th>
        </tr>
      </thead>
      <tbody>
        @for (row of rows(); track row.attendanceRecordId) {
          <tr [class.attendance-table-row--clickable]="row.canViewDetails" (click)="selectRow(row)">
            @if (showEmployeeColumn()) {
              <td>
                <span class="table-primary">{{ employeeLabel(row) }}</span>
                @if (row.employee?.employeeNumber) { <span class="table-secondary">{{ row.employee?.employeeNumber }}</span> }
              </td>
            }
            <td>{{ formatDate(row.workDate) }}</td>
            <td>{{ formatDateTime(row.clockInAt, displayTimezone()) }}</td>
            <td>{{ formatDateTime(row.clockOutAt, displayTimezone()) }}</td>
            <td>{{ formatMinutes(row.totalWorkedMinutes) }}</td>
            <td>
              <span class="table-primary">{{ statusLabel(row.status, row.statusLabel) }}</span>
              @if (row.attentionLabel) { <span class="table-note">{{ row.attentionLabel }}</span> }
            </td>
          </tr>
        }
      </tbody>
    </table>
  </div>
  @if (totalCount() > pageSize()) {
    <div class="tt-pagination">
      <span class="tt-pagination-info">Page {{ page() }} of {{ Math.ceil(totalCount() / pageSize()) }}</span>
      <div class="tt-pagination-buttons">
        <app-button type="button" variant="secondary" [disabled]="page() <= 1" (pressed)="pageChange.emit(page() - 1)">Previous</app-button>
        <app-button type="button" variant="secondary" [disabled]="page() * pageSize() >= totalCount()" (pressed)="pageChange.emit(page() + 1)">Next</app-button>
      </div>
    </div>
  }
}
```

- [ ] **Step 5: Create the styles**

Create `src/app/modules/attendance/feature/time-tracking/attendance-history-list/attendance-history-list.component.css` (duplicates the subset of `time-tracking.component.css` this component needs — Angular view encapsulation means a new component doesn't inherit a sibling component's styles; this mirrors the existing per-component styling convention already used throughout this module):

```css
:host{display:block}.table-scroll{overflow-x:auto;border:1px solid color-mix(in srgb,var(--color-border) 75%,transparent);border-radius:10px}.attendance-table{width:100%;min-width:600px;border-collapse:collapse;color:var(--color-text-primary);font-size:.8125rem}.attendance-table th,.attendance-table td{padding:.8rem .875rem;border-bottom:1px solid color-mix(in srgb,var(--color-border) 75%,transparent);text-align:left;vertical-align:top}.attendance-table th{background:color-mix(in srgb,var(--color-surface-secondary) 55%,var(--color-surface));color:var(--color-text-secondary);font-size:.6875rem;font-weight:700;letter-spacing:.04em;text-transform:uppercase;white-space:nowrap}.attendance-table tbody tr:last-child td{border-bottom:0}.attendance-table-row--clickable{cursor:pointer}.attendance-table-row--clickable:hover{background:color-mix(in srgb,var(--color-surface-secondary) 45%,var(--color-surface))}.table-primary,.table-secondary{display:block}.table-primary{color:var(--color-text-primary);font-weight:600}.table-secondary{margin-top:.2rem;color:var(--color-text-secondary);font-size:.75rem}.table-note{display:block;margin-top:.2rem;color:var(--color-text-secondary);font-size:.6875rem;line-height:1.35}.empty-copy{margin:0;color:var(--color-text-secondary);font-size:.8125rem}.time-tracking-message{display:flex;align-items:center;justify-content:space-between;gap:.75rem;border-radius:10px;padding:.75rem 1rem;border:1px solid color-mix(in srgb,var(--color-danger) 25%,var(--color-border));background:color-mix(in srgb,var(--color-danger-subtle) 55%,var(--color-surface));color:var(--color-danger-text)}.time-tracking-message p{margin:0;font-size:.8125rem;line-height:1.45}.time-tracking-message app-button{width:auto;flex-shrink:0}.table-skeleton{height:13rem;border-radius:var(--radius-content);background:var(--color-surface-secondary);animation:time-tracking-pulse 1.5s ease-in-out infinite}@keyframes time-tracking-pulse{50%{opacity:.55}}.tt-pagination{display:flex;align-items:center;justify-content:space-between;margin-top:.875rem;font-size:.8125rem;color:var(--color-text-secondary)}.tt-pagination-info{font-weight:500}.tt-pagination-buttons{display:flex;align-items:center;gap:.5rem}@media(max-width:520px){.time-tracking-message{align-items:flex-start;flex-direction:column}.time-tracking-message app-button{width:100%}}
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npx vitest run src/app/modules/attendance/feature/time-tracking/attendance-history-list/attendance-history-list.component.spec.ts`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/app/modules/attendance/feature/time-tracking/attendance-history-list/
git commit -m "feat: add AttendanceHistoryListComponent (trimmed, reusable for My and Team views)"
```

---

### Task 6: Wire the drawer, trimmed list, and side-by-side layout into `time-tracking.component`

**Files:**
- Modify: `src/app/modules/attendance/feature/time-tracking/time-tracking.component.ts`
- Modify: `src/app/modules/attendance/feature/time-tracking/time-tracking.component.html`
- Modify: `src/app/modules/attendance/feature/time-tracking/time-tracking.component.css`
- Modify: `src/app/modules/attendance/feature/time-tracking/time-tracking.component.spec.ts`

**Interfaces:**
- Consumes: `AttendanceHistoryListComponent` (Task 5), `AttendanceDetailDrawerComponent`/`AttendanceDetailSelection` (Part 1 Task 4), `TIME_TRACKING_COVERED_FORBIDDEN_ERROR` (already exported from `time-tracking.store.ts`).
- Produces: `component.selectedDetail: Signal<AttendanceDetailSelection | null>`, `component.onMyRowSelected(row)`, `component.onTeamRowSelected(row)`, `component.closeDetailDrawer()`. Task 7 does not depend on these (it only touches the "My requests" panel), but they must exist and work before Task 7 starts, since Task 7's manual verification exercises the whole page.

- [ ] **Step 1: Update imports and the `@Component` decorator**

In `src/app/modules/attendance/feature/time-tracking/time-tracking.component.ts`, change:

```ts
import { ModalComponent } from '../../../../shared/ui/modal/modal.component';
import { CorrectionApprovalsComponent } from '../correction-approvals/correction-approvals.component';
```

to:

```ts
import { ModalComponent } from '../../../../shared/ui/modal/modal.component';
import { AttendanceDetailDrawerComponent, AttendanceDetailSelection } from './attendance-detail-drawer/attendance-detail-drawer.component';
import { AttendanceHistoryListComponent } from './attendance-history-list/attendance-history-list.component';
import { CorrectionApprovalsComponent } from '../correction-approvals/correction-approvals.component';
```

Change:

```ts
import { TimeTrackingAction, TimeTrackingStore } from '../../state/time-tracking.store';
```

to:

```ts
import { TIME_TRACKING_COVERED_FORBIDDEN_ERROR, TimeTrackingAction, TimeTrackingStore } from '../../state/time-tracking.store';
```

Change:

```ts
  imports: [BreadcrumbHeaderComponent, ButtonComponent, CorrectionApprovalsComponent, DateRangePickerComponent, FormsModule, ModalComponent, WorkAreaApprovalsComponent],
```

to:

```ts
  imports: [AttendanceDetailDrawerComponent, AttendanceHistoryListComponent, BreadcrumbHeaderComponent, ButtonComponent, CorrectionApprovalsComponent, DateRangePickerComponent, FormsModule, ModalComponent, WorkAreaApprovalsComponent],
```

- [ ] **Step 2: Add `selectedDetail` state, row-selection methods, and expose the forbidden-message constant**

Change:

```ts
  readonly Math = Math;
```

to:

```ts
  readonly Math = Math;
  readonly TIME_TRACKING_COVERED_FORBIDDEN_ERROR = TIME_TRACKING_COVERED_FORBIDDEN_ERROR;
```

Change:

```ts
  readonly currentWeekRange = currentWeekRange();
```

to:

```ts
  readonly currentWeekRange = currentWeekRange();
  readonly selectedDetail = signal<AttendanceDetailSelection | null>(null);
```

Add these three methods right after `goToCoveredHistoryPage`:

```ts
  goToCoveredHistoryPage(page: number): void {
    const range = this.store.selectedHistoryRange() ?? this.currentWeekRange;
    void this.store.loadCoveredHistory(range, this.store.selectedCoveredEmployeeId() ?? undefined, page);
  }
```

becomes:

```ts
  goToCoveredHistoryPage(page: number): void {
    const range = this.store.selectedHistoryRange() ?? this.currentWeekRange;
    void this.store.loadCoveredHistory(range, this.store.selectedCoveredEmployeeId() ?? undefined, page);
  }

  onMyRowSelected(row: AttendanceHistoryRow): void {
    const employeeId = this.store.today()?.employeeId;
    if (!employeeId) return;
    this.selectedDetail.set({ employeeId, workDate: row.workDate });
  }

  onTeamRowSelected(row: AttendanceHistoryRow): void {
    if (!row.employee) return;
    this.selectedDetail.set({ employeeId: row.employee.employeeId, workDate: row.workDate });
  }

  closeDetailDrawer(): void {
    this.selectedDetail.set(null);
    this.store.clearDayDetail();
  }
```

- [ ] **Step 3: Close the drawer when a correction is successfully submitted**

Change:

```ts
    this.notifications.success(result.status === 'approved' ? 'Attendance correction applied.' : 'Correction request submitted.');
    this.closeCorrection();
    const range = this.store.selectedHistoryRange() ?? this.currentWeekRange;
    void this.store.loadToday();
    void this.store.loadMyHistory(range);
    void this.store.loadMyCorrections();
  }
```

to:

```ts
    this.notifications.success(result.status === 'approved' ? 'Attendance correction applied.' : 'Correction request submitted.');
    this.closeCorrection();
    this.closeDetailDrawer();
    const range = this.store.selectedHistoryRange() ?? this.currentWeekRange;
    void this.store.loadToday();
    void this.store.loadMyHistory(range);
    void this.store.loadMyCorrections();
  }
```

(This makes the drawer close rather than show stale pre-correction data after a successful submit — it can always be reopened by clicking the row again.)

- [ ] **Step 4: Rewrite the template's My-history section into the side-by-side layout**

In `time-tracking.component.html`, replace this entire block (from the `@if (viewMode() === 'my') {` that opens the history/requests area, through the `</section>` that closes "My requests", right before `@if (correctionFormOpen(); as selectedRow) {`):

```html
  @if (viewMode() === 'my') {
      <section class="history-card" aria-labelledby="history-heading">
    <div class="section-heading section-heading--stacked-mobile">
      <div>
        <p class="eyebrow">Personal records</p>
        <h2 id="history-heading">My attendance history</h2>
      </div>
      <div class="range-controls" aria-label="Attendance history date range">
        <app-date-range-picker
          [from]="historyFrom()"
          [to]="historyTo()"
          [disabled]="store.historyLoading()"
          (rangeChange)="onRangeSelected($event)"
        />
      </div>
    </div>
    @if (store.historyLoading()) {
      <div class="table-skeleton" aria-busy="true" aria-label="Loading attendance history"></div>
    } @else if (store.historyError()) {
      <div class="time-tracking-message time-tracking-message--error" role="alert"><p>{{ store.historyError() }}</p><app-button type="button" variant="secondary" size="sm" (pressed)="retryHistory()">Try again</app-button></div>
    } @else if (store.history().length === 0) {
      <p class="empty-copy">No attendance records for this date range.</p>
    } @else {
      <div class="table-scroll">
        <table class="attendance-table">
          <thead><tr><th scope="col">Date</th><th scope="col">Clock in</th><th scope="col">Clock out</th><th scope="col">Break</th><th scope="col">Worked time</th><th scope="col">Work mode / source / status</th><th scope="col">Actions</th></tr></thead>
          <tbody>
            @for (row of store.history(); track row.attendanceRecordId) {
              <tr>
                <td>{{ formatDate(row.workDate) }}</td>
                <td>{{ formatDateTime(row.clockInAt, displayTimezone()) }}</td>
                <td>{{ formatDateTime(row.clockOutAt, displayTimezone()) }}</td>
                <td>
                  <span class="table-primary">{{ formatMinutes(row.breakMinutes) }}</span>
                  @if (hasBreakOverage(row.breakOverageMinutes, row.isOverBreakAllowance)) { <span class="table-note table-note--warning">{{ breakOverageHistoryLabel(row.breakOverageMinutes) }}</span> }
                </td>
                <td>{{ formatMinutes(row.totalWorkedMinutes) }}</td>
                <td>
                  <span class="table-primary">{{ workModeLabel(row.expectedWorkMode) }}</span>
                  <span class="table-secondary">{{ sourceLabel(row.attendanceSource) }} · {{ statusLabel(row.status, row.statusLabel) }}</span>
                  @if (hasAttention(row.attentionLabel)) { <span class="table-note">{{ row.attentionLabel }}</span> }
                </td>
                <td>
                  @if (row.canRequestCorrection) { <button type="button" class="table-action" data-testid="request-correction" (click)="openCorrection(row)">Request correction</button> }
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>
      @if (store.historyTotalCount() > store.historyPageSize()) {
        <div class="tt-pagination">
          <span class="tt-pagination-info">
            Page {{ store.historyPage() }} of {{ Math.ceil(store.historyTotalCount() / store.historyPageSize()) }}
          </span>
          <div class="tt-pagination-buttons">
            <app-button type="button" variant="secondary" [disabled]="store.historyPage() <= 1" (pressed)="goToHistoryPage(store.historyPage() - 1)">Previous</app-button>
            <app-button type="button" variant="secondary" [disabled]="store.historyPage() * store.historyPageSize() >= store.historyTotalCount()" (pressed)="goToHistoryPage(store.historyPage() + 1)">Next</app-button>
          </div>
        </div>
      }
    }
    </section>

      <section class="history-card" aria-labelledby="my-requests-heading">
```

Keep everything from `<div class="section-heading">` inside that "My requests" `<section>` (the tablist, both tab panels, all the way to that section's own `</section>`) **exactly as it is, byte-for-byte** — only the two things above and below it change. The replacement for the block quoted above is:

```html
  @if (viewMode() === 'my') {
    <div class="history-requests-row">
      <section class="history-card history-card--history" aria-labelledby="history-heading">
        <div class="section-heading section-heading--stacked-mobile">
          <div>
            <p class="eyebrow">Personal records</p>
            <h2 id="history-heading">My attendance history</h2>
          </div>
          <div class="range-controls" aria-label="Attendance history date range">
            <app-date-range-picker
              [from]="historyFrom()"
              [to]="historyTo()"
              [disabled]="store.historyLoading()"
              (rangeChange)="onRangeSelected($event)"
            />
          </div>
        </div>
        <app-attendance-history-list
          [rows]="store.history()"
          [loading]="store.historyLoading()"
          [error]="store.historyError()"
          [page]="store.historyPage()"
          [pageSize]="store.historyPageSize()"
          [totalCount]="store.historyTotalCount()"
          [displayTimezone]="displayTimezone()"
          emptyMessage="No attendance records for this date range."
          (pageChange)="goToHistoryPage($event)"
          (retryRequested)="retryHistory()"
          (rowSelected)="onMyRowSelected($event)"
        />
      </section>

      <section class="history-card" aria-labelledby="my-requests-heading">
```

and immediately after the (unchanged) "My requests" section's closing `</section>` — i.e. right before `@if (correctionFormOpen(); as selectedRow) {` — add one closing `</div>` to end `.history-requests-row`:

```html
      </section>
    </div>

    @if (correctionFormOpen(); as selectedRow) {
```

(That `</section>` is the existing one that already closes "My requests" — you're only adding the new `</div>` and blank line after it, not touching the section itself.)

- [ ] **Step 5: Rewrite the template's Team-attendance table into `app-attendance-history-list`**

Replace:

```html
        @if (store.coveredHistoryLoading()) {
          <div class="table-skeleton" aria-busy="true" aria-label="Loading team attendance"></div>
        } @else if (store.coveredHistoryError()) {
          <div class="time-tracking-message time-tracking-message--error" role="alert"><p>{{ store.coveredHistoryError() }}</p>@if (store.coveredHistoryError() !== 'You do not have access to view team attendance.') { <app-button type="button" variant="secondary" size="sm" (pressed)="retryCoveredHistory()">Try again</app-button> }</div>
        } @else if (store.coveredHistory().length === 0) {
          <p class="empty-copy">No team attendance records for this date range.</p>
        } @else {
          <div class="table-scroll">
            <table class="attendance-table">
              <thead><tr><th scope="col">Employee</th><th scope="col">Date</th><th scope="col">Clock in</th><th scope="col">Clock out</th><th scope="col">Break</th><th scope="col">Worked time</th><th scope="col">Status</th></tr></thead>
              <tbody>
                @for (row of store.coveredHistory(); track row.attendanceRecordId) {
                  <tr>
                    <td><span class="table-primary">{{ employeeLabel(row) }}</span>@if (row.employee?.employeeNumber) { <span class="table-secondary">{{ row.employee?.employeeNumber }}</span> }</td>
                    <td>{{ formatDate(row.workDate) }}</td>
                    <td>{{ formatDateTime(row.clockInAt, displayTimezone()) }}</td>
                    <td>{{ formatDateTime(row.clockOutAt, displayTimezone()) }}</td>
                    <td><span class="table-primary">{{ formatMinutes(row.breakMinutes) }}</span>@if (hasBreakOverage(row.breakOverageMinutes, row.isOverBreakAllowance)) { <span class="table-note table-note--warning">{{ breakOverageHistoryLabel(row.breakOverageMinutes) }}</span> }</td>
                    <td>{{ formatMinutes(row.totalWorkedMinutes) }}</td>
                    <td><span class="table-primary">{{ statusLabel(row.status, row.statusLabel) }}</span>@if (hasAttention(row.attentionLabel)) { <span class="table-note">{{ row.attentionLabel }}</span> }</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
          @if (store.coveredHistoryTotalCount() > store.coveredHistoryPageSize()) {
            <div class="tt-pagination">
              <span class="tt-pagination-info">
                Page {{ store.coveredHistoryPage() }} of {{ Math.ceil(store.coveredHistoryTotalCount() / store.coveredHistoryPageSize()) }}
              </span>
              <div class="tt-pagination-buttons">
                <app-button type="button" variant="secondary" [disabled]="store.coveredHistoryPage() <= 1" (pressed)="goToCoveredHistoryPage(store.coveredHistoryPage() - 1)">Previous</app-button>
                <app-button type="button" variant="secondary" [disabled]="store.coveredHistoryPage() * store.coveredHistoryPageSize() >= store.coveredHistoryTotalCount()" (pressed)="goToCoveredHistoryPage(store.coveredHistoryPage() + 1)">Next</app-button>
              </div>
            </div>
          }
        }
      </section>
    }
```

with:

```html
        <app-attendance-history-list
          [rows]="store.coveredHistory()"
          [loading]="store.coveredHistoryLoading()"
          [error]="store.coveredHistoryError()"
          [page]="store.coveredHistoryPage()"
          [pageSize]="store.coveredHistoryPageSize()"
          [totalCount]="store.coveredHistoryTotalCount()"
          [displayTimezone]="displayTimezone()"
          [showEmployeeColumn]="true"
          [retryDisabledMessage]="TIME_TRACKING_COVERED_FORBIDDEN_ERROR"
          emptyMessage="No team attendance records for this date range."
          (pageChange)="goToCoveredHistoryPage($event)"
          (retryRequested)="retryCoveredHistory()"
          (rowSelected)="onTeamRowSelected($event)"
        />
      </section>
    }
```

- [ ] **Step 6: Add the drawer to the template**

Replace the file's final five lines:

```html
        }
      </section>
    }
  }
</div>
```

with:

```html
        }
      </section>
    }
  }

  <app-attendance-detail-drawer
    [selection]="selectedDetail()"
    [displayTimezone]="displayTimezone()"
    (closed)="closeDetailDrawer()"
    (requestCorrection)="openCorrection($event)"
  />
</div>
```

- [ ] **Step 7: Add the side-by-side layout CSS**

In `time-tracking.component.css`, append this line at the end of the file (after the existing `.tt-pagination{...}` line, keep everything else in the file untouched):

```css

.history-requests-row{display:flex;align-items:flex-start;gap:1rem}.history-requests-row>.history-card{flex:1 1 0;min-width:0}.history-requests-row>.history-card--history{flex:1.85 1 0}@media(max-width:900px){.history-requests-row{flex-direction:column}.history-requests-row>.history-card,.history-requests-row>.history-card--history{flex:1 1 auto;width:100%}}
```

- [ ] **Step 8: Update `time-tracking.component.spec.ts`**

Add `AttendanceDayDetail` to the model import:

```ts
import { AttendanceHistoryRow, AttendanceTodayResponse } from '../../models/time-tracking.model';
```

becomes:

```ts
import { AttendanceDayDetail, AttendanceHistoryRow, AttendanceTodayResponse } from '../../models/time-tracking.model';
```

Add five fields to the `StoreMock` type — change:

```ts
  selectedCoveredEmployeeId: ReturnType<typeof signal<string | null>>;
  loadToday: ReturnType<typeof vi.fn>;
```

to:

```ts
  selectedCoveredEmployeeId: ReturnType<typeof signal<string | null>>;
  dayDetail: ReturnType<typeof signal<AttendanceDayDetail | null>>;
  dayDetailLoading: ReturnType<typeof signal<boolean>>;
  dayDetailError: ReturnType<typeof signal<string | null>>;
  loadDayDetail: ReturnType<typeof vi.fn>;
  clearDayDetail: ReturnType<typeof vi.fn>;
  loadToday: ReturnType<typeof vi.fn>;
```

Add the matching fields to the mock object built in `setup()` — change:

```ts
      selectedCoveredEmployeeId: signal(null),
      loadToday: vi.fn(() => Promise.resolve()),
```

to:

```ts
      selectedCoveredEmployeeId: signal(null),
      dayDetail: signal(null),
      dayDetailLoading: signal(false),
      dayDetailError: signal(null),
      loadDayDetail: vi.fn(() => Promise.resolve()),
      clearDayDetail: vi.fn(),
      loadToday: vi.fn(() => Promise.resolve()),
```

Replace the two tests that exercise the old row-level "Request correction" button (the row-level button no longer exists — the action moved into the drawer's Summary section, tested in Part 1). Change:

```ts
  it('shows Request correction only when the history row allows it', async () => {
    const eligible = { ...coveredRow, canRequestCorrection: true };
    const hidden = { ...eligible, attendanceRecordId: 'record-2', canRequestCorrection: false };
    const { fixture } = await setup({}, false, [eligible, hidden]);
    expect(fixture.nativeElement.querySelectorAll('[data-testid="request-correction"]')).toHaveLength(1);
  });

  it('opens the correction form with the selected work date and clock-in fields', async () => {
    const eligible = { ...coveredRow, canRequestCorrection: true, workDate: '2026-08-21' };
    const { fixture } = await setup({}, false, [eligible]);
    (fixture.nativeElement.querySelector('[data-testid="request-correction"]') as HTMLButtonElement).click();
    fixture.detectChanges();
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Request attendance correction');
    expect(text).toContain('Aug 21, 2026');
    expect(text).toContain('Times are shown in company time.');
    expect(text).not.toContain('Times use Asia/Colombo.');
    expect(fixture.nativeElement.querySelector('input[name="requestedClockInAt"]')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('input[name="requestedClockOutAt"]')).toBeNull();
  });
```

to:

```ts
  it('opens the detail drawer for a My-history row using the current employee id from Today', async () => {
    const row = { ...coveredRow, workDate: '2026-08-21' };
    const { fixture } = await setup({ employeeId: 'employee-9' }, false, [row]);
    const component = fixture.componentInstance;

    component.onMyRowSelected(row);

    expect(component.selectedDetail()).toEqual({ employeeId: 'employee-9', workDate: '2026-08-21' });
  });

  it('does not open the detail drawer for a My-history row when Today has not loaded', async () => {
    const row = { ...coveredRow, workDate: '2026-08-21' };
    const { fixture, store } = await setup({}, false, [row]);
    store.today.set(null);
    const component = fixture.componentInstance;

    component.onMyRowSelected(row);

    expect(component.selectedDetail()).toBeNull();
  });

  it("opens the detail drawer for a Team-attendance row using that row's employee id", async () => {
    const { fixture } = await setup({ canViewCoveredEmployees: true }, true, [coveredRow]);
    const component = fixture.componentInstance;

    component.onTeamRowSelected(coveredRow);

    expect(component.selectedDetail()).toEqual({ employeeId: 'employee-2', workDate: '2026-08-22' });
  });

  it('closes and clears the detail drawer', async () => {
    const { fixture, store } = await setup({}, false, [coveredRow]);
    const component = fixture.componentInstance;
    component.selectedDetail.set({ employeeId: 'employee-2', workDate: coveredRow.workDate });

    component.closeDetailDrawer();

    expect(component.selectedDetail()).toBeNull();
    expect(store.clearDayDetail).toHaveBeenCalled();
  });

  it('renders My attendance history and My requests side by side', async () => {
    const { fixture } = await setup({}, false, [coveredRow]);
    const row = fixture.nativeElement.querySelector('.history-requests-row');
    expect(row).toBeTruthy();
    expect(row?.querySelector('app-attendance-history-list')).toBeTruthy();
    expect(row?.textContent).toContain('My requests');
  });

  it('renders the detail drawer content once a row is selected and its data loads', async () => {
    const { fixture, store } = await setup({}, false, [coveredRow]);
    const component = fixture.componentInstance;
    component.selectedDetail.set({ employeeId: 'employee-2', workDate: coveredRow.workDate });
    store.dayDetail.set({ summary: coveredRow, timelineEvents: [], dailyActivity: null });
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Attendance detail');
  });

  it('opens the correction form with the selected work date and clock-in fields', async () => {
    const eligible = { ...coveredRow, canRequestCorrection: true, workDate: '2026-08-21' };
    const { fixture } = await setup({}, false, [eligible]);
    const component = fixture.componentInstance;
    component.openCorrection(eligible);
    fixture.detectChanges();
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Request attendance correction');
    expect(text).toContain('Aug 21, 2026');
    expect(text).toContain('Times are shown in company time.');
    expect(text).not.toContain('Times use Asia/Colombo.');
    expect(fixture.nativeElement.querySelector('input[name="requestedClockInAt"]')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('input[name="requestedClockOutAt"]')).toBeNull();
  });
```

(The "opens the correction form..." test keeps its original body, just triggers via the still-existing `openCorrection` method directly instead of a DOM click on the now-removed row button — matching the pattern the very next test in the file, `component.openCorrection(eligible)`, already uses.)

- [ ] **Step 9: Run the full attendance test suite**

Run: `npx vitest run src/app/modules/attendance`
Expected: PASS — every test in the module, including the new and rewritten ones.

- [ ] **Step 10: Typecheck / build**

Run: `npx ng build --configuration development` (or the project's existing local build script if one is set up for this — check `package.json` scripts first)
Expected: 0 errors. If any unused-import or unused-symbol errors surface from this task's edits (e.g. `hasBreakOverage`/`breakOverageHistoryLabel`/`workModeLabel`/`sourceLabel`/`employeeLabel` becoming unused on `time-tracking.component.ts` now that the row markup moved into `AttendanceHistoryListComponent`), remove exactly those now-dead members and re-run the build. Do not remove anything still referenced by the correction/work-area-change modals or the "My requests" panel, which are untouched by this task.

- [ ] **Step 11: Commit**

```bash
git add src/app/modules/attendance/feature/time-tracking/time-tracking.component.ts src/app/modules/attendance/feature/time-tracking/time-tracking.component.html src/app/modules/attendance/feature/time-tracking/time-tracking.component.css src/app/modules/attendance/feature/time-tracking/time-tracking.component.spec.ts
git commit -m "feat: wire attendance detail drawer, trimmed history list, and side-by-side layout into Time Tracking"
```

- [ ] **Step 12: Manual browser verification (requires the backend running with the companion plan's endpoint)**

1. Start the backend (per the companion backend plan) and the frontend dev server.
2. Log in as an employee with self-service access. On `/attendance/time-tracking`, confirm "My attendance history" and "My requests" render side by side (history wider), each row shows only Date/Clock in/Clock out/Worked time/Status, and clicking a row with `canViewDetails` opens the drawer showing Summary → Timeline → Daily activity (an empty state is fine if no `ActivityDailySummary` exists for that day/employee — this is the expected self-view path, always populated for Summary/Timeline regardless of `monitoring:read`).
3. Click "Request correction" inside the drawer's Summary section; confirm the existing correction modal opens pre-filled for that row, and that submitting it closes both the modal and the drawer.
4. Switch to Team view (a user with `attendance:read` + coverage). Confirm the Team table is similarly trimmed with an Employee column, and that clicking a row opens the drawer for that employee. If the logged-in user also has `monitoring:read`, confirm the Daily activity section can show populated data for an employee/day that has an `ActivityDailySummary` row; if not, confirm it shows the empty state rather than erroring.
5. Resize to a narrow viewport and confirm "My attendance history"/"My requests" stack vertically below the tablet breakpoint.

---

### Task 7: Extract `MyRequestsPanelComponent`

Ordered last: this touches the exact markup the pre-existing WIP most recently reworked (the My Requests tab consolidation), so everything else lands first and stays stable if this task needs rework.

**Files:**
- Create: `src/app/modules/attendance/feature/time-tracking/my-requests-panel/my-requests-panel.component.ts`
- Create: `src/app/modules/attendance/feature/time-tracking/my-requests-panel/my-requests-panel.component.html`
- Create: `src/app/modules/attendance/feature/time-tracking/my-requests-panel/my-requests-panel.component.spec.ts`
- Modify: `src/app/modules/attendance/feature/time-tracking/time-tracking.component.ts`
- Modify: `src/app/modules/attendance/feature/time-tracking/time-tracking.component.html`

**Interfaces:**
- Consumes: `formatDate`/`formatDateTime`/`formatWorkAreaDate` from Part 1's `attendance-formatters.ts`; `correctionTypeLabel`/`correctionStatusLabel` from `../../models/attendance-correction.model`; `workAreaLabel`/`workAreaChangeStatusLabel` from `../../models/work-area-change-request.model`.
- Produces: component selector `app-my-requests-panel`, no inputs/outputs — it is fully self-contained (injects `TimeTrackingStore` and `NotificationService` directly, exactly like the already-existing `CorrectionApprovalsComponent`/`WorkAreaApprovalsComponent` siblings). The parent renders `<app-my-requests-panel />` in place of the tablist/panels markup it used to own directly.

This extraction moves, verbatim, the "My requests" tabbed panel (both tabs, both tables, both pagination blocks) **and** the work-area-change cancellation confirmation modal (currently rendered in the parent but only ever triggered from this panel) into the new component. Nothing about their behavior changes — this is a pure move, not a rewrite.

- [ ] **Step 1: Write the failing component test**

Create `src/app/modules/attendance/feature/time-tracking/my-requests-panel/my-requests-panel.component.spec.ts`:

```ts
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { NotificationService } from '../../../../../core/services/notification.service';
import { AttendanceCorrectionResponse } from '../../../models/attendance-correction.model';
import { WorkAreaChangeRequestResponse } from '../../../models/work-area-change-request.model';
import { TimeTrackingStore } from '../../../state/time-tracking.store';
import { MyRequestsPanelComponent } from './my-requests-panel.component';

const correction: AttendanceCorrectionResponse = {
  id: 'correction-1',
  employeeId: 'employee-1',
  workDate: '2026-08-21',
  correctionType: 'clock_in',
  requestedClockInAt: '2026-08-21T04:00:00Z',
  requestedClockOutAt: null,
  requestedBreaks: null,
  reason: 'Forgot to clock in',
  notes: null,
  status: 'pending',
  timezone: 'Asia/Colombo',
  reviewedAt: null,
  reviewComment: null
} as AttendanceCorrectionResponse;

const workAreaRequest: WorkAreaChangeRequestResponse = {
  id: 'wa-1',
  employeeId: 'employee-1',
  legalEntityId: 'entity-1',
  requesterDisplayName: 'Requester',
  timezone: 'Asia/Colombo',
  date: '2026-08-22',
  currentExpectedWorkArea: 'onsite',
  requestedWorkArea: 'remote',
  reason: 'Client meeting',
  status: 'pending',
  requestedAt: '2026-08-21T06:00:00.000Z',
  reviewedById: null,
  reviewerDisplayName: null,
  reviewedAt: null,
  reviewComment: null,
  receiver: { employeeId: 'approver-1', userId: 'user-1', displayName: 'Approver', positionName: 'Manager' }
};

interface PanelStoreMock {
  myCorrections: ReturnType<typeof signal<readonly AttendanceCorrectionResponse[]>>;
  myCorrectionsLoading: ReturnType<typeof signal<boolean>>;
  myCorrectionsError: ReturnType<typeof signal<string | null>>;
  myCorrectionsPage: ReturnType<typeof signal<number>>;
  myCorrectionsPageSize: ReturnType<typeof signal<number>>;
  myCorrectionsTotalCount: ReturnType<typeof signal<number>>;
  myCorrectionsLoaded: ReturnType<typeof signal<boolean>>;
  correctionActionLoading: ReturnType<typeof signal<boolean>>;
  activeCorrectionAction: ReturnType<typeof signal<string | null>>;
  loadMyCorrections: ReturnType<typeof vi.fn>;
  cancelCorrection: ReturnType<typeof vi.fn>;
  myWorkAreaRequests: ReturnType<typeof signal<readonly WorkAreaChangeRequestResponse[]>>;
  myWorkAreaRequestsLoading: ReturnType<typeof signal<boolean>>;
  myWorkAreaRequestsError: ReturnType<typeof signal<string | null>>;
  myWorkAreaRequestsPage: ReturnType<typeof signal<number>>;
  myWorkAreaRequestsPageSize: ReturnType<typeof signal<number>>;
  myWorkAreaRequestsTotalCount: ReturnType<typeof signal<number>>;
  myWorkAreaRequestsLoaded: ReturnType<typeof signal<boolean>>;
  workAreaActionLoading: ReturnType<typeof signal<boolean>>;
  activeWorkAreaRequestId: ReturnType<typeof signal<string | null>>;
  loadMyWorkAreaRequests: ReturnType<typeof vi.fn>;
  cancelWorkAreaChangeRequest: ReturnType<typeof vi.fn>;
}

describe('MyRequestsPanelComponent', () => {
  afterEach(() => TestBed.resetTestingModule());

  async function setup(options: {
    corrections?: readonly AttendanceCorrectionResponse[];
    workAreaRequests?: readonly WorkAreaChangeRequestResponse[];
  } = {}): Promise<{ fixture: ComponentFixture<MyRequestsPanelComponent>; store: PanelStoreMock }> {
    const store: PanelStoreMock = {
      myCorrections: signal(options.corrections ?? []),
      myCorrectionsLoading: signal(false),
      myCorrectionsError: signal(null),
      myCorrectionsPage: signal(1),
      myCorrectionsPageSize: signal(20),
      myCorrectionsTotalCount: signal((options.corrections ?? []).length),
      myCorrectionsLoaded: signal(false),
      correctionActionLoading: signal(false),
      activeCorrectionAction: signal(null),
      loadMyCorrections: vi.fn(() => Promise.resolve()),
      cancelCorrection: vi.fn(() => Promise.resolve(correction)),
      myWorkAreaRequests: signal(options.workAreaRequests ?? []),
      myWorkAreaRequestsLoading: signal(false),
      myWorkAreaRequestsError: signal(null),
      myWorkAreaRequestsPage: signal(1),
      myWorkAreaRequestsPageSize: signal(20),
      myWorkAreaRequestsTotalCount: signal((options.workAreaRequests ?? []).length),
      myWorkAreaRequestsLoaded: signal(false),
      workAreaActionLoading: signal(false),
      activeWorkAreaRequestId: signal(null),
      loadMyWorkAreaRequests: vi.fn(() => Promise.resolve()),
      cancelWorkAreaChangeRequest: vi.fn(() => Promise.resolve({ ...workAreaRequest, status: 'cancelled' }))
    };

    await TestBed.configureTestingModule({
      imports: [MyRequestsPanelComponent],
      providers: [
        { provide: TimeTrackingStore, useValue: store },
        { provide: NotificationService, useValue: { success: vi.fn(), error: vi.fn() } }
      ]
    }).compileComponents();

    const fixture = TestBed.createComponent(MyRequestsPanelComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return { fixture, store };
  }

  it('loads corrections on init (the default tab)', async () => {
    const { store } = await setup();
    expect(store.loadMyCorrections).toHaveBeenCalled();
  });

  it('switches to the work-area tab and loads it on first visit', async () => {
    const { fixture, store } = await setup();
    const workAreaTab = fixture.nativeElement.querySelector('#my-requests-tab-work-area') as HTMLButtonElement;
    workAreaTab.click();
    fixture.detectChanges();
    expect(store.loadMyWorkAreaRequests).toHaveBeenCalledWith({ pageNumber: 1 });
  });

  it('renders the corrections table and cancels a pending request', async () => {
    const { fixture, store } = await setup({ corrections: [correction] });
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Forgot to clock in');

    fixture.nativeElement.querySelector<HTMLButtonElement>('.table-action--danger')!.click();
    await fixture.whenStable();

    expect(store.cancelCorrection).toHaveBeenCalledWith('correction-1');
  });

  it('opens the cancel-work-area confirmation modal and confirms it', async () => {
    const { fixture, store } = await setup({ workAreaRequests: [workAreaRequest] });
    fixture.nativeElement.querySelector<HTMLButtonElement>('#my-requests-tab-work-area')!.click();
    fixture.detectChanges();

    fixture.nativeElement.querySelector<HTMLButtonElement>('.table-action--danger')!.click();
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Cancel work-area request?');

    const confirmButtons = Array.from(fixture.nativeElement.querySelectorAll('button')) as HTMLButtonElement[];
    confirmButtons.find((button) => button.textContent?.trim() === 'Cancel request')!.click();
    await fixture.whenStable();

    expect(store.cancelWorkAreaChangeRequest).toHaveBeenCalledWith('wa-1');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/app/modules/attendance/feature/time-tracking/my-requests-panel/my-requests-panel.component.spec.ts`
Expected: FAIL — the component doesn't exist yet.

- [ ] **Step 3: Create the component class**

Create `src/app/modules/attendance/feature/time-tracking/my-requests-panel/my-requests-panel.component.ts`:

```ts
import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { ButtonComponent } from '../../../../../shared/ui/button/button.component';
import { ModalComponent } from '../../../../../shared/ui/modal/modal.component';
import { NotificationService } from '../../../../../core/services/notification.service';
import { AttendanceCorrectionResponse, correctionStatusLabel, correctionTypeLabel } from '../../../models/attendance-correction.model';
import { workAreaChangeStatusLabel, workAreaLabel } from '../../../models/work-area-change-request.model';
import { TimeTrackingStore } from '../../../state/time-tracking.store';
import { formatDate, formatDateTime, formatWorkAreaDate } from '../../../utils/attendance-formatters';

type PersonalRequestTab = 'corrections' | 'work-area';

@Component({
  selector: 'app-my-requests-panel',
  standalone: true,
  imports: [ButtonComponent, ModalComponent],
  templateUrl: './my-requests-panel.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MyRequestsPanelComponent implements OnInit {
  readonly store = inject(TimeTrackingStore);
  private readonly notifications = inject(NotificationService);

  readonly Math = Math;
  readonly formatDate = formatDate;
  readonly formatDateTime = formatDateTime;
  readonly formatWorkAreaDate = formatWorkAreaDate;
  readonly correctionTypeLabel = correctionTypeLabel;
  readonly correctionStatusLabel = correctionStatusLabel;
  readonly workAreaLabel = workAreaLabel;
  readonly workAreaChangeStatusLabel = workAreaChangeStatusLabel;

  readonly selectedRequestTab = signal<PersonalRequestTab>('corrections');
  readonly workAreaCancelRequestId = signal<string | null>(null);

  ngOnInit(): void {
    this.ensureRequestTabLoaded(this.selectedRequestTab());
  }

  selectRequestTab(tab: PersonalRequestTab): void {
    this.selectedRequestTab.set(tab);
    this.ensureRequestTabLoaded(tab);
  }

  private ensureRequestTabLoaded(tab: PersonalRequestTab): void {
    if (tab === 'corrections') {
      if (!this.store.myCorrectionsLoaded?.() && this.store.loadMyCorrections) {
        void this.store.loadMyCorrections();
      }
      return;
    }
    if (!this.store.myWorkAreaRequestsLoaded()) {
      void this.store.loadMyWorkAreaRequests({ pageNumber: 1 });
    }
  }

  goToCorrectionsPage(page: number): void {
    void this.store.loadMyCorrections(page);
  }

  goToWorkAreaRequestsPage(page: number): void {
    void this.store.loadMyWorkAreaRequests({ pageNumber: page });
  }

  correctionSummary(request: AttendanceCorrectionResponse): string {
    if (request.correctionType === 'break') return `${request.requestedBreaks?.length ?? 0} interval(s)`;
    const clockIn = request.requestedClockInAt ? this.formatDateTime(request.requestedClockInAt, request.timezone) : null;
    const clockOut = request.requestedClockOutAt ? this.formatDateTime(request.requestedClockOutAt, request.timezone) : null;
    if (clockIn && clockOut) return `${clockIn} to ${clockOut}`;
    return clockIn || clockOut || 'Time update requested';
  }

  correctionActionIsLoading(action: string): boolean {
    return this.store.activeCorrectionAction?.() === action;
  }

  async cancelCorrection(id: string): Promise<void> {
    const result = await this.store.cancelCorrection(id);
    if (!result) return;
    this.notifications.success('Correction request cancelled.');
    void this.store.loadMyCorrections();
  }

  requestCancelWorkArea(id: string): void {
    if (this.store.myWorkAreaRequests().find((request) => request.id === id)?.status === 'pending') {
      this.workAreaCancelRequestId.set(id);
    }
  }

  closeCancelWorkArea(): void {
    if (!this.store.workAreaActionLoading()) this.workAreaCancelRequestId.set(null);
  }

  async confirmCancelWorkArea(): Promise<void> {
    const id = this.workAreaCancelRequestId();
    if (!id) return;
    const result = await this.store.cancelWorkAreaChangeRequest(id);
    if (result) {
      this.workAreaCancelRequestId.set(null);
      void this.store.loadMyWorkAreaRequests({ pageNumber: this.store.myWorkAreaRequestsPage() });
    }
  }

  workAreaActionIsLoading(id: string): boolean {
    return this.store.activeWorkAreaRequestId() === id;
  }
}
```

- [ ] **Step 4: Create the template**

Create `src/app/modules/attendance/feature/time-tracking/my-requests-panel/my-requests-panel.component.html` — this is the "My requests" tablist/panels markup, moved verbatim from `time-tracking.component.html` (no `store.`/method-name changes, since this new component keeps the identical field/method names), plus the cancel-work-area confirmation modal moved verbatim from the same file:

```html
<div class="section-heading">
  <div><p class="eyebrow">Requests</p><h2 id="my-requests-heading">My requests</h2></div>
</div>
<div class="my-requests-tablist" role="tablist" aria-label="My requests">
  <button
    type="button"
    role="tab"
    id="my-requests-tab-corrections"
    class="my-requests-tab"
    [class.my-requests-tab--active]="selectedRequestTab() === 'corrections'"
    [attr.aria-selected]="selectedRequestTab() === 'corrections'"
    aria-controls="my-requests-panel-corrections"
    tabindex="0"
    (click)="selectRequestTab('corrections')"
  >
    Attendance corrections
  </button>
  <button
    type="button"
    role="tab"
    id="my-requests-tab-work-area"
    class="my-requests-tab"
    [class.my-requests-tab--active]="selectedRequestTab() === 'work-area'"
    [attr.aria-selected]="selectedRequestTab() === 'work-area'"
    aria-controls="my-requests-panel-work-area"
    tabindex="0"
    (click)="selectRequestTab('work-area')"
  >
    Work-area changes
  </button>
</div>

@if (selectedRequestTab() === 'corrections') {
  <div id="my-requests-panel-corrections" role="tabpanel" aria-labelledby="my-requests-tab-corrections" tabindex="0">
    @if (store.myCorrectionsLoading?.()) { <p class="access-note">Loading…</p> }
    @if (store.myCorrectionsError?.()) {
      <div class="time-tracking-message time-tracking-message--error" role="alert"><p>{{ store.myCorrectionsError?.() }}</p><app-button type="button" variant="secondary" size="sm" (pressed)="store.loadMyCorrections?.()">Try again</app-button></div>
    } @else if ((store.myCorrections?.() ?? []).length === 0) {
      <p class="empty-copy">You have not submitted any attendance correction requests.</p>
    } @else {
      <div class="table-scroll">
        <table class="attendance-table corrections-table">
          <thead><tr><th scope="col">Date</th><th scope="col">Change</th><th scope="col">Status</th><th scope="col">Reason</th><th scope="col">Review</th><th scope="col">Actions</th></tr></thead>
          <tbody>
            @for (request of (store.myCorrections?.() ?? []); track request.id) {
              <tr>
                <td>{{ formatDate(request.workDate) }}<span class="table-secondary">Requested</span></td>
                <td><span class="table-primary">{{ correctionTypeLabel(request.correctionType) }}</span><span class="table-secondary">{{ correctionSummary(request) }}</span></td>
                <td><span class="status-pill status-pill--compact">{{ correctionStatusLabel(request.status) }}</span></td>
                <td>{{ request.reason }}</td>
                <td><span class="table-secondary">{{ request.reviewComment || (request.reviewedAt ? 'Reviewed ' + formatDateTime(request.reviewedAt, request.timezone) : 'Not reviewed') }}</span></td>
                <td>
                  @if (request.status === 'pending') { <button type="button" class="table-action table-action--danger" [disabled]="correctionActionIsLoading('cancel')" (click)="cancelCorrection(request.id)">Cancel request</button> }
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>
      @if (store.myCorrectionsTotalCount() > store.myCorrectionsPageSize()) {
        <div class="tt-pagination">
          <span class="tt-pagination-info">
            Page {{ store.myCorrectionsPage() }} of {{ Math.ceil(store.myCorrectionsTotalCount() / store.myCorrectionsPageSize()) }}
          </span>
          <div class="tt-pagination-buttons">
            <app-button type="button" variant="secondary" [disabled]="store.myCorrectionsPage() <= 1" (pressed)="goToCorrectionsPage(store.myCorrectionsPage() - 1)">Previous</app-button>
            <app-button type="button" variant="secondary" [disabled]="store.myCorrectionsPage() * store.myCorrectionsPageSize() >= store.myCorrectionsTotalCount()" (pressed)="goToCorrectionsPage(store.myCorrectionsPage() + 1)">Next</app-button>
          </div>
        </div>
      }
    }
  </div>
} @else {
  <div id="my-requests-panel-work-area" role="tabpanel" aria-labelledby="my-requests-tab-work-area" tabindex="0">
    @if (store.myWorkAreaRequestsLoading()) { <p class="access-note">Loading…</p> }
    @if (store.myWorkAreaRequestsError()) {
      <div class="time-tracking-message time-tracking-message--error" role="alert"><p>{{ store.myWorkAreaRequestsError() }}</p><app-button type="button" variant="secondary" size="sm" (pressed)="store.loadMyWorkAreaRequests()">Try again</app-button></div>
    } @else if (store.myWorkAreaRequests().length === 0) {
      <p class="empty-copy">You have not submitted any work-area change requests.</p>
    } @else {
      <div class="table-scroll">
        <table class="attendance-table work-area-requests-table">
          <thead><tr><th scope="col">Date</th><th scope="col">Change</th><th scope="col">Status</th><th scope="col">Reason</th><th scope="col">Sent to</th><th scope="col">Requested</th><th scope="col">Review</th><th scope="col">Actions</th></tr></thead>
          <tbody>
            @for (request of store.myWorkAreaRequests(); track request.id) {
              <tr>
                <td>{{ formatWorkAreaDate(request.date, request.timezone) }}</td>
                <td><span class="table-primary">{{ workAreaLabel(request.currentExpectedWorkArea) }} → {{ workAreaLabel(request.requestedWorkArea) }}</span></td>
                <td><span class="status-pill status-pill--compact">{{ workAreaChangeStatusLabel(request.status) }}</span></td>
                <td>{{ request.reason }}</td>
                <td>{{ request.receiver?.displayName || '—' }}@if (request.receiver?.positionName) { <span class="table-secondary">{{ request.receiver?.positionName }}</span> }</td>
                <td>{{ formatDateTime(request.requestedAt, request.timezone) }}</td>
                <td><span class="table-secondary">@if (request.reviewerDisplayName) { {{ request.reviewerDisplayName }} } @if (request.reviewedAt) { · {{ formatDateTime(request.reviewedAt, request.timezone) }} } @if (request.reviewComment) { <span class="table-note">{{ request.reviewComment }}</span> } @if (!request.reviewerDisplayName && !request.reviewedAt && !request.reviewComment) { Not reviewed }</span></td>
                <td>@if (request.status === 'pending') { <button type="button" class="table-action table-action--danger" [disabled]="store.workAreaActionLoading()" (click)="requestCancelWorkArea(request.id)">Cancel request</button> }</td>
              </tr>
            }
          </tbody>
        </table>
      </div>
      @if (store.myWorkAreaRequestsTotalCount() > store.myWorkAreaRequestsPageSize()) {
        <div class="tt-pagination"><span class="tt-pagination-info">Page {{ store.myWorkAreaRequestsPage() }} of {{ Math.ceil(store.myWorkAreaRequestsTotalCount() / store.myWorkAreaRequestsPageSize()) }}</span><div class="tt-pagination-buttons"><app-button type="button" variant="secondary" [disabled]="(store.myWorkAreaRequestsPage()) <= 1 || !!store.myWorkAreaRequestsLoading()" (pressed)="goToWorkAreaRequestsPage((store.myWorkAreaRequestsPage()) - 1)">Previous</app-button><app-button type="button" variant="secondary" [disabled]="(store.myWorkAreaRequestsPage()) * store.myWorkAreaRequestsPageSize() >= store.myWorkAreaRequestsTotalCount() || !!store.myWorkAreaRequestsLoading()" (pressed)="goToWorkAreaRequestsPage((store.myWorkAreaRequestsPage()) + 1)">Next</app-button></div></div>
      }
    }
  </div>
}

@if (workAreaCancelRequestId(); as requestId) {
  <app-modal [open]="true" title="Cancel work-area request?" size="md" [closeOnBackdropClick]="false" (closed)="closeCancelWorkArea()">
    <div class="confirmation-panel"><p>This pending request will be cancelled and can no longer be approved.</p><div class="modal-actions"><app-button type="button" variant="secondary" [disabled]="store.workAreaActionLoading()" (pressed)="closeCancelWorkArea()">Keep request</app-button><app-button type="button" variant="danger" [loading]="workAreaActionIsLoading(requestId)" [disabled]="store.workAreaActionLoading()" (pressed)="confirmCancelWorkArea()">Cancel request</app-button></div></div>
  </app-modal>
}
```

This markup uses classes from two different sources, and each needs a different fix:

1. Classes scoped to `time-tracking.component.css` specifically (component-level, won't reach this new sibling component): `.section-heading`, `.my-requests-tablist`, `.my-requests-tab`/`.my-requests-tab--active`, `.table-scroll`, `.attendance-table` (and its `th`/`td`/`tbody tr:last-child` rules), `.table-primary`/`.table-secondary`, `.tt-pagination`/`.tt-pagination-info`/`.tt-pagination-buttons`, `.time-tracking-message`/`.time-tracking-message--error`, `.empty-copy`, `.access-note`. Grep `time-tracking.component.css` for each of these class names, copy their exact current rule bodies verbatim into a new `my-requests-panel.component.css` (compact single-line style, matching Task 5's file), and add `styleUrl: './my-requests-panel.component.css'` to the `@Component` decorator.
2. `.status-pill`/`.status-pill--compact`, `.confirmation-panel`, `.modal-actions` do **not** appear in the `time-tracking.component.css` content already quoted elsewhere in this plan — before assuming they belong in the new component's own stylesheet, grep the whole frontend repo for each of these three class names (e.g. `rg "\.status-pill" src/app/modules/attendance` and the same for `.confirmation-panel`/`.modal-actions`). If they're defined in a global stylesheet (`src/styles.css` or similar), they apply everywhere unscoped and need no action here. If they're defined locally in some other component's `.css` file, copy their rule bodies into `my-requests-panel.component.css` the same way as group 1. Do not guess their rule bodies — verify before copying.

Do this as part of Step 4, not a separate step — the component and its styles land together.

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run src/app/modules/attendance/feature/time-tracking/my-requests-panel/my-requests-panel.component.spec.ts`
Expected: PASS.

- [ ] **Step 6: Remove the extracted markup and members from `time-tracking.component`**

In `time-tracking.component.html`, replace the "My requests" section's entire inner content (everything from `<div class="section-heading">` through the tab panels, inside the `<section class="history-card" aria-labelledby="my-requests-heading">` added/kept in Task 6) with a single line:

```html
        <app-my-requests-panel />
```

Delete the cancel-work-area confirmation modal block entirely from `time-tracking.component.html` (it moved into the new component):

```html
    @if (workAreaCancelRequestId(); as requestId) {
      <app-modal [open]="true" title="Cancel work-area request?" size="md" [closeOnBackdropClick]="false" (closed)="closeCancelWorkArea()">
        <div class="confirmation-panel"><p>This pending request will be cancelled and can no longer be approved.</p><div class="modal-actions"><app-button type="button" variant="secondary" [disabled]="store.workAreaActionLoading()" (pressed)="closeCancelWorkArea()">Keep request</app-button><app-button type="button" variant="danger" [loading]="workAreaActionIsLoading(requestId)" [disabled]="store.workAreaActionLoading()" (pressed)="confirmCancelWorkArea()">Cancel request</app-button></div></div>
      </app-modal>
    }
```

In `time-tracking.component.ts`:

Add the import and register it:

```ts
import { AttendanceHistoryListComponent } from './attendance-history-list/attendance-history-list.component';
```

becomes:

```ts
import { AttendanceHistoryListComponent } from './attendance-history-list/attendance-history-list.component';
import { MyRequestsPanelComponent } from './my-requests-panel/my-requests-panel.component';
```

```ts
  imports: [AttendanceDetailDrawerComponent, AttendanceHistoryListComponent, BreadcrumbHeaderComponent, ButtonComponent, CorrectionApprovalsComponent, DateRangePickerComponent, FormsModule, ModalComponent, WorkAreaApprovalsComponent],
```

becomes:

```ts
  imports: [AttendanceDetailDrawerComponent, AttendanceHistoryListComponent, BreadcrumbHeaderComponent, ButtonComponent, CorrectionApprovalsComponent, DateRangePickerComponent, FormsModule, ModalComponent, MyRequestsPanelComponent, WorkAreaApprovalsComponent],
```

Delete the type alias:

```ts
type PersonalRequestTab = 'corrections' | 'work-area';
```

Delete the field:

```ts
  readonly selectedRequestTab = signal<PersonalRequestTab>('corrections');
```

Delete the field:

```ts
  readonly workAreaCancelRequestId = signal<string | null>(null);
```

In `ngOnInit`, change:

```ts
  ngOnInit(): void {
    const range = this.currentWeekRange;
    this.historyFrom.set(range.from);
    this.historyTo.set(range.to);
    if (this.hasSelfServiceAccess() || this.hasCoveredAccess()) {
      void this.store.loadToday();
    }
    if (this.hasSelfServiceAccess()) {
      void this.store.loadMyHistory(range);
      this.ensureRequestTabLoaded(this.selectedRequestTab());
    }
  }
```

to:

```ts
  ngOnInit(): void {
    const range = this.currentWeekRange;
    this.historyFrom.set(range.from);
    this.historyTo.set(range.to);
    if (this.hasSelfServiceAccess() || this.hasCoveredAccess()) {
      void this.store.loadToday();
    }
    if (this.hasSelfServiceAccess()) {
      void this.store.loadMyHistory(range);
    }
  }
```

Delete these methods entirely (all moved to `MyRequestsPanelComponent`): `selectRequestTab`, `ensureRequestTabLoaded`, `goToCorrectionsPage`, `goToWorkAreaRequestsPage`, `correctionSummary`, `cancelCorrection`, `correctionActionIsLoading`, `requestCancelWorkArea`, `closeCancelWorkArea`, `confirmCancelWorkArea`, `workAreaActionIsLoading`.

Remove `correctionTypeLabel`, `correctionStatusLabel`, and `AttendanceCorrectionResponse` from the `attendance-correction.model` import (they're no longer referenced in this file — `correctionTypeOptions`/`CORRECTION_TYPE_OPTIONS` stays, the correction request-preview/submit flow keeps using `AttendanceCorrectionPreviewRequest`/`AttendanceCorrectionType`, which are untouched).

- [ ] **Step 7: Run the full attendance suite, then typecheck/build**

Run: `npx vitest run src/app/modules/attendance`
Expected: PASS.

Run: `npx ng build --configuration development`
Expected: 0 errors. Fix any remaining unused-import/unused-member errors surfaced by this task's removals — do not remove anything still used by the correction-request modal, the work-area-change-request creation modal, or the Team/Approvals sections, none of which this task touches.

- [ ] **Step 8: Commit**

```bash
git add src/app/modules/attendance/feature/time-tracking/my-requests-panel/ src/app/modules/attendance/feature/time-tracking/time-tracking.component.ts src/app/modules/attendance/feature/time-tracking/time-tracking.component.html
git commit -m "refactor: extract MyRequestsPanelComponent out of time-tracking.component"
```

- [ ] **Step 9: Final manual verification**

Repeat Task 6 Step 12's manual pass (My view, Team view, drawer, correction flow, narrow-viewport stacking) once more end-to-end, confirming nothing regressed from the extraction — specifically: both "My requests" tabs still load and paginate, cancelling a correction and cancelling a work-area request both still work (including the confirmation modal), and the "My requests" card still sits beside "My attendance history" exactly as it did after Task 6.
