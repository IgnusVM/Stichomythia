import { Slider } from '@/components/ui/slider';
import { useAudioEngine } from '@/contexts/AudioEngineContext';

export function MasterStrip() {
  const { mixerState, setMasterVolume } = useAudioEngine();
  const volume = mixerState.masterVolume;
  const dbValue = volume > 0 ? (20 * Math.log10(volume)).toFixed(1) : '-inf';

  return (
    <div className="flex flex-col items-center gap-1 px-3 py-2 min-w-[64px] border-l border-gold/10">
      <span className="text-[10px] font-heading tracking-wider text-gold/60 uppercase mb-1">
        Master
      </span>

      <div className="h-16 flex items-center">
        <Slider
          orientation="vertical"
          value={[volume]}
          min={0}
          max={1}
          step={0.01}
          onValueChange={([v]) => setMasterVolume(v)}
          className="h-16"
        />
      </div>

      <span className="text-[9px] text-muted-foreground font-mono">{dbValue}dB</span>
    </div>
  );
}
