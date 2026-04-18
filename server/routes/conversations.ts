import { Router } from 'express';
import path from 'path';
import { v4 as uuid } from 'uuid';
import {
  readJson,
  writeJson,
  deleteFile,
  listJsonFiles,
  getConversationsDir,
} from '../utils/files.js';

interface Conversation {
  id: string;
  name: string;
  characterIds: string[];
  segments: unknown[];
  memories: unknown[];
  settings: {
    model: string;
    generationMode: string;
    turnsPerSegment: number;
    memorySummaryInterval: number;
    topicSeeds: string[];
    pauseRange: { minMs: number; maxMs: number };
    longPauseChance: number;
  };
  createdAt: string;
  updatedAt: string;
  totalTurns: number;
  totalDurationMs?: number;
  status: string;
}

export const conversationsRouter = Router();

conversationsRouter.get('/', async (_req, res) => {
  const files = await listJsonFiles(getConversationsDir());
  const conversations: Conversation[] = [];
  for (const file of files) {
    const conv = await readJson<Conversation>(file);
    if (conv) conversations.push(conv);
  }
  conversations.sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );
  res.json(conversations);
});

conversationsRouter.get('/:id', async (req, res) => {
  const filePath = path.join(getConversationsDir(), `${req.params.id}.json`);
  const conv = await readJson<Conversation>(filePath);
  if (!conv) {
    res.status(404).json({ error: 'Conversation not found' });
    return;
  }
  res.json(conv);
});

conversationsRouter.post('/', async (req, res) => {
  const id = uuid();
  const now = new Date().toISOString();
  const conv: Conversation = {
    id,
    name: req.body.name ?? 'Untitled Conversation',
    characterIds: req.body.characterIds ?? [],
    segments: [],
    memories: [],
    settings: req.body.settings ?? {
      model: 'claude-opus-4-6',
      generationMode: 'batch',
      turnsPerSegment: 60,
      memorySummaryInterval: 3,
      topicSeeds: req.body.topicSeeds ?? [],
      pauseRange: { minMs: 300, maxMs: 2000 },
      longPauseChance: 0.1,
    },
    createdAt: now,
    updatedAt: now,
    totalTurns: 0,
    status: 'draft',
  };
  const filePath = path.join(getConversationsDir(), `${id}.json`);
  await writeJson(filePath, conv);
  res.status(201).json(conv);
});

conversationsRouter.put('/:id', async (req, res) => {
  const filePath = path.join(getConversationsDir(), `${req.params.id}.json`);
  const existing = await readJson<Conversation>(filePath);
  if (!existing) {
    res.status(404).json({ error: 'Conversation not found' });
    return;
  }
  const updated: Conversation = {
    ...existing,
    ...req.body,
    id: existing.id,
    createdAt: existing.createdAt,
    updatedAt: new Date().toISOString(),
  };
  await writeJson(filePath, updated);
  res.json(updated);
});

conversationsRouter.delete('/:id', async (req, res) => {
  const filePath = path.join(getConversationsDir(), `${req.params.id}.json`);
  const deleted = await deleteFile(filePath);
  if (!deleted) {
    res.status(404).json({ error: 'Conversation not found' });
    return;
  }
  res.json({ success: true });
});
