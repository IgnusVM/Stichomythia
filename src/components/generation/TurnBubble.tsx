import { useState } from 'react';
import type { Turn, Character } from '@/types';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Pencil, Trash2, Check, X } from 'lucide-react';

interface Props {
  turn: Turn;
  character?: Character;
  onEdit: (text: string) => void;
  onDelete: () => void;
}

export function TurnBubble({ turn, character, onEdit, onDelete }: Props) {
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(turn.text);
  const [hovered, setHovered] = useState(false);

  const handleSave = () => {
    onEdit(editText);
    setEditing(false);
  };

  const handleCancel = () => {
    setEditText(turn.text);
    setEditing(false);
  };

  return (
    <div
      className="flex gap-2 py-1 px-2 rounded-md hover:bg-muted/30 group relative"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div
        className="w-2 h-2 rounded-full mt-2 shrink-0"
        style={{ backgroundColor: character?.color ?? '#888' }}
      />

      <div className="flex-1 min-w-0">
        {editing ? (
          <div className="space-y-2">
            <Textarea
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              rows={2}
              className="text-sm"
              autoFocus
            />
            <div className="flex gap-1">
              <Button size="sm" variant="ghost" onClick={handleSave}>
                <Check className="w-3 h-3" />
              </Button>
              <Button size="sm" variant="ghost" onClick={handleCancel}>
                <X className="w-3 h-3" />
              </Button>
            </div>
          </div>
        ) : (
          <>
            <span className="text-xs text-muted-foreground mr-2">({turn.moodTag})</span>
            <span className="text-sm">{turn.text}</span>
            {turn.status === 'edited' && (
              <span className="text-xs text-yellow-500 ml-2">edited</span>
            )}
          </>
        )}
      </div>

      {hovered && !editing && (
        <div className="flex gap-0.5 shrink-0">
          <Button
            size="icon"
            variant="ghost"
            className="h-6 w-6"
            onClick={() => setEditing(true)}
          >
            <Pencil className="w-3 h-3" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="h-6 w-6 text-destructive"
            onClick={onDelete}
          >
            <Trash2 className="w-3 h-3" />
          </Button>
        </div>
      )}
    </div>
  );
}
