import Anthropic from '@anthropic-ai/sdk';
import { readJson, getSettingsPath } from '../utils/files.js';

interface Character {
  id: string;
  personality: string;
  speechStyle: string;
  interests: string[];
  quirks: string[];
  emotionalProfile: {
    temperament: string;
    triggers: Array<{ topic: string; reaction: string; intensity: string; description: string }>;
    recoverySpeed: string;
  };
}

interface MemoryBlock {
  summary: string;
  tier: 'recent' | 'mid' | 'old';
}

let clientInstance: Anthropic | null = null;
let lastKey = '';

async function getClient(): Promise<Anthropic> {
  const key = process.env.ANTHROPIC_API_KEY
    || (await readJson<{ anthropicApiKey?: string }>(getSettingsPath()))?.anthropicApiKey
    || '';
  if (!clientInstance || key !== lastKey) {
    clientInstance = new Anthropic({ apiKey: key });
    lastKey = key;
  }
  return clientInstance;
}

export async function buildAIDirection(
  characters: Character[],
  labelMap: Map<string, string>,
  previousSummary: EmotionalSummary,
  memories: MemoryBlock[],
  coveredTopics: string[],
  segmentNumber: number,
  targetTurnCount: number,
): Promise<DirectorInput> {
  const client = await getClient();

  const charProfiles = characters.map(c => {
    const label = labelMap.get(c.id)!;
    return `${label}: ${c.personality}. Interests: ${c.interests.join(', ')}. Quirks: ${c.quirks.join(', ')}. Temperament: ${c.emotionalProfile.temperament}. Triggers: ${c.emotionalProfile.triggers.map(t => `${t.topic} (${t.reaction})`).join(', ') || 'none'}.`;
  }).join('\n');

  const memoryText = memories.length > 0
    ? memories.map(m => m.summary).join('\n\n')
    : 'No previous conversation history.';

  const emotionalState = Object.entries(previousSummary.emotionalStates)
    .map(([label, s]) => `${label}: ${s.emotion} (intensity ${s.intensity}, ${s.note || 'no note'})`)
    .join('\n');

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    system: [
      {
        type: 'text',
        text: `You are the director of a naturalistic conversation between four people. Your job is to guide the next segment of their conversation by providing emotional landscape and creative suggestions.

You are NOT writing the conversation. You are writing stage direction — describing where the conversation should go emotionally, what dynamics should shift, what topics could come up, and what the pacing should feel like.

Think about:
- Character dynamics that should evolve (who's been too quiet? who's dominating? any tension building?)
- Narrative pacing (has it been intense? time for a breather? time to escalate?)
- Topics that would be interesting for THESE specific characters given their personalities and triggers
- Emotional arcs — not every segment needs conflict, but the conversation should feel like it's going somewhere

CRITICAL: The conversation must ALWAYS move forward. NEVER suggest returning to topics already covered — they are OFF-LIMITS. NEVER suggest discussing a character's personality or traits — the characters should talk about the WORLD, not about each other's personalities. Push the conversation into genuinely new territory every single segment.

Your most important job is injecting SPECIFIC, CONCRETE new topics — not vague meta-suggestions like "someone changes the subject." Name the actual subject: "someone brings up a weird dream they had about being chased through a supermarket" or "someone asks the group whether they think aliens have visited Earth." Real topics that real people would bring up sitting around talking.

Think about: random memories, hypothetical scenarios, things in the news, debates about everyday life, confessions, plans, childhood stories, unpopular opinions, travel stories, weird facts, relationship drama, work stories, philosophical questions, funny observations.

Return a JSON object:
{
  "emotionalLandscape": { "Person A": "description", "Person B": "description", ... },
  "suggestions": ["suggestion 1", "suggestion 2", ...],
  "newTopic": "a specific, concrete topic for someone to bring up naturally"
}

Keep suggestions to 2-4 items. The "newTopic" field is REQUIRED — it must be a specific subject that has NOT been covered before, described concretely enough that the writer knows exactly what to have someone bring up. Write suggestions as natural nudges, not rigid commands.

Return ONLY the JSON object.`,
        cache_control: { type: 'ephemeral' },
      },
    ],
    messages: [
      {
        role: 'user',
        content: `Segment ${segmentNumber + 1} of the conversation. Each segment is about ${targetTurnCount} turns.

CHARACTER PROFILES:
${charProfiles}

CONVERSATION SO FAR (memory summaries):
${memoryText}

CURRENT EMOTIONAL STATE (end of last segment):
${emotionalState}

UNRESOLVED THREADS: ${previousSummary.unresolvedThreads.join(', ') || 'none'}

TOPICS THAT ARE OFF-LIMITS (already explored — do NOT revisit these):
${coveredTopics.join(', ') || 'none yet'}

Write the direction for the next segment.`,
      },
    ],
  });

  const text = response.content[0].type === 'text' ? response.content[0].text : '';
  const jsonMatch = text.match(/\{[\s\S]*\}/);

  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]);
      const suggestions = parsed.suggestions ?? [];
      if (parsed.newTopic) {
        suggestions.push(`Someone naturally brings up ${parsed.newTopic}`);
      }
      return {
        emotionalLandscape: parsed.emotionalLandscape ?? {},
        suggestions,
        topicSeeds: [],
        targetTurnCount,
      };
    } catch {}
  }

  return buildNextSegmentDirection(previousSummary, [], coveredTopics, targetTurnCount, segmentNumber);
}

