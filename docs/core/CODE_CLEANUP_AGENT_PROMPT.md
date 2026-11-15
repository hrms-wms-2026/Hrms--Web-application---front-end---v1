# Code cleanup: prompts for an AI agent

Copy-paste prompts for Claude Code, Codex or any other coding agent. They follow
[`CODE_CLEANUP_GUIDE.md`](CODE_CLEANUP_GUIDE.md), which the agent reads first.

How to use them:

1. Pull both repos and run `npm install` in the frontend.
2. Fill in the `<...>` placeholders. `<MODULE>` is the module **you** own, for example `Leave` or `Calendar`.
3. Give the agent **Prompt 1**. Read its report and pick the batches you want.
4. Give it **Prompt 2** once per approved batch.

---

## Prompt 1: set up the tools and scan (Mode A, no code changes)

```text
You are cleaning up dead, unused and duplicate code in the HRMS repos. Work only in report mode for now.

Repos (cloned next to each other):
- Frontend: <PATH>\Hrms--Web-application---front-end---v1
- Backend:  <PATH>\HRMS-Backend-v1
Scan: <frontend | backend | both>
My module (the only one I may clean): <MODULE>

Step 1. Read the rules, all of them, before running anything:
- Frontend docs/core/CODE_CLEANUP_GUIDE.md (the whole file; it is the process)
- Frontend CLAUDE.md (zero warnings, a11y, security rules)
- Backend CLAUDE.md or AGENTS.md if it exists

Step 2. Check the environment. Run `node -v` (needs 20.19+ or 22.12+) and `dotnet --version` (needs 10).
If one is missing or too old, stop and tell me; do not install SDKs yourself.
Check that the frontend has node_modules. If not, run `npm install` there.

Step 3. Set up the tools (guide section 2.2).
Create the folder <PATH>\cleanup-tools next to the repos, with a reports\ subfolder, and write the three
files exactly as the guide shows: knip.frontend.json, roslyn-cleanup.globalconfig, roslyn-cleanup.targets.
Do not add anything to either repo: no package.json, .editorconfig, CI or config change.

Step 4. Run the Mode A scans from guide section 3, in PowerShell, for the repos above.
- Use the exact pinned versions (knip@6.43.0, jscpd@5.4.2).
- Roslyn: if the result is 0 findings, the config did not load (see the guide's Gotcha). Fix that; do not report 0 as clean.
- Roslyn build error mentioning path1 / NuGet.targets: run `dotnet build-server shutdown` and retry once.
- Do not kill any running API or dotnet process.
Compare the totals with the baseline table in section 3.5 and mention big differences.

Step 5. Filter to my module, <MODULE>. List findings in other modules only as counts per module, so I
can tell their owners. Do not verify or fix those.

Step 6. Verify every finding in my module by reading the code (guide section 4.1). Grep each name
everywhere, including strings, templates, specs, DI registration, reflection, routes and the widget
registry. Label each one CONFIRMED, SUSPECTED or KEEP with a one-line reason.
Anything in auth, tokens, tenant isolation / RLS, permissions or validation is never CONFIRMED.
Migrations are never touched.
For duplicates, propose a merge only when the copies must change together.

Step 7. Report, then stop:
- the tool totals (and how they compare with the baseline)
- one table per repo: item | file:line | label | reason | suggested action
- unused usings grouped as one line per project
- the CONFIRMED items grouped into small batches, one theme each (for example "unused DTOs"), named Batch A, B, C...

Do not edit, delete, format, stage or commit any file in either repo in this step.
```

---

## Prompt 2: clean up one approved batch (Mode B)

```text
Do Mode B (guide section 5) for Batch <LETTER> from your report, and nothing else.
Repo: <frontend | backend>. Branch: stay on the current branch; do not create, switch or reset branches.

Rules:
- Change only the items in that batch. No unrelated refactoring, renaming or reformatting of other code.
- If an item turns out to be used after all, leave it and tell me why.
- Never suppress a lint rule, analyzer, test or warning, never raise build budgets, never touch migrations.

Verify (guide section 5 step 3):
- Frontend: `npm run check:warnings` (zero warnings), `npm run lint` (0 errors, 0 warnings) and the specs
  of the touched area. If a spec or lint error was already failing before your change, show that it
  fails the same way on the unchanged code; do not "fix" it by deleting the test.
- Backend: `dotnet build`, then the unit and architecture tests for the area, then the full unit +
  architecture suite once. Use `--artifacts-path <backend repo>\artifacts\<your-name>` (inside the repo).
- Re-run the scan from guide section 3: the count must drop and nothing new may appear.

Then show me `git diff --stat`, a short list of what was removed and the test results.
Do not commit or push. I will review the diff first. If I say commit: stage only the files you changed
(`git add <file> ...`, never `git add -A`) and use a message like `chore(<module>): remove unused <thing>`.
```

---

## Tips

- One batch per prompt. Small batches are easy to review and easy to revert.
- Agents tend to delete too much. Check that every CONFIRMED item has a real reason, not just "Knip said so".
- If the agent wants to change another module, say no and send the finding to that module's owner.
