import { Worker } from 'worker_threads';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import { SAMPLE_RATE, CHANNELS, CHUNK_FRAMES, CHUNK_FLOATS, RING_CHUNKS, RING_FLOATS } from './audio-constants.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const audify: any = require('audify');
const RtAudio = audify.RtAudio;
const RtAudioApi = audify.RtAudioApi;

interface StemPCM {
  left: Float32Array;
  right: Float32Array;
  length: number;
  volume: number;
  muted: boolean;
  soloed: boolean;
}

interface BiquadState {
  x1: number; x2: number; y1: number; y2: number;
}

interface BiquadCoeffs {
  b0: number; b1: number; b2: number; a1: number; a2: number;
}

interface EQBand {
  type: 'lowshelf' | 'peaking' | 'highshelf' | 'highpass';
  frequency: number;
  gain: number;
  Q: number;
  coeffs: BiquadCoeffs;
  stateL: BiquadState;
  stateR: BiquadState;
}

function computeCoeffs(type: string, freq: number, gain: number, Q: number): BiquadCoeffs {
  const A = Math.pow(10, gain / 40);
  const w0 = 2 * Math.PI * freq / SAMPLE_RATE;
  const cosw0 = Math.cos(w0);
  const sinw0 = Math.sin(w0);
  let alpha: number, b0: number, b1: number, b2: number, a0: number, a1: number, a2: number;

  if (type === 'peaking') {
    alpha = sinw0 / (2 * Q);
    b0 = 1 + alpha * A;
    b1 = -2 * cosw0;
    b2 = 1 - alpha * A;
    a0 = 1 + alpha / A;
    a1 = -2 * cosw0;
    a2 = 1 - alpha / A;
  } else if (type === 'lowshelf') {
    const sqrtA = Math.sqrt(A);
    alpha = sinw0 / 2 * Math.sqrt((A + 1 / A) * (1 / Q - 1) + 2);
    b0 = A * ((A + 1) - (A - 1) * cosw0 + 2 * sqrtA * alpha);
    b1 = 2 * A * ((A - 1) - (A + 1) * cosw0);
    b2 = A * ((A + 1) - (A - 1) * cosw0 - 2 * sqrtA * alpha);
    a0 = (A + 1) + (A - 1) * cosw0 + 2 * sqrtA * alpha;
    a1 = -2 * ((A - 1) + (A + 1) * cosw0);
    a2 = (A + 1) + (A - 1) * cosw0 - 2 * sqrtA * alpha;
  } else {
    const sqrtA = Math.sqrt(A);
    alpha = sinw0 / 2 * Math.sqrt((A + 1 / A) * (1 / Q - 1) + 2);
    b0 = A * ((A + 1) + (A - 1) * cosw0 + 2 * sqrtA * alpha);
    b1 = -2 * A * ((A - 1) + (A + 1) * cosw0);
    b2 = A * ((A + 1) + (A - 1) * cosw0 - 2 * sqrtA * alpha);
    a0 = (A + 1) - (A - 1) * cosw0 + 2 * sqrtA * alpha;
    a1 = 2 * ((A - 1) - (A + 1) * cosw0);
    a2 = (A + 1) - (A - 1) * cosw0 - 2 * sqrtA * alpha;
  }

  return { b0: b0 / a0, b1: b1 / a0, b2: b2 / a0, a1: a1 / a0, a2: a2 / a0 };
}

function computeHighpass(freq: number, Q: number): BiquadCoeffs {
  const w0 = 2 * Math.PI * freq / SAMPLE_RATE;
  const cosw0 = Math.cos(w0);
  const alpha = Math.sin(w0) / (2 * Q);
  const b0 = (1 + cosw0) / 2;
  const b1 = -(1 + cosw0);
  const b2 = (1 + cosw0) / 2;
  const a0 = 1 + alpha;
  const a1 = -2 * cosw0;
  const a2 = 1 - alpha;
  return { b0: b0 / a0, b1: b1 / a0, b2: b2 / a0, a1: a1 / a0, a2: a2 / a0 };
}

