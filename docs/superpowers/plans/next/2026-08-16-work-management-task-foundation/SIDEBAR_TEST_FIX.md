Quick fix (unrelated to Task Foundation, found during the QA sweep) — not a feature gap:

`src/app/layouts/main-layout/side-navbar/side-navbar.component.spec.ts`, the test
`'renders all 8 sidebar items in canonical order for a tenant owner with every Phase 1 module and org/roles permissions'`
calls `setup(['org:read', 'roles:manage'], [...])` — missing `'projects:access'` in the
permissions array. `nav-items.config.ts`'s `work` item requires `requiredPermissions:
['projects:access']` (correct, matches every Work Management controller's own permission gate) —
the Work nav item's config and the gating logic (`nav-access.ts`, ANY-of-modules AND
required-permissions) are both correct and untouched by today's work. This is a one-line test
fixture fix:

```typescript
const fixture = setup(
  ['org:read', 'roles:manage', 'projects:access'],
  ['worksync_foundation', 'core_hr', 'calendar', 'leave', 'time_attendance', 'org_structure']
);
```

Run `npx ng test --watch=false`, confirm the previously-failing test now passes and nothing else
regresses, commit as `fix(nav): grant projects:access in the "tenant owner sees everything"
side-navbar test fixture`. This is a 5-minute fix, unrelated to Work Management's own commit
history — safe to do in either repo session.
