import { exec, execFile } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs/promises';
import { v4 as uuid } from 'uuid';
import { getAudioDir, ensureDir, readJson, getSettingsPath } from '../utils/files.js';

const execFileAsync = promisify(execFile);
const execAsync = promisify(exec);

interface RenderOptions {
  text: string;
  voice: string;
  rate: string;
  pitch: string;
  conversationId: string;
  turnId: string;
}

interface RenderResult {
  turnId: string;
  audioFile: string;
  durationMs: number;
  success: boolean;
  error?: string;
}

let edgeTtsCommand: string | null = null;

async function detectEdgeTts(): Promise<string> {
  if (edgeTtsCommand) return edgeTtsCommand;

  const tryExec = (cmd: string): Promise<boolean> =>
    new Promise(resolve => {
      exec(`${cmd} --list-voices`, { timeout: 10000 }, err => resolve(!err));
    });

  if (await tryExec('edge-tts')) { edgeTtsCommand = 'edge-tts'; return edgeTtsCommand; }
  if (await tryExec('python -m edge_tts')) { edgeTtsCommand = 'python -m edge_tts'; return edgeTtsCommand; }
  if (await tryExec('python3 -m edge_tts')) { edgeTtsCommand = 'python3 -m edge_tts'; return edgeTtsCommand; }

  throw new Error('edge-tts not found. Install with: pip install edge-tts');
}

async function getAudioDuration(filePath: string): Promise<number> {
  try {
    const stats = await fs.stat(filePath);
    return Math.round((stats.size / 16000) * 1000);
  } catch {
    return 3000;
  }
}

async function runEdgeTts(args: string[], timeout = 30000): Promise<void> {
  const cmd = await detectEdgeTts();

  if (cmd === 'edge-tts') {
    await execFileAsync('edge-tts', args, { timeout });
  } else {
    const escapedArgs = args.map(a => {
      if (a.includes(' ') || a.includes('"') || a.includes("'")) {
        return `"${a.replace(/"/g, '\\"')}"`;
      }
      return a;
    });
    await execAsync(`${cmd} ${escapedArgs.join(' ')}`, { timeout });
  }
}

async function renderWithRetry(
  args: string[],
  outputPath: string,
  maxRetries: number = 3,
): Promise<void> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      await runEdgeTts(args);
      const stats = await fs.stat(outputPath);
      if (stats.size > 0) return;
      throw new Error('Empty output file');
    } catch (err) {
      if (attempt === maxRetries - 1) throw err;
      const delay = 1000 * Math.pow(2, attempt);
      await new Promise(r => setTimeout(r, delay));
    }
  }
}

export async function renderTurn(options: RenderOptions): Promise<RenderResult> {
  const audioDir = path.join(getAudioDir(), options.conversationId);
  await ensureDir(audioDir);

  const filename = `${options.turnId}.mp3`;
  const outputPath = path.join(audioDir, filename);

  try {
    const args = [
      '--voice', options.voice,
      '--rate', options.rate,
      '--pitch', options.pitch,
      '--text', options.text,
      '--write-media', outputPath,
    ];

    await renderWithRetry(args, outputPath);

    const durationMs = await getAudioDuration(outputPath);

    return {
      turnId: options.turnId,
      audioFile: `/audio/${options.conversationId}/${filename}`,
      durationMs,
      success: true,
    };
  } catch (err) {
    return {
      turnId: options.turnId,
      audioFile: '',
      durationMs: 0,
      success: false,
      error: String(err),
    };
  }
}

