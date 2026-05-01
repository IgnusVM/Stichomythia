# Contract: Settings UI

**Producer**: `src/pages/Settings.tsx`
**Consumer**: User configuring the feature

## New controls

A new "Interruptions" section appears in Settings, below the existing
TTS section. Controls:

- **Enable interruptions** (toggle) — bound to `settings.interruptionsEnabled`.
  Default on.
- **Overlap range** (two number inputs) — bound to
  `settings.interruptionOverlapRange.minMs` and `.maxMs`. Default 200 / 400.
  Validated: min ≥ 50, max ≥ min, max ≤ 1500.
- **Tail fade** (number input) — bound to `settings.interruptionFadeMs`.
  Default 150. Validated: 50 ≤ value ≤ 500.
- **Max interruptions per segment** (number input) — bound to
  `settings.interruptionMaxPerSegment`. Default 2. Validated: 0 ≤ value ≤ 10.

A small descriptive paragraph above the controls explains what the feature
does in user terms (no implementation jargon).

## Save behavior

On save, the existing PUT /settings endpoint persists the new fields. Per
SC-007, the changes take effect on the next playback or export with no
restart needed.

## Conditional disable hint

If the user's character-to-speaker map at save time has only one distinct
output device, the toggle row shows an italic note: *"All characters
currently route to one speaker; interruptions will not render until you
assign characters to multiple outputs."* This is informational only — the
setting can still be enabled.
