import fs from 'fs/promises';
import path from 'path';

const DATA_DIR = path.resolve('./data');
const EXPORTS_DIR = path.resolve('./exports');

export async function ensureDir(dir: string): Promise<void> {
  await fs.mkdir(dir, { recursive: true });
}

export async function ensureDataDirs(): Promise<void> {
  await Promise.all([
    ensureDir(path.join(DATA_DIR, 'characters')),
    ensureDir(path.join(DATA_DIR, 'conversations')),
    ensureDir(path.join(DATA_DIR, 'audio')),
    ensureDir(EXPORTS_DIR),
  ]);
}

export async function readJson<T>(filePath: string): Promise<T | null> {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(content) as T;
  } catch {
    return null;
  }
}

export async function writeJson<T>(filePath: string, data: T): Promise<void> {
  await ensureDir(path.dirname(filePath));
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

export async function deleteFile(filePath: string): Promise<boolean> {
  try {
    await fs.unlink(filePath);
    return true;
  } catch {
    return false;
  }
}

export async function listJsonFiles(dir: string): Promise<string[]> {
  try {
    const files = await fs.readdir(dir);
    return files.filter((f) => f.endsWith('.json')).map((f) => path.join(dir, f));
  } catch {
    return [];
  }
}

export function getCharactersDir(): string {
  return path.join(DATA_DIR, 'characters');
}

export function getConversationsDir(): string {
  return path.join(DATA_DIR, 'conversations');
}

export function getAudioDir(): string {
  return path.join(DATA_DIR, 'audio');
}

export function getExportsDir(): string {
  return EXPORTS_DIR;
}

export function getSettingsPath(): string {
  return path.join(DATA_DIR, 'settings.json');
}
