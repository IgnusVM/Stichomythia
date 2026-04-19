import { useState, useRef, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Upload, X, Volume2, VolumeX } from 'lucide-react';
import { useAudioEngine } from '@/contexts/AudioEngineContext';

interface Props {
  index: number;
  speakerId: string | null;
  onSpeakerChange: (speakerId: string) => void;
  onBufferLoaded: (buffer: ArrayBuffer, duration: number, fileName: string) => void;
  onRemove: () => void;
  fileName: string | null;
  position: number;
  duration: number;
  muted: boolean;
  soloed: boolean;
  onToggleMute: () => void;
  onToggleSolo: () => void;
}

function drawWaveform(
  canvas: HTMLCanvasElement,
  audioBuffer: AudioBuffer,
  position: number,
  duration: number,
) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const { width, height } = canvas;
  const dpr = window.devicePixelRatio || 1;
  canvas.width = width * dpr;
  canvas.height = height * dpr;
  ctx.scale(dpr, dpr);

  ctx.clearRect(0, 0, width, height);

  const data = audioBuffer.getChannelData(0);
  const step = Math.ceil(data.length / width);
  const mid = height / 2;

  ctx.fillStyle = 'rgba(212, 168, 67, 0.15)';
  ctx.fillRect(0, 0, (position / duration) * width, height);

  ctx.beginPath();
  ctx.strokeStyle = 'rgba(212, 168, 67, 0.6)';
  ctx.lineWidth = 1;

  for (let i = 0; i < width; i++) {
    const start = i * step;
    let min = 1, max = -1;
    for (let j = 0; j < step && start + j < data.length; j++) {
      const val = data[start + j];
      if (val < min) min = val;
      if (val > max) max = val;
    }
    ctx.moveTo(i, mid + min * mid);
    ctx.lineTo(i, mid + max * mid);
  }
  ctx.stroke();

  const px = (position / duration) * width;
  ctx.beginPath();
  ctx.strokeStyle = '#D4A843';
  ctx.lineWidth = 2;
  ctx.moveTo(px, 0);
  ctx.lineTo(px, height);
  ctx.stroke();
}

export function StemTrack({
  index,
  speakerId,
  onSpeakerChange,
  onBufferLoaded,
  onRemove,
  fileName,
  position,
  duration,
  muted,
  soloed,
  onToggleMute,
  onToggleSolo,
}: Props) {
  const { speakers } = useAudioEngine();
  const [dragging, setDragging] = useState(false);
  const [audioBuffer, setAudioBuffer] = useState<AudioBuffer | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const labels = ['Guitar', 'Bass', 'Drums', 'Vocals'];

  const handleFile = useCallback(async (file: File) => {
    const arrayBuffer = await file.arrayBuffer();
    const offlineCtx = new OfflineAudioContext(2, 1, 44100);
    const decoded = await offlineCtx.decodeAudioData(arrayBuffer.slice(0));
    setAudioBuffer(decoded);
    onBufferLoaded(arrayBuffer, decoded.duration, file.name);
  }, [onBufferLoaded]);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('audio/')) handleFile(file);
  }, [handleFile]);

  const onFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  }, [handleFile]);

  useEffect(() => {
    if (!canvasRef.current || !audioBuffer) return;
    drawWaveform(canvasRef.current, audioBuffer, position, duration);
  }, [audioBuffer, position, duration]);

  return (
    <div className={`border rounded-lg transition-colors ${dragging ? 'border-gold bg-gold-muted/30' : 'border-gold/10 bg-card/50'}`}>
      <div className="flex items-center gap-3 p-3">
        <span className="text-xs font-heading text-gold-light w-14 shrink-0">
          {labels[index] || `Stem ${index + 1}`}
        </span>

        <div className="flex gap-0.5">
          <button
            onClick={onToggleMute}
            className={`w-6 h-5 rounded text-[9px] font-bold transition-colors ${
              muted ? 'bg-red-500/80 text-white' : 'bg-muted/50 text-muted-foreground hover:bg-muted'
            }`}
          >
            M
          </button>
          <button
            onClick={onToggleSolo}
            className={`w-6 h-5 rounded text-[9px] font-bold transition-colors ${
              soloed ? 'bg-gold text-black' : 'bg-muted/50 text-muted-foreground hover:bg-muted'
            }`}
          >
            S
          </button>
        </div>

        <select
          value={speakerId || ''}
          onChange={(e) => onSpeakerChange(e.target.value)}
          className="text-xs bg-muted/50 border border-gold/10 rounded px-2 py-1 text-foreground w-28 shrink-0"
        >
          <option value="">No speaker</option>
          {speakers.map(s => (
            <option key={s.id} value={s.id}>{s.label}</option>
          ))}
        </select>

        {fileName ? (
          <div className="flex-1 min-w-0 flex items-center gap-2">
            <span className="text-xs text-muted-foreground truncate">{fileName}</span>
            <button
              onClick={onRemove}
              className="shrink-0 text-muted-foreground hover:text-red-400 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <div
            className="flex-1 min-w-0"
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
          >
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full flex items-center justify-center gap-2 py-2 rounded border border-dashed border-gold/20 text-xs text-muted-foreground hover:text-gold-light hover:border-gold/40 transition-colors"
            >
              <Upload className="w-3.5 h-3.5" />
              Drop audio file or click to browse
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="audio/*"
              onChange={onFileSelect}
              className="hidden"
            />
          </div>
        )}
      </div>

      {audioBuffer && (
        <div className="px-3 pb-2">
          <canvas
            ref={canvasRef}
            width={600}
            height={48}
            className="w-full h-12 rounded"
            style={{ imageRendering: 'pixelated' }}
          />
        </div>
      )}
    </div>
  );
}
