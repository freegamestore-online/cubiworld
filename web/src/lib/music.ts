/**
 * CUBIworld — 6 synthesized level tracks via Web Audio API.
 * Each level has its own BPM, scale, melody, and vibe.
 * Music is fixed for the whole round.
 */

const C_PENTA  = [261.63, 293.66, 329.63, 392.0,  440.0,  523.25, 587.33, 659.25];
const A_MINOR  = [220.0,  261.63, 293.66, 329.63, 392.0,  440.0,  523.25, 587.33];
const D_DORIAN = [293.66, 329.63, 349.23, 392.0,  440.0,  493.88, 523.25, 587.33];
const EB_MAJOR = [311.13, 349.23, 392.0,  415.30, 466.16, 523.25, 587.33, 622.25];
const F_LYDIAN = [349.23, 392.0,  440.0,  493.88, 523.25, 587.33, 659.25, 698.46];
const G_PENTA  = [196.0,  220.0,  246.94, 293.66, 329.63, 392.0,  440.0,  493.88];

interface TrackDef {
  name: string;
  emoji: string;
  description: string;
  bpm: number;
  scale: number[];
  chordRoots: number[];
  melodyPattern: number[];
  chordPattern: number[];
  bassPattern: number[];
  waveType: OscillatorType;
  padWave: OscillatorType;
  masterVol: number;
  bgTop: string;
  bgBottom: string;
  groundColor: string;
}

export const LEVEL_TRACKS: TrackDef[] = [
  {
    name: "Cozy Spring",
    emoji: "🌸",
    description: "Warm & gentle — perfect for beginners",
    bpm: 88,
    scale: C_PENTA,
    chordRoots: [261.63, 349.23, 392.0, 220.0],
    melodyPattern: [4,-1,3,2,4,-1,5,-1, 3,-1,2,1,3,-1,2,-1, 4,5,4,3,2,-1,4,-1, 5,-1,4,3,4,2,3,-1],
    chordPattern: [0,0,1,2,0,3,1,2],
    bassPattern: [0,0,2,0,1,0,2,0],
    waveType: "sine",
    padWave: "triangle",
    masterVol: 0.38,
    bgTop: "#ffd6f0",
    bgBottom: "#ffe8f8",
    groundColor: "#c8f5c8",
  },
  {
    name: "Neon Dash",
    emoji: "⚡",
    description: "Energetic & punchy — pick up the pace",
    bpm: 112,
    scale: A_MINOR,
    chordRoots: [220.0, 261.63, 293.66, 246.94],
    melodyPattern: [5,5,-1,4,3,-1,5,4, 3,3,-1,2,1,-1,3,2, 5,6,5,4,3,2,-1,5, 4,-1,3,2,3,1,2,-1],
    chordPattern: [0,1,2,3,0,1,3,2],
    bassPattern: [0,2,0,2,1,2,0,1],
    waveType: "square",
    padWave: "sawtooth",
    masterVol: 0.28,
    bgTop: "#1a0a2e",
    bgBottom: "#2d1b4e",
    groundColor: "#3d2b5e",
  },
  {
    name: "Ocean Breeze",
    emoji: "🌊",
    description: "Flowing & smooth — find your rhythm",
    bpm: 96,
    scale: D_DORIAN,
    chordRoots: [293.66, 349.23, 392.0, 329.63],
    melodyPattern: [3,-1,4,5,4,-1,3,-1, 2,3,2,1,-1,2,3,-1, 4,5,6,5,4,3,-1,4, 3,-1,2,1,2,-1,3,-1],
    chordPattern: [0,1,2,1,0,3,1,0],
    bassPattern: [0,0,1,0,2,0,1,0],
    waveType: "sine",
    padWave: "triangle",
    masterVol: 0.36,
    bgTop: "#0a2a4a",
    bgBottom: "#1a4a6a",
    groundColor: "#1a6a5a",
  },
  {
    name: "Candy Rush",
    emoji: "🍬",
    description: "Sweet & bouncy — things get spicy",
    bpm: 120,
    scale: EB_MAJOR,
    chordRoots: [311.13, 392.0, 349.23, 415.30],
    melodyPattern: [4,5,4,-1,3,4,5,-1, 6,5,4,3,-1,4,5,-1, 4,3,2,-1,3,4,3,-1, 5,6,5,4,3,2,3,-1],
    chordPattern: [0,1,2,3,0,2,1,3],
    bassPattern: [0,1,0,2,1,0,2,1],
    waveType: "triangle",
    padWave: "sine",
    masterVol: 0.34,
    bgTop: "#3a0a2a",
    bgBottom: "#5a1a4a",
    groundColor: "#7a2a5a",
  },
  {
    name: "Sky Temple",
    emoji: "🏛️",
    description: "Epic & majestic — almost there",
    bpm: 104,
    scale: F_LYDIAN,
    chordRoots: [349.23, 440.0, 392.0, 523.25],
    melodyPattern: [3,4,5,-1,6,5,4,-1, 3,4,5,6,7,-1,5,-1, 4,5,6,5,4,3,-1,4, 5,6,7,6,5,4,5,-1],
    chordPattern: [0,1,2,3,1,0,2,3],
    bassPattern: [0,0,2,0,1,2,0,1],
    waveType: "sine",
    padWave: "triangle",
    masterVol: 0.36,
    bgTop: "#0a1a3a",
    bgBottom: "#1a2a5a",
    groundColor: "#2a4a7a",
  },
  {
    name: "Final Blaze",
    emoji: "🔥",
    description: "Intense & relentless — the ultimate challenge",
    bpm: 136,
    scale: G_PENTA,
    chordRoots: [196.0, 220.0, 246.94, 293.66],
    melodyPattern: [5,6,5,-1,4,5,6,-1, 7,6,5,4,-1,5,6,-1, 5,4,3,-1,4,5,4,-1, 6,7,6,5,4,3,4,-1],
    chordPattern: [0,1,2,3,2,1,0,3],
    bassPattern: [0,2,1,2,0,1,2,0],
    waveType: "sawtooth",
    padWave: "square",
    masterVol: 0.26,
    bgTop: "#1a0800",
    bgBottom: "#2a1000",
    groundColor: "#3a1800",
  },
];

