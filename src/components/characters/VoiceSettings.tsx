import { useState, useEffect, useRef } from 'react';
import { api } from '@/lib/api';
import type { EdgeTtsVoice } from '@/types';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Play, Loader2 } from 'lucide-react';

interface VoiceConfig {
  edgeTtsVoice: string;
  rate: string;
  pitch: string;
}

interface Props {
  voice: VoiceConfig;
  onChange: (voice: VoiceConfig) => void;
}

function rateToNumber(rate: string): number {
  return parseInt(rate.replace('%', '').replace('+', ''), 10) || 0;
}

function pitchToNumber(pitch: string): number {
  return parseInt(pitch.replace('Hz', '').replace('+', ''), 10) || 0;
}

export function VoiceSettings({ voice, onChange }: Props) {
  const [voices, setVoices] = useState<EdgeTtsVoice[]>([]);
  const [previewText, setPreviewText] = useState("Hello, how's it going?");
  const [previewing, setPreviewing] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    api.tts
      .voices()
      .then(setVoices)
      .catch(() => {});
  }, []);

  const handlePreview = async () => {
    setPreviewing(true);
    try {
      const blob = await api.tts.preview(
        previewText,
        voice.edgeTtsVoice,
        voice.rate,
        voice.pitch
      );
      const url = URL.createObjectURL(blob);
      if (audioRef.current) {
        audioRef.current.pause();
        URL.revokeObjectURL(audioRef.current.src);
      }
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onended = () => URL.revokeObjectURL(url);
      await audio.play();
    } catch (err) {
      console.error('Preview failed:', err);
    } finally {
      setPreviewing(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <Label>Voice</Label>
        <Select
          value={voice.edgeTtsVoice}
          onValueChange={(val) => onChange({ ...voice, edgeTtsVoice: val })}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select a voice" />
          </SelectTrigger>
          <SelectContent className="max-h-60">
            {voices.map((v) => (
              <SelectItem key={v.name} value={v.name}>
                {v.friendlyName || v.name} ({v.gender}, {v.locale})
              </SelectItem>
            ))}
            {voices.length === 0 && (
              <SelectItem value={voice.edgeTtsVoice} disabled>
                Loading voices...
              </SelectItem>
            )}
          </SelectContent>
        </Select>
      </div>

      <div>
        <div className="flex items-center justify-between mb-1">
          <Label>Rate</Label>
          <span className="text-xs text-muted-foreground">
            {rateToNumber(voice.rate) >= 0 ? '+' : ''}
            {rateToNumber(voice.rate)}%
          </span>
        </div>
        <Slider
          value={[rateToNumber(voice.rate)]}
          min={-50}
          max={50}
          step={5}
          onValueChange={([val]) => {
            const prefix = val >= 0 ? '+' : '';
            onChange({ ...voice, rate: `${prefix}${val}%` });
          }}
        />
      </div>

      <div>
        <div className="flex items-center justify-between mb-1">
          <Label>Pitch</Label>
          <span className="text-xs text-muted-foreground">
            {pitchToNumber(voice.pitch) >= 0 ? '+' : ''}
            {pitchToNumber(voice.pitch)}Hz
          </span>
        </div>
        <Slider
          value={[pitchToNumber(voice.pitch)]}
          min={-50}
          max={50}
          step={5}
          onValueChange={([val]) => {
            const prefix = val >= 0 ? '+' : '';
            onChange({ ...voice, pitch: `${prefix}${val}Hz` });
          }}
        />
      </div>

      <div>
        <Label>Preview</Label>
        <div className="flex gap-2 mt-1">
          <Input
            value={previewText}
            onChange={(e) => setPreviewText(e.target.value)}
            placeholder="Type a test sentence..."
            className="flex-1"
          />
          <Button
            onClick={handlePreview}
            disabled={previewing || !previewText.trim()}
            size="icon"
          >
            {previewing ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Play className="w-4 h-4" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
