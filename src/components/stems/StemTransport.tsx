import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Play, Pause, Square, Repeat, SkipForward } from 'lucide-react';

interface Props {
  playing: boolean;
  looping: boolean;
  position: number;
  duration: number;
  hasQueue: boolean;
  onPlay: () => void;
  onPause: () => void;
  onStop: () => void;
  onSeek: (position: number) => void;
  onToggleLoop: () => void;
  onNext: () => void;
  disabled: boolean;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function StemTransport({
  playing,
  looping,
  position,
  duration,
  hasQueue,
  onPlay,
  onPause,
  onStop,
  onSeek,
  onToggleLoop,
  onNext,
  disabled,
}: Props) {
  return (
    <div className="flex items-center gap-3 p-3 border-t border-gold/10 bg-card/80">
      <div className="flex items-center gap-1">
        {playing ? (
          <Button size="sm" variant="outline" onClick={onPause} disabled={disabled} className="border-gold/20 hover:bg-gold-muted">
            <Pause className="w-4 h-4" />
          </Button>
        ) : (
          <Button size="sm" variant="outline" onClick={onPlay} disabled={disabled} className="border-gold/20 hover:bg-gold-muted">
            <Play className="w-4 h-4" />
          </Button>
        )}
        <Button size="sm" variant="outline" onClick={onStop} disabled={disabled} className="border-gold/20 hover:bg-gold-muted">
          <Square className="w-3.5 h-3.5" />
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={onNext}
          disabled={!hasQueue}
          className="border-gold/20 hover:bg-gold-muted"
          title="Next in queue"
        >
          <SkipForward className="w-4 h-4" />
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={onToggleLoop}
          disabled={disabled}
          className={`border-gold/20 ${looping ? 'bg-gold-muted text-gold glow-gold-text' : 'hover:bg-gold-muted'}`}
        >
          <Repeat className="w-4 h-4" />
        </Button>
      </div>

      <span className="text-xs font-mono text-muted-foreground w-10 text-right">{formatTime(position)}</span>

      <Slider
        value={[position]}
        min={0}
        max={duration || 1}
        step={0.1}
        onValueChange={([v]) => onSeek(v)}
        disabled={disabled}
        className="flex-1"
      />

      <span className="text-xs font-mono text-muted-foreground w-10">{formatTime(duration)}</span>
    </div>
  );
}
