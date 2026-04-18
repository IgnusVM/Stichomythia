import { useState } from 'react';
import { api } from '@/lib/api';
import type { Conversation, Character, Segment, Turn } from '@/types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Loader2, Check, RefreshCw, Trash2, Pencil, X, Plus } from 'lucide-react';
import { MoodDashboard } from './MoodDashboard';
import { TurnBubble } from './TurnBubble';
import { SampleProgress } from './SampleProgress';

interface Props {
  conversation: Conversation;
  characters: Character[];
  onConversationUpdate: (conv: Conversation) => void;
}

export function GenerateTab({ conversation, characters, onConversationUpdate }: Props) {
  const [generating, setGenerating] = useState(false);
  const [streamText, setStreamText] = useState('');
  const [segmentsDone, setSegmentsDone] = useState(0);
  const [segmentCount, setSegmentCount] = useState(1);
  const [model, setModel] = useState(conversation.settings.model);

  const charMap = new Map(characters.map(c => [c.id, c]));

  const lastSegment = conversation.segments[conversation.segments.length - 1];

  const handleGenerate = async () => {
    setGenerating(true);
    setStreamText('');
    setSegmentsDone(0);

    await api.generation.generateStream(conversation.id, segmentCount, {
      onChunk: (text) => setStreamText(prev => prev + text),
      onSegmentComplete: () => setSegmentsDone(prev => prev + 1),
      onComplete: async () => {
        const updated = await api.conversations.get(conversation.id);
        onConversationUpdate(updated);
        setGenerating(false);
        setStreamText('');
      },
      onError: (message) => {
        console.error('Generation error:', message);
        setGenerating(false);
      },
    });
  };

  const handleApproveAll = async () => {
    await api.generation.approveAll(conversation.id);
    const updated = await api.conversations.get(conversation.id);
    onConversationUpdate(updated);
  };

  const handleApproveSegment = async (segmentId: string) => {
    await api.generation.approveSegment(conversation.id, segmentId);
    const updated = await api.conversations.get(conversation.id);
    onConversationUpdate(updated);
  };

  const handleEditTurn = async (turnId: string, text: string) => {
    await api.generation.editTurn(conversation.id, turnId, text);
    const updated = await api.conversations.get(conversation.id);
    onConversationUpdate(updated);
  };

  const handleDeleteTurn = async (turnId: string) => {
    await api.generation.deleteTurn(conversation.id, turnId);
    const updated = await api.conversations.get(conversation.id);
    onConversationUpdate(updated);
  };

  const handleDeleteSegmentsFrom = async (segmentId: string) => {
    await api.generation.deleteSegmentsFrom(conversation.id, segmentId);
    const updated = await api.conversations.get(conversation.id);
    onConversationUpdate(updated);
  };

  const draftCount = conversation.segments
    .flatMap(s => s.turns)
    .filter(t => t.status === 'draft').length;

  if (generating) {
    return (
      <SampleProgress
        streamText={streamText}
        segmentsDone={segmentsDone}
        totalSegments={segmentCount}
      />
    );
  }

  return (
    <div className="flex h-full">
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Model:</span>
            <Select value={model} onValueChange={(v) => setModel(v as typeof model)}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="claude-opus-4-6">Opus</SelectItem>
                <SelectItem value="claude-sonnet-4-6">Sonnet</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Segments:</span>
            <Input
              type="number"
              min={1}
              max={25}
              value={segmentCount}
              onChange={(e) => setSegmentCount(Math.max(1, parseInt(e.target.value) || 1))}
              className="w-20"
            />
          </div>

          <Button onClick={handleGenerate} disabled={generating}>
            {generating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            Generate
          </Button>

          {draftCount > 0 && (
            <Button variant="outline" onClick={handleApproveAll}>
              <Check className="w-4 h-4 mr-2" />
              Approve All ({draftCount})
            </Button>
          )}
        </div>

        {lastSegment && (
          <MoodDashboard
            emotionalSummary={lastSegment.emotionalSummary}
            characters={characters}
            characterIds={conversation.characterIds}
          />
        )}

        <div className="space-y-8">
          {conversation.segments.map((segment) => (
            <div key={segment.id}>
              <div className="flex items-center gap-3 mb-3">
                <h3 className="text-sm font-medium text-muted-foreground">
                  Segment {segment.sequenceNumber + 1} ({segment.turns.length} turns)
                </h3>
                <Badge variant={segment.status === 'approved' ? 'secondary' : 'outline'} className="text-xs">
                  {segment.status}
                </Badge>
                {segment.status === 'draft' && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleApproveSegment(segment.id)}
                  >
                    <Check className="w-3 h-3 mr-1" />
                    Approve
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-destructive"
                  onClick={() => handleDeleteSegmentsFrom(segment.id)}
                >
                  <Trash2 className="w-3 h-3 mr-1" />
                  Delete from here
                </Button>
              </div>

              <div className="space-y-1">
                {segment.turns.map((turn) => (
                  <TurnBubble
                    key={turn.id}
                    turn={turn}
                    character={charMap.get(turn.characterId)}
                    onEdit={(text) => handleEditTurn(turn.id, text)}
                    onDelete={() => handleDeleteTurn(turn.id)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="w-64 border-l p-4 space-y-4 overflow-y-auto shrink-0 hidden lg:block">
        <div>
          <h4 className="text-sm font-medium mb-2">Topic Seeds</h4>
          <div className="space-y-1">
            {conversation.settings.topicSeeds.map((seed, i) => (
              <Badge key={i} variant="secondary" className="mr-1">
                {seed}
              </Badge>
            ))}
            {conversation.settings.topicSeeds.length === 0 && (
              <p className="text-xs text-muted-foreground">No topic seeds</p>
            )}
          </div>
        </div>

        {lastSegment && (
          <div>
            <h4 className="text-sm font-medium mb-2">Unresolved Threads</h4>
            <div className="space-y-1">
              {lastSegment.emotionalSummary.unresolvedThreads.map((thread, i) => (
                <p key={i} className="text-xs text-muted-foreground">{thread}</p>
              ))}
              {lastSegment.emotionalSummary.unresolvedThreads.length === 0 && (
                <p className="text-xs text-muted-foreground">None</p>
              )}
            </div>
          </div>
        )}

        {lastSegment && (
          <div>
            <h4 className="text-sm font-medium mb-2">Topics Covered</h4>
            <div className="flex flex-wrap gap-1">
              {lastSegment.emotionalSummary.topicsCovered.map((topic, i) => (
                <Badge key={i} variant="outline" className="text-xs">
                  {topic}
                </Badge>
              ))}
            </div>
          </div>
        )}

        <div>
          <h4 className="text-sm font-medium mb-2">Stats</h4>
          <div className="text-xs text-muted-foreground space-y-1">
            <p>Segments: {conversation.segments.length}</p>
            <p>Total turns: {conversation.totalTurns}</p>
            <p>Draft: {draftCount}</p>
            <p>Approved: {conversation.segments.flatMap(s => s.turns).filter(t => t.status === 'approved').length}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
