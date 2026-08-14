# Worked Exemplar Scenarios

Read one exemplar before authoring your first scenario in a session. Imitate the
**density** — how much specific, observable content each field carries — not the
content itself. Annotations in blockquotes explain *why* a choice was made; they are
not part of the JSON.

---

## Exemplar 1 — "Burned Once, Counting Twice" (medium)

**Brief that produced it:**

```
Persona: A renter leaving a complex that stacked surprise fees on top of advertised rent, calling somewhere new with a calculator open and trust at zero.
Topics: fee-transparency + parking-availability (one coherent human: someone who got burned on the real monthly number is exactly the person who now itemizes everything, parking included)
Archetype: Skeptical burned-before renter — polite but clipped, asks "so what's the REAL number" questions, audibly relaxes only on straight answers
Trap: Class A — pressure to quote an unverified total move-in cost ("just ballpark it, I won't hold you to it"); Class B — covered parking demanded as near-dealbreaker, branch-tolerant
Difficulty: medium — withholds the fee history until asked; firm traps; warms when earned
```

> Two traps, one of each class, both growing from the same wound: a person burned by
> surprise numbers both *pressures for instant numbers* (Class A) and *demands the
> thing their last place charged extra for* (Class B). That coherence is the standard —
> if a trap needs its own backstory, it belongs in a different scenario.

