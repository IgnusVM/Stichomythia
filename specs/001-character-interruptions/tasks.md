---

description: "Task list for Character Interruptions feature"
---

# Tasks: Character Interruptions

**Input**: Design documents in `specs/001-character-interruptions/`
**Prerequisites**: spec.md, plan.md (✅), research.md (✅), data-model.md (✅), contracts/ (✅), quickstart.md (✅)

**Tests**: This project has no automated test framework. The verification artifacts are the manual quickstart scenarios, referenced by ID in each user-story phase.

**Organization**: Tasks are grouped by user story. Each story is independently completable and verifiable via its quickstart scenarios.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel — different files, no dependency on incomplete tasks
- **[Story]**: Which user story this task belongs to (US1–US5)
- File paths are repository-relative

## Path Conventions

This is an Electron + React + Node single-codebase project. Relevant trees:

- `src/` — React renderer
- `server/` — forked Node server (Express)
- `electron/` — Electron main + preload + native audio (untouched by this feature)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Create the new file that holds the shared, pure helper functions used by both renderer and server contexts.

- [ ] T001 Create new file `src/lib/interruption.ts` with file-level export comment block describing its role per [data-model.md "Internal helper types"](data-model.md). Leave function bodies as `throw new Error('not implemented')` stubs for now; they're filled in T005.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Schema additions, settings, generation pipeline, and shared helpers — every user story depends on these. Order within the phase: types first, helpers next, then the server-side pipeline pieces.

**⚠️ CRITICAL**: No user story work begins until this phase is complete. The data model changes are additive and must be in place before parser, scheduler, or export code can refer to the new fields.

- [ ] T002 [P] Extend `Turn` interface in `src/types/index.ts`: keep `pauseAfterMs: number` but document in a single-line comment that it MAY be negative (overlap); add optional `fadeOutTailMs?: number`. Keep all other fields unchanged. Do not add validation yet — that lives in T005's helpers and T008's parser.
- [ ] T003 [P] Extend `AppSettings` interface in `server/routes/settings.ts` with: `interruptionsEnabled: boolean`, `interruptionOverlapRange: { minMs: number; maxMs: number }`, `interruptionFadeMs: number`, `interruptionMaxPerSegment: number`. Add matching defaults to `DEFAULT_SETTINGS`: `true`, `{ minMs: 200, maxMs: 400 }`, `150`, `2`. Mirror the type definition into `src/types/index.ts` if a client-side `AppSettings` type already exists there.
- [ ] T004 [P] Extend the `AIDirection` type produced by `server/services/director.ts` (and any consumer-side mirror in `src/types/index.ts`) with optional field `interruptionOpportunities?: string[]`. No behavioral change yet — wire happens in T006.
- [ ] T005 Implement the helper functions in `src/lib/interruption.ts` per [data-model.md](data-model.md) and [contracts/playback-scheduler.md](contracts/playback-scheduler.md):
   - `detectInterruptPair(turnA: Turn, turnB: Turn): boolean` — returns true iff `turnA.text` ends with U+2014, `turnB.text` begins with U+2014, and the two turns have different `characterId`.
   - `computeEffectiveOverlapMs(authoredOverlapMs: number, durationAMs: number, durationBMs: number): number` — returns `min(authoredOverlapMs, 0.5 * min(durationAMs, durationBMs))`.
   - `clampFadeToOverlap(fadeMs: number, effectiveOverlapMs: number): number` — returns `min(fadeMs, effectiveOverlapMs)`.
   - `distinctSpeakerCount(turns: Turn[], speakerForCharacter: (id: string) => string): number` — returns the size of the set of speaker ids covering all turns.
