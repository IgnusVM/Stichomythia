# Contract: Segment Parser Extension

**Producer**: `server/services/anthropic.ts` — `parseSegmentResponse()`
**Consumer**: Storage layer (turn JSON files), `server/routes/generation.ts`

## Existing behavior (unchanged)

The parser walks each line of the AI response, applies the line regex, and
produces an array of `ParsedTurn` objects with `characterLabel`, `moodTag`,
and `text`.

## Added behavior: em-dash pair detection

After parsing the per-line array, the parser MUST run a second pass over
adjacent pairs `[turn[i], turn[i+1]]` and detect interruptions as follows:

1. Trim trailing whitespace from `turn[i].text`.
2. If the last code point is `—` (U+2014), AND
3. `turn[i+1].text` (after leading whitespace trim) begins with `—`, AND
4. `turn[i].characterLabel !== turn[i+1].characterLabel`,

then this pair IS an interrupt pair. Apply:

- Strip the leading `—` and any immediately following whitespace from
  `turn[i+1].text` (it's a structural marker, not spoken content).
- Leave the trailing `—` on `turn[i].text` intact (TTS uses it for prosody).
- Compute `overlapMs` = a uniform random integer in
  `[settings.interruptionOverlapRange.minMs, settings.interruptionOverlapRange.maxMs]`.
- Set `turn[i].pauseAfterMs = -overlapMs`.
- Set `turn[i].fadeOutTailMs = settings.interruptionFadeMs`.
- Do NOT mutate `turn[i+1]`'s pause/fade fields based on the pair (the
  next pair, if any, governs `turn[i+1].pauseAfterMs`).

If any of conditions 2–4 fail for a candidate pair, the parser MUST:

- Strip stray em-dashes from the text on either side (so they're not
  spoken weirdly).
- Compute `pauseAfterMs` via the existing `generatePause()`.
- Leave `fadeOutTailMs` undefined.

## Cap enforcement

If the parser detects more than `settings.interruptionMaxPerSegment`
interrupt pairs in a single response, it MUST keep the first
`interruptionMaxPerSegment` of them and convert the rest to ordinary turn
pairs (per the failure-mode handling above).

## Output

The parser returns the same `ParsedTurn[]` shape as before, with the new
fields populated where applicable. Downstream code (storage, audio render,
playback) consumes these fields per the data model.
