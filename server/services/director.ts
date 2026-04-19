const TOPIC_DRIFTS = [
  'Someone brings up something completely unrelated that just popped into their head',
  'A random observation about their surroundings sparks a new tangent',
  'Someone shares a story from their week that has nothing to do with what they were talking about',
  'The conversation hits a natural lull and someone changes the subject entirely',
  'Someone remembers something they wanted to tell the group about',
  'A passing thought derails the current topic into something unexpected',
  'Someone asks the group a random question out of nowhere',
  'An old memory surfaces and someone shares it, shifting the whole conversation',
  'Someone brings up something they read, watched, or heard recently',
  'A small disagreement fizzles out and someone pivots to a lighter subject',
  'Someone mentions a plan or idea they have been thinking about',
  'The group gets into a hypothetical or "what would you do" scenario',
  'Someone confesses something minor or embarrassing, taking things in a new direction',
  'A joke or offhand comment accidentally opens up a deeper conversation',
  'Someone asks for advice about something unrelated to the current topic',
];

interface EmotionalSummary {
  emotionalStates: Record<string, {
    emotion: string;
    intensity: number;
    valence: number;
    note: string;
  }>;
  unresolvedThreads: string[];
  topicsCovered: string[];
  suggestedNextDirection: string;
}

interface DirectorInput {
  emotionalLandscape: Record<string, string>;
  suggestions: string[];
  topicSeeds: string[];
  targetTurnCount: number;
}

export function buildFirstSegmentDirection(
  topicSeeds: string[],
  targetTurnCount: number,
): DirectorInput {
  const suggestions: string[] = [];

  if (topicSeeds.length > 0) {
    suggestions.push(`Start the conversation around ${topicSeeds[0]} — someone brings it up naturally`);
    if (topicSeeds.length > 1) {
      suggestions.push(`The conversation could also touch on ${topicSeeds.slice(1).join(', ')}`);
    }
  } else {
    suggestions.push('Start with casual small talk — someone brings up something on their mind');
  }

  return {
    emotionalLandscape: {
      'Person A': 'relaxed, settling in',
      'Person B': 'upbeat, ready to chat',
      'Person C': 'calm, listening',
      'Person D': 'alert, in a good mood',
    },
    suggestions,
    topicSeeds,
    targetTurnCount,
  };
}

export function buildNextSegmentDirection(
  previousSummary: EmotionalSummary,
  topicSeeds: string[],
  coveredTopics: string[],
  targetTurnCount: number,
  segmentNumber: number = 1,
): DirectorInput {
  const emotionalLandscape: Record<string, string> = {};
  for (const [label, state] of Object.entries(previousSummary.emotionalStates)) {
    const intensityWord =
      state.intensity > 0.7 ? 'very' :
      state.intensity > 0.4 ? 'somewhat' :
      'mildly';
    const note = state.note ? ` — ${state.note}` : '';
    emotionalLandscape[label] = `${intensityWord} ${state.emotion}${note}`;
  }

  const suggestions: string[] = [];

  if (previousSummary.suggestedNextDirection && Math.random() > 0.3) {
    suggestions.push(previousSummary.suggestedNextDirection);
  }

  if (previousSummary.unresolvedThreads.length > 0 && Math.random() > 0.4) {
    const thread = previousSummary.unresolvedThreads[
      Math.floor(Math.random() * previousSummary.unresolvedThreads.length)
    ];
    suggestions.push(`The unresolved thread about "${thread}" could resurface`);
  }

  const driftChance = Math.min(0.8, 0.3 + segmentNumber * 0.1);
  if (Math.random() < driftChance) {
    const drift = TOPIC_DRIFTS[Math.floor(Math.random() * TOPIC_DRIFTS.length)];
    suggestions.push(`At some point in this segment: ${drift.toLowerCase()}`);
  }

  if (segmentNumber > 2 && Math.random() < 0.4) {
    suggestions.push('Let the conversation breathe — not every moment needs to be high-energy or meaningful. Sometimes people just chat about nothing for a bit.');
  }

  const unusedSeeds = topicSeeds.filter(s => !coveredTopics.includes(s));
  const seedsToUse = unusedSeeds.length > 0 ? unusedSeeds : topicSeeds;

  return {
    emotionalLandscape,
    suggestions,
    topicSeeds: seedsToUse,
    targetTurnCount,
  };
}
