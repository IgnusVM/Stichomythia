# Contract: Turn Update Edit-Clear

**Producer**: `server/routes/turns.ts` — turn update handler (PUT /turns/:id)
**Consumers**: Persisted conversation JSON, renderer (via event)

## Trigger

Whenever a turn's `text` is edited and saved, after persisting the new text:

1. Look up the turn's `pauseAfterMs` and `sequenceNumber`, plus the same
   fields on the previous and next turns in the same segment (call them
   `prev` and `next`).
2. If this turn or its neighbor was previously part of an interrupt pair
   (detected by checking for `pauseAfterMs < 0` on this turn or `prev`),
   re-run the em-dash pair detection from [parser.md](./parser.md) over the
   affected pair(s).

## Pairs to re-evaluate

- If `this.pauseAfterMs < 0`: the (this, next) pair.
- If `prev.pauseAfterMs < 0`: the (prev, this) pair.

## Outcome of re-evaluation

For each affected pair, the detection either still holds (em-dashes intact,
different characters) or it doesn't:

**Pair still holds**: do nothing. The interrupt linkage is preserved.

**Pair no longer holds** (the trigger condition for FR-008): for the
formerly-interrupted turn:

1. Compute new `pauseAfterMs` via `generatePause()`.
2. Set `pauseAfterMs` to that value.
3. Clear `fadeOutTailMs`.
4. Strip any stray em-dashes from the text on either side of the pair to
   prevent them from being spoken.
5. Re-render TTS for the affected turn(s) on the next playback / export
   request the same way the existing edit flow does (audio re-rendering is
   already triggered by text changes).
6. Emit a server-sent event of shape:

   ```
   { type: 'turn-updated', turnId, segmentId, removedInterruption: true }
   ```

   The renderer's `AudioEngineContext` listens for this event and shows a
   toast: *"Interruption removed — both turns now play in full"*. The toast
   is dismissable; auto-hide after 4 seconds.

## Idempotency

The re-evaluation is idempotent: editing the same turn twice in a row with
no further markers does not produce duplicate toasts (the second
re-evaluation finds no negative `pauseAfterMs` on either side and exits
without emitting).

## Same-character invalidation

If a user changes a turn's `characterId` to match its neighbor's such that an
existing interrupt pair would now violate FR-004, the same clearing logic
applies (em-dash markers may still be present in text, but the
different-characters condition fails).
