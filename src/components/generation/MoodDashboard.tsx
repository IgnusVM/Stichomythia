import type { EmotionalSummary, Character } from '@/types';

interface Props {
  emotionalSummary: EmotionalSummary;
  characters: Character[];
  characterIds: string[];
}

const LABELS = ['Person A', 'Person B', 'Person C', 'Person D'];

export function MoodDashboard({ emotionalSummary, characters, characterIds }: Props) {
  return (
    <div className="bg-muted/30 rounded-lg p-4 space-y-2">
      <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
        Mood Dashboard
      </h4>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {LABELS.map((label, i) => {
          const state = emotionalSummary.emotionalStates[label];
          const char = characters.find(c => c.id === characterIds[i]);
          if (!state) return null;

          return (
            <div key={label} className="flex items-start gap-2">
              <div
                className="w-2.5 h-2.5 rounded-full mt-1 shrink-0"
                style={{ backgroundColor: char?.color ?? '#888' }}
              />
              <div className="text-xs">
                <span className="font-medium">{state.emotion}</span>
                <span className="text-muted-foreground ml-1">
                  {(state.intensity * 10).toFixed(0)}/10
                </span>
                {state.note && (
                  <p className="text-muted-foreground mt-0.5">{state.note}</p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {emotionalSummary.unresolvedThreads.length > 0 && (
        <div className="text-xs text-muted-foreground pt-1">
          <span className="font-medium">Threads: </span>
          {emotionalSummary.unresolvedThreads.map((t, i) => (
            <span key={i}>
              &ldquo;{typeof t === 'object' ? (t as any).thread ?? JSON.stringify(t) : t}&rdquo;
              {i < emotionalSummary.unresolvedThreads.length - 1 ? ', ' : ''}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
