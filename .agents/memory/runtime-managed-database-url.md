---
name: Runtime-managed DATABASE_URL
description: Replit behavior when the provisioned database connection variable appears to be deleted.
---

`DATABASE_URL` is runtime-managed in this project. A visible secret-change notification can say it was removed while the environment still reports the runtime-managed variable and the application continues to connect to the database.

**Why:** On September 1, 2026, the workflow started with `HAS_DATABASE_URL: true`, database inserts succeeded, and the secret inventory reported `DATABASE_URL: true` with `runtimeManaged: ["DATABASE_URL"]` after a removal notification.

**How to apply:** Do not request or manually set a replacement connection string. First inspect runtime-managed secret presence and app startup logs. Only investigate database provisioning if a restarted workflow explicitly reports `DATABASE_URL` missing or the database itself is unavailable.