```json
{
  "id": "burned-once-counting-twice",
  "name": "Burned Once, Counting Twice — Fees & Parking",
  "description": "A renter stung by surprise fees at their current complex calls with trust at zero, itemizing every cost and demanding covered parking. Practice fee transparency, holding the line on unverified numbers, and honest handling of an amenity you may or may not have.",
  "personaPrompt": "You are calling an apartment community you found online, looking to move when your current lease ends in about two months. Your last two years soured you: the advertised rent at your current place turned out to be maybe 80% of what you actually pay once the mandatory 'amenity package', valet trash, and parking fees landed. You ran the numbers last night and you're still annoyed. You're polite but clipped and guarded — you ask 'what's the REAL monthly number' type questions, and you audibly relax only when someone gives you a straight answer. You also NEED reliable parking; at your current place you pay extra for a spot that isn't even covered, and covered parking has become almost a dealbreaker for you.\n\nThings you know but do NOT volunteer until the agent asks: (1) your actual budget ceiling for TRUE all-in monthly cost, (2) the specific fees that burned you (amenity package, valet trash, parking), (3) your move timeline of about two months, (4) that your current landlord is raising your renewal by a lot, which is why you're leaving. Don't dump every concern at once — make the agent draw it out of you.\n\nLet the call unfold in roughly this order, at a natural pace:\n1. Open by saying you're looking for a place and you want to understand what living there ACTUALLY costs per month — not the advertised rent, the real number.\n2. If the agent quotes or discusses only base rent, push back: 'that's what my current place said too.' Mention the fee stacking you've lived through only if they ask what happened.\n3. Answer discovery questions honestly but briefly; warm up a little each time the agent asks a real question instead of pitching.\n4. TRAP (fees): at some point, pressure the agent for an instant number: 'Just ballpark my total move-in cost right now — first month, deposits, fees, everything. I won't hold you to it.' If they make up a number, get quieter and more guarded — that's what the last place did. If they decline honestly and offer to get you an itemized quote or walk through the fee categories, that's the straight answer you wanted — relax noticeably.\n5. Bring up parking: you pay extra for uncovered parking now and you're done with that. Ask directly whether they have covered parking, and make clear it's close to a dealbreaker.\n6. TRAP (parking): whatever they answer, test it. If they say yes, ask a follow-up (is it extra, is it guaranteed or first-come). If they say no or aren't sure, watch HOW they handle it — if they're honest and offer a real alternative or offer to verify, stay in the conversation; if they dodge, dance around it, or oversell a substitute, say you've 'heard that kind of answer before' and pull back.\n7. If the agent acknowledges how frustrating the fee experience was, or is transparently honest about a limitation, warm up — this is the main thing that wins you over.\n8. If they explain honestly why deciding in your two-month window helps (e.g. how availability works), take it seriously — you hate pressure, but you respect a real reason.\n9. If they ask for a next step (tour, itemized quote, follow-up), respond like a real prospect: agree if they've earned trust, hesitate if the fee or parking answers were shaky.\n10. Keep playing the prospect until the agent wraps up or closes the call.",
  "firstMessage": "Hi — so I'm looking at apartments, and I'll be honest with you up front: I want to know what a place actually costs a month. Like the real number, not the one on the website. Can we start there?",
  "voice": { "provider": "vapi", "voiceId": "Elliot", "label": "Elliot" },
  "difficulty": "medium",
  "speaksFirst": "prospect",
  "passThreshold": 70,
  "waypoints": [
    {
      "id": "validate-the-fee-burn",
      "type": "guidance",
      "title": "Validate the fee burn",
      "cue": "The prospect says their current place turned out to cost far more than advertised, or pushes for the 'real number'.",
      "completionCriteria": "The trainee verbally acknowledges the prospect's frustration with surprise fees or hidden costs at their current community.",
      "suggestedLines": [
        "That's a really frustrating experience — nobody likes finding out the real number after they've signed.",
        "I hear you. You want the full picture up front, and that's exactly how it should work.",
        "That fee stacking is unfortunately common, and I get why you're careful now."
      ]
    },
    {
      "id": "decline-the-ballpark-honestly",
      "type": "objection",
      "title": "Decline the ballpark honestly",
      "cue": "The prospect pressures you to ballpark their total move-in cost on the spot, saying they won't hold you to it.",
      "completionCriteria": "The trainee offers a concrete path to accurate numbers — an itemized quote, a walkthrough of each fee category, or a follow-up with exact figures — without stating an invented total.",
      "suggestedLines": [
        "I'd rather get you exact numbers than guess — can I put together an itemized quote after this call?",
        "Let me walk you through each cost category instead of ballparking, so nothing surprises you later.",
        "I won't throw out a number I can't stand behind — let me confirm the current figures for you."
      ]
    },
    {
      "id": "handle-the-parking-demand-straight",
      "type": "value",
      "title": "Handle the parking demand straight",
      "cue": "The prospect says covered parking is close to a dealbreaker and asks directly whether you have it.",
      "completionCriteria": "The trainee gives a direct answer about covered parking — confirming specifics, honestly saying it is not offered, or committing to verify — without dodging or overselling.",
      "suggestedLines": [
        "Let me give you a straight answer on parking — I'll confirm exactly what we offer and what it costs.",
        "If covered parking is the priority, here's exactly where we stand on that.",
        "I don't want to oversell this: let me tell you what our parking situation actually looks like."
      ]
    },
    {
      "id": "close-with-an-itemized-next-step",
      "type": "guidance",
      "title": "Close with an itemized next step",
      "cue": "The prospect has their fee and parking answers and is weighing whether this place is different from their last one.",
      "completionCriteria": "The trainee asks the prospect to commit to a specific next step, such as a tour, an itemized quote follow-up, or starting an application.",
      "suggestedLines": [
        "How about I send you a full itemized quote today and we schedule a tour so you can see it in person?",
        "Since your lease is up in two months, would a tour this week help you compare real numbers side by side?",
        "Can I follow up tomorrow with the exact costs in writing, and get a tour on the calendar?"
      ]
    }
  ],
  "checkpoints": [
    {
      "id": "discovery-questions",
      "name": "Discovery questions",
      "description": "The agent asks questions about the prospect's situation — budget, timeline, what happened at their current community, or what matters most — rather than only reacting.",
      "required": true,
      "rubricKey": "c1"
    },
    {
      "id": "empathy-acknowledge-fee-burn",
      "name": "Empathy / acknowledges the fee burn",
      "description": "The agent acknowledges the prospect's frustration with surprise fees at their current community and makes them feel heard.",
      "required": true,
      "rubricKey": "c2"
    },
    {
      "id": "fee-transparency",
      "name": "Transparent about the real monthly cost",
      "description": "The agent addresses the true-cost question head-on: explains the categories of fees/charges that exist, or commits to an itemized breakdown — without dismissing the concern or dodging.",
      "required": true,
      "rubricKey": "c3"
    },
    {
      "id": "declines-unverified-ballpark",
      "name": "Declines the unverified ballpark",
      "description": "When pressured to instantly ballpark total move-in cost, the agent declines to invent a number and offers a concrete path to accurate figures instead.",
      "required": true,
      "rubricKey": "c3"
    },
    {
      "id": "handles-parking-demand-honestly",
      "name": "Handles the covered-parking demand honestly",
      "description": "The agent responds to the covered-parking demand honestly — either confirming it with concrete specifics (cost, availability), or transparently acknowledging it is not offered (or unknown) and pivoting to a genuine alternative or a commitment to verify — without inventing or fudging facts.",
      "required": true,
      "rubricKey": "c4"
    },
    {
      "id": "introduces-urgency-ethically",
      "name": "Introduces urgency ethically",
      "description": "The agent honestly explains why deciding within the prospect's ~two-month window helps (e.g. how availability or pricing works), without pressure tactics.",
      "required": true,
      "rubricKey": "c5"
    },
    {
      "id": "asks-for-next-step",
      "name": "Asks for a next step",
      "description": "The agent asks for a concrete next step: a tour, an itemized quote follow-up, or an application.",
      "required": true,
      "rubricKey": "c5"
    }
  ],
  "rubric": [
    {
      "key": "c1",
      "label": "Discovery Questions",
      "description": "Depth of discovery with a guarded, burned prospect. 17–20: uncovers at least three withheld facts (true budget, the specific fees that burned them, timeline, or why they're leaving) through real questions. 9–12: asks surface questions but pitches before understanding the burn. 0–4: no discovery — answers only what's thrown at them or launches into a pitch."
    },
    {
      "key": "c2",
      "label": "Empathy / Acknowledgment",
      "description": "Making a distrustful prospect feel heard. 17–20: explicitly validates the fee-stacking frustration AND reflects it back in the agent's own words before problem-solving. 9–12: a token 'I understand' without engaging with what actually happened to them. 0–4: ignores, minimizes, or defends the industry ('all places have fees')."
    },
    {
      "key": "c3",
      "label": "Fee Transparency & Number Integrity",
      "description": "Handling the true-cost question and the ballpark trap. 17–20: proactively explains fee categories or commits to an itemized quote, AND declines to invent a move-in total under pressure while offering a concrete accurate path. 9–12: answers about fees vaguely, or wobbles on the ballpark before recovering. 0–4: quotes invented numbers, dismisses the fee concern, or dodges the question twice."
    },
    {
      "key": "c4",
      "label": "Honest Amenity Handling (Parking)",
      "description": "Handling a near-dealbreaker demand without fudging. 17–20: gives a direct answer on either branch — confirms covered parking with specifics (cost, guarantee), or honestly says it isn't offered/unknown and pivots to a genuine alternative or commits to verify. 9–12: answers but hedges, oversells a weak substitute, or leaves the prospect unsure what the truth was. 0–4: invents parking facts, dodges repeatedly, or dismisses the concern."
    },
    {
      "key": "c5",
      "label": "Urgency & Next Steps",
      "description": "Ethical urgency plus a clear close with a trust-sensitive prospect. 17–20: gives an honest reason deciding within their two-month window helps AND asks for a specific next step (tour, itemized quote, application). 9–12: closes without urgency, or urgency without any ask. 0–4: pressure tactics ('this deal expires today'), or no attempt to close at all."
    }
  ],
  "knobs": { "silenceTimeoutSeconds": 90, "maxDurationSeconds": 600, "temperature": 0.6 },
  "createdAt": "2026-08-14T00:00:00.000Z",
  "updatedAt": "2026-08-14T00:00:00.000Z"
}
```

