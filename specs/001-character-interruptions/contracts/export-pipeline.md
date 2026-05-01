# Contract: Export Pipeline Extension

**Producer**: `server/routes/export.ts`
**Consumer**: User exporting a finished conversation

## Existing pipeline (preserved)

The existing two-step export remains:

1. Copy turn MP3s to a numbered sequence in the export work directory.
2. Build a concat demuxer list, optionally inserting silence files for
   `pauseAfterMs > 0`, and run ffmpeg concat → final MP3.

## Added pre-step: pre-merge interrupt pairs

Before step 1, walk the turns in order. For each turn `i` where
`turn[i].pauseAfterMs < 0` AND `turn[i+1]` exists AND export-time policy
permits interruptions (see "Single-speaker disable" below):

1. Compute `effectiveOverlapMs` per the same formula as the playback
   scheduler in [playback-scheduler.md](./playback-scheduler.md).
2. Compute `fadeMs = min(turn[i].fadeOutTailMs ?? 0, effectiveOverlapMs)`.
3. Run ffmpeg with `acrossfade` to merge the two MP3s into a single MP3:

   ```
   ffmpeg -i {turn_i.mp3} -i {turn_i+1.mp3} \
     -filter_complex "[0][1]acrossfade=d={effectiveOverlapMs/1000}:c1=tri:c2=tri" \
     -c:a libmp3lame -q:a 2 \
     {workdir}/pair_{i}.mp3
   ```

4. In the rest of the export pipeline, treat the merged file as a single
   sequence entry, replacing both turns. Do not insert a silence file
   between them.

## Single-speaker disable (export side)

Export computes `distinctOutputDevices` the same way the playback scheduler
does, except using the speaker assignments persisted with the conversation.
If the count is 1 OR `settings.interruptionsEnabled === false`, the pre-merge
step is skipped entirely. All turns participate in the existing concat
pipeline as if no interrupt markers existed (treating negative
`pauseAfterMs` as 100 ms gap).

## Output guarantee

The exported MP3 MUST be audibly identical to what a user heard in in-app
playback for the same conversation under the same effective settings. The
two pipelines compute `effectiveOverlapMs` and `fadeMs` from the same inputs
using the same formulas; this is the single source of correctness for SC-002.

## Failure modes

- Missing audio file for either turn in a pair: log, skip the pre-merge for
  that pair, fall through to ordinary concat with positive pause.
- ffmpeg `acrossfade` failure: log the ffmpeg stderr, skip the pre-merge for
  that pair, fall through to ordinary concat with positive pause. Do not
  fail the entire export.
