# Feature Specification: Character Interruptions

**Feature Directory**: `specs/001-character-interruptions/`
**Created**: 2026-04-25
**Status**: Draft
**Input**: User description: "Build in occasional interruptions between characters in conversation. Audio-level (overlapping playback, not just sequential), but written into the dialogue itself so it makes sense as authored content. Must work with OpenAI voices (no word-level timing API). Director-driven frequency. Auto-clear with toast on edit. No same-character interrupts in v1. Disabled when all characters route to the same speaker."

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Hear authored interruptions during playback (Priority: P1)

While listening back to a generated conversation in the in-app player, the listener occasionally hears one character cut off another mid-thought, with the new speaker's voice briefly overlapping the tail of the prior speaker's voice. The cut-off feels written, not glitchy: the truncated line ends on a word the audience can complete in their head, and the interrupter's first words make sense as a reaction to what just got cut off.

**Why this priority**: Interruptions are the headline feature. Without playback rendering them correctly, none of the rest matters. This is the smallest end-to-end slice that actually demonstrates the value to the user.

**Independent Test**: Generate a short conversation with the feature enabled across at least two distinct output speakers, play it back in-app, and confirm by ear that at least one interruption occurs and that it sounds like an authored cut-off (truncated line + overlapping interrupter), not a stutter or skip.

**Acceptance Scenarios**:

1. **Given** a conversation has been generated with the interruption feature enabled and contains at least one director-flagged interrupt pair, **When** the user presses Play in the conversation player, **Then** the listener hears the interrupting character's voice begin to play before the interrupted character's voice has fully finished, with the interrupted line ending on an unfinished thought.
2. **Given** an interruption is occurring during playback, **When** the overlap window is in progress, **Then** the interrupted character's audio fades down smoothly over a short window (no abrupt clipping) so the seam does not sound mechanical.
3. **Given** a conversation has been generated with the interruption feature enabled but the director did not flag any interrupt opportunities for that segment, **When** the user plays it back, **Then** all turns play sequentially with no overlap, exactly as they would without the feature.

---

### User Story 2 — Interruptions survive export to the final audio file (Priority: P1)

When the user exports a conversation to a single audio file, the exported file contains the same interruptions, with the same overlaps and fades, that the user heard in the in-app player. There is no audible difference between in-app preview and the final exported deliverable.

**Why this priority**: Stichomythia's primary deliverable is the exported file. If interruptions only work in the preview but flatten back to sequential turns on export, the feature is broken for the actual use case. Pairs naturally with Story 1 — both are required for a usable v1.

**Independent Test**: Export a conversation that contained an audible interruption in the in-app player; play the exported file in any external audio player; confirm the interruption is present and sounds the same.

**Acceptance Scenarios**:

1. **Given** a conversation in which the user heard an interruption during in-app playback, **When** the user exports the conversation, **Then** the exported audio file contains an audible overlap between the two turns at the same point and of the same approximate duration.
2. **Given** a conversation contains multiple interrupt pairs, **When** the user exports it, **Then** every pair is rendered correctly in the export with no order changes or missing turns elsewhere in the conversation.

---

### User Story 3 — Author edits an interrupted line and the system updates cleanly (Priority: P2)

The author of a conversation reviews a generated interrupt pair, decides the interrupted line should be rewritten, and edits its text. If the edit removes the structural marker that made it an interruption (the trailing em-dash), the system silently clears the interrupt link between the two turns and shows a brief notification explaining what changed. The two turns then play sequentially like any other pair.

**Why this priority**: Without this, edits silently break audio playback (the interrupt flag points to text that is no longer a cut-off) or, worse, produce garbled overlap on export. Important but not blocking the headline feature — interruptions can ship working before the edit-handling polish lands.

**Independent Test**: Generate a conversation with at least one interrupt pair, open the editor, modify the interrupted turn's text to end in a period instead of an em-dash, save, and confirm that (a) a toast appears, (b) the pair plays back sequentially with no overlap, and (c) the export reflects the same sequential playback.

**Acceptance Scenarios**:

1. **Given** an interrupt pair exists in the conversation, **When** the user edits the interrupted turn so its text no longer ends with an em-dash, **Then** the system clears the interrupt linkage between the two turns and displays a toast explaining that the interruption was removed.
2. **Given** an interrupt pair exists in the conversation, **When** the user edits the interrupting turn so its text no longer begins with an em-dash, **Then** the same clearing-and-toast behavior occurs.
3. **Given** the user edits an interrupted turn but preserves the trailing em-dash, **When** the edit is saved, **Then** the interrupt linkage remains intact and playback continues to overlap.

---

### User Story 4 — Director controls when interruptions happen (Priority: P2)

