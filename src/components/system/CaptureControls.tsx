import { useState, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Radio, Square } from 'lucide-react';
import { useAudioEngine } from '@/contexts/AudioEngineContext';

interface Props {
  sourceId: string | null;
}

export function CaptureControls({ sourceId }: Props) {
  const { speakers } = useAudioEngine();
  const [capturing, setCapturing] = useState(false);
  const streamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);

  const startCapture = useCallback(async () => {
    if (!sourceId || !window.electronAPI?.nativeAudio) return;
    const na = window.electronAPI.nativeAudio;

    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        mandatory: {
          chromeMediaSource: 'desktop',
          chromeMediaSourceId: sourceId,
        },
      } as any,
      video: {
        mandatory: {
          chromeMediaSource: 'desktop',
          chromeMediaSourceId: sourceId,
          maxWidth: 1,
          maxHeight: 1,
          maxFrameRate: 1,
        },
      } as any,
    });

    stream.getVideoTracks().forEach(t => {
      t.stop();
      stream.removeTrack(t);
    });

    const ctx = new AudioContext({ sampleRate: 44100 });
    const source = ctx.createMediaStreamSource(stream);
    const processor = ctx.createScriptProcessor(4096, 2, 2);

    processor.onaudioprocess = (e) => {
      const left = e.inputBuffer.getChannelData(0);
      const right = e.inputBuffer.numberOfChannels > 1
        ? e.inputBuffer.getChannelData(1)
        : left;
      na.feedCapture(
        left.buffer.slice(left.byteOffset, left.byteOffset + left.byteLength),
        right.buffer.slice(right.byteOffset, right.byteOffset + right.byteLength),
      );
    };

    const silencer = ctx.createGain();
    silencer.gain.value = 0;
    source.connect(processor);
    processor.connect(silencer);
    silencer.connect(ctx.destination);

    streamRef.current = stream;
    processorRef.current = processor;
    ctxRef.current = ctx;

    await na.startCapture(speakers.map(s => s.id));
    setCapturing(true);
  }, [sourceId, speakers]);

  const stopCapture = useCallback(async () => {
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }
    if (ctxRef.current) {
      ctxRef.current.close().catch(() => {});
      ctxRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (window.electronAPI?.nativeAudio) {
      await window.electronAPI.nativeAudio.stopCapture();
    }
    setCapturing(false);
  }, []);

  return (
    <div className="flex items-center gap-3 p-3 border rounded-lg border-gold/10 bg-card/50">
      {capturing ? (
        <>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-red-500 capture-pulse" />
            <span className="text-sm text-red-400 font-medium">Capturing</span>
          </div>
          <span className="text-xs text-muted-foreground">
            Audio routed to {speakers.length} speaker{speakers.length !== 1 ? 's' : ''}
          </span>
          <Button size="sm" variant="outline" onClick={stopCapture} className="ml-auto border-red-500/30 text-red-400 hover:bg-red-500/10">
            <Square className="w-3.5 h-3.5 mr-1.5" />
            Stop
          </Button>
        </>
      ) : (
        <>
          <span className="text-sm text-muted-foreground">
            {sourceId ? 'Ready to capture' : 'Select a source above'}
          </span>
          <Button
            size="sm"
            variant="outline"
            onClick={startCapture}
            disabled={!sourceId}
            className="ml-auto border-gold/20 hover:bg-gold-muted"
          >
            <Radio className="w-3.5 h-3.5 mr-1.5" />
            Start Capture
          </Button>
        </>
      )}
    </div>
  );
}