- [ ] T006 [P] Update `server/services/director.ts` `buildAIDirection()` system prompt to produce the new `interruptionOpportunities` field per [contracts/director-output.md](contracts/director-output.md). Constraints: 0–5 entries, each ≤ 200 chars, names two different Person labels, never same character on both sides. Add the parsed array to the returned `AIDirection` object; default to `[]` when the model emits no opportunities.
- [ ] T007 Update `server/services/anthropic.ts` `generateSegment()` system prompt per [contracts/generation-prompt.md](contracts/generation-prompt.md): add a section that lists the segment's `interruptionOpportunities` verbatim, instructs the model on em-dash markers, forbids same-character interrupts, forbids inventing opportunities outside the list, caps total pairs at `min(opportunities.length, settings.interruptionMaxPerSegment)`. Skip the section entirely when `opportunities` is empty/absent.
- [ ] T008 Update `server/services/anthropic.ts` `parseSegmentResponse()` per [contracts/parser.md](contracts/parser.md): after parsing the per-line array, walk adjacent pairs, call `detectInterruptPair()` from T005. For valid pairs, set `pauseAfterMs = -overlapMs` (random integer in `settings.interruptionOverlapRange`), `fadeOutTailMs = settings.interruptionFadeMs`, strip leading em-dash from the interrupting turn's text. For invalid em-dash placements, strip stray em-dashes silently and let `generatePause()` handle the pause as today. Cap to `settings.interruptionMaxPerSegment` valid pairs per response.
- [ ] T009 [P] Add Interruptions settings section to `src/pages/Settings.tsx` per [contracts/settings.md](contracts/settings.md): toggle for `interruptionsEnabled`, two number inputs for overlap range, one number input for fade, one number input for max-per-segment. Include the descriptive paragraph and the conditional single-speaker info note. Wire to existing settings save endpoint. No new endpoint needed.
- [ ] T010 Verify and adjust as needed: `server/routes/settings.ts` PUT handler accepts the new fields and persists them; GET handler returns them in the safe-redacted response. Existing handler shape should already accept them via `...req.body` spread, but confirm.

**Checkpoint**: Foundation ready. Generated conversations now produce interrupt-pair markers in turn data; settings UI exposes controls; helpers exist for renderer and export to consume. Playback and export still ignore the new fields at this point — that's the next two stories' jobs.

---

## Phase 3: User Story 1 — Hear authored interruptions during playback (Priority: P1) 🎯 MVP

**Goal**: Listener can play a generated conversation in-app and hear authored interruptions with overlap and fade across at least two distinct output speakers.

**Independent Test**: Quickstart Scenarios 1, 8, 9. Generate a conversation that produces at least one interrupt pair (Foundational phase made this possible), play it back across at least two physical speakers, confirm by ear that an interruption is audible and sounds authored.

### Implementation for User Story 1

- [ ] T011 [US1] Rewrite `src/components/audio/ConversationPlayer.tsx` to use WebAudio per [contracts/playback-scheduler.md](contracts/playback-scheduler.md). Replace the existing `HTMLAudioElement → onended → setTimeout` chain. New structure: a single `AudioContext` per playback session; for each turn, decode the MP3 to an `AudioBuffer` via `ctx.decodeAudioData`; one `GainNode` per turn; per-character routing via `MediaStreamAudioDestinationNode` feeding hidden `<audio>` elements with `setSinkId(deviceId)` to preserve current per-character speaker assignments.
- [ ] T012 [US1] In the same `ConversationPlayer.tsx`, implement the scheduling loop: walk `turns[]`, compute each `ScheduledTurn.startTimeSec` from `ctx.currentTime` plus the running cursor; for `turns[i-1].pauseAfterMs >= 0`, advance cursor by `prev.duration + pauseAfterMs/1000`; for `turns[i-1].pauseAfterMs < 0`, advance cursor by `prev.duration - effectiveOverlapMs(i-1)/1000`. Use `computeEffectiveOverlapMs()` from T005.
- [ ] T013 [US1] In the same `ConversationPlayer.tsx`, implement gain fades: for any turn where `fadeOutTailMs > 0` and policy is enabled, compute fade duration via `clampFadeToOverlap()` from T005, then schedule `gain.gain.setValueAtTime(1.0, fadeOutAtSec)` followed by `gain.gain.linearRampToValueAtTime(0.0, fadeOutAtSec + fadeDurationSec)`.
- [ ] T014 [US1] In the same `ConversationPlayer.tsx`, handle pause/resume/seek correctly: on pause, call `source.stop()` on every running source and remember the playback offset; on resume, recompute schedule from the current offset; on seek to turn N, cancel all queued sources and re-schedule from N. Ensure no zombie sources are left running.
- [ ] T015 [US1] In the same `ConversationPlayer.tsx`, handle the end-of-conversation case: when the last turn has `pauseAfterMs < 0` and there is no next turn, treat it as a normal turn (no fade, no overlap, play full duration). Emit the same `playback-ended` event the previous implementation emitted.
- [ ] T016 [US1] Verify with **Quickstart Scenario 1**, **Scenario 8** (very short interrupted clip), and **Scenario 9** (interrupted last turn). Document any deviations in [quickstart.md](quickstart.md) at the bottom under a new "Verification log" section before moving on.