export const AI_DIRECTOR_INTERVAL = 3;

const CONCRETE_TOPICS = [
  'a weird dream someone had last night',
  'the best meal they ever had and where it was',
  'whether they could survive alone in the wilderness for a week',
  'a conspiracy theory that actually makes them think',
  'the most embarrassing thing that happened to them in public',
  'what they would do with an extra hour every day',
  'a skill they wish they had learned when they were younger',
  'the strangest job they ever had or heard about',
  'whether time travel would actually be worth the risk',
  'a place they have always wanted to visit but never have',
  'the worst advice someone gave them that they actually followed',
  'what their life would look like if they had made one different decision',
  'an animal they think is underrated',
  'whether they think aliens have visited Earth',
  'a book, movie, or show that genuinely changed how they think',
  'the most useless talent they have',
  'what the world will look like in fifty years',
  'a habit they cannot break no matter how hard they try',
  'the best or worst neighbor they have ever had',
  'whether they would rather know the future or change the past',
  'a food combination that sounds disgusting but actually works',
  'the oldest thing they own and why they still have it',
  'what they would do if they won an absurd amount of money',
  'a time they were completely wrong about someone',
  'whether they believe in luck or think everything is cause and effect',
  'the scariest experience they have ever had',
  'a trend they absolutely do not understand',
  'what they think happens after you die',
  'the funniest misunderstanding they have been part of',
  'a hill they would die on that nobody else cares about',
  'whether they would want to be famous and for what',
  'the most overrated thing in modern life',
  'a random act of kindness they witnessed or did',
  'what superpower would actually be the most practical',
  'a childhood memory that feels like it happened to someone else',
  'whether they would live on Mars if they could never come back',
  'the weirdest thing they have ever eaten',
  'a teacher or mentor who shaped who they are',
  'what they think their friends really think of them',
  'whether social media has made people better or worse',
  'a recurring argument they have with someone close to them',
  'the most beautiful place they have ever seen',
  'whether AI is going to take their job someday',
  'a guilty pleasure they would never admit to most people',
  'what era they would want to live in if they could pick',
  'the worst date or social event they have been to',
  'a house rule they grew up with that they later realized was weird',
  'whether they would clone their pet if they could',
  'the most physically challenging thing they have done',
  'what they would teach a class on if they had to',
  'a mystery or unsolved case that fascinates them',
  'whether they think humanity is getting smarter or dumber',
  'the longest they have gone without sleep and what happened',
  'a piece of technology they refuse to use',
  'what their ideal retirement looks like',
  'the worst movie they have sat through to the end',
  'whether they would want to read minds if it meant hearing everything',
  'a time they had to pretend to like something they hated',
  'what their younger self would think of their life now',
  'a local legend or urban myth from where they grew up',
  'whether they think people can truly change',
  'the most spontaneous thing they have ever done',
  'a fear they had as a kid that seems ridiculous now',
  'what they would put in a time capsule for a hundred years from now',
  'the best concert, show, or live event they have been to',
  'whether it is better to be smart or to be kind',
  'a job they think does not get enough respect',
  'the funniest thing a kid ever said to them',
  'whether they could go a full year without their phone',
  'a historical figure they would want to have dinner with',
  'the most interesting stranger they have ever talked to',
  'what language they would learn instantly if they could',
  'a tradition they have that other people find strange',
  'whether it is possible to be truly selfless',
  'the worst injury they have ever had and how it happened',
  'something they believed for way too long before finding out it was wrong',
  'what they would name a bar or restaurant if they opened one',
  'a song that brings back a specific vivid memory',
  'whether they think there is intelligent life in the ocean we have not found',
  'the pettiest thing they have ever done',
  'what they would do if they were invisible for a day',
  'a moment of their life they wish they could relive',
  'whether zoos are ethical or not',
  'the strangest coincidence that ever happened to them',
  'what invention they think the world still needs',
  'a compliment someone gave them that they still think about',
  'whether money actually buys happiness or just comfort',
  'the worst haircut they ever had',
  'what they would do differently if they started their career over',
  'a phobia they have that they know is irrational',
  'the most interesting documentary they have watched',
  'whether they think dreams actually mean something',
  'a hobby they picked up and dropped within a month',
  'what they think their last words will be',
  'the most awkward elevator or waiting room moment they experienced',
  'whether they think there is such a thing as a soulmate',
  'a rule or law they think is completely pointless',
  'what their autobiography title would be',
];

