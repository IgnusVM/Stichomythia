import { Router } from 'express';
import { execFile } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs/promises';
import { v4 as uuid } from 'uuid';
import { getAudioDir, ensureDir } from '../utils/files.js';

const execFileAsync = promisify(execFile);

export const ttsRouter = Router();

ttsRouter.get('/voices', async (_req, res) => {
  try {
    const { stdout } = await execFileAsync('edge-tts', ['--list-voices'], {
      timeout: 15000,
    });

    const voices: Array<{
      name: string;
      gender: string;
      locale: string;
      friendlyName: string;
    }> = [];

    const lines = stdout.split('\n');
    let current: Record<string, string> = {};

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('Name:')) {
        if (current.Name) {
          if (current.Name.startsWith('en-')) {
            voices.push({
              name: current.Name,
              gender: current.Gender ?? '',
              locale: current.Locale ?? current.Name.split('-').slice(0, 2).join('-'),
              friendlyName:
                current.FriendlyName ?? current.Name.split('-').pop()?.replace('Neural', '') ?? '',
            });
          }
        }
        current = {};
        current.Name = trimmed.replace('Name: ', '').trim();
      } else if (trimmed.startsWith('Gender:')) {
        current.Gender = trimmed.replace('Gender: ', '').trim();
      } else if (trimmed.startsWith('Locale:')) {
        current.Locale = trimmed.replace('Locale: ', '').trim();
      } else if (trimmed.startsWith('FriendlyName:')) {
        current.FriendlyName = trimmed.replace('FriendlyName: ', '').trim();
      }
    }

    if (current.Name?.startsWith('en-')) {
      voices.push({
        name: current.Name,
        gender: current.Gender ?? '',
        locale: current.Locale ?? '',
        friendlyName: current.FriendlyName ?? '',
      });
    }

    res.json(voices);
  } catch (err) {
    res.status(500).json({ error: `Failed to list voices: ${err}` });
  }
});

ttsRouter.post('/preview', async (req, res) => {
  const { text, voice, rate, pitch } = req.body;
  if (!text || !voice) {
    res.status(400).json({ error: 'text and voice are required' });
    return;
  }

  const tempDir = path.join(getAudioDir(), 'previews');
  await ensureDir(tempDir);
  const filename = `preview-${uuid()}.mp3`;
  const outputPath = path.join(tempDir, filename);

  try {
    const args = [
      '--voice', voice,
      '--rate', rate ?? '+0%',
      '--pitch', pitch ?? '+0Hz',
      '--text', text,
      '--write-media', outputPath,
    ];

    await execFileAsync('edge-tts', args, { timeout: 30000 });

    const audioData = await fs.readFile(outputPath);
    res.set('Content-Type', 'audio/mpeg');
    res.send(audioData);

    fs.unlink(outputPath).catch(() => {});
  } catch (err) {
    res.status(500).json({ error: `TTS failed: ${err}` });
  }
});
