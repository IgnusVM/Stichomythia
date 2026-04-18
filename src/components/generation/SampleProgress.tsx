import { useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2, Check } from 'lucide-react';

interface Props {
  streamText: string;
  segmentsDone: number;
  totalSegments: number;
}

const TURN_REGEX = /^\[Person ([A-D])\]\s*\(([^)]+)\):\s*(.+)$/gm;
const COLORS: Record<string, string> = {
  A: '#E74C3C',
  B: '#3498DB',
  C: '#2ECC71',
  D: '#F39C12',
};

export function SampleProgress({ streamText, segmentsDone, totalSegments }: Props) {
  const previewLines = useMemo(() => {
    const lines: Array<{ label: string; mood: string; text: string }> = [];
    let match;
    const regex = new RegExp(TURN_REGEX.source, 'gm');
    while ((match = regex.exec(streamText)) !== null) {
      lines.push({ label: match[1], mood: match[2], text: match[3] });
    }
    return lines.slice(-15);
  }, [streamText]);

  return (
    <div className="flex items-center justify-center h-full p-6">
      <Card className="w-full max-w-2xl">
        <CardContent className="p-8 space-y-6">
          <h2 className="text-lg font-semibold">Generating your 10-minute sample...</h2>

          <div className="space-y-2">
            {Array.from({ length: totalSegments }, (_, i) => (
              <div key={i} className="flex items-center gap-2 text-sm">
                {i < segmentsDone ? (
                  <Check className="w-4 h-4 text-green-500" />
                ) : i === segmentsDone ? (
                  <Loader2 className="w-4 h-4 animate-spin text-blue-400" />
                ) : (
                  <div className="w-4 h-4 rounded-full border border-muted-foreground/30" />
                )}
                <span className={i <= segmentsDone ? 'text-foreground' : 'text-muted-foreground'}>
                  Segment {i + 1}
                  {i < segmentsDone && ': complete'}
                  {i === segmentsDone && ': generating...'}
                </span>
              </div>
            ))}
          </div>

          {previewLines.length > 0 && (
            <div className="space-y-1.5 max-h-64 overflow-y-auto">
              <p className="text-xs text-muted-foreground mb-2">Preview:</p>
              {previewLines.map((line, i) => (
                <div key={i} className="flex gap-2 text-sm">
                  <div
                    className="w-2 h-2 rounded-full mt-1.5 shrink-0"
                    style={{ backgroundColor: COLORS[line.label] ?? '#888' }}
                  />
                  <span className="text-muted-foreground text-xs">({line.mood})</span>
                  <span>{line.text}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