const TOPIC_INTROS = [
  'Someone randomly brings up',
  'Out of nowhere, someone mentions',
  'Someone suddenly asks the group about',
  'Apropos of nothing, someone starts talking about',
  'Someone changes the subject to',
  'Someone remembers something and brings up',
  'A stray thought leads someone to mention',
  'Someone asks if anyone else has thought about',
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
    const freshThreads = previousSummary.unresolvedThreads.filter(thread => {
      const threadText = typeof thread === 'object' ? (thread as any).thread ?? String(thread) : String(thread);
      return !coveredTopics.some(topic =>
        threadText.toLowerCase().includes(topic.toLowerCase()) ||
        topic.toLowerCase().includes(threadText.toLowerCase())
      );
    });
    if (freshThreads.length > 0) {
      const thread = freshThreads[Math.floor(Math.random() * freshThreads.length)];
      const threadText = typeof thread === 'object' ? (thread as any).thread ?? String(thread) : String(thread);
      suggestions.push(`The unresolved thread about "${threadText}" could resurface`);
    }
  }

  const driftChance = Math.min(0.9, 0.4 + segmentNumber * 0.1);
  if (Math.random() < driftChance) {
    const unusedTopics = CONCRETE_TOPICS.filter(t =>
      !coveredTopics.some(ct => ct.toLowerCase().includes(t.split(' ').slice(0, 3).join(' ').toLowerCase()))
    );
    const topicPool = unusedTopics.length > 0 ? unusedTopics : CONCRETE_TOPICS;
    const topic = topicPool[Math.floor(Math.random() * topicPool.length)];
    const intro = TOPIC_INTROS[Math.floor(Math.random() * TOPIC_INTROS.length)];
    suggestions.push(`${intro} ${topic}`);
  }

  if (segmentNumber > 2 && Math.random() < 0.4) {
    suggestions.push('Let the conversation breathe — not every moment needs to be high-energy or meaningful. Sometimes people just chat about nothing for a bit.');
  }

  const seedsToUse = topicSeeds.filter(s => !coveredTopics.includes(s));

  return {
    emotionalLandscape,
    suggestions,
    topicSeeds: seedsToUse,
    targetTurnCount,
  };
}
