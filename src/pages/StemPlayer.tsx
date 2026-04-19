import { Music } from 'lucide-react';

export function StemPlayer() {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center p-6">
      <Music className="w-12 h-12 text-gold/30 mb-4" />
      <h1 className="text-xl font-heading tracking-wider mb-2">Stem Player</h1>
      <p className="text-sm text-muted-foreground max-w-md">
        Load up to 4 audio stems and play them in perfect sync across your speakers.
        Assign each stem to a different speaker for isolated instrument playback.
      </p>
      <p className="text-xs text-muted-foreground mt-4">Coming soon</p>
    </div>
  );
}
