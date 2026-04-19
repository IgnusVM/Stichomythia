import { useState } from 'react';
import { api } from '@/lib/api';
import type { Conversation, Character } from '@/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Play } from 'lucide-react';
import { SampleProgress } from './SampleProgress';

interface Props {
  conversation: Conversation;
  characters: Character[];
  onConversationUpdate: (conv: Conversation) => void;
}

export function EmptyState({ conversation, characters, onConversationUpdate }: Props) {
  const [generating, setGenerating] = useState(false);
  const [streamText, setStreamText] = useState('');
  const [segmentsDone, setSegmentsDone] = useState(0);

  const handleSample = async () => {
    setGenerating(true);
    setStreamText('');
    setSegmentsDone(0);

    await api.generation.generateStream(conversation.id, 2, {
      onChunk: (text) => {
        setStreamText(prev => prev + text);
      },
      onSegmentComplete: () => {
        setSegmentsDone(prev => prev + 1);
      },
      onComplete: async () => {
        const updated = await api.conversations.get(conversation.id);
        onConversationUpdate(updated);
        setGenerating(false);
      },
      onError: (message) => {
        console.error('Generation error:', message);
        setGenerating(false);
      },
    });
  };

  if (generating) {
    return (
      <SampleProgress
        streamText={streamText}
        segmentsDone={segmentsDone}
        totalSegments={2}
      />
    );
  }

  return (
    <div className="flex items-center justify-center h-full p-6">
      <Card className="w-full max-w-lg">
        <CardContent className="p-8 text-center space-y-6">
          <h2 className="text-xl font-semibold">Ready to hear your characters talk?</h2>

          <div className="space-y-2 text-left">
            {characters.map(c => (
              <div key={c.id} className="flex items-center gap-3 p-2 bg-muted/50 rounded-md">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: c.color }} />
                <span className="text-sm">{c.personality}</span>
              </div>
            ))}
          </div>

          {conversation.settings.topicSeeds.length > 0 && (
            <p className="text-sm text-muted-foreground">
              Topic seeds: {conversation.settings.topicSeeds.join(', ')}
            </p>
          )}

          <div className="space-y-2">
            <Button size="lg" className="w-full" onClick={handleSample}>
              <Play className="w-4 h-4 mr-2" />
              Generate 10min Sample
            </Button>
            <p className="text-xs text-muted-foreground">
              ~120 turns &middot; ~$0.56 &middot; ~2min to generate
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
