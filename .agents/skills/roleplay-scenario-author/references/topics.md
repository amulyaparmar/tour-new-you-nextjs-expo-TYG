# Topic Catalog

This file is the canonical list of conversation topics available to scenario authors for the voice-AI leasing roleplay trainer. It grows over time as new prospect pain points are discovered and admitted (see "Expanding this catalog"). Every scenario selects **exactly two** topics from this catalog; the fixed skeleton of discovery, empathy, and closing is always present and is not a catalog topic.

## Admission test

A new topic must clear all three lines before being added:

1. A NEW PROSPECT would plausibly raise it on a first sales call (never a current-resident issue like a repair ticket or renewal dispute).
2. It trains observable agent behavior (a skill a grader can hear), not pure trivia recall.
3. It is property-general, or can be written as a branch-tolerant demand: the prospect demands X without the scenario presuming the property has X, and grading covers both the "we have it" and "we don't" branches.

## Topics

Fact-dependence values: `none` (agent behavior is the same at any property) | `branch-tolerant` (prospect demands something the property may or may not have; grading covers both branches).

### Financial

| Slug | Prospect brings up | Trains | Fact-dep | Pairs well with |
|---|---|---|---|---|
| `tight-budget` | Has a hard monthly cap at or below what they fear market rent is | Surfacing the real number and selling value without inventing discounts | none | `fee-transparency`, `utilities-cost`, `roommate-group`, `in-unit-laundry` |
| `fee-transparency` | Wants the true all-in cost: application, admin, deposit, monthly add-ons | Itemizing every charge plainly without dodging or minimizing | none | `tight-budget`, `application-anxiety`, `first-time-renter` |
| `utilities-cost` | Asks which utilities are included and what a typical month really totals | Explaining variable costs honestly and setting realistic expectations | branch-tolerant | `tight-budget`, `fee-transparency`, `high-speed-internet` |
| `rent-negotiation` | Pushes for a discount, waived fee, or concession before applying | Holding price with warmth; trading on value, not capitulation or fake authority | none | `comparison-shopper`, `availability-timing`, `renewal-increases` |
| `cosigner-guarantor` | Needs a guarantor or asks how co-signing works and who qualifies | Explaining qualification paths clearly and without judgment | none | `credit-concerns`, `first-time-renter`, `parent-on-behalf` |
| `credit-concerns` | Worried thin, damaged, or gig-income credit history will get them denied | Reassuring honestly: explaining screening without promising approval | none | `cosigner-guarantor`, `application-anxiety` |

### Roommates & Social

| Slug | Prospect brings up | Trains | Fact-dep | Pairs well with |
|---|---|---|---|---|
| `roommate-matching` | Nervous about being matched with strangers; asks how matching and conflicts work (leans student) | Explaining the process and de-escalating stranger anxiety without overpromising harmony | branch-tolerant | `individual-liability`, `first-time-renter`, `noise-environment` |
| `roommate-group` | Calling for a pre-formed group of friends who want to live together | Group needs discovery and steering to the right floor plan and timeline | none | `tight-budget`, `availability-timing`, `parking-availability` |
| `individual-liability` | Asks whether they are on the hook if a roommate skips rent (per-bed vs joint lease; leans student) | Explaining lease structure accurately and simply | branch-tolerant | `roommate-matching`, `roommate-group`, `cosigner-guarantor` |

### Policies & Restrictions

