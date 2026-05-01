# Phase 0 Research: Character Interruptions

This document records the design decisions that resolve every open question
implicit in the spec. Each decision lists what was chosen, why, and what was
rejected.

## R1. How is the interrupted-speech audio actually truncated?

**Decision**: The truncation is **authored into the text**, not cut from the
audio. The interrupted line's text ends with an em-dash (`—`). TTS renders
exactly that text. The resulting audio clip is naturally short and ends with
the prosody of an unfinished thought.

**Rationale**: OpenAI TTS does not expose word- or character-level timestamps
in its audio response, so we cannot reliably slice an audio buffer at "where
the cut happens" in a precise way. Authoring the cut into the text turns this
constraint into a feature: the AI is forced to write lines whose meaning
survives truncation, which is exactly what makes an interruption feel natural
in fiction. As a side benefit, em-dashes are a real prosody cue both TTS
backends already respond to.

**Alternatives considered**:

- **Cut the audio at an estimated character-position-to-time ratio**: would
  produce mid-syllable cuts on roughly half of all interruptions because TTS
  pronunciation timing is non-linear with character count.
- **Use silence-detection (ffmpeg `silencedetect`) to find the nearest pause
  to a target time**: extra render pass per interrupt, no guarantee the silence
  is where the dialogue calls for the cut, doesn't survive in the renderer.
- **Render two TTS versions (full + truncated) and use the truncated one**:
  doubles TTS cost on interrupt pairs and gains us nothing over just rendering
  the truncated text once.

## R2. How is preview audio overlapped in the renderer?

**Decision**: Replace the existing `HTMLAudioElement → onended → setTimeout`
playback chain in `ConversationPlayer.tsx` with a WebAudio scheduler that
decodes each turn's MP3 to an `AudioBuffer` and schedules sources via
`AudioContext.currentTime`. Each turn gets its own `GainNode`. For interrupted
turns, we schedule a `linearRampToValueAtTime` on the gain to fade the tail
over a configurable window (default 150 ms) and start the next turn's source
at `currentTime + (interruptedTurnDuration + pauseAfterMs/1000)` where
`pauseAfterMs` is negative for an interrupt pair.

**Rationale**: HTMLAudioElement cannot precisely overlap two clips or apply
sample-accurate fades. WebAudio is in the constitution's allowed scope for
"short-lived playback effects." The scheduler is straightforward — each turn
has a deterministic absolute start time once its predecessor's duration is
known, and the AudioContext clock is monotonic.

**Alternatives considered**:

- **Keep HTMLAudioElement, manage two simultaneous Audio elements with manual
  volume animation**: HTMLAudioElement's `volume` property is not a
  ramp-able audio param; animating it from setInterval produces audible
  zipper noise. Also fails to give us sample-accurate overlap timing.
- **Pipe dialogue through the existing native audio path**: per the constitution's
  allowance for renderer-side WebAudio in non-realtime preview contexts, this
  is unnecessary complexity for the preview-only use case. The native path is
  for multi-speaker realtime delivery; a single user previewing a conversation
  in front of their PC does not need that.

## R3. How is per-character output device routing preserved?

**Decision**: `setSinkId` is called on a destination `MediaStreamAudioDestinationNode`
attached to a hidden `<audio>` element per character. The WebAudio graph
routes each character's gain into their character-specific destination,
which feeds an `<audio>` element with the right sink. This preserves the
existing per-character physical-speaker mapping that
`ConversationPlayer.tsx:74` currently uses.

**Rationale**: WebAudio's `AudioContext.destination` does not directly
support `setSinkId` with full reliability across Electron versions, but the
"MediaStreamAudioDestinationNode → hidden audio element with `setSinkId`"
pattern works in Chromium 110+ which is bundled with Electron 41. This
preserves the user's character-to-speaker assignments without any UI change.

**Alternatives considered**:

- **One AudioContext per character with `setSinkId(deviceId)` on the
  context's destination directly**: API support is inconsistent across
  Electron 41 builds; the MediaStreamDestination + audio-element pattern is
  the documented workaround.
- **Pipe dialogue through the native audio path with `openSpeaker` per
  character**: see R2 — overkill for preview.

## R4. How is exported audio overlapped?

**Decision**: Two-pass export. The existing concat-demuxer pipeline in
`server/routes/export.ts` is preserved; before it runs, each interrupt pair
is pre-merged into a single MP3 by an `acrossfade` filter with the same
duration as the playback overlap. The merged MP3 takes the place of both
turns in the concat list, with no silence between them.

**Rationale**: ffmpeg's concat demuxer has no overlap support. `acrossfade`
is the standard filter for crossfading two adjacent clips — it produces
exactly the curve we want (triangular by default, configurable to other
shapes). Pre-merging keeps the rest of the export pipeline untouched and
makes the interrupt-merging step independently inspectable: a developer
debugging an export issue can listen to the per-pair temp file directly.

**Alternatives considered**:

- **Single-pass complex filtergraph (`adelay` + `amix`)**: works but is
  significantly harder to debug, and any error in one pair's delay
  computation cascades into the entire mix being misaligned.
- **Render the entire export client-side via WebAudio offline**: would
  duplicate the playback path and avoid the server entirely, but the
  existing export already produces a high-quality LAME MP3 with predictable
  bitrate, and changing that is out of scope.

## R5. How does the director communicate interruption opportunities?

**Decision**: Extend the existing `AIDirection` schema produced by
`server/services/director.ts` with a new optional field
`interruptionOpportunities: string[]`. Each entry is a short prose hint like
"B should cut off A when A brings up the budget" or "C interrupts agreeably
when D mentions her sister." The opportunities are passed into the per-segment
generator system prompt verbatim, alongside the existing emotional landscape
and topic guidance. The generator decides whether to use any given
opportunity, but is forbidden from inventing interruptions outside this list.

**Rationale**: This is the minimum viable hook into the existing director
pipeline. It reuses the existing prompt-cache strategy (the director already
runs every 3 segments using cached system context). The opportunities are
prose because the director is already producing prose for emotional landscape
— forcing structured JSON would require reworking the director's prompt
substantially. The "generator may use any subset, may not invent new ones"
contract is what makes this director-driven rather than random.

**Alternatives considered**:

- **Director outputs structured `{turn_index, interrupter_character_id,
  reason}` objects**: more precise but the director doesn't see the segment
  it's directing yet (it produces guidance ahead of generation), so it can't
  reference turn indices. Prose hints sidestep this entirely.
- **No director involvement; the generator decides per-turn with a random
  chance**: violates Constitution Principle IV.

## R6. How does the parser detect an interrupt pair?

**Decision**: In `parseSegmentResponse()` in `server/services/anthropic.ts`,
after parsing the per-turn array, walk pairs of adjacent turns. If turn N's
text ends with `—` (em-dash, U+2014), and turn N+1's text begins with `—`,
and the two turns are by different characters, mark the pair as an
interruption: turn N gets `pauseAfterMs = -overlapMs` (random in the
configured range) and `fadeOutTailMs = settings.interruptionFadeMs`. Strip
the leading em-dash from turn N+1's text before TTS, since it's a structural
marker, not something to be spoken; preserve the trailing em-dash on turn N
because TTS uses it for prosody.

**Rationale**: Em-dash markers are uniquely visible in plain text, survive
storage as JSON without escaping concerns, and are what the AI is instructed
to produce. The "different characters" check enforces FR-004 (no
self-interruption in v1) at the parser level so it cannot leak through.

**Alternatives considered**:

- **Explicit XML/JSON tags in the AI output**: more robust but requires
  changing the existing parser's regex line-by-line approach, which has been
  stable. Em-dash detection is a 5-line addition.
- **Have the AI output structured metadata alongside text**: would change
  the prompt format meaningfully and break the existing simple
  `[Person X] (mood): text` line format.

