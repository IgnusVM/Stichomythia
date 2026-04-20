import { Router } from 'express';
import fs from 'fs/promises';
import path from 'path';
import { readJson, writeJson, getTracksPath } from '../utils/files.js';

const AUDIO_EXTENSIONS = new Set(['.mp3', '.wav', '.flac', '.ogg', '.m4a', '.aac', '.wma', '.aiff']);

interface StemSlot {
  filePath: string;
  fileName: string;
  speakerId: string | null;
  volume: number;
  muted: boolean;
  soloed: boolean;
}

interface StemTrack {
  id: string;
  name: string;
  stems: StemSlot[];
  createdAt: string;
  updatedAt: string;
}

interface TracksStore {
  tracks: StemTrack[];
}

export const tracksRouter = Router();

tracksRouter.get('/', async (_req, res) => {
  const store = await readJson<TracksStore>(getTracksPath());
  res.json(store?.tracks ?? []);
});

tracksRouter.post('/', async (req, res) => {
  const store = await readJson<TracksStore>(getTracksPath()) ?? { tracks: [] };
  const track: StemTrack = {
    id: req.body.id,
    name: req.body.name,
    stems: req.body.stems ?? [],
    createdAt: req.body.createdAt ?? new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  store.tracks.push(track);
  await writeJson(getTracksPath(), store);
  res.json(track);
});

tracksRouter.put('/:id', async (req, res) => {
  const store = await readJson<TracksStore>(getTracksPath()) ?? { tracks: [] };
  const idx = store.tracks.findIndex(t => t.id === req.params.id);
  if (idx === -1) { res.status(404).json({ error: 'Not found' }); return; }
  store.tracks[idx] = {
    ...store.tracks[idx],
    name: req.body.name ?? store.tracks[idx].name,
    stems: req.body.stems ?? store.tracks[idx].stems,
    updatedAt: new Date().toISOString(),
  };
  await writeJson(getTracksPath(), store);
  res.json(store.tracks[idx]);
});

tracksRouter.delete('/:id', async (req, res) => {
  const store = await readJson<TracksStore>(getTracksPath()) ?? { tracks: [] };
  store.tracks = store.tracks.filter(t => t.id !== req.params.id);
  await writeJson(getTracksPath(), store);
  res.json({ ok: true });
});

tracksRouter.post('/browse', async (req, res) => {
  const folderPath: string = req.body.path;
  if (!folderPath) { res.status(400).json({ error: 'path required' }); return; }
  try {
    const entries = await fs.readdir(folderPath, { withFileTypes: true });
    const files = entries
      .filter(e => e.isFile() && AUDIO_EXTENSIONS.has(path.extname(e.name).toLowerCase()))
      .map(e => ({
        name: e.name,
        path: path.join(folderPath, e.name),
      }));
    const subdirs = entries
      .filter(e => e.isDirectory())
      .map(e => ({
        name: e.name,
        path: path.join(folderPath, e.name),
      }));
    res.json({ files, subdirs, current: folderPath });
  } catch {
    res.status(400).json({ error: 'Cannot read folder' });
  }
});

tracksRouter.get('/file', async (req, res) => {
  const filePath = req.query.path as string;
  if (!filePath) { res.status(400).json({ error: 'path required' }); return; }
  try {
    await fs.access(filePath);
    res.sendFile(filePath);
  } catch {
    res.status(404).json({ error: 'File not found' });
  }
});
