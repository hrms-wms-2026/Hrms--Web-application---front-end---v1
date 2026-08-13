# Position Management Coverage — Frontend Level Exclusivity Report

## 1. Overview & Problem Addressed

While the backend authoritatively validates management coverage level exclusivity (rejecting duplicate active coverage for a given tenant, legal entity, target, and `ownerOrder` with a 409 conflict error), the frontend previously allowed users to select responsibility levels that were already occupied for the chosen target.

This frontend enhancement introduces target-specific level exclusivity pre-filtering in the Management Coverage modal:
- Occupied responsibility levels for the selected target are marked as disabled (`disabled: true`) in the responsibility level dropdown.
- Dynamic N-level backup support is enabled without hardcoding to Backup 1 / Backup 2.
- Friendly helper text is displayed below the level selection when a target has occupied levels.
- Client-side submit validation prevents emitting requests for occupied levels.
- Backend 409 conflict errors (e.g. from concurrent edits by another user) trigger an automatic background re-fetch of coverage records to synchronize modal state, while displaying a sanitized user-friendly error message.

## 2. Frontend Disabling Rule

Responsibility level options are computed target-specifically based on the selected target type (`Position` or `Department`) and target ID:

- **Target Scoping**: `usedOrdersForTarget(type, positionId, departmentId, excludeRecordId)` filters `coverageRecords` for active records (`status === 'active'`) matching the exact target type and target ID.
- **Record Exclusion**: Both automatic (`isLocked: true`, `source: 'ReportingStructure'`) and manual (`source: 'Manual'`) active coverage records are included in the occupied list.
- **Self-Record Exemption**: When editing an existing manual coverage record, `excludeRecordId` excludes the record being edited so its current level remains selectable for itself while other occupied levels for that target are disabled.
- **Cross-Target Isolation**: Occupied levels for target position A do not disable levels for target position B or department C.

## 3. Handling Automatic + Manual Records

- Automatic coverage records generated from position reporting lines (`isLocked: true`, `source: 'ReportingStructure'`) are read-only and rendered under the "Automatic reporting coverage" section.
- Manual coverage records (`source: 'Manual'`) are rendered under the "Manual coverage" section.
- Both automatic and manual active records contribute to `usedOrdersForTarget`. If an automatic record claims `ownerOrder = 1` (Primary Manager) for a position, Primary Manager is disabled in the dropdown whenever that position is selected as a covered target.

## 4. Backup N Behavior

The responsibility level dropdown dynamically calculates option range:

```ts
const highestUsed = usedOrders.length > 0 ? Math.max(...usedOrders) : 0;
const maxOrder = Math.max(1 + minimumBackupLevels, highestUsed + 1);
```

Where `minimumBackupLevels = 3`:
- **Default Choices**: Orders 1 through 4 are always generated:
  - `Order 1` = Primary Manager
  - `Order 2` = Backup Manager 1
  - `Order 3` = Backup Manager 2
  - `Order 4` = Backup Manager 3
- **Dynamic Extension**: If higher backup levels exist (e.g., `ownerOrder = 6` / Backup Manager 5), options run through `Order 7` (Backup Manager 6) so the next available level is always reachable.
- **Level Mapping**: Order 1 is formatted as `"Primary Manager"`, and Order N (N > 1) is formatted as `"Backup Manager ${N - 1}"`.

## 5. Friendly Messaging & Stale Data Refresh

- **Helper Hints**: When a target has occupied levels, helper text hints are displayed below the Responsibility Level field:
  - `"This target already has a Primary Manager."`
  - `"This target already has Backup Manager {n}."`
- **Client-Side Guard**: `onAddSubmit()` and `saveEdit(record)` check if the selected order is occupied for the target and block submission client-side.
- **Concurrent 409 Handling**: If a 409 conflict occurs on `addCoverage` or `updateCoverage` (e.g., another user claimed the slot concurrently), the `PositionStore` re-fetches `api.listCoverage(legalEntityId, positionId)` to refresh the modal records, while displaying the sanitized server message.

## 6. Tests Run & Verification Results

### Unit Tests
Ran Karma unit test suite for the Organization module:
`npx ng test --no-watch --include src/app/modules/organization/**/*.spec.ts`

- **Result**: **229 passed**, 0 failed (20 test files).
- **Test Scenarios Covered**:
  - Automatic Primary Manager causes Primary Manager option to be marked `disabled: true`.
  - Manual Backup 1 causes Backup 1 option to be marked `disabled: true`.
  - Backup 2 remains enabled (`disabled: false`) when only Backup 1 exists.
  - When `usedOrders` contains order 6 (Backup 5), dropdown includes Backup Manager 5 (order 6) as disabled and Backup Manager 6 (order 7) as enabled.
  - Disabling is target-specific and does not leak across targets.
  - Editing own rule keeps its own current level enabled.
  - Submitting an occupied level is blocked client-side.
  - Friendly helper hints are generated and rendered.
  - Stale 409 backend response surfaces friendly error and refreshes coverage records from API.
  - Self-coverage guard and add/edit/delete flows continue to work.

### Production Build
`npm run build`
- **Result**: **Build succeeded** in 5.8s, zero compilation errors.

### Git Diff Check
`git diff --check`
- **Result**: **Clean**, zero whitespace errors.

## 7. Remaining Risks

- **Backend Race Window**: Between opening the modal and submitting a rule, another user could add coverage for the same level/target. This is fully mitigated: the backend remains authoritative (returning 409 conflict), and the store's updated error path re-fetches coverage records to synchronize the UI.
- **Pre-existing Uncommitted Changes**: Other modules and components in the repository contain pre-existing uncommitted changes from prior tasks, which were left untouched in accordance with task instructions.
