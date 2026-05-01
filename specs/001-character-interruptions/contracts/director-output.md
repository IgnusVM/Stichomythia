# Contract: Director Output Extension

**Producer**: `server/services/director.ts` — `buildAIDirection()`
**Consumer**: `server/services/anthropic.ts` — `generateSegment()`

## Producer contract

`buildAIDirection()` returns an `AIDirection` object whose new optional
`interruptionOpportunities` field MUST satisfy:

- An ordered array of 0–5 strings.
- Each string is a single sentence ≤ 200 characters.
- Each string names exactly two characters by their conversation labels
  (Person A, Person B, Person C, Person D), one as the interrupter and one
  as the interrupted, and gives a one-clause trigger.

**Format examples** (each is a valid string):

- `"Person B should cut off Person A when A starts justifying the budget cut."`
- `"Person C interrupts Person D agreeably when D mentions the trip to Vermont."`
- `"Person A cuts in on Person C with a sharp objection when C brings up the lawsuit."`

**Producer MUST** return an empty array (or omit the field) when:

- The current emotional landscape is calm/agreeable AND no character has a
  pending tension or strong opinion.
- The conversation is in a thoughtful, slow passage where pacing matters
  more than energy.
- The director's confidence in any candidate opportunity is low.

**Producer MUST NOT** include opportunities involving the same character on
both sides (no self-interruption — FR-004).

## Consumer contract

`generateSegment()` MUST:

- Pass each opportunity verbatim into the per-segment system prompt as a
  bulleted list under a heading the AI can recognize (e.g.,
  `Interruption opportunities for this segment:`).
- Instruct the AI that it MAY use any subset (including none) of the listed
  opportunities, and that it MUST NOT invent interruptions outside the list.
- Cap the number of interrupt pairs the AI is permitted to produce at
  `min(opportunities.length, settings.interruptionMaxPerSegment)`.

`generateSegment()` MUST NOT:

- Produce interrupt pairs when `opportunities` is empty or absent.
- Modify or paraphrase opportunities before passing them to the AI.