function computeLowpass(freq: number, Q: number): BiquadCoeffs {
  const w0 = 2 * Math.PI * freq / SAMPLE_RATE;
  const cosw0 = Math.cos(w0);
  const alpha = Math.sin(w0) / (2 * Q);
  const b0 = (1 - cosw0) / 2;
  const b1 = 1 - cosw0;
  const b2 = (1 - cosw0) / 2;
  const a0 = 1 + alpha;
  const a1 = -2 * cosw0;
  const a2 = 1 - alpha;
  return { b0: b0 / a0, b1: b1 / a0, b2: b2 / a0, a1: a1 / a0, a2: a2 / a0 };
}

interface CrossoverBand {
  filters: { coeffs: BiquadCoeffs; stateL: BiquadState; stateR: BiquadState }[];
}

const CROSSOVER_FREQS = [250, 2000, 8000];

function buildCrossoverBand(bandIndex: number, totalBands: number): CrossoverBand {
  const filters: CrossoverBand['filters'] = [];
  if (bandIndex > 0) {
    const hpFreq = CROSSOVER_FREQS[bandIndex - 1];
    filters.push({ coeffs: computeHighpass(hpFreq, 0.707), stateL: makeBiquadState(), stateR: makeBiquadState() });
    filters.push({ coeffs: computeHighpass(hpFreq, 0.707), stateL: makeBiquadState(), stateR: makeBiquadState() });
  }
  if (bandIndex < totalBands - 1) {
    const lpFreq = CROSSOVER_FREQS[bandIndex];
    filters.push({ coeffs: computeLowpass(lpFreq, 0.707), stateL: makeBiquadState(), stateR: makeBiquadState() });
    filters.push({ coeffs: computeLowpass(lpFreq, 0.707), stateL: makeBiquadState(), stateR: makeBiquadState() });
  }
  return { filters };
}

function makeBiquadState(): BiquadState {
  return { x1: 0, x2: 0, y1: 0, y2: 0 };
}

interface SpeakerState {
  worker: Worker;
  ringBuffer: SharedArrayBuffer;
  controlBuffer: SharedArrayBuffer;
  ringView: Float32Array;
  controlView: Int32Array;
  localWritePos: number;
  deviceName: string;
  stems: Set<string>;
  eq: EQBand[];
  crossover: CrossoverBand | null;
}

const CAPTURE_RING_SECONDS = 5;
const CAPTURE_RING_FRAMES = SAMPLE_RATE * CAPTURE_RING_SECONDS;

export class NativeAudioPlayer {
  private speakers = new Map<string, SpeakerState>();
  private stems = new Map<string, StemPCM>();
  private playing = false;
  private position = 0;
  private totalLength = 0;
  private looping = false;
  private nextMixFrame = 0;
  private playStartOffset = 0;
  private mixTimer: ReturnType<typeof setInterval> | null = null;
  private positionTimer: ReturnType<typeof setInterval> | null = null;
  private bufferState: 'idle' | 'buffering' | 'ready' = 'idle';
  private bufferingStartTime = 0;
  private onPositionUpdate: ((pos: number, dur: number) => void) | null = null;
  private onPlaybackEnd: (() => void) | null = null;
  private onPlaybackStart: (() => void) | null = null;
  private onBufferStateUpdate: ((state: 'idle' | 'buffering' | 'ready', elapsedSec: number) => void) | null = null;

  private pumpTimer: ReturnType<typeof setInterval> | null = null;
  private crossoverMode = false;

  private captureActive = false;
  private captureLeft = new Float32Array(CAPTURE_RING_FRAMES);
  private captureRight = new Float32Array(CAPTURE_RING_FRAMES);
  private captureWritePos = 0;
  private captureReadPos = 0;
  private captureSpeakers = new Set<string>();
  private captureMixTimer: ReturnType<typeof setInterval> | null = null;
  private capturePreBuffering = false;
  private readonly CAPTURE_PREBUFFER_CHUNKS = 4;

