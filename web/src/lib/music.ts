/**
 * CUBIworld — 6 synthesized level tracks via Web Audio API.
 * Each level has a distinct BPM, scale, melody and vibe.
 * Music stays fixed for the whole round.
 */

const C_PENTA  = [261.63, 293.66, 329.63, 392.0,  440.0,  523.25, 587.33, 659.25];
const A_MINOR  = [220.0,  261.63, 293.66, 329.63, 392.0,  440.0,  523.25, 587.33];
const D_DORIAN = [293.66, 329.63, 349.23, 392.0,  440.0,  493.88, 523.25, 587.33];
const EB_MAJOR = [311.13, 349.23, 392.0,  415.30, 466.16, 523.25, 587.33, 622.25];
const F_LYDIAN = [349.23, 392.0,  440.0,  493.88, 523.25, 587.33, 659.25, 698.46];
const G_PENTA  = [196.0,  220.0,  246.94, 293.66, 329.63, 392.0,  440.0,  493.88];

export interface TrackInfo {
  name: string;
  emoji: string;
  description: string;
  bgTop: string;
  bgBottom: string;
  groundColor: string;
}

interface TrackDef extends TrackInfo {
  bpm: number;
  scale: number[];
  chordRoots: number[];
  melodyPattern: number[];
  chordPattern: number[];
  bassPattern: number[];
  waveType: OscillatorType;
  padWave: OscillatorType;
  masterVol: number;
}

export const LEVEL_TRACKS: TrackDef[] = [
  {
    name: "Cozy Spring", emoji: "🌸", description: "Warm & gentle",
    bgTop: "#ffe4f0", bgBottom: "#fff9e6", groundColor: "#c8f5c8",
    bpm: 88, scale: C_PENTA,
    chordRoots: [261.63, 349.23, 392.0, 220.0],
    melodyPattern: [4,-1,3,2,4,-1,5,-1, 3,-1,2,1,3,-1,2,-1, 4,5,4,3,2,-1,4,-1, 5,-1,4,3,4,2,3,-1],
    chordPattern: [0,0,1,2,0,3,1,2],
    bassPattern: [0,-1,0,-1,2,-1,2,-1],
    waveType: "sine", padWave: "triangle", masterVol: 0.38,
  },
  {
    name: "Summer Breeze", emoji: "☀️", description: "Bright & bouncy",
    bgTop: "#fff3b0", bgBottom: "#ffe0a0", groundColor: "#a8e6cf",
    bpm: 104, scale: EB_MAJOR,
    chordRoots: [311.13, 392.0, 349.23, 466.16],
    melodyPattern: [5,-1,4,5,6,-1,5,4, 3,-1,4,3,2,-1,3,-1, 5,6,5,4,3,4,5,-1, 6,-1,5,4,5,3,4,-1],
    chordPattern: [0,1,2,1,0,3,2,1],
    bassPattern: [0,-1,2,-1,0,-1,3,-1],
    waveType: "square", padWave: "sine", masterVol: 0.30,
  },
  {
    name: "Midnight Jazz", emoji: "🌙", description: "Cool & smooth",
    bgTop: "#1a1a3e", bgBottom: "#2d1b4e", groundColor: "#4a3060",
    bpm: 76, scale: D_DORIAN,
    chordRoots: [293.66, 261.63, 349.23, 392.0],
    melodyPattern: [3,-1,-1,2,4,-1,3,-1, 2,1,-1,2,3,-1,1,-1, 4,-1,3,2,4,5,-1,4, 3,-1,2,1,2,-1,3,-1],
    chordPattern: [0,0,1,2,3,0,1,2],
    bassPattern: [0,-1,-1,0,2,-1,-1,2],
    waveType: "triangle", padWave: "sine", masterVol: 0.35,
  },
  {
    name: "Forest Walk", emoji: "🌿", description: "Earthy & calm",
    bgTop: "#d4edda", bgBottom: "#c3e6cb", groundColor: "#6dbf67",
    bpm: 80, scale: G_PENTA,
    chordRoots: [196.0, 246.94, 293.66, 220.0],
    melodyPattern: [2,-1,3,2,4,-1,3,-1, 5,-1,4,3,2,-1,3,-1, 4,3,2,1,2,-1,3,-1, 4,-1,5,4,3,2,1,-1],
    chordPattern: [0,1,2,3,0,2,1,3],
    bassPattern: [0,-1,0,-1,1,-1,1,-1],
    waveType: "sine", padWave: "triangle", masterVol: 0.36,
  },
  {
    name: "Neon City", emoji: "🏙️", description: "Electric & fast",
    bgTop: "#0d0d2b", bgBottom: "#1a0533", groundColor: "#2d0b4e",
    bpm: 118, scale: A_MINOR,
    chordRoots: [220.0, 261.63, 293.66, 349.23],
    melodyPattern: [5,4,-1,5,6,-1,5,4, 3,-1,4,5,4,3,-1,2, 5,-1,6,5,4,-1,5,-1, 6,5,4,3,4,5,6,-1],
    chordPattern: [0,1,2,3,0,0,1,2],
    bassPattern: [0,-1,0,0,2,-1,2,2],
    waveType: "sawtooth", padWave: "square", masterVol: 0.28,
  },
  {
    name: "Sky Kingdom", emoji: "☁️", description: "Dreamy & epic",
    bgTop: "#b3d9ff", bgBottom: "#e8f4ff", groundColor: "#fff9c4",
    bpm: 92, scale: F_LYDIAN,
    chordRoots: [349.23, 440.0, 392.0, 523.25],
    melodyPattern: [4,-1,5,4,6,-1,5,-1, 4,3,-1,4,5,-1,4,-1, 6,-1,5,4,5,6,7,-1, 6,-1,5,4,3,4,5,-1],
    chordPattern: [0,1,2,3,0,1,2,0],
    bassPattern: [0,-1,0,-1,2,-1,3,-1],
    waveType: "sine", padWave: "triangle", masterVol: 0.36,
  },
];

