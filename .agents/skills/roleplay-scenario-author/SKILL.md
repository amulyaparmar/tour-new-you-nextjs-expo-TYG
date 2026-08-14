---
name: roleplay-scenario-author
description: Author, revise, or review roleplay training scenarios for the voice-AI leasing trainer (the RoleplayScenario JSON used by apps/web/lib/roleplay). Use this whenever the user wants to create a new practice scenario, write or improve a prospect persona, design rubrics/checkpoints/waypoints, generate a scenario about specific topics (budget, pets, parking, reviews, roommates...), make a scenario easier or harder, or add seed scenarios — even if they just say "make me a scenario" or "the scenarios feel flat".
---

# Roleplay Scenario Author

This skill is the source of truth for authoring roleplay training scenarios for the
voice-AI roleplay trainer (`apps/web/app/(app)/new/roleplay` + `apps/web/lib/roleplay`).
Follow it whenever you are asked to create, revise, or review a roleplay scenario.

**Reference files (in `references/`, same skill directory):**
- `references/topics.md` — the topic catalog, pairing guidance, and prospect archetypes. Read it when picking topics/archetypes. Append to it when you discover new admissible topics.
- `references/examples.md` — a fully worked exemplar scenario with annotations. Read it before authoring your first scenario in a session; imitate its density, not its content.

---

## 1. What a scenario is

A scenario fully describes one practice call: the AI plays a **new prospect** phoning an
apartment community for the first time; the human trainee plays the **leasing agent**.
The scenario is a single JSON object conforming to the `RoleplayScenario` type in
`apps/web/lib/roleplay/types.ts` — read that file before authoring; it is the contract.