  getDevices(): { index: number; name: string; outputChannels: number; isDefault: boolean }[] {
    const rt = new RtAudio(RtAudioApi.WINDOWS_WASAPI);
    const devices = rt.getDevices();
    const defaultOut = rt.getDefaultOutputDevice();
    return devices
      .map((d: { name: string; outputChannels: number }, i: number) => ({
        index: i,
        name: d.name,
        outputChannels: d.outputChannels,
        isDefault: i === defaultOut,
      }))
      .filter((d: { outputChannels: number }) => d.outputChannels > 0);
  }

  private speakerOpenCount = 0;

  openSpeaker(speakerId: string, deviceName: string): Promise<boolean> {
    this.closeSpeaker(speakerId);

    const staggerMs = this.speakerOpenCount * 10;
    this.speakerOpenCount++;

    return new Promise<boolean>((resolve) => {
      setTimeout(() => {
        const ringBuffer = new SharedArrayBuffer(RING_FLOATS * 4);
        const controlBuffer = new SharedArrayBuffer(4 * 4);
        const ringView = new Float32Array(ringBuffer);
        const controlView = new Int32Array(controlBuffer);

        const workerPath = path.join(__dirname, 'audio-worker.js');
        const worker = new Worker(workerPath, {
          workerData: { deviceName, ringBuffer, controlBuffer, speakerId },
        });

        const defaultEQ: EQBand[] = [
          { type: 'highpass', frequency: 70, gain: 0, Q: 0.707, coeffs: computeHighpass(70, 0.707), stateL: makeBiquadState(), stateR: makeBiquadState() },
          { type: 'highpass', frequency: 70, gain: 0, Q: 0.707, coeffs: computeHighpass(70, 0.707), stateL: makeBiquadState(), stateR: makeBiquadState() },
          { type: 'lowshelf', frequency: 100, gain: 0, Q: 0.7, coeffs: computeCoeffs('lowshelf', 100, 0, 0.7), stateL: makeBiquadState(), stateR: makeBiquadState() },
          { type: 'peaking', frequency: 800, gain: 0, Q: 1.0, coeffs: computeCoeffs('peaking', 800, 0, 1.0), stateL: makeBiquadState(), stateR: makeBiquadState() },
          { type: 'peaking', frequency: 3000, gain: 0, Q: 1.0, coeffs: computeCoeffs('peaking', 3000, 0, 1.0), stateL: makeBiquadState(), stateR: makeBiquadState() },
          { type: 'highshelf', frequency: 10000, gain: 0, Q: 0.7, coeffs: computeCoeffs('highshelf', 10000, 0, 0.7), stateL: makeBiquadState(), stateR: makeBiquadState() },
        ];

        const sp: SpeakerState = {
          worker, ringBuffer, controlBuffer, ringView, controlView,
          localWritePos: 0, deviceName, stems: new Set(), eq: defaultEQ, crossover: null,
        };
        this.speakers.set(speakerId, sp);

        const timeout = setTimeout(() => {
          console.error(`[native-audio] Timeout opening speaker ${speakerId}`);
          resolve(false);
        }, 5000);

        worker.on('message', (msg: { type: string; device?: string; message?: string }) => {
          if (msg.type === 'opened') {
            clearTimeout(timeout);
            console.log(`[native-audio] Worker opened ${speakerId} → ${msg.device}`);
            resolve(true);
          } else if (msg.type === 'error') {
            clearTimeout(timeout);
            console.error(`[native-audio] Worker error ${speakerId}: ${msg.message}`);
            this.speakers.delete(speakerId);
            resolve(false);
          }
        });

        worker.on('error', (err) => {
          clearTimeout(timeout);
          console.error(`[native-audio] Worker crashed ${speakerId}:`, err);
          this.speakers.delete(speakerId);
          resolve(false);
        });

        worker.on('exit', (code) => {
          if (code !== 0) {
            console.log(`[native-audio] Worker exited ${speakerId} code ${code}`);
          }
        });
      }, staggerMs);
    });
  }

  closeSpeaker(speakerId: string): void {
    const sp = this.speakers.get(speakerId);
    if (!sp) return;
    try { sp.worker.postMessage({ type: 'close' }); } catch {}
    setTimeout(() => { try { sp.worker.terminate(); } catch {} }, 1000);
    this.speakers.delete(speakerId);
  }

