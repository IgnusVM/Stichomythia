import { useState, useRef, useCallback, useEffect } from 'react';
import { Upload, Trash2 } from 'lucide-react';
import { useAudioEngine } from '@/contexts/AudioEngineContext';
import type { StemSlot } from '@/types';

interface Props {
  index: number;
  slot: StemSlot;
  hasBuffer: boolean;
  onUpdateSlot: (update: Partial<StemSlot>) => void;
  onLoadBuffer: (buffer: ArrayBuffer, fileName: string) => void;
  onRemove: () => void;
}

function drawWaveform(canvas: HTMLCanvasElement, audioBuffer: AudioBuffer) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  const width = rect.width;
  const height = rect.height;
  canvas.width = width * dpr;
  canvas.height = height * dpr;
  ctx.scale(dpr, dpr);

  ctx.clearRect(0, 0, width, height);

  const data = audioBuffer.getChannelData(0);
  const step = Math.ceil(data.length / width);
  const mid = height / 2;

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
}

export function StemSlotRow({
  index,
  slot,
  hasBuffer,
  onUpdateSlot,
  onLoadBuffer,
  onRemove,
}: Props) {
  const { speakers } = useAudioEngine();
  const [dragging, setDragging] = useState(false);
  const [audioBuffer, setAudioBuffer] = useState<AudioBuffer | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(async (file: File) => {
    const arrayBuffer = await file.arrayBuffer();
    onLoadBuffer(arrayBuffer, file.name);
  }, [onLoadBuffer]);

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
    drawWaveform(canvasRef.current, audioBuffer);
  }, [audioBuffer]);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file && (file.type.startsWith('audio/') || file.name.match(/\.(wav|mp3|flac|ogg|aac|m4a|wma)$/i))) {
      handleFile(file);
    }
  }, [handleFile]);

  return (
    <div
      className={`border rounded-lg transition-colors flex flex-col ${
        dragging ? 'border-gold bg-gold-muted/30' : 'border-gold/10 bg-card/50'
      }`}
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
    >
      <div className="flex items-center gap-3 px-3 py-2 shrink-0">
        <span className="text-xs font-heading text-gold-light w-6 shrink-0">
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

        <input
          value={slot.label}
          onChange={(e) => onUpdateSlot({ label: e.target.value })}
          placeholder={hasBuffer ? slot.fileName : `Stem ${index + 1}`}
          className="text-xs bg-transparent border-b border-transparent hover:border-gold/20 focus:border-gold/40 focus:outline-none px-1 py-0.5 text-foreground w-36 shrink-0 truncate placeholder:text-muted-foreground"
        />

        {hasBuffer ? (
          <span className="text-[10px] text-muted-foreground truncate flex-1 min-w-0">{slot.fileName}</span>
        ) : (
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex-1 min-w-0 flex items-center justify-center gap-2 py-1.5 rounded border border-dashed border-gold/20 text-xs text-muted-foreground hover:text-gold-light hover:border-gold/40 transition-colors"
          >
            <Upload className="w-3.5 h-3.5" />
            Drop audio or click to browse
          </button>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept="audio/*"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ''; }}
          className="hidden"
        />

        <button
          onClick={onRemove}
          className="shrink-0 text-muted-foreground hover:text-red-400 transition-colors ml-1"
          title="Delete stem"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>

      {audioBuffer && (
        <div className="px-3 pb-1.5 h-12 shrink-0">
          <canvas
            ref={canvasRef}
            className="w-full h-full rounded"
          />
        </div>
      )}
    </div>
  );
}