Where scenario text actually goes at runtime (this is why each field's quality matters):

| Field | Consumed by |
|---|---|
| `personaPrompt` | The system prompt of the AI prospect (gemini-flash) during the live call |
| `firstMessage` | Spoken verbatim as the prospect's opening (or delivered via prompt for inbound-style calls) |
| `waypoints` | A private live coaching carousel the trainee sees; the SAME prospect model silently judges `completionCriteria` from the trainee's words and checks cards off mid-call |
| `checkpoints` + `rubric` | Compiled into a post-call grader prompt + JSON schema (`buildAssistantOverrides.ts`). Each rubric category's `description` is passed to the grader **verbatim** — it is the scoring instruction |
| `description` | The scenario card in the picker UI, and the grader's scenario summary |
| `difficulty` | Selects a difficulty-guidance paragraph in the live prompt (easy = cooperative, medium = realistic, hard = skeptical/objection-heavy) |

Runtime constraints you cannot exceed (enforced by sanitizers; excess is silently dropped):
- **Waypoints: 2–4 maximum.** Author 3–4. A 5th is discarded at save time.
- **Rubric: up to 5 categories** with keys `c1`–`c5`, each scored 0–20.
- **Suggested lines: 3 max per waypoint**, each under ~160 chars.
- Checkpoints have no hard cap; author 5–7.

## 2. The fixed frame

Every scenario is a **new-prospect sales call**. The trainee's job on every call, no
matter the topic, is: discover the prospect's needs, respond with empathy, and close
for a concrete next step (tour, application, or follow-up). That skeleton is fixed:

- **c1 = Discovery** and **c2 = Empathy/Acknowledgment** are always the first two rubric categories, with matching checkpoints.
- **c5 = Urgency & Next Steps** is always the last: ethical urgency (honest reasons deciding soon helps — never pressure tactics) plus an explicit ask for a next step, with matching checkpoints (`introduces-urgency-ethically`, `asks-for-next-step`).
- **c3 and c4 belong to the scenario's two topics** — one category per topic. This is where the scenario's identity lives.

## 3. Two topics, never three

Pick exactly two topics from `references/topics.md` (or accept the requester's). The
pair must read as **one coherent human's first call** — a prospect worried about rent
naturally asks about total value; a prospect with a snake naturally asks about deposits.
If the requester supplies a pairing that no single realistic caller would combine, say
so and propose an adjustment before writing.

Two topics is a ceiling, not a target to exceed: a third topic makes the call feel like
a checklist and makes every topic shallow ("too heavy"). Depth over coverage.

## 4. Property-general, always

Scenarios must work at ANY property — student housing or conventional multifamily,
any city. Concretely:

- **No property names, city names, campus names, or invented facts** (prices, unit counts, named amenities, policies) anywhere in the scenario.
- The prospect **wants and asks**; the prospect never **asserts what the property has**. Wrong: "I heard you have a rooftop gym." Right: "A gym I can actually use matters a lot to me — what do you have?"
- Amenity/feature topics are always written as **branch-tolerant demands** (section 6).
- The persona's own life facts (their budget feelings, their pet, their commute worry) are fine and encouraged — those travel with the prospect, not the property.

## 5. Persona realism — the primary quality bar

A flat persona produces a flat call. Every persona needs all five of these, in the
`personaPrompt`:

1. **An archetype** from `references/topics.md` — the personality texture (pace, fillers, directness) that makes this caller distinct from the last one. Two scenarios about the same topics with different archetypes are different scenarios.
2. **An emotional state with a cause.** Not "you are anxious" but "two places already turned your snake down, so you're anxious and a little guarded about asking." The cause gives the model something to roleplay and the trainee something to discover.
3. **Withheld information.** List 2–4 things the prospect knows but does not volunteer until asked (the real budget number, the roommate situation, the timeline). State it explicitly: "don't dump every concern at once — let the agent draw it out of you." This is what makes discovery gradeable.
4. **Conditional reactions.** IF/THEN beats: "If the agent acknowledges your worry, warm up a little. If they dodge the fee question twice, get noticeably more guarded." The prospect must respond to trainee quality, not run on rails.
5. **A numbered arc** (7–10 steps): the order the call unfolds — opening line, first topic surfacing, second topic surfacing, the trap moment (section 6), warming/withdrawing conditions, urgency response, next-step response, and "keep playing the prospect until the agent wraps up." The arc is a spine, not a script — mark it "at a natural pace."

The `firstMessage` must sound spoken, not written: hesitations, self-interruptions,
incomplete syntax ("Hi, um — so before anything else, I kind of need to know...").
Never front-load both topics into the opener; one surfaces later per the arc.

The runtime already appends voice-realism and style guidance (fillers, short turns,
never invent facts — see `apps/web/lib/roleplay/promptTemplate.ts`), so do not restate
those rules; write the persona's SPECIFIC humanity instead.

## 6. Traps — what makes a scenario challenging

Every scenario gets **1–2 trap moments**: points where the prospect tests the trainee's
judgment, not just their knowledge. A trap must grow out of the persona's actual
situation and the two topics — chosen AFTER the persona exists, never bolted on.

**Class A — fact-independent (conduct traps).** Fire identically at every property
because they test conduct, not inventory:
- Bait to badmouth a competitor ("The place across the street said you guys have hidden fees — is that true? What's wrong with them?")
- A request for an improper promise ("Can you just hold a unit for me without an application?", "Promise me my rent won't go up at renewal.")
- A demand for a guarantee no agent can give ("Guarantee me a quiet roommate.")
- Pressure to quote an unverified number ("Just ballpark the total move-in cost, I won't hold you to it.")

**Class B — fact-dependent (branch-tolerant demands).** The prospect demands something
the property may or may not have. Write the demand neutrally — the scenario never
presumes the answer — and grade the *response pattern on either branch*:

> Checkpoint: "The agent responds to the covered-parking demand honestly — either
> confirming it with concrete specifics, or transparently acknowledging it isn't
> offered and pivoting to a genuine alternative — without inventing or fudging facts."

This is deliberate double duty: at a property that has the thing, the trainee practices
value-selling it; at one that doesn't, they practice the honest "we don't have that"
recovery. Both branches are legitimate passes; inventing facts is the only failure.

**Traps are graded.** Every trap gets a checkpoint (usually linked to c3 or c4) and
appears in that category's rubric bands. An ungraded trap is a trap the trainee can
faceplant on and still pass. Usually the trap also gets the scenario's `objection`
waypoint so the trainee is coached through it live.

## 7. Difficulty — authored, not just selected

The `difficulty` enum changes one guidance paragraph at runtime. Real difficulty is
authored. When the requester picks a difficulty, propagate it:

| | easy | medium | hard |
|---|---|---|---|
| Withheld info | volunteers most things when asked once | needs real questions | needs specific, well-aimed questions; deflects vague ones |
| Traps | one, gentle (Class B demand, softly stated) | one or two, firm | two, sharp; one fires early; a good answer earns a SECOND objection before warming |
| Warming | warms fast | warms when earned | warms only after consistent quality; relapses if the agent coasts |
| Rubric bands | top band = solid execution | top band = specific + credible | top band demands both branches handled + trap navigated cleanly |

On request, author a **ladder**: the same persona/topics at 2–3 difficulties as separate
scenarios (suffix the name: "— Easy", "— Hard"), escalating per this table.

## 8. Waypoints (3–4)

Waypoints are live coaching cards, silently judged by the in-call model from the
trainee's words alone. Vague criteria are the #1 reason cards never check off. Rules
(inherited from the app's waypoint generator — they encode real failure lessons):

- **3–4 waypoints**, ordered along the call's natural arc (empathy/discovery early, value and next-step later). Include at least one `objection` and one `value` when the material supports them; the trap is usually the `objection`.
- `title`: ≤7 words, imperative, scenario-specific ("Lower the pet-policy anxiety" — never "Handle the objection").
- `cue`: one sentence naming the LIVE SIGNAL — what the prospect says that makes this the moment. Written for the trainee to recognize mid-call.
- `completionCriteria`: one sentence starting "The trainee", describing a SINGLE observable behavior judgeable from words alone. **Never fuse two behaviors with "and"/"while"** — pick the most important one ("or"-alternatives are fine). The most common fusion is the decline-and-redirect shape — "declines X and instead offers Y" — write the affirmative behavior and demote the refusal to a qualifier: "offers Y ... without X". No internal states ("builds trust"), no vague qualifiers ("appropriately"). A criteria you couldn't check off from a transcript is a broken criteria.
- `suggestedLines`: 2–3 lines the trainee could literally say, first person, under 25 words, natural spoken English. **Never invent facts** — when a fact is unknown, use verifying wording ("Let me confirm...", "Can I ask..."). For branch-tolerant traps, include one line per branch.
- `id`: kebab-case slug of the title.

## 9. Checkpoints (5–7)

Binary, hidden, graded post-call from the transcript. Composition:

- The four skeleton checkpoints: discovery questions (c1), empathy/acknowledgment (c2), ethical urgency (c5), asks for next step (c5).
- 1–3 topic checkpoints covering the two topics and the trap(s) (linked to c3/c4).

Each checkpoint: kebab-case `id`, short `name`, and a `description` that names the
observable behavior that counts as a hit — the grader executes this text. Every
checkpoint gets a `rubricKey`; a missed required checkpoint caps its linked category
at 12/20, so the link is what keeps binary and quality grades coherent. Mark
checkpoints `required: true` (the default) unless there is a deliberate reason not to —
required misses block passing regardless of score.

## 10. Rubric — banded descriptions (the specificity fix)

Five categories (`c1`–`c5`), each 0–20, per the section-2 allocation. Each category's
`description` is the grader's scoring instruction, so it must carry **explicit,
behavior-anchored score bands** — not a one-line summary. Template:

```
<one-line definition of the category for this scenario's topics.>
17–20: <the observable behaviors of a top performance, specific to this scenario>.
9–12: <partial execution — what "attempted but incomplete" looks like here>.
0–4: <whiffed — absent, counterproductive, or invented facts>.
```

Rules:
- Bands describe **observable trainee behavior** the grader can match against a transcript ("names two concrete alternatives" — never "shows good instincts").
- Bands are **scenario-specific**: write what 17–20 looks like for THIS topic and trap, not generic anchors (the grader already has generic anchors; duplicating them adds nothing).
- For branch-tolerant traps, the bands must score **both branches**: 17–20 covers "confirmed with specifics" AND "honestly acknowledged + pivoted"; 0–4 includes "invented or fudged the fact."
- The un-described middle bands (5–8, 13–16) interpolate; you do not need to write them.
- Keep each description under ~90 words; it must survive as one JSON string.

## 11. Knobs and metadata

- `voice`: default `{ "provider": "vapi", "voiceId": "Elliot", "label": "Elliot" }` unless the requester wants a specific vetted voice.
- `speaksFirst`: `"prospect"` (outbound-style, default) unless the scenario is an inbound call the trainee answers — then `"agent"` (the opener is delivered via prompt).
- `knobs`: `{ "silenceTimeoutSeconds": 90, "maxDurationSeconds": 600, "temperature": 0.6 }` are the proven defaults; deviate only with a reason (e.g. temperature 0.7 for a chattier archetype).
- `passThreshold`: 70 unless the requester says otherwise.
- `id`: kebab-case slug of the name. `name`: `<Scenario Title> — <Topic hint>` (no property names). `description`: 1–2 card-ready sentences naming what the trainee practices.
- `createdAt`/`updatedAt`: ISO timestamp of authoring (server overwrites on API save).
- `spokenGrading`: omit (force-disabled at runtime).
- `templateOverrides`: omit unless the persona genuinely needs a non-default voice-realism/style block (rare).

## 12. Workflow: brief → build → self-review

**Step 0 — inputs.** From the request, pin down: two topics (from `references/topics.md`
or the requester), archetype, difficulty, and any special asks (ladder, inbound-style,
specific trap). If the requester named all of these, skip to Step 2.

**Step 1 — brief (when degrees of freedom remain).** Propose a 5-line brief and wait for approval before writing the full scenario:

```
Persona: <one sentence: who is calling and why now>
Topics: <topic-1> + <topic-2> (why they cohere in this person)
Archetype: <name> — <one clause of texture>
Trap: <the moment, and which class (conduct / branch-tolerant)>
Difficulty: <level> — <the one thing that makes it that level>
```

**Step 2 — build.** Author the complete `RoleplayScenario` JSON in this order: persona
(archetype, emotion+cause, withheld info, conditional reactions, numbered arc) →
firstMessage → trap placement in the arc → checkpoints → rubric bands → waypoints →
knobs/metadata. Deliver as a fenced JSON block or a `.json` file, whichever the
requester's workflow prefers.

**Step 3 — self-review (mandatory, before presenting).** Check every line of this list;
fix failures and re-check before showing the result:

- [ ] Valid against `types.ts`: all required fields, rubric keys are `c1`–`c5`, waypoint types are `objection|guidance|value`, all ids kebab-case and unique
- [ ] Exactly 2 topics; the pairing reads as one coherent human
- [ ] Property-general: zero property/city names, zero invented property facts; prospect asks rather than asserts; grep your own draft for named amenities
- [ ] Persona has all five realism elements (archetype, emotion+cause, withheld info ×2–4, conditional reactions, numbered arc 7–10 steps)
- [ ] firstMessage sounds spoken and surfaces only one topic
- [ ] 1–2 traps, coherent with the persona; every trap has a checkpoint and appears in a rubric band; Class B traps are branch-tolerant on both grading sides
- [ ] Difficulty propagated per the section-7 table, not just the enum
- [ ] 3–4 waypoints; every completionCriteria is ONE observable behavior (no and/while fusions, no internal states); ≥1 objection + ≥1 value; suggestedLines ≤25 words, fact-free, branch-covering where relevant
- [ ] 5–7 checkpoints; skeleton four present; every checkpoint has a rubricKey; descriptions are observable behaviors
- [ ] All five rubric descriptions banded (17–20 / 9–12 / 0–4), scenario-specific, behavior-anchored, both branches covered where a trap is linked
- [ ] Skeleton allocation honored: c1 discovery, c2 empathy, c5 urgency+close, c3/c4 = the two topics

**Step 4 — deliver.** Present the JSON plus a 3-line summary (persona, trap, what the
trainee will find hard). Note the two landing options: add to `SEED_SCENARIOS` in
`apps/web/lib/roleplay/seedScenarios.ts` (reaches every property; goes through code
review) or save via the ScenarioEditor / `POST /api/roleplay/scenarios` (one property,
immediate). Do not push to either without the requester's say-so.

## 13. Expanding the topic catalog

When asked for novelty (or when the catalog feels stale) and web search is available:
search real renter forums, leasing blogs, and property-management sources for prospect
pain points; run each candidate through the admission test at the top of
`references/topics.md`; append admitted topics to the correct group with all five
fields. Discoveries persist in `references/topics.md` so every future invocation (in
any tool) benefits. No search available → the catalog as it stands is fully sufficient.