export class LevelMusic {
  private ac: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private running = false;
  private schedulerTimer: ReturnType<typeof setInterval> | null = null;
  private beatIdx = 0;
  private nextBeatTime = 0;
  private chordIdx = 0;
  private barBeat = 0;
  private readonly track: TrackDef;
  private readonly beat: number;
  private readonly bar: number;

  constructor(trackIndex: number) {
    this.track = LEVEL_TRACKS[trackIndex % LEVEL_TRACKS.length] ?? LEVEL_TRACKS[0]!;
    this.beat = 60 / this.track.bpm;
    this.bar  = this.beat * 4;
  }

  private get ctx(): AudioContext {
    if (!this.ac) this.ac = new AudioContext();
    return this.ac;
  }

  start() {
    if (this.running) return;
    this.running = true;
    if (this.ac?.state === "suspended") this.ac.resume();
    this.nextBeatTime = this.ctx.currentTime + 0.05;
    this.beatIdx = 0; this.chordIdx = 0; this.barBeat = 0;
    this.schedulerTimer = setInterval(() => this.schedule(), 60);
  }

  stop() {
    this.running = false;
    if (this.schedulerTimer !== null) {
      clearInterval(this.schedulerTimer);
      this.schedulerTimer = null;
    }
    try { this.masterGain?.gain.setTargetAtTime(0, this.ctx.currentTime, 0.1); }
    catch { /* ignore */ }
    setTimeout(() => {
      try { this.ac?.close(); } catch { /* ignore */ }
      this.ac = null;
      this.masterGain = null;
    }, 400);
  }

  private getMaster(): GainNode {
    if (!this.masterGain) {
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = this.track.masterVol;
      this.masterGain.connect(this.ctx.destination);
    }
    return this.masterGain;
  }

  private schedule() {
    if (!this.running) return;
    const ahead = 0.15;
    while (this.nextBeatTime < this.ctx.currentTime + ahead) {
      this.scheduleBeat(this.nextBeatTime);
      this.nextBeatTime += this.beat;
      this.beatIdx = (this.beatIdx + 1) % this.track.melodyPattern.length;
      this.barBeat++;
      if (this.barBeat >= 4) {
        this.barBeat = 0;
        this.chordIdx = (this.chordIdx + 1) % this.track.chordPattern.length;
      }
    }
  }

  private scheduleBeat(t: number) {
    const { scale, chordRoots, melodyPattern, chordPattern, bassPattern,
            waveType, padWave } = this.track;
    const master = this.getMaster();

    // Melody note
    const mi = melodyPattern[this.beatIdx % melodyPattern.length] ?? -1;
    if (mi >= 0) {
      const freq = scale[mi % scale.length] ?? 440;
      this.playTone(freq, t, this.beat * 0.45, waveType, 0.22, master);
    }

    // Chord pad (once per bar on beat 0)
    if (this.barBeat === 0) {
      const ci = chordPattern[this.chordIdx % chordPattern.length] ?? 0;
      const root = chordRoots[ci % chordRoots.length] ?? 261.63;
      for (const ratio of [1, 1.25, 1.5]) {
        this.playTone(root * ratio, t, this.bar * 0.85, padWave, 0.09, master);
      }
    }

    // Bass (every beat)
    const bi = bassPattern[this.beatIdx % bassPattern.length] ?? 0;
    const bassFreq = (scale[bi % scale.length] ?? 261.63) * 0.5;
    this.playTone(bassFreq, t, this.beat * 0.6, "triangle", 0.18, master);
  }

  private playTone(
    freq: number, t: number, dur: number,
    wave: OscillatorType, vol: number, dest: GainNode,
  ) {
    try {
      const osc = this.ctx.createOscillator();
      const g   = this.ctx.createGain();
      osc.type = wave;
      osc.frequency.value = freq;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(vol, t + 0.02);
      g.gain.setTargetAtTime(0, t + dur * 0.7, dur * 0.15);
      osc.connect(g); g.connect(dest);
      osc.start(t); osc.stop(t + dur + 0.1);
    } catch { /* ignore */ }
  }
}
