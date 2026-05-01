# Implementation Plan: Character Interruptions

**Feature Directory**: `specs/001-character-interruptions/`
**Date**: 2026-04-25
**Spec**: [spec.md](./spec.md)

## Summary

Add authored, audio-overlapping interruptions between characters. The dialogue
director identifies opportunities; the generator produces interrupt pairs whose
text is shaped to be cut off (trailing em-dash on the interrupted line, leading
em-dash on the interrupter). OpenAI/Edge TTS render the truncated text as-is —
no audio surgery. At preview time, a WebAudio scheduler in the renderer starts
the interrupting clip a few hundred ms before the interrupted clip ends and
ramps the interrupted clip's gain to zero across a short fade. At export time,
ffmpeg merges each interrupt pair with `acrossfade` before the existing concat
pass runs, producing audio identical to the preview.

## Technical Context

**Language/Version**: TypeScript ~6.0 (target ES2022)
**Primary Dependencies**: Electron 41, React 19, Express 5, Anthropic SDK 0.90,
audify 1.10, ffmpeg (external binary, user-configurable path)
**Storage**: JSON files on local disk under user data dir (conversations,
characters, settings)
**Testing**: No project test framework is currently configured. Verification
for this feature will be done via the manual quickstart scenarios in
[quickstart.md](./quickstart.md) and the existing `npm run electron:build`
smoke test.
**Target Platform**: Windows 10/11 64-bit desktop (Electron NSIS installer)
**Project Type**: Desktop app (Electron main + renderer + forked Node server +
per-speaker audio worker threads)
**Performance Goals**: Interruption overlap timing accuracy within ±50 ms of
the authored cut point; export render time per interrupt pair ≤ 1.0× the sum
of the two clips' durations (i.e. the acrossfade pass should not dominate
export wall clock)
**Constraints**: Must work with OpenAI TTS (no word-level timing API
available); must work with Edge TTS (different audio path); must reproduce
preview audio bit-equivalent in export; must leave pre-feature conversations
unchanged (FR-012)
**Scale/Scope**: Single-user desktop app; conversations typically 100–500
turns; expected interrupt pairs per conversation: 5–25; no concurrency
beyond a single user playing back or exporting one conversation at a time

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Evaluated against [.specify/memory/constitution.md](../../.specify/memory/constitution.md) v1.0.0.

| Principle | Status | Notes |
|---|---|---|
| **I. Native-First Realtime Audio** | ✅ PASS | The constitution explicitly permits Web Audio in the renderer for "short-lived playback effects (e.g. interruption fades during preview)". Export uses ffmpeg (non-realtime, server-side) which is unaffected. Native audio paths and per-speaker workers are untouched. |
| **II. Bring-Your-Own-Key** | ✅ PASS | No new API integrations. Reuses existing user-configured Anthropic and OpenAI/Edge TTS keys. |
| **III. Per-Speaker Failure Isolation** | ✅ PASS | This feature does not modify the realtime native-audio pump or worker model. Preview overlap happens in the renderer's WebAudio context, which is isolated per-AudioContext and not in the realtime delivery path. |
| **IV. Director-Driven Generation** | ✅ PASS | FR-002 mandates that interrupt pair generation is gated on the existing director's per-segment opportunities. No per-turn random sprinkle. |
| **V. One Installer, Zero Post-Install Steps** | ✅ PASS | No new external binaries, no new native modules, no new install-time configuration. Existing `npm run electron:build` continues to produce the single NSIS installer. |

**All gates pass.** No constitutional amendment required. No entries in
Complexity Tracking.

## Project Structure

### Documentation (this feature)

```text
specs/001-character-interruptions/
├── plan.md              # This file
├── spec.md              # Feature spec (already written)
├── research.md          # Phase 0 output — design decisions and alternatives
├── data-model.md        # Phase 1 output — Turn/Segment schema additions, director output shape
├── quickstart.md        # Phase 1 output — manual verification scenarios
├── contracts/           # Phase 1 output — internal interface contracts
│   ├── director-output.md
│   ├── generation-prompt.md
│   ├── parser.md
│   ├── pause-policy.md
│   ├── playback-scheduler.md
│   ├── export-pipeline.md
│   └── settings.md
├── checklists/
│   └── requirements.md  # Spec quality checklist (already written)
└── tasks.md             # Phase 2 output (/speckit-tasks — NOT created here)
```

### Source Code (repository root)

This feature is a focused change across the existing Stichomythia layout — no
new top-level directories. Affected files:

```text
stichomythia/
├── server/
│   ├── services/
│   │   ├── anthropic.ts          # MODIFY — add interrupt-pair generation rules to system prompt
│   │   ├── director.ts           # MODIFY — add interruptionOpportunities to AIDirection
│   │   └── analysis.ts           # READ-ONLY (reference only)
│   └── routes/
│       ├── generation.ts         # MODIFY — parser detects em-dash pairs; generatePause overrides
│       ├── turns.ts              # MODIFY — edit handler clears interrupt link when marker removed
│       └── export.ts             # MODIFY — pre-merge interrupt pairs with acrossfade
├── src/
│   ├── components/
│   │   └── audio/
│   │       └── ConversationPlayer.tsx   # REWRITE — switch from HTMLAudioElement chain to WebAudio scheduler
│   ├── contexts/
│   │   └── AudioEngineContext.tsx       # MODIFY — expose toast for edit-clears-interrupt notifications
│   ├── pages/
│   │   └── Settings.tsx                 # MODIFY — add interruption enable/disable + tuning controls
│   ├── lib/
│   │   └── interruption.ts              # NEW — pure helpers: detect em-dash markers, compute clamped overlap
│   └── types/
│       └── index.ts                     # MODIFY — Turn fields, AppSettings fields, AIDirection field
└── electron/                            # UNCHANGED — native audio path is untouched
```

**Structure Decision**: Use the existing single-codebase Electron layout. No
new packages, no new top-level directories. The renderer-side interruption
logic is small enough to live in a single new helper module
(`src/lib/interruption.ts`) plus the rewritten ConversationPlayer; the
server-side logic is additive to the existing services and routes.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

(No constitutional violations. Section intentionally empty.)
