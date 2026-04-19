import { DEFAULT_EQ_BANDS } from '@/types';
import type { EQBandSettings } from '@/types';

export interface ChannelState {
  speakerId: string;
  deviceId: string;
  audioContext: AudioContext;
  inputNode: GainNode;
  gainNode: GainNode;
  eqNodes: BiquadFilterNode[];
  compressorNode: DynamicsCompressorNode;
  analyserNode: AnalyserNode;
  keepAliveOscillator: OscillatorNode;
  keepAliveGain: GainNode;
  volume: number;
  muted: boolean;
  soloed: boolean;
  compressorEnabled: boolean;
  eqSettings: EQBandSettings[];
}

export class AudioEngine {
  channels = new Map<string, ChannelState>();
  masterVolume = 1;
  private keepAliveActive = false;

  createChannel(speakerId: string, deviceId: string): ChannelState {
    if (this.channels.has(speakerId)) {
      this.removeChannel(speakerId);
    }

    const ctx = new AudioContext({ sinkId: deviceId } as AudioContextOptions);

    const inputNode = ctx.createGain();
    inputNode.gain.value = 1;

    const gainNode = ctx.createGain();
    gainNode.gain.value = 1;

    const eqSettings = DEFAULT_EQ_BANDS.map(b => ({ ...b }));
    const eqNodes = eqSettings.map(band => {
      const filter = ctx.createBiquadFilter();
      filter.type = band.type;
      filter.frequency.value = band.frequency;
      filter.gain.value = band.gain;
      filter.Q.value = band.Q;
      return filter;
    });

    const compressorNode = ctx.createDynamicsCompressor();
    compressorNode.threshold.value = -24;
    compressorNode.knee.value = 30;
    compressorNode.ratio.value = 4;
    compressorNode.attack.value = 0.003;
    compressorNode.release.value = 0.25;

    const analyserNode = ctx.createAnalyser();
    analyserNode.fftSize = 256;
    analyserNode.smoothingTimeConstant = 0.8;

    // Wire: input → gain → EQ chain → compressor → analyser → destination
    inputNode.connect(gainNode);
    let prev: AudioNode = gainNode;
    for (const eq of eqNodes) {
      prev.connect(eq);
      prev = eq;
    }
    // Compressor in chain but bypassed by default (connect through it)
    prev.connect(compressorNode);
    compressorNode.connect(analyserNode);
    analyserNode.connect(ctx.destination);

    // Keep-alive oscillator
    const keepAliveGain = ctx.createGain();
    keepAliveGain.gain.value = 0;
    const keepAliveOscillator = ctx.createOscillator();
    keepAliveOscillator.frequency.value = 1;
    keepAliveOscillator.connect(keepAliveGain);
    keepAliveGain.connect(ctx.destination);
    keepAliveOscillator.start();

    const channel: ChannelState = {
      speakerId,
      deviceId,
      audioContext: ctx,
      inputNode,
      gainNode,
      eqNodes,
      compressorNode,
      analyserNode,
      keepAliveOscillator,
      keepAliveGain,
      volume: 1,
      muted: false,
      soloed: false,
      compressorEnabled: false,
      eqSettings,
    };

    this.channels.set(speakerId, channel);

    if (this.keepAliveActive) {
      keepAliveGain.gain.value = 0.001;
    }

    return channel;
  }

  removeChannel(speakerId: string): void {
    const ch = this.channels.get(speakerId);
    if (!ch) return;
    try {
      ch.keepAliveOscillator.stop();
    } catch {}
    ch.audioContext.close().catch(() => {});
    this.channels.delete(speakerId);
  }

  setVolume(speakerId: string, value: number): void {
    const ch = this.channels.get(speakerId);
    if (!ch) return;
    ch.volume = value;
    this.applyGain(ch);
  }

  setMasterVolume(value: number): void {
    this.masterVolume = value;
    for (const ch of this.channels.values()) {
      this.applyGain(ch);
    }
  }

  private applyGain(ch: ChannelState): void {
    const anySoloed = [...this.channels.values()].some(c => c.soloed);
    const shouldMute = ch.muted || (anySoloed && !ch.soloed);
    ch.gainNode.gain.value = shouldMute ? 0 : ch.volume * this.masterVolume;
  }

  setMute(speakerId: string, muted: boolean): void {
    const ch = this.channels.get(speakerId);
    if (!ch) return;
    ch.muted = muted;
    this.applyGain(ch);
  }

  toggleMute(speakerId: string): void {
    const ch = this.channels.get(speakerId);
    if (ch) this.setMute(speakerId, !ch.muted);
  }

