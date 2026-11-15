# Task 21: UAT smoke tests

| | |
|---|---|
| Priority | 21 of 24 (lower number = build first) |
| Owner folder | person-1-security-and-deployment |
| Size | 1 person, 1 day |
| Area | Deployment, Quality |
| Depends on | 05 |

## What we found

Playwright is set up with two configs (`playwright.config.ts` and `playwright.live.config.ts`) and folders `e2e` and `e2e-live`. Nothing runs them automatically, and there is no agreed short list of journeys that must work before UAT testers are told a new build is ready.

## What to do

1. Pick 10 journeys that prove a deploy is healthy: sign in, dashboard loads with data, open a project and its task board, create and move a task, open the employee list and a profile, clock in and out, submit a leave request, approve it as a manager, open the inbox and send a message, sign out.
2. Write them as independent Playwright tests against a dedicated UAT test tenant with fixed test users. Test credentials come from CI secrets, never from the repository.
3. Each test cleans up what it creates or uses unique names, so runs do not collide.
4. Add assertions that catch the problems in this folder: no console errors, no failed network calls, no API call slower than an agreed limit on the journey.
5. Run the suite from the deploy step in task 05 after each UAT deploy and publish the report.
6. Write `docs/core/uat-smoke.md`: how to run locally against UAT, how to add a journey.

## Done when

- The 10 journeys pass against UAT three times in a row.
- A failed smoke run marks the deploy as failed and notifies the team.
- The report with screenshots is kept for each run.
