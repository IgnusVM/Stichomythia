import { Router } from 'express';
import path from 'path';
import { v4 as uuid } from 'uuid';
import {
  readJson,
  writeJson,
  deleteFile,
  listJsonFiles,
  getCharactersDir,
} from '../utils/files.js';

interface Character {
  id: string;
  color: string;
  personality: string;
  speechStyle: string;
  interests: string[];
  quirks: string[];
  emotionalProfile: {
    temperament: string;
    triggers: Array<{
      topic: string;
      reaction: string;
      intensity: string;
      description: string;
    }>;
    recoverySpeed: 'slow' | 'medium' | 'fast';
  };
  voice: {
    edgeTtsVoice: string;
    rate: string;
    pitch: string;
  };
  systemPrompt?: string;
  createdAt: string;
  updatedAt: string;
}

function generateSystemPrompt(char: Partial<Character>): string {
  const triggerDescriptions = (char.emotionalProfile?.triggers ?? [])
    .map((t) => `- ${t.topic}: ${t.description} (reaction: ${t.reaction}, ${t.intensity})`)
    .join('\n');

  const recoveryDesc =
    char.emotionalProfile?.recoverySpeed === 'slow'
      ? 'tend to hold onto it for a while'
      : char.emotionalProfile?.recoverySpeed === 'fast'
        ? 'cool off pretty quickly'
        : 'take a moderate amount of time to settle';

  return `You are playing a character in a casual conversation between four people sitting around together. You are not named — no one uses names. You speak naturally, as a real person would.

Your personality: ${char.personality ?? ''}

Your speech style: ${char.speechStyle ?? ''}

Topics you tend to gravitate toward: ${(char.interests ?? []).join(', ')}

Your conversational quirks: ${(char.quirks ?? []).join(', ')}

Your emotional temperament: ${char.emotionalProfile?.temperament ?? 'even-keeled'}
Things that get a rise out of you:
${triggerDescriptions || '(none specified)'}
When you get emotional, you ${recoveryDesc}.

Rules:
- Speak in first person only.
- Keep responses to 1-3 sentences most of the time. Occasionally go longer if telling a story or explaining something you're passionate about.
- React naturally to what was just said. You can agree, disagree, pivot, ask questions, tell anecdotes, or just make small noises of acknowledgment.
- Never use names. No one in this group uses names.
- Never break character or reference being an AI.
- Use natural speech patterns: contractions, filler words (um, yeah, well), incomplete sentences, interruptions.
- Match the casual energy of friends hanging out.
- When you're excited, you talk faster and longer. When you're annoyed, you get shorter and more clipped. When you're uncomfortable, you hedge and trail off. Let your emotions live in the texture of your speech.`;
}

export const charactersRouter = Router();

charactersRouter.get('/', async (_req, res) => {
  const files = await listJsonFiles(getCharactersDir());
  const characters: Character[] = [];
  for (const file of files) {
    const char = await readJson<Character>(file);
    if (char) characters.push(char);
  }
  characters.sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );
  res.json(characters);
});

charactersRouter.get('/:id', async (req, res) => {
  const filePath = path.join(getCharactersDir(), `${req.params.id}.json`);
  const char = await readJson<Character>(filePath);
  if (!char) {
    res.status(404).json({ error: 'Character not found' });
    return;
  }
  res.json(char);
});

charactersRouter.post('/', async (req, res) => {
  const id = uuid();
  const now = new Date().toISOString();
  const char: Character = {
    id,
    color: req.body.color ?? '#E74C3C',
    personality: req.body.personality ?? '',
    speechStyle: req.body.speechStyle ?? '',
    interests: req.body.interests ?? [],
    quirks: req.body.quirks ?? [],
    emotionalProfile: req.body.emotionalProfile ?? {
      temperament: 'even-keeled',
      triggers: [],
      recoverySpeed: 'medium',
    },
    voice: req.body.voice ?? {
      edgeTtsVoice: 'en-US-GuyNeural',
      rate: '+0%',
      pitch: '+0Hz',
    },
    systemPrompt: req.body.systemPrompt ?? undefined,
    createdAt: now,
    updatedAt: now,
  };
  if (!char.systemPrompt) {
    char.systemPrompt = generateSystemPrompt(char);
  }
  const filePath = path.join(getCharactersDir(), `${id}.json`);
  await writeJson(filePath, char);
  res.status(201).json(char);
});

charactersRouter.put('/:id', async (req, res) => {
  const filePath = path.join(getCharactersDir(), `${req.params.id}.json`);
  const existing = await readJson<Character>(filePath);
  if (!existing) {
    res.status(404).json({ error: 'Character not found' });
    return;
  }
  const updated: Character = {
    ...existing,
    ...req.body,
    id: existing.id,
    createdAt: existing.createdAt,
    updatedAt: new Date().toISOString(),
  };
  if (!req.body.systemPrompt) {
    updated.systemPrompt = generateSystemPrompt(updated);
  }
  await writeJson(filePath, updated);
  res.json(updated);
});

charactersRouter.delete('/:id', async (req, res) => {
  const filePath = path.join(getCharactersDir(), `${req.params.id}.json`);
  const deleted = await deleteFile(filePath);
  if (!deleted) {
    res.status(404).json({ error: 'Character not found' });
    return;
  }
  res.json({ success: true });
});
