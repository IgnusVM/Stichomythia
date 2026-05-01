# Contract: Generation Prompt Extension

**Producer**: `server/services/anthropic.ts` — `generateSegment()` system prompt
**Consumer**: Anthropic Claude API (Opus or Sonnet, per existing model selection)

## Output line format (unchanged base)

The existing per-line format remains:

```
[Person X] (mood): text
```

The existing parser regex `/^\[Person ([A-D])\]\s*\(([^)]+)\):\s*(.+)$/`
in `parseSegmentResponse()` continues to match every line.

## Interrupt pair structural marker

When the AI chooses to author an interruption based on a director-provided
opportunity, it MUST produce two adjacent lines whose text uses em-dash
markers as follows:

- Line N (the interrupted turn) — `text` MUST end with the em-dash character
  `—` (U+2014). The line MUST be written so its meaning is mostly clear from
  what's there; the cut point should leave the listener with something to
  complete in their head.
- Line N+1 (the interrupting turn) — `text` MUST begin with the em-dash
  character `—`, followed by a space, followed by the interrupting beat. The
  beat MUST react to or build on what was cut off in line N.

**Example** (single interrupt pair):

```
[Person A] (thoughtful): The thing I've been wondering is whether we even need to —
[Person B] (sharp): — No, that's the whole point, we absolutely do need to.
```

## Constraints on the AI

The system prompt MUST require the AI to:

- Use the em-dash markers only on adjacent lines that form a true interrupt
  pair. Stray em-dashes elsewhere in dialogue are forbidden.
- Author interruptions only between two different characters (no
  self-interruption).
- Use opportunities only from the director-provided list. Inventing new
  interruptions outside the list is forbidden.
- Limit total interrupt pairs in this segment to
  `interruptionMaxPerSegment`.
- Write the interrupted line so that, if read aloud and cut off at the
  em-dash, it sounds like a complete-enough thought that the listener
  understands the gist.

## Failure modes the parser tolerates

If the AI produces a malformed interrupt attempt — em-dash on one side
only, em-dash between same-character lines, em-dash without a following
turn — the parser MUST treat the affected lines as ordinary turns:

- Strip the em-dash markers from the text (so it's not spoken)
- Apply normal `generatePause()` between them
- Do not set `pauseAfterMs` negative, do not set `fadeOutTailMs`
- Do not error or retry generation

This degrades gracefully: a missed interruption becomes an ordinary pair of
turns rather than broken playback.
