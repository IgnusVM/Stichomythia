import { Button } from '@/components/ui/button';
import { Play, Pause, Square, Repeat, SkipForward, Loader2, Radio, Volume2 } from 'lucide-react';

type BufferState = 'idle' | 'buffering' | 'ready';

interface Props {
  playing: boolean;
  looping: boolean;
  hasQueue: boolean;
  bufferState: BufferState;
  bufferElapsed: number;
  onBuffer: () => void;
  onPlay: () => void;
  onPause: () => void;
  onStop: () => void;
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
  hasQueue,
  bufferState,
  bufferElapsed,
  onBuffer,
  onPlay,
  onPause,
  onStop,
  onToggleLoop,
  onNext,
  disabled,
}: Props) {
  return (
    <div className="flex items-center gap-3 p-3 border-t border-gold/10 bg-card/80">
      <div className="flex items-center gap-1">
        <Button
          size="sm"
          variant="outline"
          onClick={onBuffer}
          disabled={disabled || playing || bufferState === 'buffering'}
          className={`border-gold/20 ${
            bufferState === 'ready'
              ? 'bg-green-500/20 text-green-400 border-green-500/30'
              : bufferState === 'buffering'
                ? 'bg-gold-muted/30 text-gold border-gold/30'
                : 'hover:bg-gold-muted'
          }`}
          title={
            bufferState === 'ready' ? 'Speakers ready' :
            bufferState === 'buffering' ? 'Buffering...' :
            'Buffer speakers'
          }
        >
          {bufferState === 'buffering' ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Radio className="w-4 h-4" />
          )}
        </Button>

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

      {bufferState === 'buffering' ? (
        <div className="flex items-center gap-2 flex-1">
          <Loader2 className="w-3.5 h-3.5 animate-spin text-gold" />
          <span className="text-xs text-gold font-mono">
            Buffering speakers... {formatTime(bufferElapsed)}
          </span>
        </div>
      ) : bufferState === 'ready' ? (
        <div className="flex items-center gap-2 flex-1">
          <span className="text-xs text-green-400 font-mono">Ready — hit play</span>
        </div>
      ) : playing ? (
        <div className="flex items-center gap-2 flex-1">
          <Volume2 className="w-3.5 h-3.5 text-gold animate-pulse" />
          <span className="text-xs text-gold font-mono">Playing</span>
        </div>
      ) : (
        <div className="flex-1" />
      )}
    </div>
  );
}
