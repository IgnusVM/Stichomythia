import { useState, useEffect } from 'react';
import type { Character, EmotionalTrigger } from '@/types';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { VoiceSettings } from './VoiceSettings';
import { TriggerCard } from './TriggerCard';
import { ChevronDown, Save, Trash2, X } from 'lucide-react';

interface Props {
  character: Character;
  onSave: (data: Partial<Character>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

const TEMPERAMENTS = [
  'even-keeled',
  'hot-headed',
  'sensitive',
  'anxious',
  'cheerful',
  'sardonic',
  'oblivious',
] as const;

export function CharacterEditor({ character, onSave, onDelete }: Props) {
  const [form, setForm] = useState(character);
  const [tagInput, setTagInput] = useState({ interests: '', quirks: '' });
  const [saving, setSaving] = useState(false);
  const [emotionOpen, setEmotionOpen] = useState(true);
  const [voiceOpen, setVoiceOpen] = useState(true);
  const [promptOpen, setPromptOpen] = useState(false);

  useEffect(() => {
    setForm(character);
  }, [character]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(form);
    } finally {
      setSaving(false);
    }
  };

  const addTag = (field: 'interests' | 'quirks') => {
    const value = tagInput[field].trim();
    if (!value) return;
    setForm((prev) => ({
      ...prev,
      [field]: [...prev[field], value],
    }));
    setTagInput((prev) => ({ ...prev, [field]: '' }));
  };

  const removeTag = (field: 'interests' | 'quirks', index: number) => {
    setForm((prev) => ({
      ...prev,
      [field]: prev[field].filter((_, i) => i !== index),
    }));
  };

  const addTrigger = () => {
    const trigger: EmotionalTrigger = {
      topic: '',
      reaction: 'irritated',
      intensity: 'moderate',
      description: '',
    };
    setForm((prev) => ({
      ...prev,
      emotionalProfile: {
        ...prev.emotionalProfile,
        triggers: [...prev.emotionalProfile.triggers, trigger],
      },
    }));
  };

  const updateTrigger = (index: number, trigger: EmotionalTrigger) => {
    setForm((prev) => ({
      ...prev,
      emotionalProfile: {
        ...prev.emotionalProfile,
        triggers: prev.emotionalProfile.triggers.map((t, i) =>
          i === index ? trigger : t
        ),
      },
    }));
  };

  const removeTrigger = (index: number) => {
    setForm((prev) => ({
      ...prev,
      emotionalProfile: {
        ...prev.emotionalProfile,
        triggers: prev.emotionalProfile.triggers.filter((_, i) => i !== index),
      },
    }));
  };

  return (
    <div className="p-6 max-w-2xl">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <input
            type="color"
            value={form.color}
            onChange={(e) => setForm((prev) => ({ ...prev, color: e.target.value }))}
            className="w-8 h-8 rounded cursor-pointer border-0 bg-transparent"
          />
          <h2 className="text-xl font-semibold">Character</h2>
        </div>
        <div className="flex gap-2">
          <Button
            variant="destructive"
            size="sm"
            onClick={() => onDelete(character.id)}
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <div className="space-y-6">
        <div>
          <Label htmlFor="personality">Personality</Label>
          <Textarea
            id="personality"
            value={form.personality}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, personality: e.target.value }))
            }
            placeholder="Laid-back, dry humor, tends to play devil's advocate..."
            rows={3}
          />
        </div>

        <div>
          <Label htmlFor="speechStyle">Speech Style</Label>
          <Textarea
            id="speechStyle"
            value={form.speechStyle}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, speechStyle: e.target.value }))
            }
            placeholder="Terse, lots of 'yeah' and 'nah', rarely asks questions..."
            rows={2}
          />
        </div>

        <div>
          <Label>Interests</Label>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {form.interests.map((tag, i) => (
              <Badge key={i} variant="secondary" className="gap-1">
                {tag}
                <button onClick={() => removeTag('interests', i)}>
                  <X className="w-3 h-3" />
                </button>
              </Badge>
            ))}
          </div>
          <div className="flex gap-2">
            <Input
              value={tagInput.interests}
              onChange={(e) =>
                setTagInput((prev) => ({ ...prev, interests: e.target.value }))
              }
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addTag('interests'))}
              placeholder="Type and press Enter..."
              className="flex-1"
            />
          </div>
        </div>

        <div>
          <Label>Quirks</Label>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {form.quirks.map((tag, i) => (
              <Badge key={i} variant="secondary" className="gap-1">
                {tag}
                <button onClick={() => removeTag('quirks', i)}>
                  <X className="w-3 h-3" />
                </button>
              </Badge>
            ))}
          </div>
          <div className="flex gap-2">
            <Input
              value={tagInput.quirks}
              onChange={(e) =>
                setTagInput((prev) => ({ ...prev, quirks: e.target.value }))
              }
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addTag('quirks'))}
              placeholder="Type and press Enter..."
              className="flex-1"
            />
          </div>
        </div>

        <Separator />

        <Collapsible open={emotionOpen} onOpenChange={setEmotionOpen}>
          <CollapsibleTrigger className="flex items-center gap-2 text-sm font-semibold w-full">
            <ChevronDown
              className={`w-4 h-4 transition-transform ${emotionOpen ? '' : '-rotate-90'}`}
            />
            Emotional Profile
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-4 space-y-4">
            <div>
              <Label>Temperament</Label>
              <Select
                value={form.emotionalProfile.temperament}
                onValueChange={(val) =>
                  setForm((prev) => ({
                    ...prev,
                    emotionalProfile: {
                      ...prev.emotionalProfile,
                      temperament: val as Character['emotionalProfile']['temperament'],
                    },
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TEMPERAMENTS.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Recovery Speed</Label>
              <p className="text-xs text-muted-foreground mb-2">
                How quickly they cool down after an emotional reaction
              </p>
              <RadioGroup
                value={form.emotionalProfile.recoverySpeed}
                onValueChange={(val) =>
                  setForm((prev) => ({
                    ...prev,
                    emotionalProfile: {
                      ...prev.emotionalProfile,
                      recoverySpeed: val as 'slow' | 'medium' | 'fast',
                    },
                  }))
                }
                className="flex gap-4"
              >
                {(['slow', 'medium', 'fast'] as const).map((speed) => (
                  <div key={speed} className="flex items-center gap-2">
                    <RadioGroupItem value={speed} id={`speed-${speed}`} />
                    <Label htmlFor={`speed-${speed}`} className="text-sm capitalize">
                      {speed}
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <Label>Triggers</Label>
                <Button size="sm" variant="outline" onClick={addTrigger}>
                  + Add Trigger
                </Button>
              </div>
              <div className="space-y-3">
                {form.emotionalProfile.triggers.map((trigger, i) => (
                  <TriggerCard
                    key={i}
                    trigger={trigger}
                    onChange={(t) => updateTrigger(i, t)}
                    onRemove={() => removeTrigger(i)}
                  />
                ))}
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>

        <Separator />

        <Collapsible open={voiceOpen} onOpenChange={setVoiceOpen}>
          <CollapsibleTrigger className="flex items-center gap-2 text-sm font-semibold w-full">
            <ChevronDown
              className={`w-4 h-4 transition-transform ${voiceOpen ? '' : '-rotate-90'}`}
            />
            Voice Settings
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-4">
            <VoiceSettings
              voice={form.voice}
              onChange={(voice) => setForm((prev) => ({ ...prev, voice }))}
            />
          </CollapsibleContent>
        </Collapsible>

        <Separator />

        <Collapsible open={promptOpen} onOpenChange={setPromptOpen}>
          <CollapsibleTrigger className="flex items-center gap-2 text-sm font-semibold w-full">
            <ChevronDown
              className={`w-4 h-4 transition-transform ${promptOpen ? '' : '-rotate-90'}`}
            />
            System Prompt (auto-generated)
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-4">
            <Textarea
              value={form.systemPrompt ?? ''}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, systemPrompt: e.target.value }))
              }
              rows={12}
              className="font-mono text-xs"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Auto-generated from fields above. Edit to override.
            </p>
          </CollapsibleContent>
        </Collapsible>

        <div className="pt-4">
          <Button onClick={handleSave} disabled={saving} className="w-full">
            <Save className="w-4 h-4 mr-2" />
            {saving ? 'Saving...' : 'Save Character'}
          </Button>
        </div>
      </div>
    </div>
  );
}