| Slug | Prospect brings up | Trains | Fact-dep | Pairs well with |
|---|---|---|---|---|
| `pet-owner` | Has a cat or dog; asks about pet rent, deposits, and limits | Asking clarifying questions (species, size, count) before quoting policy | branch-tolerant | `fee-transparency`, `restricted-breed-exotic`, `relocation-sight-unseen` |
| `restricted-breed-exotic` | Has a commonly restricted breed or an unusual animal (snake, ferret, parrot) | Checking policy rather than guessing; delivering possible bad news kindly with alternatives | branch-tolerant | `pet-owner`, `relocation-sight-unseen` |
| `esa-accommodation` | Asks about an emotional support or service animal | Legally safe, respectful accommodation handling; never improper documentation demands | none | `accessibility-needs`, `application-anxiety` |
| `guest-policy` | Partner or friends will stay over often; asks what is allowed | Stating limits factually without prying into the prospect's life | branch-tolerant | `parking-availability`, `individual-liability`, `roommate-matching` |

### Location & Commute

| Slug | Prospect brings up | Trains | Fact-dep | Pairs well with |
|---|---|---|---|---|
| `commute-access` | Needs a specific max commute to campus or work; asks about transit options | Discovering the destination, answering honestly, never fabricating times | branch-tolerant | `parking-availability`, `car-free-living`, `availability-timing` |
| `neighborhood-safety` | Asks "is the area safe?" and about lighting, access control, patrols | Fair-housing-safe factual answers; pointing to data and tours, never characterizing people | none | `parent-on-behalf`, `first-time-renter`, `noise-environment` |
| `car-free-living` | Has no car; needs walkability, transit, bike storage, delivery access | Lifestyle discovery and honest fit assessment | branch-tolerant | `commute-access`, `tight-budget` |
| `parking-availability` | Needs guaranteed spots, asks costs, covered options, guest parking | Answering layered logistics questions without hand-waving | branch-tolerant | `commute-access`, `roommate-group`, `guest-policy` |
| `noise-environment` | Light sleeper; asks about street, rail, or party noise around the community | Honesty about the environment plus concrete mitigation (unit placement, quiet hours) | branch-tolerant | `study-work-space`, `roommate-matching`, `remote-worker` |

### Property Features & Amenities (all branch-tolerant)

| Slug | Prospect brings up | Trains | Fact-dep | Pairs well with |
|---|---|---|---|---|
| `fitness-pool-amenities` | Demands a real gym and/or pool; asks hours, crowding, quality | Branch handling: selling the amenity if present, pivoting honestly to alternatives if not | branch-tolerant | `comparison-shopper`, `availability-timing`, `rent-negotiation` |
| `study-work-space` | Needs quiet study rooms or work-from-home space (students and remote workers alike) | Probing how they actually work, then matching or honestly redirecting | branch-tolerant | `remote-worker`, `noise-environment`, `high-speed-internet` |
| `in-unit-laundry` | Treats in-unit washer/dryer as a must-have | Needs-vs-wants discovery and presenting alternatives without dismissing the need | branch-tolerant | `tight-budget`, `fee-transparency`, `comparison-shopper` |
| `furnished-unit` | Needs a furnished unit or furniture package (leans student and relocation) | Clarifying what "furnished" means here and quoting the branch truthfully | branch-tolerant | `relocation-sight-unseen`, `international-prospect`, `availability-timing` |
| `high-speed-internet` | Needs fast, reliable internet for work, class, or gaming; asks who provides it | Precise answers about provider, speed, and cost without guessing specs | branch-tolerant | `remote-worker`, `study-work-space`, `utilities-cost` |

### Trust & Reputation

| Slug | Prospect brings up | Trains | Fact-dep | Pairs well with |
|---|---|---|---|---|
| `negative-reviews` | Quotes bad online reviews and asks the agent to respond to them | Non-defensive acknowledgment; rebuilding trust without trashing the reviewer | none | `maintenance-response`, `pest-history`, `comparison-shopper` |
| `maintenance-response` | Asks how fast maintenance actually shows up, not the brochure answer | Explaining the real process and timelines without overpromising | none | `negative-reviews`, `pest-history` |
| `pest-history` | Asks pointedly about roaches or bedbugs history | Calm, factual, non-dismissive handling of an uncomfortable question | none | `negative-reviews`, `maintenance-response` |
| `scam-wariness` | Fears the listing or deal is a scam; wary of deposits and wire requests | Building legitimacy: offering verification, official channels, and patience | none | `relocation-sight-unseen`, `international-prospect`, `application-anxiety` |

