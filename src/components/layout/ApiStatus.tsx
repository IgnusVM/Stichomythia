import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

type Status = 'connected' | 'idle' | 'error' | 'loading';

export function ApiStatus() {
  const [status, setStatus] = useState<Status>('loading');
  const [message, setMessage] = useState('Checking...');

  useEffect(() => {
    api.settings
      .get()
      .then((s) => {
        if (s.anthropicApiKey) {
          setStatus('idle');
          setMessage('API key configured');
        } else {
          setStatus('error');
          setMessage('No API key set');
        }
      })
      .catch(() => {
        setStatus('error');
        setMessage('Server unreachable');
      });
  }, []);

  const colors: Record<Status, string> = {
    connected: 'bg-green-500',
    idle: 'bg-yellow-500',
    error: 'bg-red-500',
    loading: 'bg-zinc-500 animate-pulse',
  };

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="flex items-center gap-2 cursor-default">
          <div className={`w-2 h-2 rounded-full ${colors[status]}`} />
          <span className="text-xs text-muted-foreground">API</span>
        </div>
      </TooltipTrigger>
      <TooltipContent>
        <p>{message}</p>
      </TooltipContent>
    </Tooltip>
  );
}