  loadStem(stemId: string, leftData: Float32Array, rightData: Float32Array): void {
    this.stems.set(stemId, {
      left: leftData,
      right: rightData,
      length: leftData.length,
      volume: 1,
      muted: false,
      soloed: false,
    });
    this.recalcTotalLength();
  }

  unloadStem(stemId: string): void {
    this.stems.delete(stemId);
    for (const sp of this.speakers.values()) {
      sp.stems.delete(stemId);
    }
    this.recalcTotalLength();
  }

  assignStem(stemId: string, speakerId: string): void {
    for (const sp of this.speakers.values()) {
      sp.stems.delete(stemId);
    }
    const sp = this.speakers.get(speakerId);
    if (sp) sp.stems.add(stemId);
  }

  setStemVolume(stemId: string, volume: number): void {
    const stem = this.stems.get(stemId);
    if (stem) stem.volume = volume;
  }

  setStemMuted(stemId: string, muted: boolean): void {
    const stem = this.stems.get(stemId);
    if (stem) stem.muted = muted;
  }

  setStemSoloed(stemId: string, soloed: boolean): void {
    const stem = this.stems.get(stemId);
    if (stem) stem.soloed = soloed;
  }

  setEQ(speakerId: string, bandIndex: number, settings: { gain?: number; frequency?: number; Q?: number }): void {
    const sp = this.speakers.get(speakerId);
    const idx = bandIndex + 2;
    if (!sp || idx < 2 || idx >= sp.eq.length) return;
    const band = sp.eq[idx];
    if (settings.gain !== undefined) band.gain = settings.gain;
    if (settings.frequency !== undefined) band.frequency = settings.frequency;
    if (settings.Q !== undefined) band.Q = settings.Q;
    band.coeffs = computeCoeffs(band.type, band.frequency, band.gain, band.Q);
  }

  setCrossoverMode(enabled: boolean): void {
    this.crossoverMode = enabled;
    const speakerList = [...this.speakers.entries()];
    const totalBands = Math.min(speakerList.length, 4);
    for (let i = 0; i < speakerList.length; i++) {
      const [, sp] = speakerList[i];
      if (enabled && i < totalBands) {
        sp.crossover = buildCrossoverBand(i, totalBands);
      } else {
        sp.crossover = null;
      }
    }
    console.log(`[native-audio] Crossover mode: ${enabled ? 'ON' : 'OFF'} (${totalBands} bands)`);
  }

  isCrossoverMode(): boolean {
    return this.crossoverMode;
  }

  setLooping(looping: boolean): void {
    this.looping = looping;
  }

  setOnPositionUpdate(cb: (pos: number, dur: number) => void): void {
    this.onPositionUpdate = cb;
  }

  setOnPlaybackEnd(cb: () => void): void {
    this.onPlaybackEnd = cb;
  }

  setOnPlaybackStart(cb: () => void): void {
    this.onPlaybackStart = cb;
  }

  setOnBufferStateUpdate(cb: (state: 'idle' | 'buffering' | 'ready', elapsedSec: number) => void): void {
    this.onBufferStateUpdate = cb;
  }

  getBufferState(): 'idle' | 'buffering' | 'ready' {
    return this.bufferState;
  }

  play(fromPositionSec?: number): void {
    if (this.playing) return;
    if (fromPositionSec !== undefined) {
      this.position = Math.floor(fromPositionSec * SAMPLE_RATE);
    }

    this.bufferState = 'buffering';
    this.bufferingStartTime = performance.now();
    this.nextMixFrame = this.position;
    this.playStartOffset = this.position;

    for (const sp of this.speakers.values()) {
      sp.ringView.fill(0);
      Atomics.store(sp.controlView, 0, 0);
      Atomics.store(sp.controlView, 1, 0);
      Atomics.store(sp.controlView, 2, 0);
      sp.localWritePos = 0;
    }

    this.preMix(RING_CHUNKS);

    for (const sp of this.speakers.values()) {
      Atomics.store(sp.controlView, 0, 1);
    }

    this.startMixLoop();
    this.startPumpBroadcast();
    this.startBufferingTimer();
    this.onBufferStateUpdate?.('buffering', 0);

    setTimeout(() => {
      if (this.bufferState === 'buffering') {
        this.bufferState = 'idle';
        this.playing = true;
        this.stopBufferingTimer();
        const elapsed = (performance.now() - this.bufferingStartTime) / 1000;
        console.log(`[native-audio] Buffered in ${elapsed.toFixed(1)}s, playing`);
        this.onBufferStateUpdate?.('idle', 0);
        this.onPlaybackStart?.();
        this.startPositionTimer();
      }
    }, 3000);
  }

