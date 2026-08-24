# Project & Milestone Card — Settings Popup Consolidation Design

**Status:** Approved 2026-08-10 (brainstormed same day). No plan written yet.

## Problem

`MilestoneCardComponent` and `ProjectCardComponent` each show separate Edit and Achieve/Unachieve buttons. User wants these consolidated into a single "Settings" entry point per card, opening a popup that combines the edit form with an Achieved toggle. This is the first of an expected series of additions to that popup over time — scope here is limited to folding in Edit + Achieve/Unachieve only.

## Card changes (both `MilestoneCardComponent` and `ProjectCardComponent`)

- Remove the separate Edit and Achieve/Unachieve buttons.
- Add a gear-icon-only button (⚙, `data-testid="settings-button"`) in the card's top-right corner, shown under the same ownership gate the Edit button used before (`milestone.isOwner` / `project.isLead`).
- View stays unchanged (own button, own behavior).

## Settings popup — shared shape, different save semantics

Rename `MilestoneFormModalComponent` → `MilestoneSettingsModalComponent`, `ProjectFormModalComponent`'s **Edit mode** → folded into a new `ProjectSettingsModalComponent` (Create mode stays as `ProjectFormModalComponent` — Create has no Achieved toggle, nothing to consolidate; renaming only applies to the edit-time UI, so this becomes two components: `ProjectFormModalComponent` keeps Create, `ProjectSettingsModalComponent` is Edit + Achieve combined. Milestones have no Create at all, so `MilestoneSettingsModalComponent` fully replaces `MilestoneFormModalComponent`.)

Both popups: same edit fields as before, plus a new **Achieved** toggle reflecting the entity's current `isAchieved`, plus one **Save changes** button.

### Milestone popup — save ordering matters

Backend fact: once an Objective is Achieved, `EditObjectiveCommandHandler` rejects further edits with `400` ("the milestone is achieved") — Achieve freezes it. So the toggle's transition direction decides call order:

- Toggle **turned off** (was achieved → not achieved): call `unachieveMilestone()` first (unfreezes), then `editMilestone()` with the field values.
- Toggle **turned on** (was not achieved → achieved): call `editMilestone()` first (still editable), then `achieveMilestone()` last (freezes it).
- Toggle **unchanged**: call `editMilestone()` only.
- Toggle **disabled** when `milestone.isDefault` is true, with a hint ("Achieve this project instead — Default Milestone follows the project's own achieved state") — `AchieveObjectiveCommandHandler`/`UnachieveObjectiveCommandHandler` both reject the Default Objective with `400`, so there's nothing valid to submit here for it.

### Project popup — no ordering constraint

Backend fact: `EditProjectCommandHandler` has no achieved-state check at all — editing an already-achieved Project is allowed. So order doesn't matter:

- Call `editProject()` with the field values.
- If the toggle changed, call `achieveProject()`/`unachieveProject()` — either before or after the edit call, doesn't matter functionally; do edit first for consistency with the Milestone popup's code shape.
- No `isDefault` equivalent — every Project card shown is a real Project, nothing to disable.

### Error handling (both)

Any step in the sequence failing stops it there, surfaces the error inline (reusing the existing `milestoneActionError`/project `error` state), and keeps the popup open — same convention as every other action in this module. `AchieveProject`'s own `400` ("a top-level milestone isn't yet Achieved") and `AchieveObjective`'s own `400` ("a direct sub-milestone isn't yet Achieved") surface exactly this way.

## Out of scope

- Any other feature the user plans to add to the Settings popup later — not designed here, comes as separate asks per the user's own framing ("more work in the settings popup, I'll tell you one at a time").
- No change to the underlying `EditObjective`/`EditProject`/`Achieve*`/`Unachieve*` API contracts — this is presentation-layer consolidation only.

## Testing

Standard TDD per component, matching existing conventions (Vitest + Angular TestBed) — card tests for the new Settings button replacing Edit/Achieve, popup tests for the Achieved toggle and the save-order sequencing (Milestone popup specifically needs a test asserting call order for both toggle directions).
