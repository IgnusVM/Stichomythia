# Contract: Renderer Playback Scheduler

**Producer**: `src/components/audio/ConversationPlayer.tsx` (rewritten)
**Consumer**: User listening in-app

## Inputs

- `turns: Turn[]` — the rendered turns of a conversation, with audio files
  loaded.
- `policy: InterruptionPolicy` — computed once per playback session from
  current settings + per-character output device map.

## Single-speaker disable

Before scheduling, compute:

```
distinctOutputDevices = new Set(turns.map(t => speakerForCharacter(t.characterId))).size
```

If `distinctOutputDevices === 1` OR `settings.interruptionsEnabled === false`,
`policy.enabled` is false. In that case, every `pauseAfterMs < 0` is treated as
`pauseAfterMs = 100` and `fadeOutTailMs` is ignored. The rest of the
scheduling proceeds normally — turns play sequentially with small gaps.

## Effective overlap calculation

For every turn `i` where `turns[i].pauseAfterMs < 0` AND `policy.enabled`:

```
authoredOverlapMs = -turns[i].pauseAfterMs
shorterDurationMs = min(turns[i].audioDurationMs, turns[i+1].audioDurationMs)
effectiveOverlapMs = min(authoredOverlapMs, 0.5 * shorterDurationMs)
```

The scheduler MUST use `effectiveOverlapMs`, not the raw authored value, for
both timing computation and for the cap on `fadeOutTailMs` (the fade MUST NOT
exceed `effectiveOverlapMs`).

## Scheduling

For each turn in order, compute its absolute start time on the AudioContext
clock:

```
scheduledTurns[0].startTimeSec = ctx.currentTime + leadInSec  (small lead, e.g. 0.1)

for i in 1..n-1:
  prev = scheduledTurns[i-1]
  if turns[i-1].pauseAfterMs < 0 AND policy.enabled:
    overlap = effectiveOverlapMs(i-1) / 1000
    scheduledTurns[i].startTimeSec = prev.startTimeSec + prev.durationSec - overlap
  else:
    pause = max(0, turns[i-1].pauseAfterMs) / 1000
    scheduledTurns[i].startTimeSec = prev.startTimeSec + prev.durationSec + pause
```

For each turn `i` whose `turns[i].fadeOutTailMs > 0` AND `policy.enabled`:

```
fadeDuration = min(turns[i].fadeOutTailMs / 1000, effectiveOverlapMs(i) / 1000)
scheduledTurns[i].fadeOutAtSec = scheduledTurns[i].startTimeSec + scheduledTurns[i].durationSec - fadeDuration
scheduledTurns[i].fadeDurationSec = fadeDuration
```

## WebAudio realization

For each `ScheduledTurn`:

1. Create an `AudioBufferSourceNode` from the decoded buffer.
2. Create a `GainNode` for that turn.
3. Connect: `source → gain → characterDestinationFor(turn.characterId) → audioElement (with setSinkId for that character's speaker)`.
4. Schedule `source.start(scheduledTurns[i].startTimeSec)`.
5. If `fadeOutAtSec` is set:
   - `gain.gain.setValueAtTime(1.0, fadeOutAtSec)`
   - `gain.gain.linearRampToValueAtTime(0.0, fadeOutAtSec + fadeDurationSec)`

## Per-character output device routing

The scheduler MUST preserve per-character routing equivalent to today's
`audio.setSinkId(deviceId)` call at
[ConversationPlayer.tsx:74](../../../src/components/audio/ConversationPlayer.tsx).
Implementation: a hidden `<audio>` element per character, fed by a
`MediaStreamAudioDestinationNode` per character, with `setSinkId` set to that
character's assigned speaker. Each turn's gain node connects to its character's
destination.

## Lifecycle

- On user pause: stop all currently-running sources, retain the schedule,
  resume from the position by re-decoding and re-scheduling from the
  current point.
- On end of last turn: emit a `playback-ended` event the same way the current
  player does.
- On user seek to turn N: cancel all scheduled sources, re-schedule from N.
- On error decoding any turn: skip that turn, continue with the next.

## Failure modes

- Missing audio file for an interrupted turn: skip that turn entirely (its
  successor plays normally with no overlap to nothing).
- AudioContext start blocked by browser autoplay policy: prompt the user the
  same way the current player does (this is unchanged).
