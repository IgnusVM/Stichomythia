import type { Character } from '@/types';

interface Props {
  characters: Character[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export function CharacterList({ characters, selectedId, onSelect }: Props) {
  return (
    <div className="space-y-1">
      {characters.map((char, i) => (
        <button
          key={char.id}
          onClick={() => onSelect(char.id)}
          className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors text-left ${
            selectedId === char.id
              ? 'bg-accent text-accent-foreground'
              : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
          }`}
        >
          <div
            className="w-3 h-3 rounded-full shrink-0"
            style={{ backgroundColor: char.color }}
          />
          <span className="truncate">
            {char.personality
              ? char.personality.slice(0, 25) + (char.personality.length > 25 ? '...' : '')
              : `Person ${String.fromCharCode(65 + i)}`}
          </span>
        </button>
      ))}
    </div>
  );
}