  pause(): void {
    if (!this.playing) return;
    this.playing = false;
    this.bufferState = 'idle';
    this.position = this.getReadPositionSamples();

    for (const sp of this.speakers.values()) {
      Atomics.store(sp.controlView, 0, 0);
    }

    this.stopMixLoop();
    this.stopPumpBroadcast();
    this.stopPositionTimer();
    this.stopBufferingTimer();

    for (const sp of this.speakers.values()) {
      try { sp.worker.postMessage({ type: 'flush' }); } catch {}
    }
  }

  stop(): void {
    this.playing = false;
    this.bufferState = 'idle';
    this.position = 0;

    for (const sp of this.speakers.values()) {
      Atomics.store(sp.controlView, 0, 0);
    }

    this.stopMixLoop();
    this.stopPumpBroadcast();
    this.stopPositionTimer();
    this.stopBufferingTimer();
    this.onBufferStateUpdate?.('idle', 0);

    for (const sp of this.speakers.values()) {
      try { sp.worker.postMessage({ type: 'flush' }); } catch {}
    }
  }

  seek(positionSec: number): void {
    for (const sp of this.speakers.values()) {
      Atomics.store(sp.controlView, 0, 0);
    }

    this.position = Math.floor(positionSec * SAMPLE_RATE);
    this.nextMixFrame = this.position;

    for (const sp of this.speakers.values()) {
      sp.ringView.fill(0);
      Atomics.store(sp.controlView, 1, 0);
      Atomics.store(sp.controlView, 2, 0);
      sp.localWritePos = 0;
    }

    if (this.playing) {
      this.preMix(RING_CHUNKS);
      this.playStartOffset = this.position;

      for (const sp of this.speakers.values()) {
        Atomics.store(sp.controlView, 0, 1);
      }
    }
  }

  getPosition(): number {
    if (!this.playing) return this.position / SAMPLE_RATE;
    return this.getReadPositionSamples() / SAMPLE_RATE;
  }

  getDuration(): number {
    return this.totalLength / SAMPLE_RATE;
  }

  isPlaying(): boolean {
    return this.playing;
  }

  startCapture(speakerIds: string[]): void {
    this.captureWritePos = 0;
    this.captureReadPos = 0;
    this.captureSpeakers.clear();
    for (const id of speakerIds) {
      if (this.speakers.has(id)) this.captureSpeakers.add(id);
    }
    if (this.captureSpeakers.size === 0) {
      for (const id of this.speakers.keys()) this.captureSpeakers.add(id);
    }
    this.captureActive = true;
    this.capturePreBuffering = true;

    for (const sp of this.speakers.values()) {
      sp.ringView.fill(0);
      Atomics.store(sp.controlView, 0, 0);
      Atomics.store(sp.controlView, 1, 0);
      Atomics.store(sp.controlView, 2, 0);
      sp.localWritePos = 0;
    }

    this.startCaptureMixLoop();
    console.log(`[native-audio] Capture started (pre-buffering ${this.CAPTURE_PREBUFFER_CHUNKS} chunks) → ${this.captureSpeakers.size} speakers`);
  }

  stopCapture(): void {
    this.captureActive = false;
    this.stopCaptureMixLoop();
    this.stopPumpBroadcast();

    for (const sp of this.speakers.values()) {
      Atomics.store(sp.controlView, 0, 0);
      try { sp.worker.postMessage({ type: 'flush' }); } catch {}
    }

    console.log('[native-audio] Capture stopped');
  }

  private captureFeedCount = 0;

