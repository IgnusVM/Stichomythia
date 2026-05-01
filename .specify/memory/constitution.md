<!--
SYNC IMPACT REPORT
==================
Version change: (none) → 1.0.0
Bump rationale: Initial ratification.

Modified principles: (none — first version)
Added sections:
  - Core Principles (I–V)
  - Architecture Constraints
  - Development Workflow
  - Governance

Removed sections: (none)

Templates requiring updates:
  ✅ .specify/templates/plan-template.md — Constitution Check section aligns with the 5 principles below
  ✅ .specify/templates/spec-template.md — no change required (principles do not redefine spec scope)
  ✅ .specify/templates/tasks-template.md — no change required

Follow-up TODOs: (none)
-->

# Stichomythia Constitution

Stichomythia is an Electron + React + Node desktop application for generating
multi-speaker AI dialogues with synthesized voices, mixing them across multiple
Bluetooth speakers, and exporting finished audio. This document is the source
of truth for non-negotiable engineering principles.

## Core Principles

### I. Native-First Realtime Audio

All realtime audio output paths MUST use the native (audify/RtAudio + WASAPI)
layer running in the Electron main process or its worker threads. Web Audio in
the renderer MAY be used for non-realtime mixing, decoding, visualization, and
short-lived playback effects (e.g. interruption fades during preview), but MUST
NOT be the primary delivery path to physical speakers.

**Rationale:** The Web Audio API on Chromium has unpredictable scheduling,
unreliable `setSinkId` semantics across multiple devices, and cannot deliver
the per-speaker isolation that Stichomythia's multi-output use case demands.
Native paths give us deterministic timing, per-speaker streams, and DSP control.

### II. Bring-Your-Own-Key

Stichomythia MUST NOT ship with any third-party API credentials baked into
the build (Anthropic, OpenAI, or otherwise). All keys MUST be supplied by the
end user via the in-app Settings screen and persisted to the local settings
file. The application MUST run end-to-end (install → launch → settings entry →
generate) on a fresh machine with no developer artifacts.

**Rationale:** Stichomythia is distributed as a single NSIS installer to
arbitrary users. Embedded keys would leak credentials and create cost liability.
BYOK is the only ethical and operationally sustainable model.

### III. Per-Speaker Failure Isolation

Any code path that drives more than one physical output device MUST isolate
each device so that a slow, blocked, or failing device cannot starve the
others. This means: one worker thread (or equivalent) per speaker for the
realtime pump, independent ring buffers, and no single sequential `for` loop
over all speakers in the hot path.

**Rationale:** Bluetooth A2DP write calls can block for tens of milliseconds
under jitter. A shared loop turns one slow speaker into four broken ones. The
v3.0 native-audio rewrite was driven by exactly this failure mode — we don't
re-introduce it.

### IV. Director-Driven Generation

Features that influence what the AI generates (interruptions, mood shifts,
topic pivots, scene beats) MUST take their cues from the segment director's
output rather than firing on uncoordinated random chance. Random sprinkles
are acceptable as a fallback only when the director has not produced relevant
guidance for that segment.

**Rationale:** The director runs every N segments specifically to keep the
conversation coherent and character-driven. Bypassing it with per-turn random
chance produces dialogue that feels arbitrary and breaks character voice. The
director is the coordination point — use it.

### V. One Installer, Zero Post-Install Steps

Every change that lands in `main` MUST keep `npm run electron:build` producing
a single working `Stichomythia Setup x.y.z.exe` that, on a clean Windows 10/11
64-bit machine, installs and runs to a usable Settings screen with no
additional manual steps beyond entering API keys. No "also install ffmpeg
separately," no "copy this file there," no "set this env var."

**Rationale:** Stichomythia's distribution story is "send someone a single
EXE." If we erode that, the project becomes a developer-only tool. The build
process is the canonical user experience.

## Architecture Constraints

- **Process model:** Electron main + renderer + a forked Node server child
  process for routes, plus per-speaker worker threads for the realtime pump.
- **Persistence:** All user data (characters, conversations, settings, exports)
  lives under the user's local data directory. No cloud sync, no telemetry.
- **External binaries:** `ffmpeg` is the only required external binary; it
  MUST be either bundled or located via a settings-configured path with a
  clear in-UI fallback when missing.
- **Native modules:** `audify` is the sole native module. New native modules
  require explicit justification in the relevant plan because they complicate
  the build and electron-builder packaging.

## Development Workflow

- **Versioning:** SemVer on `package.json`. Every code-affecting change MUST
  bump at least the patch version.
- **Build verification:** Before any release tag, `npm run electron:build`
  MUST succeed locally and the resulting installer MUST install and launch on
  the developer's machine.
- **No hidden state:** Settings, character files, and conversation files MUST
  remain plain JSON inspectable on disk. Encrypted or opaque storage is
  prohibited without an explicit constitutional amendment.
- **Spec-driven changes:** Non-trivial features (anything spanning more than
  one of: dialogue generation, TTS, native audio, mixer, export) MUST go
  through the spec-kit workflow (`/speckit-specify` → `/speckit-plan` →
  `/speckit-tasks` → `/speckit-implement`).

## Governance

This constitution supersedes ad-hoc conventions and prior informal practice.
Amendments require:

1. A written proposal (a Spec, a PR description, or a memo in
   `.specify/memory/`) stating the change and its rationale.
2. A version bump per the rules below.
3. Propagation to any spec-kit templates whose Constitution Check sections
   reference the changed principle.

**Versioning policy for this document:**

- **MAJOR:** Removing a principle, redefining a principle in a backward-
  incompatible way, or removing a governance rule.
- **MINOR:** Adding a new principle, adding a new mandatory section, or
  materially expanding the scope of an existing principle.
- **PATCH:** Wording clarifications, typo fixes, rationale refinements that
  do not change what is or is not allowed.

**Compliance review:** Every spec-kit `/speckit-plan` invocation MUST include
a Constitution Check that explicitly evaluates the plan against each of the
five Core Principles. Plans that violate a principle MUST either be redesigned
or trigger a constitutional amendment proposal — silent violations are not
acceptable.

**Version**: 1.0.0 | **Ratified**: 2026-04-25 | **Last Amended**: 2026-04-25
