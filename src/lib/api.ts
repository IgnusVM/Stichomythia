import type {
  Character,
  Conversation,
  AppSettings,
  EdgeTtsVoice,
} from '@/types';

const BASE = '/api';

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${url}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`${res.status}: ${body}`);
  }
  return res.json();
}

export const api = {
  characters: {
    list: () => request<Character[]>('/characters'),
    get: (id: string) => request<Character>(`/characters/${id}`),
    create: (data: Partial<Character>) =>
      request<Character>('/characters', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    update: (id: string, data: Partial<Character>) =>
      request<Character>(`/characters/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
    delete: (id: string) =>
      request<{ success: boolean }>(`/characters/${id}`, { method: 'DELETE' }),
  },

  conversations: {
    list: () => request<Conversation[]>('/conversations'),
    get: (id: string) => request<Conversation>(`/conversations/${id}`),
    create: (data: { name: string; characterIds: string[]; topicSeeds?: string[] }) =>
      request<Conversation>('/conversations', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    update: (id: string, data: Partial<Conversation>) =>
      request<Conversation>(`/conversations/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
    delete: (id: string) =>
      request<{ success: boolean }>(`/conversations/${id}`, { method: 'DELETE' }),
  },

  settings: {
    get: () => request<AppSettings>('/settings'),
    update: (data: Partial<AppSettings>) =>
      request<AppSettings>('/settings', {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
    verifyApiKey: (apiKey: string) =>
      request<{ valid: boolean; error?: string }>('/settings/verify-api-key', {
        method: 'POST',
        body: JSON.stringify({ apiKey }),
      }),
    verifyEdgeTts: () =>
      request<{ installed: boolean; error?: string }>('/settings/verify-edge-tts', {
        method: 'POST',
      }),
    verifyFfmpeg: () =>
      request<{ installed: boolean; version?: string; error?: string }>(
        '/settings/verify-ffmpeg',
        { method: 'POST' }
      ),
  },

  tts: {
    voices: () => request<EdgeTtsVoice[]>('/tts/voices'),
    preview: async (text: string, voice: string, rate?: string, pitch?: string) => {
      const res = await fetch(`${BASE}/tts/preview`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, voice, rate, pitch }),
      });
      if (!res.ok) throw new Error(`TTS preview failed: ${res.status}`);
      return res.blob();
    },
  },
};