  feedCapture(left: Float32Array, right: Float32Array): void {
    if (!this.captureActive) return;
    this.captureFeedCount++;
    if (this.captureFeedCount % 100 === 1) {
      console.log(`[native-audio] feedCapture #${this.captureFeedCount}: ${left.length} frames, writePos=${this.captureWritePos}, readPos=${this.captureReadPos}`);
    }
    const len = left.length;
    for (let i = 0; i < len; i++) {
      const pos = this.captureWritePos % CAPTURE_RING_FRAMES;
      this.captureLeft[pos] = left[i];
      this.captureRight[pos] = right[i];
      this.captureWritePos++;
    }
  }

  isCaptureActive(): boolean {
    return this.captureActive;
  }

  private startCaptureMixLoop(): void {
    this.stopCaptureMixLoop();
    this.captureMixTimer = setInterval(() => {
      if (!this.captureActive) return;
      this.captureMix();
    }, 20);
  }

  private stopCaptureMixLoop(): void {
    if (this.captureMixTimer) {
      clearInterval(this.captureMixTimer);
      this.captureMixTimer = null;
    }
  }

  private captureMix(): void {
    const available = this.captureWritePos - this.captureReadPos;
    if (available < CHUNK_FRAMES) return;

    const chunksAvailable = Math.floor(available / CHUNK_FRAMES);
    let minWritten = chunksAvailable;

    for (const [spId, sp] of this.speakers) {
      if (!this.captureSpeakers.has(spId)) continue;

      const readPos = Atomics.load(sp.controlView, 2);
      const buffered = sp.localWritePos - readPos;
      const space = RING_CHUNKS - 1 - buffered;
      if (space <= 0) { minWritten = 0; continue; }

      const toWrite = Math.min(chunksAvailable, space);

      for (let c = 0; c < toWrite; c++) {
        const ringOffset = (sp.localWritePos % RING_CHUNKS) * CHUNK_FLOATS;
        const captureStart = (this.captureReadPos + c * CHUNK_FRAMES) % CAPTURE_RING_FRAMES;

        for (let f = 0; f < CHUNK_FRAMES; f++) {
          const srcIdx = (captureStart + f) % CAPTURE_RING_FRAMES;
          sp.ringView[ringOffset + f * 2] = this.captureLeft[srcIdx];
          sp.ringView[ringOffset + f * 2 + 1] = this.captureRight[srcIdx];
        }

        for (const band of sp.eq) {
          if (band.gain === 0 && band.type !== 'highpass') continue;
          const { b0, b1, b2, a1, a2 } = band.coeffs;
          const sL = band.stateL;
          const sR = band.stateR;
          for (let f = 0; f < CHUNK_FRAMES; f++) {
            const li = ringOffset + f * 2;
            const ri = li + 1;
            const xL = sp.ringView[li];
            const yL = b0 * xL + b1 * sL.x1 + b2 * sL.x2 - a1 * sL.y1 - a2 * sL.y2;
            sL.x2 = sL.x1; sL.x1 = xL; sL.y2 = sL.y1; sL.y1 = yL;
            sp.ringView[li] = yL;
            const xR = sp.ringView[ri];
            const yR = b0 * xR + b1 * sR.x1 + b2 * sR.x2 - a1 * sR.y1 - a2 * sR.y2;
            sR.x2 = sR.x1; sR.x1 = xR; sR.y2 = sR.y1; sR.y1 = yR;
            sp.ringView[ri] = yR;
          }
        }

        sp.localWritePos++;
        Atomics.store(sp.controlView, 1, sp.localWritePos);
      }

      if (toWrite < minWritten) minWritten = toWrite;
    }

    if (minWritten > 0) {
      this.captureReadPos += minWritten * CHUNK_FRAMES;
    }

    if (this.capturePreBuffering) {
      let allReady = true;
      for (const [spId, sp] of this.speakers) {
        if (!this.captureSpeakers.has(spId)) continue;
        if (sp.localWritePos < this.CAPTURE_PREBUFFER_CHUNKS) {
          allReady = false;
          break;
        }
      }
      if (allReady) {
        this.capturePreBuffering = false;
        for (const [spId, sp] of this.speakers) {
          if (!this.captureSpeakers.has(spId)) continue;
          Atomics.store(sp.controlView, 0, 1);
        }
        this.startPumpBroadcast();
        console.log('[native-audio] Capture pre-buffer complete, all speakers started simultaneously');
      }
    }
  }