### Process & Lease Terms

| Slug | Prospect brings up | Trains | Fact-dep | Pairs well with |
|---|---|---|---|---|
| `lease-length-flexibility` | Needs a short-term or off-cycle lease (semester, 6-month, mid-month start) | Exploring real options without inventing terms that may not exist | branch-tolerant | `relocation-sight-unseen`, `availability-timing`, `early-exit-options` |
| `early-exit-options` | Asks what happens if plans change: sublet, relet, buyout | Explaining exit mechanics and costs honestly without scaring the prospect off | branch-tolerant | `lease-length-flexibility`, `individual-liability` |
| `application-anxiety` | Nervous about application steps, documents, screening, and being denied | Step-by-step walkthrough with reassurance and zero jargon | none | `credit-concerns`, `first-time-renter`, `cosigner-guarantor` |
| `availability-timing` | Needs to move in fast or by a hard date; pressure-tests availability | Handling urgency without hard-sell tactics or false scarcity | none | `relocation-sight-unseen`, `lease-length-flexibility`, `rent-negotiation` |
| `renewal-increases` | Savvy caller asks how much rent typically rises at renewal before signing year one | Honest expectation-setting about future pricing without guarantees | none | `comparison-shopper`, `tight-budget`, `rent-negotiation` |

### Personal Circumstances

| Slug | Prospect brings up | Trains | Fact-dep | Pairs well with |
|---|---|---|---|---|
| `first-time-renter` | Has never rented; does not know deposits from applications (leans student) | Educating without condescension; pacing to the caller's knowledge level | none | `application-anxiety`, `cosigner-guarantor`, `fee-transparency` |
| `parent-on-behalf` | Parent shopping for their student or young-adult child (leans student) | Serving the caller while looping in the absent applicant and respecting privacy limits | none | `neighborhood-safety`, `cosigner-guarantor`, `roommate-matching` |
| `international-prospect` | No SSN or U.S. credit; leasing from abroad; unfamiliar with U.S. process | Explaining alternative qualification paths with patient, idiom-free clarity | none | `scam-wariness`, `furnished-unit`, `application-anxiety` |
| `relocation-sight-unseen` | Relocating for work or school and cannot tour in person | Virtual-tour and verification offers; building enough trust to lease remotely | none | `scam-wariness`, `availability-timing`, `furnished-unit` |
| `accessibility-needs` | Asks about mobility, hearing, or visual accommodations and accessible features | Respectful, legally sound accommodation handling; verifying instead of assuming | branch-tolerant | `esa-accommodation`, `parking-availability`, `maintenance-response` |
| `comparison-shopper` | Actively comparing two or three named competitors; asks "why you?" | Differentiating on genuine strengths without trash-talking competitors | none | `rent-negotiation`, `fitness-pool-amenities`, `negative-reviews` |
| `remote-worker` | Works from home full-time; the apartment is also the office | Lifestyle discovery: daytime noise, workspace, connectivity as one coherent need | none | `high-speed-internet`, `study-work-space`, `noise-environment` |

## Anti-pairings

Pairings to avoid because no single realistic first-time caller combines them:

- `roommate-group` + `roommate-matching` — a caller with a full pre-formed group has no reason to ask to be matched with strangers.
- `car-free-living` + `parking-availability` — demanding guaranteed parking contradicts the persona's own no-car premise.
- `first-time-renter` + `comparison-shopper` — total novice confusion and spreadsheet-level market mastery cannot share one voice.
- `parent-on-behalf` + `remote-worker` — an established professional arranging their own work-from-home life does not have a parent shopping for them.
- `esa-accommodation` + `restricted-breed-exotic` — mixing a protected accommodation with a restricted pet muddles which animal (and which law) each graded behavior applies to.
- `rent-negotiation` + `application-anxiety` — confident price hardball and fear of being denied are opposite postures toward the same transaction.
- `scam-wariness` + `rent-negotiation` — nobody haggles to lock in a deal they suspect is fraudulent; each topic drains the other's stakes.