  setSolo(speakerId: string, soloed: boolean): void {
    const ch = this.channels.get(speakerId);
    if (!ch) return;
    ch.soloed = soloed;
    for (const c of this.channels.values()) {
      this.applyGain(c);
    }
  }

  toggleSolo(speakerId: string): void {
    const ch = this.channels.get(speakerId);
    if (ch) this.setSolo(speakerId, !ch.soloed);
  }

  setEQ(speakerId: string, bandIndex: number, settings: Partial<EQBandSettings>): void {
    const ch = this.channels.get(speakerId);
    if (!ch || !ch.eqNodes[bandIndex]) return;

    const band = ch.eqSettings[bandIndex];
    const node = ch.eqNodes[bandIndex];

    if (settings.gain !== undefined) {
      band.gain = settings.gain;
      node.gain.value = settings.gain;
    }
    if (settings.frequency !== undefined) {
      band.frequency = settings.frequency;
      node.frequency.value = settings.frequency;
    }
    if (settings.Q !== undefined) {
      band.Q = settings.Q;
      node.Q.value = settings.Q;
    }
  }

  setCompressor(speakerId: string, enabled: boolean): void {
    const ch = this.channels.get(speakerId);
    if (!ch) return;
    ch.compressorEnabled = enabled;
  }

  getAnalyserData(speakerId: string): Uint8Array | null {
    const ch = this.channels.get(speakerId);
    if (!ch) return null;
    const data = new Uint8Array(ch.analyserNode.frequencyBinCount);
    ch.analyserNode.getByteFrequencyData(data);
    return data;
  }

  getLevel(speakerId: string): number {
    const data = this.getAnalyserData(speakerId);
    if (!data) return 0;
    let sum = 0;
    for (let i = 0; i < data.length; i++) sum += data[i];
    return sum / (data.length * 255);
  }

  connectSource(speakerId: string, sourceNode: AudioNode): void {
    const ch = this.channels.get(speakerId);
    if (!ch) return;
    sourceNode.connect(ch.inputNode);
  }

  createSourceFromElement(speakerId: string, element: HTMLMediaElement): MediaElementAudioSourceNode | null {
    const ch = this.channels.get(speakerId);
    if (!ch) return null;
    const source = ch.audioContext.createMediaElementSource(element);
    source.connect(ch.inputNode);
    return source;
  }

  createSourceFromStream(speakerId: string, stream: MediaStream): MediaStreamAudioSourceNode | null {
    const ch = this.channels.get(speakerId);
    if (!ch) return null;
    const source = ch.audioContext.createMediaStreamSource(stream);
    source.connect(ch.inputNode);
    return source;
  }

  createSourceFromBuffer(speakerId: string, buffer: AudioBuffer): AudioBufferSourceNode | null {
    const ch = this.channels.get(speakerId);
    if (!ch) return null;
    const source = ch.audioContext.createBufferSource();
    source.buffer = buffer;
    source.connect(ch.inputNode);
    return source;
  }

  async decodeAudio(speakerId: string, arrayBuffer: ArrayBuffer): Promise<AudioBuffer | null> {
    const ch = this.channels.get(speakerId);
    if (!ch) return null;
    return ch.audioContext.decodeAudioData(arrayBuffer);
  }

  startKeepAlive(): void {
    this.keepAliveActive = true;
    for (const ch of this.channels.values()) {
      ch.keepAliveGain.gain.value = 0.001;
    }
  }

  stopKeepAlive(): void {
    this.keepAliveActive = false;
    for (const ch of this.channels.values()) {
      ch.keepAliveGain.gain.value = 0;
    }
  }

  playTestTone(speakerId: string, frequencyIndex: number = 0): Promise<void> {
    const ch = this.channels.get(speakerId);
    if (!ch) return Promise.resolve();

    const frequencies = [440, 554, 659, 880];
    const freq = frequencies[frequencyIndex % frequencies.length];
    const duration = 1;
    const ctx = ch.audioContext;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.value = freq;

    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.3, ctx.currentTime + 0.05);
    gain.gain.setValueAtTime(0.3, ctx.currentTime + duration - 0.1);
    gain.gain.linearRampToValueAtTime(0, ctx.currentTime + duration);

    osc.connect(gain);
    gain.connect(ch.inputNode);
    osc.start();
    osc.stop(ctx.currentTime + duration);

    return new Promise(resolve => {
      setTimeout(() => {
        osc.disconnect();
        gain.disconnect();
        resolve();
      }, duration * 1000 + 100);
    });
  }

  getChannelCurrentTime(speakerId: string): number {
    const ch = this.channels.get(speakerId);
    return ch ? ch.audioContext.currentTime : 0;
  }

  dispose(): void {
    this.stopKeepAlive();
    for (const [id] of this.channels) {
      this.removeChannel(id);
    }
  }
}
