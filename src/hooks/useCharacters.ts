import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import type { Character } from '@/types';

export function useCharacters() {
  const [characters, setCharacters] = useState<Character[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const list = await api.characters.list();
      setCharacters(list);
    } catch (err) {
      console.error('Failed to load characters:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const create = async (data: Partial<Character>) => {
    const char = await api.characters.create(data);
    setCharacters((prev) => [...prev, char]);
    return char;
  };

  const update = async (id: string, data: Partial<Character>) => {
    const char = await api.characters.update(id, data);
    setCharacters((prev) => prev.map((c) => (c.id === id ? char : c)));
    return char;
  };

  const remove = async (id: string) => {
    await api.characters.delete(id);
    setCharacters((prev) => prev.filter((c) => c.id !== id));
  };

  return { characters, loading, refresh, create, update, remove };
}
