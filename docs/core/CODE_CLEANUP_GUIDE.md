# Code cleanup guide (frontend + backend)

How to set up the cleanup tools on your own machine and use them to find and safely remove dead,
unused and duplicated code in the HRMS repos. The same steps work by hand, with Claude Code or with Codex.

- **Repos:** this frontend (`Hrms--Web-application---front-end---v1`) and the backend (`HRMS-Backend-v1`).
- **Set up:** 2026-11-13. Tool versions below are pinned and tested on Windows 11, Node 24, .NET SDK 10.

---

## 1. What we use, and why only these

| Tool | Repo | Finds | How it runs |
|---|---|---|---|
| **Knip 6.43.0** | frontend | unused files, exports, types, npm dependencies | `npx`, no install in the repo |
| **jscpd 5.4.2** | both | copy-pasted blocks (TS / CSS / HTML, or C#) | `npx`, no install in the repo |
| **Roslyn analyzers** | backend | unused usings, private members, parameters, assignments, unreachable code | built into the .NET SDK |

These run next to what the repos already have, so do not set them up again:

- **ESLint** (`npm run lint`, 0 errors and 0 warnings) and **zero-warnings build** (`npm run check:warnings`). See [`../../CLAUDE.md`](../../CLAUDE.md).
- **Security scanners** (Semgrep, gitleaks, Trivy, osv-scanner, npm audit, DevSkim). These are a separate
  security gate, not part of cleanup.

What we decided **not** to add:

- **SonarQube.** It needs a server (Java + database + Docker) or a paid cloud plan for private repos.
  Knip + jscpd + Roslyn + ESLint cover the same ground for a team our size.
- **Semgrep / Knip MCP servers.** The CLI does the same job, so an MCP server only adds one more thing to maintain.

**Nothing is added to the repos.** No `package.json` change, no `.editorconfig` change, no CI change. The configs
below live in a folder **outside** the repos, so the tools never affect a teammate's build.

---

## 2. One-time setup

### 2.1 Prerequisites

- Node 20.19+ or 22.12+ (`node -v`).
- .NET SDK 10 (`dotnet --version`).
- Both repos cloned next to each other. For example:

```
C:\work\
  Hrms--Web-application---front-end---v1\
  HRMS-Backend-v1\
  cleanup-tools\          <- you create this (step 2.2)
```

- Frontend `npm install` done. Knip reads the repo's own `node_modules` and `tsconfig`.

### 2.2 Create the config folder

Create `cleanup-tools\` next to the repos and add the three files below. The commands in this guide assume
that layout. Change the paths if yours differs.

**`cleanup-tools\knip.frontend.json`**: tells Knip about entry points it can't find by itself. Without it you get
about 350 false findings instead of about 40.

```json
{
  "$schema": "https://unpkg.com/knip@6/schema.json",
  "entry": [
    "scripts/**/*.{js,mjs}",
    "playwright*.config.ts",
    "e2e*/**/*.ts"
  ],
  "ignoreExportsUsedInFile": true,
  "ignoreDependencies": [
    "@angular-eslint/builder"
  ]
}
```

**`cleanup-tools\roslyn-cleanup.globalconfig`**: the dead-code rules. They are report-only, so they never fail a build.

```ini
is_global = true

# Unused usings (needs GenerateDocumentationFile, which the build command turns on)
dotnet_diagnostic.IDE0005.severity = warning
# Unused private members / private members that are written but never read
dotnet_diagnostic.IDE0051.severity = warning
dotnet_diagnostic.IDE0052.severity = warning
# Unused parameters, non-public methods only (public contracts and handlers are left alone)
dotnet_code_quality_unused_parameters = non_public
dotnet_diagnostic.IDE0060.severity = warning
# Value assigned but never used
dotnet_diagnostic.IDE0059.severity = warning
# Unreachable code
dotnet_diagnostic.IDE0035.severity = warning
# Unused private fields
dotnet_diagnostic.CA1823.severity = warning

# GenerateDocumentationFile is on only so IDE0005 runs: silence the missing-XML-doc noise it causes.
dotnet_diagnostic.CS1591.severity = none
dotnet_diagnostic.CS1573.severity = none
dotnet_diagnostic.CS1572.severity = none
dotnet_diagnostic.CS1574.severity = none
```

**`cleanup-tools\roslyn-cleanup.targets`**: plugs the rules into the build from the command line.

```xml
<Project>
  <!-- EditorConfigFiles, not GlobalAnalyzerConfigFiles: the SDK copies GlobalAnalyzerConfigFiles into
       EditorConfigFiles before this file is imported, so an item added there would never reach csc. -->
  <ItemGroup>
    <EditorConfigFiles Include="$(MSBuildThisFileDirectory)roslyn-cleanup.globalconfig" />
  </ItemGroup>
</Project>
```

> **Gotcha:** if you write `GlobalAnalyzerConfigFiles` instead of `EditorConfigFiles`, the build still succeeds but
> reports **0 findings**. That looks like a clean result, but the rules never ran. A clean backend today has
> about 270 findings, so 0 means the config did not load.

---

## 3. Run the scans (Mode A: analysis only)

Run every command in **PowerShell**. Results go to `cleanup-tools\reports\`. None of these commands edit source code.

### 3.1 Frontend: unused code (Knip)

From the frontend repo folder:

```powershell
npx --yes knip@6.43.0 --config ..\cleanup-tools\knip.frontend.json --no-progress --no-exit-code
```

It takes about 10 seconds and prints groups such as *Unused files*, *Unused exports*, *Unused types* and *Unused dependencies*.
For a file you can feed to an AI agent, add `--reporter json > ..\cleanup-tools\reports\knip.json`.

### 3.2 Frontend: duplicates (jscpd)

```powershell
npx --yes jscpd@5.4.2 src --format typescript,css,markup --ignore "**/node_modules/**,**/*.spec.ts,**/*.testing.ts" --min-tokens 70 --reporters json,html,silent --output ..\cleanup-tools\reports\jscpd-fe
```

It takes about 2 seconds. Open `jscpd-report.html` in a browser to see each clone side by side with both file:line ranges.
`jscpd-report.json` has the same data for scripts and AI agents. Use `--min-tokens 100` for fewer, bigger duplicates. Avoid the `console` reporter: it prints
every clone, hundreds of lines.

### 3.3 Backend: duplicates (jscpd)

From the backend repo folder:

```powershell
npx --yes jscpd@5.4.2 src --format csharp --ignore "**/bin/**,**/obj/**,**/Migrations/**" --min-tokens 70 --reporters json,html,silent --output ..\cleanup-tools\reports\jscpd-be
```

### 3.4 Backend: dead code (Roslyn)

From the backend repo folder:

```powershell
$cfg = (Resolve-Path ..\cleanup-tools).Path
dotnet build src\ONEVO.Api\ONEVO.Api.csproj -c CleanupScan --no-incremental -nologo -m `
  --artifacts-path "$PWD\artifacts\cleanup" `
  "-p:CustomAfterMicrosoftCommonTargets=$cfg\roslyn-cleanup.targets" `
  -p:GenerateDocumentationFile=true -p:EnforceCodeStyleInBuild=true -p:TreatWarningsAsErrors=false `
  "-flp:logfile=$cfg\reports\roslyn.log;warningsonly;verbosity=quiet" "-clp:ErrorsOnly;NoSummary"

# Readable list: one line per finding, Migrations left out, duplicates removed
Select-String -Path "$cfg\reports\roslyn.log" -Pattern 'warning (IDE0005|IDE0051|IDE0052|IDE0060|IDE0059|IDE0035|CA1823):' |
  ForEach-Object { $_.Line -replace ' \[.*$', '' -replace '\s\(https[^)]*\)', '' } |
  Where-Object { $_ -notmatch '\\Migrations\\' } | Sort-Object -Unique
```

- It takes 1-2 minutes. It builds `ONEVO.Api` and the Application, Domain and Infrastructure projects it references.
- `--artifacts-path artifacts\...` sends the output to the repo's gitignored `artifacts\` folder, in its own `CleanupScan`
  configuration. So it **does not** touch `bin\Debug`, and it works while your API is running. Keep it **inside** the
  repo: some backend tests look for the repo root and fail with "Repository root was not found" if the output sits elsewhere.
- Error mentioning `path1` / `NuGet.targets` = stale MSBuild server, not your code. Run `dotnet build-server shutdown` and try again.

### 3.5 Baseline (2026-11-13, for comparison)

| Check | Result |
|---|---|
| Knip (frontend) | about 40: 12 unused files, 2 dependencies, 11 exports, 15 types |
| jscpd frontend | 295 clones, 3,881 lines (2.1%) |
| jscpd backend | 649 clones, 7,346 lines (3.7%) |
| Roslyn backend | about 270: 251 unused usings, 9 unused parameters, 8 unused / never-read members |

---

## 4. Read the results: every finding is a suspect

A tool only sees static references. **Never delete because a tool said so.** Check each item in the code and give it one label:

| Label | Meaning | What to do |
|---|---|---|
| **CONFIRMED** | No use anywhere, including the hidden uses below | Safe to remove |
| **SUSPECTED** | Probably unused, but something could reach it at runtime | Ask the owner first |
| **KEEP** | Used in a way the tool can't see, or a deliberate defensive check | Leave it |

### 4.1 Before calling something CONFIRMED

First grep for the name everywhere, including strings, templates and specs (`git grep -n "<Name>"`). Then check the uses static tools miss.

**Frontend**

- `src/app/modules/dashboard/widgets/widget-registry.ts`: widgets load through dynamic `import()`.
- Routes: `loadComponent` / `loadChildren`.
- Components used only by selector in a template (`<app-...>`), and pipes and directives used only in templates.
- `angular.json` assets, styles and scripts. An npm package used only there looks "unused" to Knip.
- `@defer` blocks, `*.spec.ts` and `*.testing.ts` helpers.
- Re-export "shim" files. Another module may import the shim and not the real file.

**Backend**

- DI registrations (`AddScoped` / `AddTransient` / assembly scanning). A class can look unused and still be resolved at runtime.
- MediatR handlers, validators and notification handlers. They are found by reflection, never called directly.
- EF `IEntityTypeConfiguration`, interceptors and value converters.
- Background jobs (`*Job`), hosted and startup services, seeders.
- Controller DTOs and anything in a public API contract. The frontend or an external client uses them.
- **Migrations: never touch.**

**Security: never CONFIRMED until you have read why it exists**

- Anything in auth, tokens, MFA, tenant isolation / RLS, `RequirePermission` or input validation is **KEEP or SUSPECTED**
  until you know why it is there.
- Frontend and backend validation that look duplicated guard different layers. **Keep both.**

**Duplicates**

- Merge copies only when they **must change together**. Similar-looking CSS in two unrelated components is not a reason to share it.
- Dashboard widgets copy the reference widget on purpose (see [`../design/WIDGET_CREATION_RULES.md`](../design/WIDGET_CREATION_RULES.md)).
  Most widget-to-widget duplication is expected.
- A shared piece goes to `src/app/shared/` and follows the frontend rules: `styleUrl`, the a11y rules, the monochrome palette.

### 4.2 Ownership

Only clean the modules you own. For a module someone else owns, **report the finding to them. Do not fix it.**
Their code may be mid-change, or the "dead" code may be about to be wired up.

---

## 5. Clean up (Mode B: safe cleanup)

Do this only after the items have been reviewed and approved (by you for your own module, by the owner otherwise).

1. **Small batches, one theme each.** For example "unused WM files", or "unused usings in WorkManagement". Never mix in
   unrelated refactoring.
2. **Make the change.**
   - Delete the file, export or member.
   - For unused usings, your IDE's "Remove unnecessary usings" works, or run
     `dotnet format analyzers --diagnostics IDE0005 --include <files>`. Limit it to your own files.
3. **Verify.**
   - **Frontend:** `npm run check:warnings` (zero warnings), `npm run lint` (0 / 0), and the specs of the area you touched.
   - **Backend:** `dotnet build`, then the unit + architecture tests for the area, then the full suite once. Use
     `--artifacts-path <repo>\artifacts\<your-name>` while the API is running.
   - Re-run the scan from section 3. The count should drop, and nothing new should appear.
4. **Review the diff.** Run `git diff --stat` and read every hunk.
5. **Commit only your own files.** `git add <file> ...`, never `git add -A`. Other people may have work in progress in the same folder.
   One commit per batch, with a message such as `chore(work): remove unused allocation-request DTOs`.

Never:

- Suppress a lint rule, analyzer, test or warning to get a green result.
- Raise build budgets.
- Push or open a PR as part of cleanup, unless that was agreed.

---

## 6. With an AI agent (Claude Code or Codex)

Full copy-paste prompts (tool setup, scan, report, then one batch at a time) are in
[`CODE_CLEANUP_AGENT_PROMPT.md`](CODE_CLEANUP_AGENT_PROMPT.md).

Give the agent this guide and keep it in **Mode A** first. A short prompt that works:

> Read `docs/core/CODE_CLEANUP_GUIDE.md`. Run the Mode A scans from section 3 for <frontend|backend>.
> Limit the results to <module>. Check every finding in the code using section 4.1 and label it CONFIRMED,
> SUSPECTED or KEEP, with the reason. Report one table per repo, in batches. Do not change any file.

Then approve batches one by one:

> Do Mode B (section 5) for batch A only. Verify with section 5 step 3, show `git diff --stat`, and do not commit.

Agents tend to trust the tool output and delete too much, so check that each CONFIRMED item has a written reason.
