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
  ttsProvider?: 'edge-tts' | 'openai';
  edgeTtsVoice: string;
  rate: string;
  pitch: string;
  openaiVoice?: string;
  openaiModel?: string;
  openaiSpeed?: number;
}

interface Props {
  voice: VoiceConfig;
  onChange: (voice: VoiceConfig) => void;
}

type OpenAIModelId = 'tts-1' | 'tts-1-hd' | 'gpt-4o-mini-tts';

const ALL_MODELS: OpenAIModelId[] = ['tts-1', 'tts-1-hd', 'gpt-4o-mini-tts'];
const GPT4O_ONLY: OpenAIModelId[] = ['gpt-4o-mini-tts'];

const OPENAI_VOICES: { id: string; label: string; models: OpenAIModelId[] }[] = [
  { id: 'alloy',   label: 'Alloy — neutral, balanced',           models: ALL_MODELS },
  { id: 'ash',     label: 'Ash — warm, conversational',          models: GPT4O_ONLY },
  { id: 'ballad',  label: 'Ballad — expressive, storytelling',   models: GPT4O_ONLY },
  { id: 'coral',   label: 'Coral — warm, inviting',              models: GPT4O_ONLY },
  { id: 'echo',    label: 'Echo — clear, smooth',                models: ALL_MODELS },
  { id: 'fable',   label: 'Fable — expressive, animated',        models: ALL_MODELS },
  { id: 'onyx',    label: 'Onyx — deep, authoritative',          models: ALL_MODELS },
  { id: 'nova',    label: 'Nova — warm, friendly',               models: ALL_MODELS },
  { id: 'sage',    label: 'Sage — calm, measured',               models: GPT4O_ONLY },
  { id: 'shimmer', label: 'Shimmer — bright, optimistic',        models: ALL_MODELS },
  { id: 'verse',   label: 'Verse — versatile, dynamic',          models: GPT4O_ONLY },
];

const OPENAI_MODELS: { id: OpenAIModelId; label: string }[] = [
  { id: 'gpt-4o-mini-tts', label: 'GPT-4o Mini TTS — best quality, all voices' },
  { id: 'tts-1-hd',        label: 'TTS-1-HD — high quality, original 6 voices' },
  { id: 'tts-1',           label: 'TTS-1 — fast, lower quality, original 6 voices' },
];

function voiceSupportsModel(voiceId: string, modelId: OpenAIModelId): boolean {
  const v = OPENAI_VOICES.find((x) => x.id === voiceId);
  return v ? v.models.includes(modelId) : true;
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
  const provider = voice.ttsProvider ?? 'edge-tts';

  useEffect(() => {
    api.tts
      .voices()
      .then((v) => {
        v.sort((a, b) => {
          const aML = a.name.includes('Multilingual') ? 0 : 1;
          const bML = b.name.includes('Multilingual') ? 0 : 1;
          if (aML !== bML) return aML - bML;
          return a.name.localeCompare(b.name);
        });
        setVoices(v);
      })
      .catch(() => {});
  }, []);

  const handlePreview = async () => {
    setPreviewing(true);
    try {
      const blob = await api.tts.preview(
        previewText,
        voice.edgeTtsVoice,
        voice.rate,
        voice.pitch,
        provider,
        voice.openaiVoice,
        voice.openaiModel,
        voice.openaiSpeed,
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
        <Label>TTS Provider</Label>
        <Select
          value={provider}
          onValueChange={(val) => onChange({ ...voice, ttsProvider: val as 'edge-tts' | 'openai' })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="edge-tts">edge-tts (Free)</SelectItem>
            <SelectItem value="openai">OpenAI (Paid)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {provider === 'edge-tts' && (
        <>
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
                    {v.name.includes('Multilingual') ? '\u2605 ' : ''}{v.friendlyName || v.name} ({v.gender})
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
              max={100}
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
        </>
      )}

      {provider === 'openai' && (() => {
        const currentModel = (voice.openaiModel ?? 'gpt-4o-mini-tts') as OpenAIModelId;
        const currentVoice = voice.openaiVoice ?? 'alloy';
        const voiceCompatible = voiceSupportsModel(currentVoice, currentModel);
        return (
        <>
          <div>
            <div className="flex items-center justify-between mb-1">
              <Label>OpenAI Voice</Label>
              {!voiceCompatible && (
                <span className="text-xs text-amber-500">
                  Not supported by current model
                </span>
              )}
            </div>
            <Select
              value={currentVoice}
              onValueChange={(val) => onChange({ ...voice, openaiVoice: val })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {OPENAI_VOICES.map((v) => {
                  const supported = v.models.includes(currentModel);
                  return (
                    <SelectItem key={v.id} value={v.id} disabled={!supported}>
                      <span className="flex items-center justify-between gap-3 w-full">
                        <span>{v.label}</span>
                        {!supported && (
                          <span className="text-[10px] uppercase tracking-wider text-muted-foreground shrink-0">
                            GPT-4o only
                          </span>
                        )}
                      </span>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>OpenAI Model</Label>
            <Select
              value={currentModel}
              onValueChange={(val) => {
                const next = val as OpenAIModelId;
                const voiceStillOk = voiceSupportsModel(currentVoice, next);
                onChange({
                  ...voice,
                  openaiModel: next,
                  openaiVoice: voiceStillOk ? currentVoice : 'alloy',
                });
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {OPENAI_MODELS.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-[11px] text-muted-foreground mt-1">
              GPT-4o Mini TTS supports all 11 voices and per-turn mood. Legacy
              tts-1 / tts-1-hd only support the 6 original voices.
            </p>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <Label>Speed</Label>
              <span className="text-xs text-muted-foreground">
                {(voice.openaiSpeed ?? 1.0).toFixed(1)}x
              </span>
            </div>
            <Slider
              value={[voice.openaiSpeed ?? 1.0]}
              min={0.5}
              max={2.0}
              step={0.1}
              onValueChange={([val]) => onChange({ ...voice, openaiSpeed: Math.round(val * 10) / 10 })}
            />
          </div>
        </>
        );
      })()}

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
