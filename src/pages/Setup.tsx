import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '@/lib/api';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Check, X, Loader2, ArrowRight } from 'lucide-react';

type Step = 'api-key' | 'edge-tts' | 'ffmpeg' | 'characters';

const STARTER_CHARACTERS = [
  {
    color: '#E74C3C',
    personality: 'Laid-back, dry humor, plays devil\'s advocate',
    speechStyle: 'Terse, lots of "yeah" and "nah", rarely asks questions',
    interests: ['cooking', 'classic cars', 'philosophy'],
    quirks: ['sighs before speaking', 'plays devil\'s advocate'],
    emotionalProfile: { temperament: 'even-keeled' as const, triggers: [], recoverySpeed: 'fast' as const },
    voice: { edgeTtsVoice: 'en-US-GuyNeural', rate: '+0%', pitch: '+0Hz' },
  },
  {
    color: '#3498DB',
    personality: 'Enthusiastic storyteller, gets excited easily',
    speechStyle: 'Verbose, lots of tangents, uses "oh man" and "wait wait wait"',
    interests: ['travel', 'movies', 'history'],
    quirks: ['interrupts with tangents', 'tells long stories'],
    emotionalProfile: { temperament: 'cheerful' as const, triggers: [], recoverySpeed: 'fast' as const },
    voice: { edgeTtsVoice: 'en-US-JennyNeural', rate: '+5%', pitch: '+0Hz' },
  },
  {
    color: '#2ECC71',
    personality: 'Thoughtful, asks probing questions, slower to speak',
    speechStyle: 'Measured, uses "hmm" and "interesting", often pauses mid-sentence',
    interests: ['science', 'music', 'gardening'],
    quirks: ['asks follow-up questions', 'pauses to think'],
    emotionalProfile: { temperament: 'sensitive' as const, triggers: [], recoverySpeed: 'medium' as const },
    voice: { edgeTtsVoice: 'en-US-AriaNeural', rate: '-5%', pitch: '+0Hz' },
  },
  {
    color: '#F39C12',
    personality: 'Quick-witted, sarcastic, competitive',
    speechStyle: 'Snappy, uses rhetorical questions, dry one-liners',
    interests: ['sports', 'technology', 'stand-up comedy'],
    quirks: ['turns everything into a competition', 'makes sarcastic comments'],
    emotionalProfile: { temperament: 'sardonic' as const, triggers: [], recoverySpeed: 'fast' as const },
    voice: { edgeTtsVoice: 'en-US-DavisNeural', rate: '+0%', pitch: '-5Hz' },
  },
];