**Checkpoint**: User Story 1 fully functional. The user can play a conversation and hear authored interruptions in-app. Export still flattens them — that's User Story 2.

---

## Phase 4: User Story 2 — Interruptions survive export to the final audio file (Priority: P1)

**Goal**: When the user exports a conversation, the exported MP3 contains the same interruptions, in the same positions, with the same audible character as the in-app preview.

**Independent Test**: Quickstart Scenario 1 step 6 (A/B preview vs export) and Scenario 2.

### Implementation for User Story 2

- [ ] T017 [US2] In `server/routes/export.ts`, before the existing concat-list build, add a pass that walks the turns and identifies interrupt pairs (turns where `pauseAfterMs < 0` AND the next turn exists). For each pair, compute `effectiveOverlapMs` using the same formula as `computeEffectiveOverlapMs()` (port the logic to a small server-side helper or duplicate it as a private function inside `export.ts` — this is a server file, can't import the renderer module).
- [ ] T018 [US2] In `server/routes/export.ts`, for each identified pair, run ffmpeg with `acrossfade` per [contracts/export-pipeline.md](contracts/export-pipeline.md) to produce `pair_<i>.mp3` in the export work directory. Use curve `tri` on both sides. Use the existing `settings.ffmpegPath` to locate ffmpeg.
- [ ] T019 [US2] In `server/routes/export.ts`, modify the concat-list builder to substitute the merged pair file in place of both original turns: skip silence file insertion between the pair, advance the loop index past both turns. Preserve all other behavior (numbered copies of non-paired turns, silence files for non-pair gaps, final ffmpeg concat call).
- [ ] T020 [US2] In `server/routes/export.ts`, add per-pair failure handling per [contracts/export-pipeline.md](contracts/export-pipeline.md): if a pair MP3 file is missing or `acrossfade` fails (non-zero exit), log the error and the ffmpeg stderr, then fall through to non-merged concat for that pair (treat the negative `pauseAfterMs` as `100` ms gap). The export as a whole MUST NOT fail because of one bad pair.
- [ ] T021 [US2] Verify with **Quickstart Scenario 1 step 6** (preview vs export A/B comparison) and **Scenario 2** (multiple pairs in one export).

**Checkpoint**: User Stories 1 + 2 complete. Listeners hear interruptions identically in preview and export. This is the headline feature working end-to-end.

---

## Phase 5: User Story 3 — Edit-clear with toast (Priority: P2)

**Goal**: When the user edits an interrupt-pair turn such that the structural marker is removed, the system clears the interrupt linkage and shows a brief notification.

**Independent Test**: Quickstart Scenarios 3, 4.

### Implementation for User Story 3

- [ ] T022 [US3] In `server/routes/turns.ts` (the turn update handler — PUT route for editing a turn), after the existing persist step, check if the affected turn or its previous-sibling turn currently has `pauseAfterMs < 0`. If yes, re-run em-dash pair detection on the affected pair(s) per [contracts/turn-update.md](contracts/turn-update.md) using `detectInterruptPair()`-equivalent logic (server-side; duplicate or share via small shared module).
- [ ] T023 [US3] In `server/routes/turns.ts`, when a re-evaluation finds an invalidated pair: recompute `pauseAfterMs` via the existing `generatePause()` from `server/routes/generation.ts`, clear `fadeOutTailMs`, strip stray em-dashes from the text fields on either side of the pair before re-persisting.
- [ ] T024 [US3] In `server/routes/turns.ts`, after invalidation, emit a server-sent event payload of shape `{ type: 'turn-updated', turnId, segmentId, removedInterruption: true }` on the existing event bus (or response payload, depending on the current pattern — read existing route's event-emit code for the pattern). For non-invalidating edits, emit the same event with `removedInterruption: false` (or omit the field).
- [ ] T025 [US3] In `src/contexts/AudioEngineContext.tsx`, subscribe to `turn-updated` events. When `removedInterruption === true`, show a toast with text *"Interruption removed — both turns now play in full"* using whatever toast primitive the codebase already uses (check `src/components/ui/` for a Toast component; if none exists, use a minimal one). Auto-dismiss after 4 seconds.
- [ ] T026 [US3] Verify with **Quickstart Scenario 3** (text edit removes em-dash) and **Scenario 4** (character reassignment causes same-character pair).

**Checkpoint**: Edits no longer silently break interrupt playback. The feature is robust to author iteration.

---

## Phase 6: User Story 4 — Director-driven density (Priority: P2)

**Goal**: Interrupt density in tense segments is meaningfully higher than in calm segments. No interruptions appear in clearly calm segments.

**Independent Test**: Quickstart Scenario 2.

This phase is mostly verification because the wiring was done in Phase 2 (T006, T007). The job here is to validate the prompts produce the right behavior and tune them if not.

### Implementation for User Story 4

- [ ] T027 [US4] In `server/services/director.ts`, audit the `buildAIDirection()` prompt added in T006. Specifically: ensure it instructs the model to *return zero opportunities* in calm/agreeable segments and to *return some* (1–5) in tense segments. Run an exploratory generation with a clearly calm seed prompt and confirm zero opportunities; run one with a clearly tense seed and confirm some opportunities. Adjust prompt language if needed.
- [ ] T028 [US4] In `server/services/anthropic.ts`, audit the `generateSegment()` prompt added in T007. Specifically: confirm that when `interruptionOpportunities` is empty, the prompt OMITS the entire interruption section (not just "list of zero items"). Empty-list signal must produce zero interrupt pairs in output.
- [ ] T029 [US4] Verify with **Quickstart Scenario 2** (20-segment alternating arc, 4× density requirement). If density falls short of the spec's 4× threshold or any calm segment shows interrupts, return to T027/T028 and tighten the prompts.

**Checkpoint**: Interruptions feel authored and character-driven, not random.

---

## Phase 7: User Story 5 — Single-speaker disable (Priority: P3)

**Goal**: When all characters are routed to one physical speaker, the system renders sequentially even if data contains interrupt-pair markers.

**Independent Test**: Quickstart Scenario 5.

### Implementation for User Story 5

- [ ] T030 [US5] In `src/components/audio/ConversationPlayer.tsx`, before scheduling, compute `policy.enabled` using `distinctSpeakerCount()` from T005 AND `settings.interruptionsEnabled`. When `policy.enabled === false`, the scheduler treats every `pauseAfterMs < 0` as `pauseAfterMs = 100` and ignores `fadeOutTailMs`. Implement this as a one-liner branch in the scheduling loop from T012.
- [ ] T031 [US5] In `server/routes/export.ts`, before the pre-merge pass added in T017, compute the same `distinctSpeakerCount`-based `policy.enabled`. When disabled, skip pre-merge entirely; treat negative `pauseAfterMs` as `100` ms in the existing concat builder (cap at zero or insert a small silence file accordingly).
- [ ] T032 [US5] In `src/pages/Settings.tsx`, when the user's character-to-speaker map currently has only one distinct device, render the informational note from [contracts/settings.md](contracts/settings.md) below the toggle. Read the speaker map from existing context (it's already used for playback routing).
- [ ] T033 [US5] Verify with **Quickstart Scenario 5** (single-speaker mode).

**Checkpoint**: All five user stories done. Feature is complete per spec.

---

## Phase 8: Polish & Cross-Cutting Concerns

- [ ] T034 [P] Verify with **Quickstart Scenario 6** (pre-feature conversation parity). Confirm a conversation generated on the previous version plays and exports identically on the new build.
- [ ] T035 [P] Verify with **Quickstart Scenario 7** (settings toggle takes effect immediately, no restart).
- [ ] T036 [P] Verify with **Quickstart Scenario 10** (`npm run electron:build` smoke test on a clean Windows install).
- [ ] T037 Bump `package.json` version to `3.1.0` (minor bump — this is a new feature, not a bugfix).
- [ ] T038 Final integration smoke test: run `npm run electron:dev`, run through Quickstart Scenarios 1, 3, 5 in one session to ensure no regressions across stories.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 Setup**: No dependencies. Quick.
- **Phase 2 Foundational**: Depends on Phase 1. **BLOCKS all user stories**. Inside Phase 2, T002–T004 are all parallelizable; T005 depends on T002–T004 (it imports the new types); T006 is parallelizable with T002–T005; T007 and T008 depend on T002 and T003; T009 depends on T003; T010 depends on T003. In practice, T002/T003/T004 in parallel, then T005/T006 in parallel, then T007 and T008 (sequential — same file), T009 and T010 in parallel.
- **Phase 3 (US1)**: Depends on Phase 2 complete. All US1 tasks edit the same file (`ConversationPlayer.tsx`) and are sequential.
- **Phase 4 (US2)**: Depends on Phase 2 complete. Independent of Phase 3 — could run in parallel by a different developer. All US2 tasks edit `server/routes/export.ts` and are sequential.
- **Phase 5 (US3)**: Depends on Phase 2 complete. Independent of Phase 3 and Phase 4 — could run in parallel. T022–T024 sequential (same file). T025 in a different file, can parallelize with T024.
- **Phase 6 (US4)**: Depends on Phase 2 complete. T027 and T028 edit different files, can parallelize. T029 is verification, sequential after both.
- **Phase 7 (US5)**: Depends on Phase 3 (T030 modifies the scheduler from T012) AND Phase 4 (T031 modifies the export pre-merge from T017). T032 is independent of those.
- **Phase 8**: Depends on all desired stories complete.

### Parallel Opportunities

Within Phase 2: **T002, T003, T004 in parallel**; then **T005 and T006 in parallel**; then **T007 and T008 sequential** (same file); then **T009 and T010 in parallel**.

Across phases (with multiple developers): once Phase 2 is done, **Phase 3 (US1), Phase 4 (US2), Phase 5 (US3), Phase 6 (US4)** can all proceed in parallel by different developers, since they touch separate files. Phase 7 must wait for Phase 3 and Phase 4 because it modifies code those phases produce.

---

## Parallel Example: Phase 2 Foundational

```text
Wave 1 (parallel):
  T002 — Turn type extension in src/types/index.ts
  T003 — AppSettings extension in server/routes/settings.ts (+ mirror in src/types/index.ts)
  T004 — AIDirection extension

Wave 2 (parallel):
  T005 — interruption.ts helpers (depends on T002-T004 types)
  T006 — Director prompt update

Wave 3 (sequential, same file):
  T007 — generateSegment system prompt
  T008 — parseSegmentResponse em-dash detection

Wave 4 (parallel):
  T009 — Settings UI section
  T010 — Settings route validation
```

---

## Implementation Strategy

### MVP First (User Story 1 only)

1. Phase 1 Setup
2. Phase 2 Foundational (CRITICAL — unlocks all stories; produces interrupt-pair data)
3. Phase 3 User Story 1 (WebAudio playback)
4. **STOP and VALIDATE** — confirm the user can hear authored interruptions in-app
5. Demo to user

The MVP at this point is incomplete in one important way: the export still flattens interruptions. But the headline experience (the listener hears authored interruptions) works.

### Incremental Delivery (recommended)

1. Setup + Foundational → Foundation ready
2. Add US1 → Demo MVP (preview-only interruptions)
3. Add US2 → Demo full preview-and-export feature
4. Add US3 → Demo edit safety
5. Add US4 → Validate density quality (mostly verification, may surface prompt tuning)
6. Add US5 → Polish edge case
7. Final polish + version bump + build smoke test

### Single-developer note

This is a single-developer project. The "parallel" annotations above describe which tasks could be parallelized; in practice they're a hint about which tasks are independent enough to be context-switched safely. Sequential execution is fine.

---

## Notes

- This project has no automated test framework. "Verify" tasks reference Quickstart Scenarios — they are the verification of record.
- The em-dash character is U+2014 throughout. Do NOT use the en-dash (U+2013) — TTS prosody and parser detection both rely on the specific character.
- Server and renderer cannot share the `src/lib/interruption.ts` module directly across the process boundary; if a server route needs the same logic, duplicate it in a small `server/lib/` helper or extract a shared package. Don't import `src/lib/*` from `server/`.
- Avoid: vague tasks, cross-story dependencies that aren't necessary, edits that span more files than the contract calls for.
- Commit after each task or logical group. Bump patch version per the constitution's Development Workflow rule.
