import { Slider } from '@/components/ui/slider';
import type { EQBandSettings } from '@/types';

interface Props {
  bands: EQBandSettings[];
  onChange: (bandIndex: number, settings: Partial<EQBandSettings>) => void;
}

const BAND_LABELS = ['Low', 'Lo-Mid', 'Mid', 'Hi-Mid', 'High'];

export function EQControl({ bands, onChange }: Props) {
  return (
    <div className="space-y-3 p-3">
      <p className="text-xs font-heading tracking-wider text-gold/80 uppercase">Parametric EQ</p>
      {bands.map((band, i) => (
        <div key={i} className="space-y-1">
          <div className="flex items-center justify-between text-[10px] text-muted-foreground">
            <span>{BAND_LABELS[i]}</span>
            <span>{band.frequency}Hz</span>
            <span>{band.gain > 0 ? '+' : ''}{band.gain.toFixed(1)}dB</span>
          </div>
          <Slider
            value={[band.gain]}
            min={-12}
            max={12}
            step={0.5}
            onValueChange={([v]) => onChange(i, { gain: v })}
            className="w-full"
          />
          {band.type === 'peaking' && (
            <div className="flex items-center gap-2">
              <span className="text-[9px] text-muted-foreground w-6">Q</span>
              <Slider
                value={[band.Q]}
                min={0.1}
                max={10}
                step={0.1}
                onValueChange={([v]) => onChange(i, { Q: v })}
                className="flex-1"
              />
              <span className="text-[9px] text-muted-foreground w-8 text-right">{band.Q.toFixed(1)}</span>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
