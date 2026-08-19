# Project Identifier Auto-suggest — Design

**Status:** Approved 2026-08-10 (brainstormed same day). No plan written yet.

## Problem

`ProjectFormModalComponent`'s Create form has a manual `identifier` text field (`docs/superpowers/specs/finished/2026-08-09/2026-08-08-work-management-projects-milestones-design.md` scoped it as plain user entry). Users have to invent a valid identifier by hand every time, even though the backend already derives most of what a reasonable identifier needs from the Name they just typed.

## Requirement

As the user types into the **Name** field (create mode only — Identifier doesn't exist in Edit mode; it's immutable after creation per `Edit Project.md`), auto-populate the Identifier field with a suggestion derived from Name.

## Algorithm

1. Take the first whitespace-delimited word of `name`.
2. Strip every character that isn't `[A-Za-z0-9]`, then uppercase the result.
3. If the stripped result is empty or doesn't start with a letter (e.g. name starts with a digit/symbol), fall back to the literal prefix `PRJ`.
4. Truncate the prefix to 12 characters (leaves room for the 8-digit suffix within the API's 20-char max).
5. Append an 8-digit random number, zero-padded (`Math.floor(Math.random() * 1e8)` padded to 8 digits with leading zeros).
6. Result always satisfies the existing `IDENTIFIER_PATTERN` (`^[A-Za-z][A-Za-z0-9]{0,19}$`) in `project-form.validator.ts` unchanged — no validator change needed.

Example: Name `"Website Revamp"` → prefix `WEBSITE` → Identifier `WEBSITE00483921`.

## Behavior

- **Live**: recomputes on every Name keystroke, same as the rest of the form's reactive signals.
- **Stops once the user manually edits Identifier themselves** — same pattern as GitHub repo slugs / Jira project keys. Track a local `identifierTouched` flag, set `true` on the Identifier field's own `(valueChange)`; the Name-driven auto-suggest effect only writes to `identifier()` while `identifierTouched()` is `false`.
- **Still fully editable** at any time — this is a prefill convenience, not a lock. Existing submit-time validation and the backend's `409` uniqueness check are unchanged; a random-number collision is handled the same way a hand-typed duplicate already is today (error shown, user edits and resubmits).
- Switching back to a blank Create form (the existing "Create opened right after Edit closed" reset branch) also resets `identifierTouched` to `false`, so the next Name entry starts auto-suggesting again.

## Out of scope

- No new backend endpoint or validation change — this is presentation-layer only, reusing the existing `Create Project` contract as-is.
- No client-side uniqueness pre-check against existing identifiers (would need a new list-all-identifiers endpoint; not requested, YAGNI).

## Testing

- Unit test on `ProjectFormModalComponent`: typing a Name auto-fills Identifier with the expected prefix + an 8-digit numeric suffix (assert format via regex, not exact digits, since it's random).
- Unit test: after manually editing Identifier, further Name changes do not overwrite it.
- Unit test: name starting with a non-letter (e.g. `"123 Launch"`) falls back to the `PRJ` prefix.
- Unit test: a long first word is truncated to 12 chars before the suffix is appended, keeping the whole identifier ≤ 20 chars.
