# ONEXSO Local Dev — Port Assignments

Canonical copy lives in `HRMS-Backend-v1/PORTS.md` — keep this in sync with it.

| App                | URL                                    | Repo                                      |
|--------------------|-----------------------------------------|--------------------------------------------|
| Backend API        | `https://localhost:7229`                | `HRMS-Backend-v1`                           |
| Tenant App         | `https://{tenant}.localhost:4200`       | `front end-org/Hrms--Web-application---front-end---v1` (this repo) |
| Platform Admin     | `https://admin.localhost:4300`          | `platform-administration`                   |

This app stays on **4200** (unchanged). Don't run it or `platform-administration` on each
other's port — only one dev server can bind a given port at a time, and the "wrong app answers
on this port" failure mode shows up as a browser certificate error
(`NET::ERR_CERT_COMMON_NAME_INVALID`), not an obvious "port in use" message.
