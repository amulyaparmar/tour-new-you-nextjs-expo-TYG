# AGENTS.md

Guidance for AI coding agents (Codex, Cursor, Claude Code, etc.) working in this
repository.

## Repository overview

Turborepo monorepo for the TYG tour/leasing platform:

- `apps/web` — Next.js app (App Router). Includes the voice-AI **roleplay trainer** (`apps/web/app/(app)/new/roleplay` + `apps/web/lib/roleplay`): leasing agents practice sales calls against a Vapi-powered AI prospect and get graded scorecards.
- `apps/*` (Expo) — mobile apps.
- `packages/` — shared code. `supabase/` — SQL migrations (Supabase). `workers/` — background workers.

## Skills

Reusable agent skills live in `.agents/skills/` (Agent Skills format, one directory per
skill with a `SKILL.md`). Invoke them by name, or apply them when the task matches
their description.

- **`roleplay-scenario-author`** (`.agents/skills/roleplay-scenario-author/SKILL.md`) — the authoring playbook for roleplay training scenarios. Use it for ANY request to create, revise, or review a roleplay scenario, prospect persona, rubric, checkpoint set, or waypoint set — including casual asks like "make me a scenario about budget objections" or "this scenario feels flat, fix it". It encodes the required scenario anatomy (two-topic rule, persona realism elements, graded traps, banded rubrics) and a mandatory self-review checklist; scenarios authored without it tend to be rejected.

(`.cursor/skills/` contains third-party skills installed via `npx skills`; manage those
with that CLI rather than editing them.)

## Roleplay scenario conventions (summary — the skill has the full rules)

- Scenarios are `RoleplayScenario` JSON per `apps/web/lib/roleplay/types.ts`.
- Every scenario: exactly two topics, property-general (no property/city names, no invented property facts), 3–4 waypoints, 5–7 checkpoints, five banded rubric categories (`c1` discovery, `c2` empathy, `c3`/`c4` the two topics, `c5` urgency & next steps).
- Seed scenarios that should reach every property go in `apps/web/lib/roleplay/seedScenarios.ts`; one-property scenarios go through the ScenarioEditor / `POST /api/roleplay/scenarios`.
