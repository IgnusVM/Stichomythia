import type { EmotionalTrigger } from '@/types';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Trash2 } from 'lucide-react';

const REACTIONS: EmotionalTrigger['reaction'][] = [
  'irritated',
  'angry',
  'excited',
  'passionate',
  'defensive',
  'nostalgic',
  'uncomfortable',
  'withdrawn',
  'amused',
];

const INTENSITIES: EmotionalTrigger['intensity'][] = ['mild', 'moderate', 'strong'];

interface Props {
  trigger: EmotionalTrigger;
  onChange: (trigger: EmotionalTrigger) => void;
  onRemove: () => void;
}

export function TriggerCard({ trigger, onChange, onRemove }: Props) {
  return (
    <Card>
      <CardContent className="p-3 space-y-2">
        <div className="flex gap-2">
          <div className="flex-1">
            <Input
              value={trigger.topic}
              onChange={(e) => onChange({ ...trigger, topic: e.target.value })}
              placeholder="Topic (e.g., politics)"
              className="text-sm"
            />
          </div>
          <Button size="icon" variant="ghost" onClick={onRemove}>
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
        <div className="flex gap-2">
          <Select
            value={trigger.reaction}
            onValueChange={(val) =>
              onChange({ ...trigger, reaction: val as EmotionalTrigger['reaction'] })
            }
          >
            <SelectTrigger className="flex-1 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {REACTIONS.map((r) => (
                <SelectItem key={r} value={r}>
                  {r}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={trigger.intensity}
            onValueChange={(val) =>
              onChange({ ...trigger, intensity: val as EmotionalTrigger['intensity'] })
            }
          >
            <SelectTrigger className="w-28 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {INTENSITIES.map((i) => (
                <SelectItem key={i} value={i}>
                  {i}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Textarea
          value={trigger.description}
          onChange={(e) => onChange({ ...trigger, description: e.target.value })}
          placeholder="Gets visibly annoyed when people dismiss..."
          rows={2}
          className="text-sm"
        />
      </CardContent>
    </Card>
  );
}