  dispose(): void {
    this.stopCapture();
    this.stop();
    for (const [id] of this.speakers) {
      this.closeSpeaker(id);
    }
    this.stems.clear();
  }

  private getReadPositionSamples(): number {
    if (!this.playing) return this.position;
    let minRead = Infinity;
    for (const sp of this.speakers.values()) {
      const readPos = Atomics.load(sp.controlView, 2);
      if (readPos < minRead) minRead = readPos;
    }
    if (minRead === Infinity) return this.position;
    const pos = this.playStartOffset + minRead * CHUNK_FRAMES;
    return Math.min(pos, this.totalLength);
  }

  private recalcTotalLength(): void {
    let max = 0;
    for (const stem of this.stems.values()) {
      if (stem.length > max) max = stem.length;
    }
    this.totalLength = max;
  }

  private preMix(maxChunks: number): void {
    const anySoloed = [...this.stems.values()].some(s => s.soloed);

    for (let c = 0; c < maxChunks; c++) {
      if (this.nextMixFrame >= this.totalLength) {
        if (this.looping) {
          this.nextMixFrame = 0;
        } else {
          return;
        }
      }

      for (const sp of this.speakers.values()) {
        const ringOffset = (sp.localWritePos % RING_CHUNKS) * CHUNK_FLOATS;
        const end = ringOffset + CHUNK_FLOATS;

        sp.ringView.fill(0, ringOffset, end);

        if (this.crossoverMode) {
          for (const stem of this.stems.values()) {
            if (stem.muted) continue;
            if (anySoloed && !stem.soloed) continue;
            const vol = stem.volume;
            for (let f = 0; f < CHUNK_FRAMES; f++) {
              const idx = this.nextMixFrame + f;
              if (idx >= stem.length) break;
              sp.ringView[ringOffset + f * 2] += stem.left[idx] * vol;
              sp.ringView[ringOffset + f * 2 + 1] += stem.right[idx] * vol;
            }
          }
        } else {
          for (const stemId of sp.stems) {
            const stem = this.stems.get(stemId);
            if (!stem || stem.muted) continue;
            if (anySoloed && !stem.soloed) continue;
            const vol = stem.volume;
            for (let f = 0; f < CHUNK_FRAMES; f++) {
              const idx = this.nextMixFrame + f;
              if (idx >= stem.length) break;
              sp.ringView[ringOffset + f * 2] += stem.left[idx] * vol;
              sp.ringView[ringOffset + f * 2 + 1] += stem.right[idx] * vol;
            }
          }
        }

        for (const band of sp.eq) {
          if (band.gain === 0 && band.type !== 'highpass') continue;
          const { b0, b1, b2, a1, a2 } = band.coeffs;
          const sL = band.stateL;
          const sR = band.stateR;
          for (let f = 0; f < CHUNK_FRAMES; f++) {
            const li = ringOffset + f * 2;
            const ri = li + 1;
            const xL = sp.ringView[li];
            const yL = b0 * xL + b1 * sL.x1 + b2 * sL.x2 - a1 * sL.y1 - a2 * sL.y2;
            sL.x2 = sL.x1; sL.x1 = xL; sL.y2 = sL.y1; sL.y1 = yL;
            sp.ringView[li] = yL;
            const xR = sp.ringView[ri];
            const yR = b0 * xR + b1 * sR.x1 + b2 * sR.x2 - a1 * sR.y1 - a2 * sR.y2;
            sR.x2 = sR.x1; sR.x1 = xR; sR.y2 = sR.y1; sR.y1 = yR;
            sp.ringView[ri] = yR;
          }
        }

        if (sp.crossover) {
          for (const filt of sp.crossover.filters) {
            const { b0, b1, b2, a1, a2 } = filt.coeffs;
            const sL = filt.stateL;
            const sR = filt.stateR;
            for (let f = 0; f < CHUNK_FRAMES; f++) {
              const li = ringOffset + f * 2;
              const ri = li + 1;
              const xL = sp.ringView[li];
              const yL = b0 * xL + b1 * sL.x1 + b2 * sL.x2 - a1 * sL.y1 - a2 * sL.y2;
              sL.x2 = sL.x1; sL.x1 = xL; sL.y2 = sL.y1; sL.y1 = yL;
              sp.ringView[li] = yL;
              const xR = sp.ringView[ri];
              const yR = b0 * xR + b1 * sR.x1 + b2 * sR.x2 - a1 * sR.y1 - a2 * sR.y2;
              sR.x2 = sR.x1; sR.x1 = xR; sR.y2 = sR.y1; sR.y1 = yR;
              sp.ringView[ri] = yR;
            }
          }
        }

        for (let i = ringOffset; i < end; i++) {
          if (sp.ringView[i] > 1) sp.ringView[i] = 1;
          else if (sp.ringView[i] < -1) sp.ringView[i] = -1;
        }

        sp.localWritePos++;
        Atomics.store(sp.controlView, 1, sp.localWritePos);
      }

      this.nextMixFrame += CHUNK_FRAMES;
    }
  }

