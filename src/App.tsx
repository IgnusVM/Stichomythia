import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { TooltipProvider } from '@/components/ui/tooltip';
import { NavBar } from '@/components/layout/NavBar';
import { Dashboard } from '@/pages/Dashboard';
import { Characters } from '@/pages/Characters';
import { SettingsPage } from '@/pages/Settings';
import { Setup } from '@/pages/Setup';
import { ConversationPage } from '@/pages/Conversation';

export default function App() {
  return (
    <BrowserRouter>
      <TooltipProvider>
        <div className="dark min-h-screen bg-background text-foreground flex flex-col">
          <NavBar />
          <main className="flex-1">
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/conversation/:id" element={<ConversationPage />} />
              <Route path="/characters" element={<Characters />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="/setup" element={<Setup />} />
            </Routes>
          </main>
        </div>
      </TooltipProvider>
    </BrowserRouter>
  );
}