function pick<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)] as T; }

export class LevelMusic {
  private ac: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private running = false;
  private timer: ReturnType<typeof setInterval> | null = null;
  private beatIdx = 0;
  private nextBeatTime = 0;
  private chordIdx = 0;
  private barBeat = 0;
  private track: TrackDef;

  constructor(levelIndex: number) {
    this.track = LEVEL_TRACKS[levelIndex % LEVEL_TRACKS.length] ?? LEVEL_TRACKS[0]!;
  }

  private get ctx(): AudioContext {
    if (!this.ac) this.ac = new AudioContext();
    return this.ac;
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.beatIdx = 0;
    this.chordIdx = 0;
    this.barBeat = 0;
    if (this.ctx.state === "suspended") this.ctx.resume();
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = this.track.masterVol;
    this.masterGain.connect(this.ctx.destination);
    this.nextBeatTime = this.ctx.currentTime + 0.05;
    this.timer = setInterval(() => this.schedule(), 50);
  }

  stop() {
    this.running = false;
    if (this.timer) { clearInterval(this.timer); this.timer = null; }
    if (this.masterGain) {
      try { this.masterGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.1); } catch { /* ignore */ }
    }
    setTimeout(() => {
      try { this.ac?.close(); } catch { /* ignore */ }
      this.ac = null;
      this.masterGain = null;
    }, 400);
  }

  private schedule() {
    if (!this.running || !this.masterGain) return;
    const t = this.track;
    const beat = 60 / t.bpm;
    const lookAhead = 0.15;

    while (this.nextBeatTime < this.ctx.currentTime + lookAhead) {
      const now = this.nextBeatTime;

      // Melody
      const mIdx = this.beatIdx % t.melodyPattern.length;
      const mNote = t.melodyPattern[mIdx] ?? -1;
      if (mNote >= 0) {
        const freq = t.scale[mNote] ?? t.scale[0]!;
        this.playNote(freq, now, beat * 0.45, 0.22, t.waveType);
      }

      // Bass (every 2 beats)
      if (this.beatIdx % 2 === 0) {
        const bIdx = (this.beatIdx / 2) % t.bassPattern.length;
        const bNote = t.bassPattern[bIdx] ?? -1;
        if (bNote >= 0) {
          const freq = (t.scale[bNote] ?? t.scale[0]!) * 0.5;
          this.playNote(freq, now, beat * 1.8, 0.18, t.waveType);
        }
      }

      // Chord (every bar = 4 beats)
      if (this.barBeat === 0) {
        const cIdx = this.chordIdx % t.chordPattern.length;
        const root = t.chordRoots[t.chordPattern[cIdx] ?? 0] ?? t.chordRoots[0]!;
        [1, 1.25, 1.5].forEach(ratio => {
          this.playPad(root * ratio, now, beat * 3.8, 0.08, t.padWave);
        });
        this.chordIdx++;
      }

      // Hi-hat shimmer
      if (this.beatIdx % 2 === 1) {
        this.playHihat(now, beat * 0.12);
      }

      this.barBeat = (this.barBeat + 1) % 4;
      this.beatIdx++;
      this.nextBeatTime += beat;
    }
  }

  private playNote(freq: number, t: number, dur: number, vol: number, wave: OscillatorType) {
    if (!this.masterGain) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = wave;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(vol, t + 0.01);
    gain.gain.setTargetAtTime(0, t + dur * 0.6, dur * 0.15);
    osc.connect(gain); gain.connect(this.masterGain);
    osc.start(t); osc.stop(t + dur + 0.1);
  }

  private playPad(freq: number, t: number, dur: number, vol: number, wave: OscillatorType) {
    if (!this.masterGain) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = wave;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(vol, t + 0.08);
    gain.gain.setTargetAtTime(0, t + dur * 0.7, dur * 0.2);
    osc.connect(gain); gain.connect(this.masterGain);
    osc.start(t); osc.stop(t + dur + 0.2);
  }

  private playHihat(t: number, dur: number) {
    if (!this.masterGain) return;
    const buf = this.ctx.createBuffer(1, Math.floor(this.ctx.sampleRate * dur), this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * 0.15;
    const src = this.ctx.createBufferSource();
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();
    filter.type = "highpass"; filter.frequency.value = 8000;
    src.buffer = buf;
    gain.gain.setValueAtTime(0.06, t);
    gain.gain.setTargetAtTime(0, t + dur * 0.3, dur * 0.1);
    src.connect(filter); filter.connect(gain); gain.connect(this.masterGain);
    src.start(t);
  }

  static getTrackInfo(levelIndex: number): TrackInfo {
    return LEVEL_TRACKS[levelIndex % LEVEL_TRACKS.length] ?? LEVEL_TRACKS[0]!;
  }

  static pickRandom(arr: number[]): number {
    return pick(arr);
  }
}