  private startMixLoop(): void {
    this.stopMixLoop();
    this.mixTimer = setInterval(() => {
      if (!this.playing && this.bufferState === 'idle') return;

      let minBuffered = RING_CHUNKS;
      for (const sp of this.speakers.values()) {
        const readPos = Atomics.load(sp.controlView, 2);
        const buffered = sp.localWritePos - readPos;
        if (buffered < minBuffered) minBuffered = buffered;
      }

      const toMix = RING_CHUNKS - minBuffered;
      if (toMix > 0) this.preMix(toMix);

      if (this.playing && this.nextMixFrame >= this.totalLength && !this.looping) {
        let allDone = true;
        for (const sp of this.speakers.values()) {
          if (Atomics.load(sp.controlView, 2) < sp.localWritePos) {
            allDone = false;
            break;
          }
        }
        if (allDone) {
          this.playing = false;
          this.position = 0;
          for (const sp of this.speakers.values()) {
            Atomics.store(sp.controlView, 0, 0);
          }
          this.stopMixLoop();
          this.stopPumpBroadcast();
          this.stopPositionTimer();
          this.onPlaybackEnd?.();
        }
      }
    }, 20);
  }

  private stopMixLoop(): void {
    if (this.mixTimer) {
      clearInterval(this.mixTimer);
      this.mixTimer = null;
    }
  }

  private startPumpBroadcast(): void {
    this.stopPumpBroadcast();
    const msg = { type: 'pump' };
    this.pumpTimer = setInterval(() => {
      for (const sp of this.speakers.values()) {
        sp.worker.postMessage(msg);
      }
    }, 45);
  }

  private stopPumpBroadcast(): void {
    if (this.pumpTimer) {
      clearInterval(this.pumpTimer);
      this.pumpTimer = null;
    }
  }

  private bufferingTimer: ReturnType<typeof setInterval> | null = null;

  private startBufferingTimer(): void {
    this.stopBufferingTimer();
    this.bufferingTimer = setInterval(() => {
      if (this.bufferState !== 'buffering') return;
      const elapsed = (performance.now() - this.bufferingStartTime) / 1000;
      this.onBufferStateUpdate?.('buffering', elapsed);
    }, 100);
  }

  private stopBufferingTimer(): void {
    if (this.bufferingTimer) {
      clearInterval(this.bufferingTimer);
      this.bufferingTimer = null;
    }
  }

  private startPositionTimer(): void {
    this.stopPositionTimer();
    this.positionTimer = setInterval(() => {
      if (!this.playing) return;
      this.onPositionUpdate?.(this.getPosition(), this.getDuration());
    }, 50);
  }

  private stopPositionTimer(): void {
    if (this.positionTimer) {
      clearInterval(this.positionTimer);
      this.positionTimer = null;
    }
  }
}