The system's existing dialogue director, which sets emotional landscape and pacing every few segments, also decides when interruptions are appropriate based on the conversation's current emotional state. Random sprinkling per turn is not used; instead, interruptions appear in moments of disagreement, eagerness, or tension that the director has identified, and rarely or never appear in calm or thoughtful passages.

**Why this priority**: This is what makes the feature feel authored rather than gimmicky. It depends on Story 1 (the feature must actually work) but adds the qualitative coherence that distinguishes "characters interrupt each other in tense moments" from "interruptions sprinkled randomly throughout."

**Independent Test**: Generate a long conversation with sustained calm passages and sustained tense passages; review the resulting interrupt placements; confirm that the density of interruptions in tense passages is meaningfully higher than in calm ones, and that no interruption appears in a clearly calm/agreeable exchange.

**Acceptance Scenarios**:

1. **Given** the director has identified the current segment as low-tension (e.g. agreement, thoughtful exchange), **When** the system generates that segment, **Then** no interruptions are produced in that segment.
2. **Given** the director has identified the current segment as containing disagreement, eagerness, or escalating tension, **When** the system generates that segment, **Then** interruptions may be produced, and when produced they appear at moments aligned with the director's flagged opportunities.
3. **Given** a generated segment contains an interrupt pair, **When** the user inspects the segment metadata, **Then** the interrupt is associated with a director-identified opportunity rather than a random per-turn roll.

---

### User Story 5 — No interruptions when output is single-speaker (Priority: P3)

When all characters in the conversation are routed to a single physical output speaker, the system disables interruption rendering. Conversations generated and played back under that configuration play sequentially even if the underlying turn data contains interrupt-pair markers, because overlapping voices on a single speaker produce muddy, hard-to-follow audio.

**Why this priority**: A correctness-and-quality safeguard rather than a primary feature. Most Stichomythia users route characters to separate speakers (the whole point of the app), so this is an edge-case guardrail rather than a core flow. Can ship after the headline feature.

**Independent Test**: Configure all characters in a conversation to route to the same output speaker; generate a conversation that would normally include interrupt pairs; confirm that playback and export both render the turns sequentially with no overlap.

**Acceptance Scenarios**:

1. **Given** all characters are routed to the same physical output speaker, **When** the user plays back a conversation containing interrupt pairs, **Then** all turns play sequentially with no overlap.
2. **Given** all characters are routed to the same physical output speaker, **When** the user exports that conversation, **Then** the exported file contains no overlapping audio.
3. **Given** characters are routed to at least two distinct physical output speakers, **When** the user plays back a conversation containing interrupt pairs, **Then** interruption rendering is enabled and overlaps occur as authored.

---

### Edge Cases