const MOOD_INSTRUCTIONS: Record<string, string> = {
  relaxed: 'Speak in a calm, easy, laid-back tone. Unhurried and comfortable.',
  amused: 'Speak with warm amusement, a smile in your voice. Light and easy.',
  curious: 'Speak with genuine curiosity and interest. Slightly upbeat, leaning in.',
  excited: 'Speak with energy and enthusiasm. Faster pace, animated.',
  annoyed: 'Speak with clipped irritation. Slightly terse, shorter phrasing.',
  frustrated: 'Speak with restrained frustration. Tense, controlled but clearly bothered.',
  angry: 'Speak with sharp, forceful irritation. Biting tone.',
  sarcastic: 'Speak with dry sarcasm. Flat delivery with subtle edge.',
  thoughtful: 'Speak slowly and reflectively, as if thinking out loud. Measured pace.',
  hesitant: 'Speak with uncertainty. Halting, careful, slightly unsure.',
  uncomfortable: 'Speak with awkward discomfort. Stilted, wanting to move on.',
  sad: 'Speak with quiet sadness. Subdued, lower energy.',
  nostalgic: 'Speak with wistful warmth. Fond but a little melancholy.',
  playful: 'Speak with teasing, playful energy. Light and fun.',
  defensive: 'Speak with guarded defensiveness. Slightly sharp, justifying.',
  dismissive: 'Speak with casual dismissiveness. Unbothered, brushing it off.',
  surprised: 'Speak with genuine surprise. Slightly higher pitch, caught off guard.',
  shocked: 'Speak with stunned disbelief. Taken aback.',
  embarrassed: 'Speak with flustered embarrassment. Slightly rushed, wanting to deflect.',
  confident: 'Speak with assured confidence. Steady, direct, certain.',
  passionate: 'Speak with deep conviction and intensity. Engaged and emphatic.',
  bored: 'Speak with flat, low-energy boredom. Disengaged monotone.',
  sympathetic: 'Speak with gentle sympathy and warmth. Soft, caring.',
  skeptical: 'Speak with mild skepticism. Questioning, not quite buying it.',
  deadpan: 'Speak with completely flat, dry delivery. No inflection.',
  wistful: 'Speak with gentle longing. Soft, reflective.',
  eager: 'Speak with bright eagerness. Ready and forward-leaning.',
  resigned: 'Speak with quiet resignation. Accepting, low energy.',
  conspiratorial: 'Speak with hushed, conspiratorial energy. Like sharing a secret.',
  teasing: 'Speak with warm, good-natured teasing. Playful ribbing.',
};

function getMoodInstruction(moodTag: string): string {
  const normalized = moodTag.toLowerCase().trim();
  if (MOOD_INSTRUCTIONS[normalized]) return MOOD_INSTRUCTIONS[normalized];
  for (const [key, instruction] of Object.entries(MOOD_INSTRUCTIONS)) {
    if (normalized.includes(key) || key.includes(normalized)) return instruction;
  }
  return 'Speak naturally and conversationally, like talking with close friends.';
}

export async function renderTurnOpenAI(options: RenderOptions & { openaiVoice?: string; openaiModel?: string; openaiSpeed?: number; moodTag?: string }): Promise<RenderResult> {
  const audioDir = path.join(getAudioDir(), options.conversationId);
  await ensureDir(audioDir);

  const filename = `${options.turnId}.mp3`;
  const outputPath = path.join(audioDir, filename);

  try {
    const settings = await readJson<{ openaiApiKey: string }>(getSettingsPath());
    const apiKey = settings?.openaiApiKey;
    if (!apiKey) throw new Error('OpenAI API key not configured');

    const voice = options.openaiVoice || 'alloy';
    const rawModel = options.openaiModel || 'tts-1';
    const model = rawModel === 'gpt-4o-mini-tts' ? 'gpt-4o-mini-tts-2025-03-20' : rawModel;

    const isMinitts = model.startsWith('gpt-4o-mini-tts');
    const body: Record<string, unknown> = {
      model,
      input: options.text,
      voice,
      speed: options.openaiSpeed ?? 1.0,
      response_format: 'mp3',
    };
    if (isMinitts && options.moodTag) {
      body.instructions = getMoodInstruction(options.moodTag);
    }

    const response = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`OpenAI TTS failed: ${response.status} ${err}`);
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    await fs.writeFile(outputPath, buffer);

    const durationMs = await getAudioDuration(outputPath);

    return {
      turnId: options.turnId,
      audioFile: `/audio/${options.conversationId}/${filename}`,
      durationMs,
      success: true,
    };
  } catch (err) {
    return {
      turnId: options.turnId,
      audioFile: '',
      durationMs: 0,
      success: false,
      error: String(err),
    };
  }
}

export async function renderTurnsWithThrottle(
  turns: Array<RenderOptions & { ttsProvider?: string; openaiVoice?: string; openaiModel?: string; openaiSpeed?: number; moodTag?: string }>,
  throttleMs: number,
  onProgress: (result: RenderResult, index: number, total: number) => void,
): Promise<RenderResult[]> {
  const results: RenderResult[] = [];

  for (let i = 0; i < turns.length; i++) {
    const turn = turns[i];
    const result = turn.ttsProvider === 'openai'
      ? await renderTurnOpenAI(turn)
      : await renderTurn(turn);
    results.push(result);
    onProgress(result, i, turns.length);

    if (i < turns.length - 1) {
      await new Promise(r => setTimeout(r, turn.ttsProvider === 'openai' ? 100 : throttleMs));
    }
  }

  return results;
}
