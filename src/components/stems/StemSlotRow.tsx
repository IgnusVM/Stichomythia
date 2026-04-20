import { useState, useRef, useCallback, useEffect } from 'react';
import { Upload, X } from 'lucide-react';
import { useAudioEngine } from '@/contexts/AudioEngineContext';
import type { StemSlot } from '@/types';

interface Props {
  index: number;
  slot: StemSlot;
  hasBuffer: boolean;
  duration: number;
  position: number;
  onUpdateSlot: (update: Partial<StemSlot>) => void;
  onLoadFile: (path: string, name: string) => void;
  onRemove: () => void;
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

export function StemSlotRow({
  index,
  slot,
  hasBuffer,
  duration,
  position,
  onUpdateSlot,
  onLoadFile,
  onRemove,
}: Props) {
  const { speakers } = useAudioEngine();
  const [dragging, setDragging] = useState(false);
  const [audioBuffer, setAudioBuffer] = useState<AudioBuffer | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(async (file: File) => {
    const filePath = (file as unknown as { path?: string }).path;
    if (filePath) {
      onLoadFile(filePath, file.name);
    } else {
      const arrayBuffer = await file.arrayBuffer();
      const offlineCtx = new OfflineAudioContext(2, 1, 44100);
      const decoded = await offlineCtx.decodeAudioData(arrayBuffer.slice(0));
      setAudioBuffer(decoded);
    }
  }, [onLoadFile]);

  useEffect(() => {
    if (!hasBuffer || !slot.filePath) { setAudioBuffer(null); return; }
    fetch(`/api/tracks/file?path=${encodeURIComponent(slot.filePath)}`)
      .then(r => r.arrayBuffer())
      .then(buf => {
        const offCtx = new OfflineAudioContext(2, 1, 44100);
        return offCtx.decodeAudioData(buf);
      })
      .then(setAudioBuffer)
      .catch(() => {});
  }, [hasBuffer, slot.filePath]);

  useEffect(() => {
    if (!canvasRef.current || !audioBuffer) return;
    drawWaveform(canvasRef.current, audioBuffer, position, duration);
  }, [audioBuffer, position, duration]);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('audio/')) handleFile(file);
  }, [handleFile]);

  return (
    <div className={`border rounded-lg transition-colors flex-1 min-h-0 flex flex-col ${
      dragging ? 'border-gold bg-gold-muted/30' : 'border-gold/10 bg-card/50'
    }`}>
      <div className="flex items-center gap-3 px-3 py-2 shrink-0">
        <span className="text-xs font-heading text-gold-light w-10 shrink-0">
          {index + 1}
        </span>

        <div className="flex gap-0.5">
          <button
            onClick={() => onUpdateSlot({ muted: !slot.muted })}
            className={`w-6 h-5 rounded text-[9px] font-bold transition-colors ${
              slot.muted ? 'bg-red-500/80 text-white' : 'bg-muted/50 text-muted-foreground hover:bg-muted'
            }`}
          >
            M
          </button>
          <button
            onClick={() => onUpdateSlot({ soloed: !slot.soloed })}
            className={`w-6 h-5 rounded text-[9px] font-bold transition-colors ${
              slot.soloed ? 'bg-gold text-black' : 'bg-muted/50 text-muted-foreground hover:bg-muted'
            }`}
          >
            S
          </button>
        </div>

        <select
          value={slot.speakerId || ''}
          onChange={(e) => onUpdateSlot({ speakerId: e.target.value || null })}
          className="text-xs bg-muted/50 border border-gold/10 rounded px-2 py-1 text-foreground w-28 shrink-0"
        >
          <option value="">No speaker</option>
          {speakers.map(s => (
            <option key={s.id} value={s.id}>{s.label}</option>
          ))}
        </select>

        {hasBuffer ? (
          <div className="flex-1 min-w-0 flex items-center gap-2">
            <span className="text-xs text-muted-foreground truncate">{slot.fileName}</span>
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
              className="w-full flex items-center justify-center gap-2 py-1.5 rounded border border-dashed border-gold/20 text-xs text-muted-foreground hover:text-gold-light hover:border-gold/40 transition-colors"
            >
              <Upload className="w-3.5 h-3.5" />
              Drop audio or click to browse
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="audio/*"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
              className="hidden"
            />
          </div>
        )}
      </div>

      {audioBuffer && (
        <div className="px-3 pb-1.5 flex-1 min-h-0">
          <canvas
            ref={canvasRef}
            width={600}
            height={40}
            className="w-full h-full rounded"
            style={{ imageRendering: 'pixelated' }}
          />
        </div>
      )}
    </div>
  );
}
