import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { ensureDataDirs } from './utils/files.js';
import { charactersRouter } from './routes/characters.js';
import { conversationsRouter } from './routes/conversations.js';
import { settingsRouter } from './routes/settings.js';
import { ttsRouter } from './routes/tts.js';
import { generationRouter } from './routes/generation.js';
import { exportRouter } from './routes/export.js';

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

app.use('/api/characters', charactersRouter);
app.use('/api/conversations', conversationsRouter);
app.use('/api/settings', settingsRouter);
app.use('/api/tts', ttsRouter);
app.use('/api/generation', generationRouter);
app.use('/api/export', exportRouter);

app.use('/audio', express.static(path.resolve('./data/audio')));

async function start() {
  await ensureDataDirs();
  app.listen(PORT, () => {
    console.log(`Stichomythia server running on http://localhost:${PORT}`);
  });
}

start();
