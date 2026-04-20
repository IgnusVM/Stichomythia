import { Slider } from '@/components/ui/slider';
import { useAudioEngine } from '@/contexts/AudioEngineContext';

const COMPACT_SLIDER = '[&_[data-slot=slider-thumb]]:size-2 [&_[data-slot=slider-thumb]]:border-0';

export function MasterStrip() {
  const { mixerState, setMasterVolume } = useAudioEngine();
  const volume = mixerState.masterVolume;
  const dbValue = volume > 0 ? (20 * Math.log10(volume)).toFixed(1) : '-∞';

  return (
    <div className="flex flex-col items-center justify-center gap-1 px-2 py-1 w-14 shrink-0 border-l border-gold/15">
      <span className="text-[7px] font-heading tracking-wider text-gold/50 uppercase">
        Master
      </span>

      <Slider
        value={[volume]}
        min={0}
        max={1}
        step={0.01}
        onValueChange={([v]) => setMasterVolume(v)}
        className={`w-10 ${COMPACT_SLIDER}`}
      />

      <span className="text-[7px] text-muted-foreground font-mono">{dbValue}</span>
    </div>
  );
}
