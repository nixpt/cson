# `.jagent/` — repo-local agent working surface

The per-repo analog of `/workspace/.squad/`. Design:
`workspace-meta/plans/2026-09-18-jagent-sessions-and-bridge-folding.md`.

## Committed
`PROJECT.md` · `PROTOCOL.md` · `TODO.md` · `planning/` · `agents/` · `skills/`

## Local (gitignored)
`sessions/` · `local/` · `sync/` · `worktrees/` · `tmp/` · `knowledge/` · runtime DBs

## Boundary
`.dejavue/` = durable *why*/how (tool-owned, travels) · `.jagent/planning/` = the *sequence* ·
`.jagent/sessions/` = what happened *here* (local) · `.squad/` = fleet-wide.

Rule: still true in a year → `.dejavue/`; "last Tuesday" → `.jagent/sessions/`;
"this clone's scratch" → `.jagent/local/`.