- **Last turn of a conversation flagged as interrupted**: The "interrupted" turn has no following interrupter to overlap with. The system MUST treat such a turn as non-interrupted (play in full, no fade).
- **Two consecutive interrupt pairs**: A is interrupted by B, then B is interrupted by C. The system MUST cleanly chain these — no compounding fades, no gaps swallowed by overlap.
- **Interrupted turn has very short audio (under 1 second)**: The overlap window would consume most or all of the interrupted line. The system MUST shorten the overlap to a safe maximum (no more than 50% of the interrupted line's duration) so the listener still hears the interrupted content.
- **Interrupting turn has very short audio (under 500 ms)**: The fade window of the interrupted turn might extend past the interrupter's whole utterance. The system MUST cap the fade so the interrupter is fully audible.
- **Editing an interrupting turn to remove the leading em-dash, but the interrupted turn still has a trailing em-dash**: The pair is no longer valid; clearing should still happen and the toast should still appear, with the same wording regardless of which side was edited.
- **User opens an existing pre-feature conversation**: Old conversations have no interrupt markers. The system MUST play and export them exactly as before, with no special handling.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The dialogue generation system MUST be capable of producing interrupt pairs — adjacent turns where the first is written to be cut off mid-thought and the second is written to make sense as the interrupting reaction.
- **FR-002**: Whether to produce an interrupt pair in any given segment MUST be governed by the existing dialogue director's per-segment direction, not by a per-turn random chance.
- **FR-003**: A turn that is interrupted MUST be marked as such in the persisted conversation data, and its companion interrupting turn MUST be discoverable from that mark.
- **FR-004**: An interrupt pair MUST never involve the same character interrupting themselves (in v1).
- **FR-005**: During in-app playback, the interrupting turn's audio MUST begin playing some time before the interrupted turn's audio ends, with the overlap perceived by the listener as a natural cut-off.
- **FR-006**: During in-app playback, the interrupted turn's audio MUST fade out smoothly over a short window at the end so the seam does not sound abrupt.
- **FR-007**: The exported audio file MUST reproduce the same overlap and fade that the user heard in in-app playback for the same conversation, with no audible difference.
- **FR-008**: When the user edits a turn that is part of an interrupt pair such that the structural marker (the trailing or leading em-dash that established the interruption) is removed, the system MUST clear the interrupt linkage between the two turns and display a brief, dismissable notification explaining that the interruption was removed.
- **FR-009**: When the user edits a turn in an interrupt pair but preserves the structural marker, the system MUST leave the interrupt linkage intact.
- **FR-010**: When all characters in a conversation are routed to the same physical output speaker, the system MUST render playback and export sequentially, ignoring any interrupt-pair markers in the data.
- **FR-011**: When characters are routed to at least two distinct physical output speakers, the system MUST render interruptions as overlapping audio per FR-005 through FR-007.
- **FR-012**: Conversations created before this feature shipped MUST continue to play and export exactly as before, with no behavioral change.
- **FR-013**: The system MUST cap interruption overlap duration so that no overlap exceeds half the duration of the shorter of the two involved turns, to prevent the interrupted line from being effectively erased.
- **FR-014**: An interrupted turn at the very end of a conversation (with no following turn to interrupt it) MUST be treated as a normal, non-interrupted turn for both playback and export.
- **FR-015**: The user MUST be able to enable or disable the interruption feature globally via Settings; when disabled, the system MUST behave as if no interrupt pairs exist regardless of director output.

### Key Entities *(include if feature involves data)*

- **Interrupt Pair**: A relationship between two adjacent turns in a conversation where the first turn (the *interrupted turn*) is authored to end mid-thought, and the second turn (the *interrupting turn*) is authored to begin as a reaction that cuts off the first. The pair carries enough information for playback and export to render the overlap and fade consistently.
- **Director Interruption Opportunity**: A per-segment piece of guidance produced by the existing dialogue director identifying a moment in the upcoming generation where an interruption would be character-appropriate. The generation system uses these opportunities, not random chance, to decide whether to author an interrupt pair.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: When listening back to a conversation containing director-flagged interrupt pairs, an unprompted listener identifies the interruptions as deliberate writing rather than playback glitches in at least 9 out of 10 cases.
- **SC-002**: For every conversation that contains audible interruptions in in-app playback, the exported audio file contains the same interruptions in the same positions; an A/B comparison reveals no audible difference between preview and export.
- **SC-003**: Across at least 20 generated segments split between high-tension and low-tension director states, interruption density in high-tension segments is at least four times that of low-tension segments, and at least one low-tension segment contains zero interruptions.
- **SC-004**: When a user edits an interrupted turn's text to remove the structural marker, the in-app playback of that pair is sequential (no overlap) on the very next playback attempt, with no app restart required, and a notification appears within 2 seconds of the save action.
- **SC-005**: When all characters in a conversation are routed to a single output speaker, no overlap is audible in either preview or export, regardless of how many interrupt pairs exist in the underlying data.
- **SC-006**: Pre-feature conversations (created before this feature shipped) play back and export with bit-identical audio to a baseline taken before this feature was installed.
- **SC-007**: Enabling or disabling the interruption feature in Settings takes effect on the next playback or export without requiring an app restart or conversation re-generation.

## Assumptions

- **Director context is sufficient for interruption decisions**: The existing dialogue director already produces enough emotional and topical context per segment to identify natural interruption moments. No new external data source (sentiment APIs, separate model calls) is required.
- **Em-dash as structural marker is acceptable**: Using a trailing-and-leading em-dash convention to mark interrupt pairs is acceptable both as authoring intent and as a TTS prosody hint. Authors are not expected to write em-dashes elsewhere with the same pair pattern.
- **OpenAI TTS rendering of truncated text sounds natural**: Rendering text that ends mid-thought with an em-dash via OpenAI TTS produces an audio clip that sounds like a natural cut-off, without requiring post-processing of the audio waveform.
- **Multi-speaker is the dominant configuration**: The vast majority of users route characters to distinct output speakers. The single-speaker disable is a guardrail, not a primary supported flow.
- **No retroactive interruption insertion**: This feature only affects newly generated content. There is no requirement to add interruptions to existing conversations after the fact.
- **No same-character interruption in v1**: A character cutting off their own previous utterance (self-interruption, restarts) is explicitly out of scope for v1 and may be considered later.
- **Existing per-turn pause data remains the primary timing mechanism**: Pauses between non-interrupted turns continue to be governed by the existing pause-generation logic. This feature only changes timing for the small subset of turns participating in an interrupt pair.
