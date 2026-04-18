import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '@/lib/api';
import type { Conversation } from '@/types';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus } from 'lucide-react';
import { NewConversationDialog } from '@/components/dashboard/NewConversationDialog';

export function Dashboard() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [showNew, setShowNew] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    api.conversations.list().then(setConversations).catch(console.error);
  }, []);

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">Your Conversations</h1>
        <Button onClick={() => setShowNew(true)}>
          <Plus className="w-4 h-4 mr-2" />
          New
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {conversations.map((conv) => (
          <Card
            key={conv.id}
            className="cursor-pointer hover:border-foreground/20 transition-colors"
            onClick={() => navigate(`/conversation/${conv.id}`)}
          >
            <CardContent className="p-5">
              <h3 className="font-medium mb-2">{conv.name}</h3>
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
                <span>{conv.totalTurns} turns</span>
                {conv.totalDurationMs && (
                  <>
                    <span>·</span>
                    <span>
                      {Math.round(conv.totalDurationMs / 60000)}m audio
                    </span>
                  </>
                )}
              </div>
              <Badge variant="secondary">{conv.status}</Badge>
            </CardContent>
          </Card>
        ))}

        <Card
          className="cursor-pointer border-dashed hover:border-foreground/20 transition-colors"
          onClick={() => setShowNew(true)}
        >
          <CardContent className="p-5 flex items-center justify-center min-h-[120px]">
            <div className="text-center text-muted-foreground">
              <Plus className="w-8 h-8 mx-auto mb-2" />
              <span>Create New</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <NewConversationDialog
        open={showNew}
        onOpenChange={setShowNew}
        onCreated={(conv) => {
          setConversations((prev) => [conv, ...prev]);
          navigate(`/conversation/${conv.id}`);
        }}
      />
    </div>
  );
}
