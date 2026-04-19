import { Monitor } from 'lucide-react';

export function SystemAudio() {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center p-6">
      <Monitor className="w-12 h-12 text-gold/30 mb-4" />
      <h1 className="text-xl font-heading tracking-wider mb-2">System Audio</h1>
      <p className="text-sm text-muted-foreground max-w-md">
        Capture audio from any application on your computer and route it
        through your speaker array with per-speaker volume and EQ control.
      </p>
      <p className="text-xs text-muted-foreground mt-4">Coming soon</p>
    </div>
  );
}
