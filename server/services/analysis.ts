import Anthropic from '@anthropic-ai/sdk';
import { readJson, getSettingsPath } from '../utils/files.js';

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

async function getApiKey(): Promise<string> {
  if (process.env.ANTHROPIC_API_KEY) return process.env.ANTHROPIC_API_KEY;
  const settings = await readJson<{ anthropicApiKey?: string }>(getSettingsPath());
  if (settings?.anthropicApiKey) return settings.anthropicApiKey;
  throw new Error('No Anthropic API key configured');
}

let clientInstance: Anthropic | null = null;
let lastKey = '';

async function getClient(): Promise<Anthropic> {
  const key = await getApiKey();
  if (!clientInstance || key !== lastKey) {
    clientInstance = new Anthropic({ apiKey: key });
    lastKey = key;
  }
  return clientInstance;
}

export async function analyzeSegment(segmentDialogue: string): Promise<EmotionalSummary> {
  const client = await getClient();

  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1024,
    messages: [
      {
        role: 'user',
        content: `Analyze this conversation segment between four people (Person A, Person B, Person C, Person D).

${segmentDialogue}

Return a JSON object with:
{
  "emotionalStates": {
    "Person A": { "emotion": "...", "intensity": 0.0-1.0, "valence": -1.0 to 1.0, "note": "brief note" },
    "Person B": { ... },
    "Person C": { ... },
    "Person D": { ... }
  },
  "unresolvedThreads": ["topics/tensions left hanging"],
  "topicsCovered": ["what they talked about"],
  "suggestedNextDirection": "one sentence suggestion for where the conversation could go next"
}

Return ONLY the JSON object, no other text.`,
      },
    ],
  });

  const text = response.content[0].type === 'text' ? response.content[0].text : '';

  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    return {
      emotionalStates: {
        'Person A': { emotion: 'neutral', intensity: 0.3, valence: 0, note: '' },
        'Person B': { emotion: 'neutral', intensity: 0.3, valence: 0, note: '' },
        'Person C': { emotion: 'neutral', intensity: 0.3, valence: 0, note: '' },
        'Person D': { emotion: 'neutral', intensity: 0.3, valence: 0, note: '' },
      },
      unresolvedThreads: [],
      topicsCovered: [],
      suggestedNextDirection: 'Continue the conversation naturally.',
    };
  }

  return JSON.parse(jsonMatch[0]) as EmotionalSummary;
}

export async function summarizeForMemory(
  segmentDialogues: string[],
  targetWordCount: number,
): Promise<{
  summary: string;
  keyTopics: string[];
  emotionalHighlights: string[];
  runningJokes: string[];
}> {
  const client = await getClient();

  const combined = segmentDialogues.join('\n\n---\n\n');

  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1024,
    messages: [
      {
        role: 'user',
        content: `Summarize the following conversation segments in approximately ${targetWordCount} words. Focus on:
1. Key topics discussed
2. Emotional dynamics between the speakers
3. Any running jokes, callbacks, or recurring themes
4. Unresolved tensions or threads

Conversation:
${combined}

Return a JSON object:
{
  "summary": "...",
  "keyTopics": ["..."],
  "emotionalHighlights": ["..."],
  "runningJokes": ["..."]
}

Return ONLY the JSON object.`,
      },
    ],
  });

  const text = response.content[0].type === 'text' ? response.content[0].text : '';
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    return {
      summary: 'The conversation continued naturally.',
      keyTopics: [],
      emotionalHighlights: [],
      runningJokes: [],
    };
  }

  return JSON.parse(jsonMatch[0]);
}

export async function compressMemory(
  currentSummary: string,
  targetWordCount: number,
): Promise<string> {
  const client = await getClient();

  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 512,
    messages: [
      {
        role: 'user',
        content: `Compress the following conversation summary to approximately ${targetWordCount} words. Keep the most important facts, dynamics, and any running jokes or tensions.

Original summary:
${currentSummary}

Return ONLY the compressed summary text, nothing else.`,
      },
    ],
  });

  return response.content[0].type === 'text' ? response.content[0].text : currentSummary;
}
