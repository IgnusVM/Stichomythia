# Quickstart: Character Interruptions

This document is the manual verification script. Run through these scenarios
after `/speckit-implement` to confirm the feature meets the spec's success
criteria. No automated test suite exists for this project — these manual
scenarios are the verification of record.

## Prerequisites

- A clean install of the latest Stichomythia build with this feature included.
- An Anthropic API key entered in Settings.
- An OpenAI API key entered in Settings (TTS provider set to OpenAI).
- At least two physical Bluetooth speakers paired and assigned to two
  different characters in a test conversation.

## Scenario 1 — End-to-end happy path (covers SC-001, SC-002)

1. Open Settings → Interruptions, confirm "Enable interruptions" is on.
2. Create or open a conversation with at least four characters, each routed
   to a distinct output speaker.
3. Generate at least 10 segments. Provide a prompt that encourages
   disagreement (e.g., "the four of you are debating whether the ending of
   the novel was earned").
4. Open the conversation player and press Play.
5. **Expected**: at least one interruption is audible — one character cuts off
   another with brief overlap, the cut-off line ends mid-thought, and the
   interrupter's first words react to what was being said.
6. Export the conversation. Open the exported MP3 in a third-party audio
   player (e.g., VLC, Foobar2000).
7. **Expected**: the same interruption is present at the same point in the
   exported file with the same audible character.

## Scenario 2 — Director-driven density (covers SC-003)

1. Generate a 20-segment conversation with a clearly varied emotional arc:
   alternate between calm topics (e.g., "what you each cooked last night")
   and tense topics (e.g., "who's responsible for the failed launch").
2. After generation, inspect each segment's persisted `directorInput` and the
   resulting turns. Count interrupt pairs per segment.
3. **Expected**: tense segments contain at least 4× as many interrupt pairs
   as calm segments. At least one calm segment contains zero.

## Scenario 3 — Edit clears interruption (covers SC-004, FR-008)

1. Open a conversation containing at least one interrupt pair.
2. Open the editor for the interrupted turn.
3. Edit the text to end with a period instead of an em-dash. Save.
4. **Expected**: within 2 seconds, a toast appears reading
   *"Interruption removed — both turns now play in full"*.
5. Press Play. **Expected**: the formerly-interrupted pair plays sequentially
   with no overlap.
6. Re-open the same turn's text and add an em-dash back at the end. Save.
7. **Expected**: no toast appears (the pair was already cleared and re-adding
   a marker on one side does not re-create an interrupt — that requires
   regeneration).

## Scenario 4 — Same-character interruption rejected (covers FR-004)

1. Open a conversation containing at least one interrupt pair.
2. Open the editor for the interrupting turn.
3. Change its character assignment to match the interrupted turn's character.
   Save.
4. **Expected**: a toast appears (same as Scenario 3, step 4) and playback
   for that pair is now sequential.

## Scenario 5 — Single-speaker disable (covers SC-005, FR-010)

1. Open a conversation containing at least one interrupt pair.
2. Reassign every character to the same physical output speaker.
3. Press Play.
4. **Expected**: all turns play sequentially with small gaps; no overlap is
   audible. No regeneration occurred.
5. Export the conversation.
6. **Expected**: exported file has no overlap. The interrupt-pair markers in
   the underlying data are unchanged (verify by inspecting the JSON).
7. Reassign one character to a different speaker. Press Play again.
8. **Expected**: interruptions are audible again. No regeneration occurred.

## Scenario 6 — Pre-feature conversation unchanged (covers SC-006, FR-012)

1. Before installing this build, on the previous version, generate a
   conversation, play it back, and export it. Save the exported MP3 and a
   recording of the in-app playback for reference.
2. Install the new build with this feature.
3. Open the same conversation.
4. Play it back.
5. **Expected**: bit-identical (or imperceptibly different) audio compared to
   the pre-install reference recording.
6. Export it.
7. **Expected**: bit-identical (or imperceptibly different) MP3 compared to
   the pre-install reference export.

## Scenario 7 — Toggle takes effect immediately (covers SC-007, FR-015)

1. With a conversation containing audible interruptions playing, pause
   playback.
2. Open Settings → Interruptions, toggle "Enable interruptions" off, save,
   close Settings.
3. Resume playback (do not restart the app, do not reload the conversation).
4. **Expected**: subsequent turns in the same conversation play sequentially
   with no overlap. Pre-existing interrupt pair markers in the underlying
   data are untouched.
5. Toggle the setting back on. Replay from the start.
6. **Expected**: interruptions are audible again.

## Scenario 8 — Edge: very short interrupted turn (covers FR-013)

1. Manually construct or generate a conversation in which the interrupted
   turn's audio is under 1 second (e.g., a single short word: "Yes —").
2. Play it back.
3. **Expected**: the interruption still occurs but the overlap is shortened
   (capped at half the shorter clip's duration). The listener can clearly
   hear the interrupted word before the interrupter cuts in.

## Scenario 9 — Edge: interrupted last turn (covers edge case in spec)

1. Manually construct or generate a conversation whose last turn is marked
   as interrupted (no following turn exists).
2. Play it back.
3. **Expected**: the last turn plays in full with no fade and no overlap.
   No errors logged.

## Scenario 10 — Build smoke test (covers Constitution V)

1. Run `npm run electron:build`.
2. **Expected**: build succeeds. A `Stichomythia Setup x.y.z.exe` is produced
   in `release/`.
3. Install the produced installer on a clean Windows machine (or a fresh
   Windows VM).
4. Launch. Enter API keys in Settings.
5. **Expected**: app launches and reaches a usable state with no additional
   manual steps. The Interruptions section appears in Settings.