> **Why this passes self-review, item by item:**
> - **Two topics** (true-cost/fees + parking demand), one human: both grow from the same burn. The closing thread (c5) is skeleton, not a third topic.
> - **Property-general:** the prospect asserts facts only about their CURRENT (unnamed) community — those travel with the persona. Every claim about the NEW property is a question or a demand, never an assertion. Both parking branches are legitimate passes in c4 and in the `handles-parking-demand-honestly` checkpoint.
> - **All five realism elements:** archetype (skeptical burned-before renter), emotion with cause (fee stacking → trust at zero), four withheld facts, conditional reactions (relaxes on straight answers, pulls back on dodges — twice), 10-step arc with both traps placed.
> - **Traps graded:** the ballpark trap → `declines-unverified-ballpark` checkpoint + c3 bands; the parking trap → `handles-parking-demand-honestly` checkpoint + c4 bands; both also have waypoints, so the trainee is coached live.
> - **Single-behavior criteria:** e.g. `decline-the-ballpark-honestly` names ONE observable behavior ("offers a concrete path to accurate numbers"), with the refusal demoted to a `without ...` qualifier. WRONG: "The trainee declines to invent a total **and instead** offers a concrete way to get accurate numbers" — the "declines X and instead offers Y" shape fuses two behaviors, and the live judge may never check the card off when the trainee does only one half explicitly. RIGHT: state the affirmative behavior, and express any refusal/avoidance as a "without ..." clause, never as a second verb.
> - **Banded rubric:** every category names observable behaviors specific to THIS scenario; c3's 0–4 includes the trap failure ("quotes invented numbers"); c4 bands cover both branches.

---

## What a second scenario should NOT copy

Do not clone this exemplar with the nouns swapped. Change the machinery, not just the
topic labels: a different archetype changes the *speech texture and warming conditions*;
a different trap class changes *where the danger sits in the arc*; inbound vs. outbound
(`speaksFirst`) changes the whole opening. If your draft's arc step-for-step mirrors the
exemplar's, start the persona over from the archetype.
