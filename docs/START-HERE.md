# Personal Finance OS: start here

Design approved by David on 2026-11-21. Nothing is built yet. Build in Claude Code on the branch that already has the Vercel skills.

## Files and where they go (in the project repo)

- `docs/superpowers/specs/2026-11-20-personal-finance-os-design.md` (the approved design)
- `docs/superpowers/plans/2026-11-21-personal-finance-os.md` (the build plan, 23 tasks plus 9A)
- `personal-finance-app-backlog.md` at the repo root (deferred and parked decisions; keep it updated)

Task 1 of the plan creates the Next.js app. If the repo already exists, create the app at its root rather than in a `personal-finance-os/` subfolder and adjust the paths in Task 1.

## Before starting

1. Enable the Supabase and Design plugins in Claude Code (the plan's "Skills to load" section names the skills).
2. Confirm both Vercel skills are listed (`vercel-react-best-practices`, `web-design-guidelines`). `next-best-practices` is not needed: Next.js 16.3+ generates it, and Task 1 checks the version.
3. Have `npx supabase`, Node and a Google OAuth client ready (needed from Task 10).
4. Make sure Mobbin is connected (the plan requires a phone and a desktop reference search before every screen).

## Prompt to paste into Claude Code

> Read `docs/START-HERE.md`, the design doc and the plan. Then use superpowers:subagent-driven-development to implement the plan task by task, in order, starting with Task 1. Follow each task's "Skills to load" and the Mobbin rule in Global Constraints. Do not skip the failing-test steps. Stop and ask me if the design and the plan disagree, or if a "My call" default needs changing.

(Use `superpowers:executing-plans` instead if you prefer one session to do everything, then one review at the end.)
