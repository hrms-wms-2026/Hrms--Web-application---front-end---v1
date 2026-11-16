# Task 01: CI pipeline for the frontend

| | |
|---|---|
| Priority | 1 of 24 (lower number = build first) |
| Owner folder | person-1-security-and-deployment |
| Size | 1 person, 1 day |
| Area | Deployment |
| Depends on | nothing |

## What we found

The repository has no `.github` folder. Nothing builds, lints or tests a pull request. The quality rules exist only as local scripts (`npm run lint`, `npm run check:warnings`, `npm test`) and a git hook path set by `npm prepare`. A broken build can be merged and reach UAT.

## What to do

1. Add `.github/workflows/ci.yml` that runs on pull requests and pushes to `main`, `testing` and `Development`.
2. Steps: `npm ci`, `npm run check:warnings`, `npm run lint`, `npm test` (headless, single run), `ng build --configuration staging`.
3. Cache the npm folder keyed by `package-lock.json`.
4. Fail the job on a bundle budget error. Upload the build statistics as an artifact so size can be compared between runs.
5. Add a `CODEOWNERS` file like the backend has.
6. Pin GitHub Actions to commit hashes.
7. Agree the change with the repository owner first, because it affects every developer.

## Done when

- A pull request with a lint error or a failing test cannot be merged.
- A normal run finishes in under 10 minutes.
- The README says what CI checks and how to run the same checks locally.