## Prospect archetypes

Archetypes texture HOW the persona talks, independent of which two topics are in play. They must stay respectful: texture, never caricature. Never write phonetic accents or mock speech patterns.

1. **Anxious First-Timer** — fast, nervous pace; frequent "um" and "sorry"; over-apologizes. Challenging because they need reassurance without being steamrolled, and they lose the thread when rushed. *"Hi, um — sorry, I've never done any of this before, but I saw your listing and…"*
2. **Over-Researched Comparison Shopper** — brisk, data-forward, interrupts with figures and review quotes. Challenging because they punish vagueness instantly and fact-check the agent live. *"So I've got a spreadsheet open — you, plus two other communities — and your admin fee is the outlier."*
3. **Curt Professional** — clipped sentences, no small talk, visibly time-boxed. Challenging because there is no room for rapport rituals; the agent must earn every extra sentence. *"I've got five minutes between meetings. One-bedroom. What's the number?"*
4. **Chatty Rambler** — warm, digressive, life stories mid-question. Challenging because the agent must redirect kindly without losing the warmth that is the caller's currency. *"Oh hi! So my niece lived near there — well, actually, let me back up a second…"*
5. **Skeptical Burned Renter** — flat, guarded tone; tests every claim against past betrayal. Challenging because pat answers make it worse; only specifics and candor land. *"Look, my last complex promised me the world too, so forgive me if I ask for that in writing."*
6. **Budget-Embarrassed Student** — hedges, trails off around numbers, deflects with humor. Challenging because the agent must gently surface the real budget the caller is hiding. *"I mean, price isn't like a huge deal, but, um… what's roughly the… cheapest option?"*
7. **Parent Proxy** — organized, protective, arrives with a written list; sometimes answers for the absent child. Challenging because the agent must serve the caller while keeping the actual applicant in the loop. *"Hi, I'm calling for my daughter — she starts in the fall and I have a few questions. Okay, more than a few."*
8. **Careful Non-Native Speaker** — measured pace, precise formal vocabulary, confirms understanding often ("so, to confirm—"). Challenging because the agent must slow down, drop idioms, and verify comprehension without a hint of condescension. *"Hello. I would like to confirm some details about the lease, if that is okay."*
9. **Indecisive People-Pleaser** — agrees with everything, never states a preference, cheerful but opaque. Challenging because surface agreement hides real objections; only forced-choice discovery reveals them. *"Oh yeah, no, that all sounds great, honestly — whatever you think is best."*
10. **Sight-Unseen Transferee** — organized but stressed; logistics-first; juggling time zones and a countdown. Challenging because trust must be built without a tour and every unanswered detail raises the stakes. *"I'm relocating in three weeks and can't fly out — how do people normally do this remotely?"*

## Expanding this catalog

An agent with web search adds topics as follows:

1. Search real renter voices for first-call pain points: renter and student-housing forums (e.g., Reddit r/renters, r/Apartmentliving, campus-housing threads), leasing-industry blogs, and "questions to ask before renting" guides.
2. Run each candidate through the Admission test (all three lines). Reject current-resident issues and anything requiring property-specific facts that cannot be written as a branch-tolerant demand.
3. Append the topic to the best-fitting existing group with all five fields: slug, one-line description, trains, fact-dependence, pairs well with. Add pairings in both directions where natural. Only create a new group when three or more admitted topics do not fit existing groups.
4. Keep slugs stable once added — scenarios reference them; never rename or repurpose an existing slug. If a topic's scope changes materially, add a new slug and mark the old one deprecated rather than editing it in place.
