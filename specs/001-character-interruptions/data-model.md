# Phase 1 Data Model: Character Interruptions

This document specifies the additive schema changes for the interruptions
feature. All changes are additive and backward-compatible — existing data
files continue to load and behave as before (FR-012).

## Turn (modified)

The existing `Turn` interface in `src/types/index.ts` gains two optional fields.
No existing field is renamed, removed, or has its semantics changed.

```typescript
interface Turn {
  // ...all existing fields unchanged...
  pauseAfterMs: number;        // EXISTING — semantics extended: now MAY be NEGATIVE
  fadeOutTailMs?: number;      // NEW — when set, ramp this turn's gain to 0 over N ms at end
}
```

### Field semantics

- **`pauseAfterMs` (extended)** — Previously always non-negative; the gap between
  this turn's end and the next turn's start. Now MAY be negative. A negative
  value `-N` means the next turn starts `N` ms before this turn's audio ends.
  Range: `[-1500, 3500]` (clamp at write time). Validators MUST accept the
  negative range; renderers that don't understand it MAY fall back to
  `Math.max(0, pauseAfterMs)` (legacy behavior).

- **`fadeOutTailMs` (new, optional)** — When present and positive, the playback
  scheduler MUST apply a linear gain ramp from 1.0 to 0.0 over the last
  `fadeOutTailMs` ms of this turn's audio. When absent or 0, no fade is
  applied. Typical value is 150 ms. Range: `[0, 500]`. Only meaningful for
  turns whose `pauseAfterMs` is negative; ignored otherwise.

### Validation rules

- `fadeOutTailMs` MUST be ≤ 500
- `pauseAfterMs` MUST be ≥ -1500 and ≤ 3500
- If `pauseAfterMs < 0`, the turn at `sequenceNumber + 1` in the same segment
  MUST exist and MUST have a different `characterId` (FR-004 enforcement)

### State transitions

There is no formal state machine — these are scalar fields. The only state
transition relevant to this feature is: **edit invalidation**. When a turn
text edit causes the em-dash markers to no longer hold (R7), the server
recomputes `pauseAfterMs` from `generatePause()` and clears `fadeOutTailMs`.

### Backward compatibility

Loading a `Turn` JSON object that does not have `fadeOutTailMs` MUST treat it
as undefined (not 0, not null — undefined). All existing turns load unchanged.

---

## Segment (unchanged structure, extended director input)

The `Segment` interface itself doesn't change; it already contains
`directorInput?: string`. The shape of `directorInput` (which is JSON-encoded)
is extended.

---

## AIDirection (modified)

The `AIDirection` interface produced by `server/services/director.ts` gains
one optional field.

```typescript
interface AIDirection {
  // ...all existing fields unchanged...
  interruptionOpportunities?: string[];   // NEW
}
```

### Field semantics

- **`interruptionOpportunities` (new, optional)** — An ordered array of short
  prose hints describing moments in the upcoming segment where one character
  interrupting another would be character-appropriate. Each hint is one
  sentence, names two characters, and describes the trigger. Empty or absent
  means the director sees no good interruption opportunities for this segment;
  the generator MUST NOT produce interrupt pairs in that case.

### Validation rules

- Each hint MUST be a single sentence ≤ 200 characters
- Hints MUST reference characters by their per-conversation labels (Person A,
  Person B, etc.) the same way the existing emotional landscape does
- Maximum 5 hints per segment (the director will be prompt-instructed to
  produce 0–5)

---

## AppSettings (modified)

The `AppSettings` interface in `server/routes/settings.ts` gains four fields.

```typescript
interface AppSettings {
  // ...all existing fields unchanged...
  interruptionsEnabled: boolean;                       // NEW — default true
  interruptionOverlapRange: { minMs: number; maxMs: number };  // NEW — default {200, 400}
  interruptionFadeMs: number;                          // NEW — default 150
  interruptionMaxPerSegment: number;                   // NEW — default 2 (cap on interrupt pairs per segment)
}
```

### Field semantics and ranges

- **`interruptionsEnabled`** — Master switch. When false, the system MUST
  behave as if no interrupt pairs exist (FR-015). Persisted but takes effect
  on the next playback or export without app restart (SC-007).
- **`interruptionOverlapRange.minMs`** — Lower bound for the random overlap
  duration when the parser creates an interrupt pair. Range: `[50, 1000]`.
- **`interruptionOverlapRange.maxMs`** — Upper bound. Range: `[minMs, 1500]`.
- **`interruptionFadeMs`** — Duration of the gain fade applied to the tail
  of the interrupted turn. Range: `[50, 500]`.
- **`interruptionMaxPerSegment`** — Cap on the number of interrupt pairs the
  generator may produce in a single segment, regardless of how many
  opportunities the director listed. Range: `[0, 10]`. Setting to 0 is
  equivalent to `interruptionsEnabled = false` for that segment but does
  not affect already-generated content.

### Validation rules

- All four fields are loaded from `settings.json` with the listed defaults if
  absent (preserves backward compatibility)

---

## Internal helper types (new)

These types live in `src/lib/interruption.ts` (new file) and are not
persisted; they're computed at render time.

```typescript
interface InterruptionPolicy {
  enabled: boolean;
  fadeMs: number;
  effectiveOverlapMs: number;   // computed per pair: min(authored, 0.5 * shorterClipMs)
}

interface ScheduledTurn {
  turnId: string;
  startTimeSec: number;          // absolute time on AudioContext clock
  durationSec: number;
  fadeOutAtSec?: number;         // start time of fade ramp, when applicable
  fadeDurationSec?: number;
}
```

These are constructed by the scheduler from a list of `Turn` plus a
`InterruptionPolicy`, and consumed by the WebAudio playback code.

---

## Migration

No migration is required. All existing conversations and settings files
continue to load and behave identically. The new fields appear only on
content generated after this feature ships.