export function Setup() {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>('api-key');
  const [apiKey, setApiKey] = useState('');
  const [keyStatus, setKeyStatus] = useState<'idle' | 'checking' | 'valid' | 'invalid'>('idle');
  const [ttsOk, setTtsOk] = useState<boolean | null>(null);
  const [ffmpegOk, setFfmpegOk] = useState<boolean | null>(null);
  const [creating, setCreating] = useState(false);

  const verifyKey = async () => {
    setKeyStatus('checking');
    const result = await api.settings.verifyApiKey(apiKey);
    setKeyStatus(result.valid ? 'valid' : 'invalid');
    if (result.valid) {
      await api.settings.update({ anthropicApiKey: apiKey });
    }
  };

  const checkTts = async () => {
    const result = await api.settings.verifyEdgeTts();
    setTtsOk(result.installed);
  };

  const checkFfmpeg = async () => {
    const result = await api.settings.verifyFfmpeg();
    setFfmpegOk(result.installed);
  };

  const createStarters = async () => {
    setCreating(true);
    for (const data of STARTER_CHARACTERS) {
      await api.characters.create(data);
    }
    await api.settings.update({ setupComplete: true });
    setCreating(false);
    navigate('/characters');
  };

  return (
    <div className="min-h-[calc(100vh-3.5rem)] flex items-center justify-center p-6">
      <Card className="w-full max-w-lg">
        <CardContent className="p-8">
          <h1 className="text-2xl font-semibold mb-1">Welcome to Stichomythia</h1>
          <p className="text-sm text-muted-foreground mb-8">
            Let's get you set up. This takes about 2 minutes.
          </p>

          {step === 'api-key' && (
            <div className="space-y-4">
              <h2 className="text-lg font-medium">Step 1: API Key</h2>
              <div>
                <Label htmlFor="setup-key">Anthropic API Key</Label>
                <Input
                  id="setup-key"
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="sk-ant-..."
                />
              </div>
              <div className="flex gap-2">
                <Button onClick={verifyKey} disabled={!apiKey || keyStatus === 'checking'}>
                  {keyStatus === 'checking' ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : null}
                  Verify
                </Button>
                {keyStatus === 'valid' && (
                  <Button onClick={() => { setStep('edge-tts'); checkTts(); }}>
                    Next <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                )}
              </div>
              {keyStatus === 'valid' && (
                <p className="text-sm text-green-500 flex items-center gap-1">
                  <Check className="w-3 h-3" /> Key verified — Opus access confirmed
                </p>
              )}
              {keyStatus === 'invalid' && (
                <p className="text-sm text-red-500 flex items-center gap-1">
                  <X className="w-3 h-3" /> Invalid key. Check and try again.
                </p>
              )}
            </div>
          )}

          {step === 'edge-tts' && (
            <div className="space-y-4">
              <h2 className="text-lg font-medium">Step 2: Verify edge-tts</h2>
              {ttsOk === null ? (
                <p className="text-sm text-muted-foreground flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" /> Checking...
                </p>
              ) : ttsOk ? (
                <>
                  <p className="text-sm text-green-500 flex items-center gap-1">
                    <Check className="w-3 h-3" /> edge-tts is installed
                  </p>
                  <Button onClick={() => { setStep('ffmpeg'); checkFfmpeg(); }}>
                    Next <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </>
              ) : (
                <>
                  <p className="text-sm text-red-500 flex items-center gap-1">
                    <X className="w-3 h-3" /> edge-tts not found
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Install with: <code className="bg-muted px-1 rounded">pip install edge-tts</code>
                  </p>
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={checkTts}>Retry</Button>
                    <Button variant="ghost" onClick={() => { setStep('ffmpeg'); checkFfmpeg(); }}>
                      Skip
                    </Button>
                  </div>
                </>
              )}
            </div>
          )}

          {step === 'ffmpeg' && (
            <div className="space-y-4">
              <h2 className="text-lg font-medium">Step 3: Verify ffmpeg</h2>
              {ffmpegOk === null ? (
                <p className="text-sm text-muted-foreground flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" /> Checking...
                </p>
              ) : ffmpegOk ? (
                <>
                  <p className="text-sm text-green-500 flex items-center gap-1">
                    <Check className="w-3 h-3" /> ffmpeg is installed
                  </p>
                  <Button onClick={() => setStep('characters')}>
                    Next <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </>
              ) : (
                <>
                  <p className="text-sm text-red-500 flex items-center gap-1">
                    <X className="w-3 h-3" /> ffmpeg not found
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Install from ffmpeg.org (needed for mix-down export)
                  </p>
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={checkFfmpeg}>Retry</Button>
                    <Button variant="ghost" onClick={() => setStep('characters')}>
                      Skip
                    </Button>
                  </div>
                </>
              )}
            </div>
          )}

          {step === 'characters' && (
            <div className="space-y-4">
              <h2 className="text-lg font-medium">Step 4: Create Characters</h2>
              <p className="text-sm text-muted-foreground">
                We'll create 4 starter characters to get you going. You can customize them later.
              </p>
              <div className="space-y-2">
                {STARTER_CHARACTERS.map((char, i) => (
                  <div key={i} className="flex items-center gap-3 p-2 bg-muted/50 rounded-md">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: char.color }}
                    />
                    <span className="text-sm">{char.personality}</span>
                  </div>
                ))}
              </div>
              <Button onClick={createStarters} disabled={creating} className="w-full">
                {creating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    Creating characters...
                  </>
                ) : (
                  'Create Characters & Get Started'
                )}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