## R7. How does the system handle edits that break an interrupt pair?

**Decision**: On the server, the turn update handler in
`server/routes/turns.ts` re-runs the em-dash pair detection over the
affected pair after every text edit to a turn marked
`isInterruptedByNext` or to its successor. If the structural markers no
longer hold (em-dashes missing, characters now match, etc.), the handler
clears `pauseAfterMs` back to a positive value computed by the existing
`generatePause()`, clears `fadeOutTailMs`, and emits a server-side event
that the renderer picks up to show the toast. The toast is shown by
`AudioEngineContext.tsx` listening to a new `turn-updated` event that
includes a `removedInterruption: boolean` flag.

**Rationale**: Server-side detection ensures the cleared state is canonical
and survives a renderer reload. Toast triggering via an event channel
keeps the UI loosely coupled to the server detection logic.

**Alternatives considered**:

- **Detect on the client when the editor saves**: works but the canonical
  conversation state lives on the server; a client-side detection that's
  out of sync with server detection would create bugs.
- **Re-run the parser on the entire segment after every edit**: more
  thorough but unnecessary; only the affected pair can change state.

## R8. How is the single-speaker disable enforced?

**Decision**: Both the playback scheduler and the export pipeline compute
`distinctOutputDevices = new Set(turns.map(t => speakerForCharacter(t.characterId))).size`
once per session. If that set has size 1, every `pauseAfterMs < 0` is treated
as `pauseAfterMs = 100` (small positive gap), `fadeOutTailMs` is ignored,
and the interrupt-merge step in export is skipped. No data is mutated — this
is purely a render-time policy.

**Rationale**: Per FR-010, this is a render policy not a data policy. The
underlying interrupt markers stay intact so that if the user later assigns
characters to different speakers, the interruptions render again on the next
playback or export — no regeneration required.

**Alternatives considered**:

- **Mutate `pauseAfterMs` in the persisted turn data when single-speaker
  mode is active**: would force regeneration of audio when the user changes
  speaker assignments, violates the pre-feature-conversation invariant
  (FR-012) for any user who happens to single-speaker their setup.

## R9. How do we cap overlap duration for very short clips?

**Decision**: At schedule time (both playback and export), compute the
effective overlap as `min(authoredOverlapMs, 0.5 * shorterClipDurationMs)`.
If the effective overlap differs from the authored overlap, the playback
scheduler logs it once at debug level; no user-visible change.

**Rationale**: FR-013 requires this guardrail. Doing it at schedule time
rather than authoring time means the authored value can stay stable across
clips of different durations (e.g. if the user re-renders a turn at a
different speed setting and it gets shorter).

**Alternatives considered**:

- **Cap at authoring time**: the cap would change every time a clip's
  duration changes, leading to confusing data.
- **Reject author overlaps that would exceed the cap**: rejects valid
  interrupt pairs purely because of TTS-rendered duration; bad UX.

## R10. What about Edge TTS?

**Decision**: Treat Edge TTS identically to OpenAI TTS for v1 — same em-dash
authoring, same renderer-side scheduling, same export merging. No use of
Edge TTS's word-boundary events for now.

**Rationale**: The em-dash + scheduler approach works regardless of TTS
backend because it doesn't rely on word-level timing. Adding Edge-specific
word-boundary handling would gate higher-quality interrupt timing behind a
TTS backend choice, which complicates the UX without clear benefit. If we
later want sample-accurate cuts for Edge users, we can add a refinement
step that uses word boundaries to nudge the overlap onset — strictly an
enhancement, not a v1 requirement.

**Alternatives considered**:

- **Edge-only interruptions, OpenAI users get a degraded mode**: hard no;
  the spec explicitly requires OpenAI parity.
- **Edge gets word-accurate timing, OpenAI gets character-estimated
  timing**: introduces backend-specific code paths in playback and export
  for marginal quality gain. Defer.
