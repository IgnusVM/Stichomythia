# Contract: Pause Policy

**Producer**: `server/routes/generation.ts` — `generatePause()`
**Consumers**: Parser (when not an interrupt pair), edit-clear handler
(when invalidating an interrupt)

## Existing behavior (unchanged)

`generatePause(ctx)` produces a positive `pauseAfterMs` between 60 and 3500 ms
based on text patterns, mood, word count, and randomization, as described in
the spec at [server/routes/generation.ts:109-169](../../../server/routes/generation.ts).

## Added contract

`generatePause()` is the canonical source of truth for non-interrupt
pause values. The parser invokes it for every pair that is NOT an interrupt
pair (per [parser.md](./parser.md)). The edit-clear handler invokes it
when invalidating an interrupt pair (per [turn-update.md](./turn-update.md)
below).

`generatePause()` itself does NOT need to change. It does not produce
negative values; that is exclusively the parser's responsibility for
em-dash-marked pairs.

## Sequencing

- For an interrupt pair: parser sets `turn[i].pauseAfterMs = -overlapMs`,
  bypassing `generatePause()` for that turn only.
- For all other turns: parser invokes `generatePause()` as today.
- For an edit that invalidates an interrupt pair: edit handler invokes
  `generatePause()` and assigns the result to `turn[i].pauseAfterMs`,
  clearing the negative value.
