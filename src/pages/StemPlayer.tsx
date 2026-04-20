import { useState, useRef, useCallback, useEffect } from 'react';
import { v4 as uuid } from 'uuid';
import { Music, Plus, Save, Trash2, FolderOpen, ChevronRight, ArrowUp } from 'lucide-react';
import { StemSlotRow } from '@/components/stems/StemSlotRow';
import { StemTransport } from '@/components/stems/StemTransport';
import { useAudioEngine } from '@/contexts/AudioEngineContext';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { StemTrackConfig, StemSlot } from '@/types';

const STEM_COUNT = 4;

interface LoadedStem {
  slot: StemSlot;
  rawBuffer: ArrayBuffer | null;
  duration: number;
}

function createEmptySlot(): StemSlot {
  return { filePath: '', fileName: '', speakerId: null, volume: 1, muted: false, soloed: false };
}

function createEmptyLoaded(): LoadedStem {
  return { slot: createEmptySlot(), rawBuffer: null, duration: 0 };
}

export function StemPlayer() {
  const { engine } = useAudioEngine();

  const [tracks, setTracks] = useState<StemTrackConfig[]>([]);
  const [activeTrackId, setActiveTrackId] = useState<string | null>(null);
  const [trackName, setTrackName] = useState('');
  const [stems, setStems] = useState<LoadedStem[]>(() =>
    Array.from({ length: STEM_COUNT }, createEmptyLoaded)
  );
  const [dirty, setDirty] = useState(false);

  const [playing, setPlaying] = useState(false);
  const [looping, setLooping] = useState(false);
  const [position, setPosition] = useState(0);

  const [browseFolder, setBrowseFolder] = useState<string | null>(null);
  const [browseFiles, setBrowseFiles] = useState<{ name: string; path: string }[]>([]);
  const [browseSubdirs, setBrowseSubdirs] = useState<{ name: string; path: string }[]>([]);
  const [browseCurrent, setBrowseCurrent] = useState('');

  const sourcesRef = useRef<(AudioBufferSourceNode | null)[]>([null, null, null, null]);
  const startTimeRef = useRef(0);
  const offsetRef = useRef(0);
  const rafRef = useRef(0);
  const playingRef = useRef(false);

  const maxDuration = Math.max(...stems.map(s => s.duration), 0);
  const hasAnyStem = stems.some(s => s.rawBuffer !== null);

  useEffect(() => {
    api.tracks.list().then(setTracks).catch(() => {});
  }, []);

  const loadTrack = useCallback(async (track: StemTrackConfig) => {
    if (playingRef.current) stopPlayback();
    setActiveTrackId(track.id);
    setTrackName(track.name);
    setDirty(false);

    const loaded: LoadedStem[] = [];
    for (let i = 0; i < STEM_COUNT; i++) {
      const slot = track.stems[i] ?? createEmptySlot();
      if (slot.filePath) {
        try {
          const resp = await fetch(api.tracks.fileUrl(slot.filePath));
          const buf = await resp.arrayBuffer();
          const offCtx = new OfflineAudioContext(2, 1, 44100);
          const decoded = await offCtx.decodeAudioData(buf.slice(0));
          loaded.push({ slot, rawBuffer: buf, duration: decoded.duration });
        } catch {
          loaded.push({ slot: { ...slot, fileName: slot.fileName + ' (missing)' }, rawBuffer: null, duration: 0 });
        }
      } else {
        loaded.push(createEmptyLoaded());
      }
    }
    setStems(loaded);
    offsetRef.current = 0;
    setPosition(0);
  }, []);

  const updateStem = useCallback((index: number, update: Partial<LoadedStem>) => {
    setStems(prev => prev.map((s, i) => i === index ? { ...s, ...update } : s));
    setDirty(true);
  }, []);

  const updateSlot = useCallback((index: number, update: Partial<StemSlot>) => {
    setStems(prev => prev.map((s, i) =>
      i === index ? { ...s, slot: { ...s.slot, ...update } } : s
    ));
    setDirty(true);
  }, []);

  const loadFileIntoSlot = useCallback(async (index: number, filePath: string, fileName: string) => {
    try {
      const resp = await fetch(api.tracks.fileUrl(filePath));
      const buf = await resp.arrayBuffer();
      const offCtx = new OfflineAudioContext(2, 1, 44100);
      const decoded = await offCtx.decodeAudioData(buf.slice(0));
      updateStem(index, {
        slot: { ...stems[index].slot, filePath, fileName, speakerId: stems[index].slot.speakerId },
        rawBuffer: buf,
        duration: decoded.duration,
      });
    } catch {
      console.error('Failed to load:', filePath);
    }
  }, [stems, updateStem]);

  const handleSave = useCallback(async () => {
    const stemSlots = stems.map(s => s.slot);
    if (activeTrackId) {
      const updated = await api.tracks.update(activeTrackId, { name: trackName, stems: stemSlots });
      setTracks(prev => prev.map(t => t.id === activeTrackId ? updated : t));
    } else {
      const track: StemTrackConfig = {
        id: uuid(),
        name: trackName || 'Untitled Track',
        stems: stemSlots,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      const created = await api.tracks.create(track);
      setTracks(prev => [...prev, created]);
      setActiveTrackId(created.id);
    }
    setDirty(false);
  }, [activeTrackId, trackName, stems]);

  const handleNew = useCallback(() => {
    if (playingRef.current) stopPlayback();
    setActiveTrackId(null);
    setTrackName('');
    setStems(Array.from({ length: STEM_COUNT }, createEmptyLoaded));
    setDirty(false);
    offsetRef.current = 0;
    setPosition(0);
  }, []);

  const handleDelete = useCallback(async (id: string) => {
    await api.tracks.delete(id);
    setTracks(prev => prev.filter(t => t.id !== id));
    if (activeTrackId === id) handleNew();
  }, [activeTrackId, handleNew]);

  const openFolder = useCallback(async (folderPath: string) => {
    try {
      const result = await api.tracks.browse(folderPath);
      setBrowseFiles(result.files);
      setBrowseSubdirs(result.subdirs);
      setBrowseCurrent(result.current);
      setBrowseFolder(result.current);
    } catch {
      console.error('Cannot browse:', folderPath);
    }
  }, []);

  const promptFolder = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.setAttribute('webkitdirectory', '');
    input.onchange = () => {
      const file = input.files?.[0];
      if (file) {
        const folderPath = (file as unknown as { path: string }).path;
        const dir = folderPath.substring(0, folderPath.lastIndexOf('\\')) || folderPath.substring(0, folderPath.lastIndexOf('/'));
        openFolder(dir);
      }
    };
    input.click();
  }, [openFolder]);

  // Playback
  const stopAllSources = useCallback(() => {
    for (let i = 0; i < STEM_COUNT; i++) {
      try { sourcesRef.current[i]?.stop(); } catch {}
      sourcesRef.current[i] = null;
    }
    cancelAnimationFrame(rafRef.current);
  }, []);

  const tickPosition = useCallback(() => {
    if (!playingRef.current) return;
    const elapsed = offsetRef.current + (performance.now() - startTimeRef.current) / 1000;
    setPosition(elapsed);
    if (elapsed >= maxDuration) {
      if (looping) {
        offsetRef.current = 0;
        startPlayback(0);
      } else {
        stopPlayback();
      }
      return;
    }
    rafRef.current = requestAnimationFrame(tickPosition);
  }, [maxDuration, looping]);

  const startPlayback = useCallback(async (fromOffset: number) => {
    stopAllSources();
    const anySoloed = stems.some(s => s.slot.soloed);
    for (let i = 0; i < STEM_COUNT; i++) {
      const { slot, rawBuffer } = stems[i];
      if (!rawBuffer || !slot.speakerId) continue;
      if (slot.muted || (anySoloed && !slot.soloed)) continue;
      const ch = engine.channels.get(slot.speakerId);
      if (!ch) continue;
      const decoded = await ch.audioContext.decodeAudioData(rawBuffer.slice(0));
      const source = ch.audioContext.createBufferSource();
      source.buffer = decoded;
      source.connect(ch.inputNode);
      if (decoded.duration - fromOffset <= 0) continue;
      source.start(0, fromOffset);
      sourcesRef.current[i] = source;
    }
    startTimeRef.current = performance.now();
    offsetRef.current = fromOffset;
    playingRef.current = true;
    setPlaying(true);
    rafRef.current = requestAnimationFrame(tickPosition);
  }, [stems, engine, stopAllSources, tickPosition]);

  const stopPlayback = useCallback(() => {
    playingRef.current = false;
    setPlaying(false);
    stopAllSources();
  }, [stopAllSources]);

  const handlePlay = useCallback(() => startPlayback(offsetRef.current), [startPlayback]);
  const handlePause = useCallback(() => {
    offsetRef.current += (performance.now() - startTimeRef.current) / 1000;
    playingRef.current = false;
    setPlaying(false);
    stopAllSources();
  }, [stopAllSources]);
  const handleStop = useCallback(() => { stopPlayback(); offsetRef.current = 0; setPosition(0); }, [stopPlayback]);
  const handleSeek = useCallback((pos: number) => {
    offsetRef.current = pos;
    setPosition(pos);
    if (playingRef.current) startPlayback(pos);
  }, [startPlayback]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.code === 'Space') {
        e.preventDefault();
        if (playingRef.current) handlePause();
        else if (hasAnyStem) handlePlay();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handlePlay, handlePause, hasAnyStem]);

  useEffect(() => () => stopAllSources(), [stopAllSources]);

  return (
    <div className="flex flex-col h-full">
      <div className="border-b border-gold/10 px-5 py-3 gradient-dark-gold shrink-0">
        <div className="flex items-center gap-3">
          <Music className="w-5 h-5 text-gold" />
          <h1 className="text-base font-heading tracking-wider">Stem Workstation</h1>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Track Library */}
        <div className="w-56 border-r border-gold/10 flex flex-col shrink-0">
          <div className="flex items-center justify-between px-3 py-2 border-b border-gold/10">
            <span className="text-xs font-heading text-gold-light tracking-wider">Tracks</span>
            <Button size="icon" variant="ghost" className="h-6 w-6" onClick={handleNew}>
              <Plus className="w-3.5 h-3.5" />
            </Button>
          </div>
          <div className="flex-1 overflow-y-auto">
            {tracks.map(t => (
              <div
                key={t.id}
                className={`flex items-center gap-2 px-3 py-2 cursor-pointer transition-colors group ${
                  t.id === activeTrackId ? 'bg-gold-muted text-gold' : 'text-muted-foreground hover:bg-card/80 hover:text-foreground'
                }`}
                onClick={() => loadTrack(t)}
              >
                <Music className="w-3 h-3 shrink-0" />
                <span className="text-xs truncate flex-1">{t.name}</span>
                <span className="text-[10px] text-muted-foreground">{t.stems.filter(s => s.filePath).length}</span>
                <button
                  onClick={(e) => { e.stopPropagation(); handleDelete(t.id); }}
                  className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-red-400 transition-all"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            ))}
            {tracks.length === 0 && (
              <p className="text-[10px] text-muted-foreground px-3 py-4 text-center">No saved tracks</p>
            )}
          </div>

          {/* Folder browser */}
          <div className="border-t border-gold/10">
            <div className="flex items-center justify-between px-3 py-2">
              <span className="text-xs font-heading text-gold-light tracking-wider">Files</span>
              <Button size="icon" variant="ghost" className="h-6 w-6" onClick={promptFolder}>
                <FolderOpen className="w-3.5 h-3.5" />
              </Button>
            </div>
            {browseFolder && (
              <div className="overflow-y-auto max-h-48">
                <div className="px-3 pb-1">
                  <p className="text-[9px] text-muted-foreground truncate" title={browseCurrent}>{browseCurrent}</p>
                </div>
                <button
                  onClick={() => {
                    const parent = browseCurrent.replace(/[/\\][^/\\]+$/, '');
                    if (parent && parent !== browseCurrent) openFolder(parent);
                  }}
                  className="flex items-center gap-1.5 px-3 py-1 w-full text-left text-[10px] text-muted-foreground hover:bg-card/80"
                >
                  <ArrowUp className="w-3 h-3" /> ..
                </button>
                {browseSubdirs.map(d => (
                  <button
                    key={d.path}
                    onClick={() => openFolder(d.path)}
                    className="flex items-center gap-1.5 px-3 py-1 w-full text-left text-[10px] text-muted-foreground hover:bg-card/80 truncate"
                  >
                    <ChevronRight className="w-3 h-3 shrink-0" />
                    {d.name}
                  </button>
                ))}
                {browseFiles.map(f => {
                  const emptySlotIdx = stems.findIndex(s => !s.rawBuffer);
                  return (
                    <button
                      key={f.path}
                      onClick={() => {
                        if (emptySlotIdx >= 0) loadFileIntoSlot(emptySlotIdx, f.path, f.name);
                      }}
                      disabled={emptySlotIdx < 0}
                      className="flex items-center gap-1.5 px-3 py-1 w-full text-left text-[10px] hover:bg-gold-muted/50 hover:text-gold truncate disabled:opacity-30"
                    >
                      <Music className="w-3 h-3 shrink-0 text-gold/50" />
                      {f.name}
                    </button>
                  );
                })}
                {browseFiles.length === 0 && browseSubdirs.length === 0 && (
                  <p className="text-[10px] text-muted-foreground px-3 py-2 text-center">Empty folder</p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Workspace */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex items-center gap-3 px-4 py-2 border-b border-gold/10 shrink-0">
            <Input
              value={trackName}
              onChange={(e) => { setTrackName(e.target.value); setDirty(true); }}
              placeholder="Track name..."
              className="h-7 text-sm max-w-xs"
            />
            <Button
              size="sm"
              variant="outline"
              onClick={handleSave}
              disabled={!dirty && !!activeTrackId}
              className="border-gold/20 hover:bg-gold-muted"
            >
              <Save className="w-3.5 h-3.5 mr-1.5" />
              {activeTrackId ? 'Save' : 'Save New'}
            </Button>
          </div>

          <div className="flex-1 overflow-hidden p-4 flex flex-col gap-2">
            {stems.map((stem, i) => (
              <StemSlotRow
                key={i}
                index={i}
                slot={stem.slot}
                hasBuffer={stem.rawBuffer !== null}
                duration={stem.duration}
                position={position}
                onUpdateSlot={(update) => updateSlot(i, update)}
                onLoadFile={(path, name) => loadFileIntoSlot(i, path, name)}
                onRemove={() => {
                  if (playing) handleStop();
                  updateStem(i, createEmptyLoaded());
                }}
              />
            ))}
          </div>

          <StemTransport
            playing={playing}
            looping={looping}
            position={position}
            duration={maxDuration}
            onPlay={handlePlay}
            onPause={handlePause}
            onStop={handleStop}
            onSeek={handleSeek}
            onToggleLoop={() => setLooping(!looping)}
            disabled={!hasAnyStem}
          />
        </div>
      </div>
    </div>
  );
}
