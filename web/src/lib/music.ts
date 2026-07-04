/**
 * Cozy warm background music — fully synthesized via Web Audio API.
 * Gentle pentatonic melody + soft pad chords + warm bass pulse.
 * Call start() to begin, stop() to end. Loops forever.
 */

// C major pentatonic: C D E G A  (and octave up)
const PENTA = [261.63, 293.66, 329.63, 392.0, 440.0, 523.25, 587.33, 659.25, 783.99];

// Warm chord roots (C, F, G, Am in Hz for root note)
const CHORD_ROOTS = [261.63, 349.23, 392.0, 220.0];
// Each chord: root, major 3rd, perfect 5th ratios
const CHORD_RATIOS = [1, 1.25, 1.5];

const BPM = 88;
const BEAT = 60 / BPM;       // seconds per beat
const BAR  = BEAT * 4;       // 4/4 time

export class CozyMusic {
  private ac: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private running = false;
  private scheduleAhead = 0.15; // seconds
  private schedulerTimer: ReturnType<typeof setInterval> | null = null;

  // Sequencer state
  private beatIdx = 0;
  private nextBeatTime = 0;

  // Melody pattern (indices into PENTA, -1 = rest)
  private melodyPattern = [
    4, -1, 3, 2, 4, -1, 5, -1,
    3, -1, 2, 1, 3, -1, 2, -1,
    4, 5, 4, 3, 2, -1, 4, -1,
    5, -1, 4, 3, 4, 2, 3, -1,
  ];

  // Chord pattern (index into CHORD_ROOTS, one per bar)
  private chordPattern = [0, 0, 1, 2, 0, 3, 1, 2];
  private chordIdx = 0;
  private barBeat = 0;

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
    this.nextBeatTime = this.ctx.currentTime + 0.05;

    // Master gain (soft overall volume)
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.setValueAtTime(0, this.ctx.currentTime);
    this.masterGain.gain.linearRampToValueAtTime(0.55, this.ctx.currentTime + 1.5);
    this.masterGain.connect(this.ctx.destination);

    this.schedulerTimer = setInterval(() => this.schedule(), 50);
  }

  stop() {
    if (!this.running) return;
    this.running = false;
    if (this.schedulerTimer !== null) { clearInterval(this.schedulerTimer); this.schedulerTimer = null; }
    if (this.masterGain) {
      const now = this.ctx.currentTime;
      this.masterGain.gain.cancelScheduledValues(now);
      this.masterGain.gain.setValueAtTime(this.masterGain.gain.value, now);
      this.masterGain.gain.linearRampToValueAtTime(0, now + 0.8);
    }
  }

  setVolume(v: number) {
    if (!this.masterGain) return;
    const now = this.ctx.currentTime;
    this.masterGain.gain.cancelScheduledValues(now);
    this.masterGain.gain.setValueAtTime(this.masterGain.gain.value, now);
    this.masterGain.gain.linearRampToValueAtTime(v * 0.55, now + 0.3);
  }

  private schedule() {
    if (!this.running || !this.masterGain) return;
    const ac = this.ctx;
    const lookahead = ac.currentTime + this.scheduleAhead;

    while (this.nextBeatTime < lookahead) {
      this.scheduleBeat(this.nextBeatTime);
      this.nextBeatTime += BEAT * 0.5; // schedule every half-beat
    }
  }

  private scheduleBeat(time: number) {
    const ac = this.ctx;
    const master = this.masterGain!;
    const halfBeat = this.beatIdx % 2 === 0; // every half-beat, melody on even

    // ── Melody (every half-beat) ──
    const mIdx = this.melodyPattern[Math.floor(this.beatIdx / 2) % this.melodyPattern.length];
    if (halfBeat && mIdx !== undefined && mIdx >= 0) {
      const freq = PENTA[mIdx];
      if (freq !== undefined) {
        this.playNote(ac, master, freq, time, BEAT * 0.38, 0.18, "sine");
        // Soft harmony a 5th above
        this.playNote(ac, master, freq * 1.5, time, BEAT * 0.28, 0.06, "sine");
      }
    }

    // ── Chord pad (every bar = 8 half-beats) ──
    if (this.beatIdx % 8 === 0) {
      const rootHz = CHORD_ROOTS[this.chordPattern[this.chordIdx % this.chordPattern.length] ?? 0];
      if (rootHz !== undefined) {
        for (const ratio of CHORD_RATIOS) {
          this.playPad(ac, master, rootHz * ratio, time, BAR * 0.92, 0.07);
          this.playPad(ac, master, rootHz * ratio * 0.5, time, BAR * 0.92, 0.05); // sub octave warmth
        }
      }
      this.chordIdx++;
      this.barBeat = 0;
    }
    this.barBeat++;

    // ── Bass pulse (every beat = every 2 half-beats) ──
    if (this.beatIdx % 2 === 0) {
      const rootHz = CHORD_ROOTS[this.chordPattern[this.chordIdx % this.chordPattern.length] ?? 0];
      if (rootHz !== undefined) {
        const bassFreq = rootHz * 0.5; // one octave below chord root
        this.playBass(ac, master, bassFreq, time, BEAT * 0.22, 0.14);
      }
    }

    // ── Soft hi-hat shimmer (every half-beat, quieter on offbeats) ──
    const hatVol = this.beatIdx % 2 === 0 ? 0.025 : 0.012;
    this.playHat(ac, master, time, 0.04, hatVol);

    // ── Kick on beats 1 and 3 ──
    if (this.beatIdx % 4 === 0 || this.beatIdx % 4 === 4) {
      this.playKick(ac, master, time, 0.12);
    }

    this.beatIdx++;
    if (this.beatIdx >= this.melodyPattern.length * 2) this.beatIdx = 0;
  }

  // Soft sine/triangle note with gentle attack/release
  private playNote(
    ac: AudioContext, dest: AudioNode,
    freq: number, time: number, dur: number, gain: number,
    type: OscillatorType,
  ) {
    const osc = ac.createOscillator();
    const g   = ac.createGain();
    // Warm low-pass filter
    const filt = ac.createBiquadFilter();
    filt.type = "lowpass"; filt.frequency.value = 1800; filt.Q.value = 0.5;

    osc.type = type; osc.frequency.value = freq;
    // Slight detune for warmth
    osc.detune.value = rnd(-4, 4);

    g.gain.setValueAtTime(0, time);
    g.gain.linearRampToValueAtTime(gain, time + 0.04);
    g.gain.setValueAtTime(gain, time + dur * 0.6);
    g.gain.exponentialRampToValueAtTime(0.001, time + dur);

    osc.connect(filt); filt.connect(g); g.connect(dest);
    osc.start(time); osc.stop(time + dur + 0.05);
  }

  // Warm pad — triangle wave with slow attack
  private playPad(
    ac: AudioContext, dest: AudioNode,
    freq: number, time: number, dur: number, gain: number,
  ) {
    const osc  = ac.createOscillator();
    const g    = ac.createGain();
    const filt = ac.createBiquadFilter();
    filt.type = "lowpass"; filt.frequency.value = 900; filt.Q.value = 0.3;

    osc.type = "triangle"; osc.frequency.value = freq;
    osc.detune.value = rnd(-6, 6);

    g.gain.setValueAtTime(0, time);
    g.gain.linearRampToValueAtTime(gain, time + 0.18);
    g.gain.setValueAtTime(gain, time + dur * 0.7);
    g.gain.exponentialRampToValueAtTime(0.001, time + dur);

    osc.connect(filt); filt.connect(g); g.connect(dest);
    osc.start(time); osc.stop(time + dur + 0.05);
  }

  // Deep warm bass
  private playBass(
    ac: AudioContext, dest: AudioNode,
    freq: number, time: number, dur: number, gain: number,
  ) {
    const osc  = ac.createOscillator();
    const g    = ac.createGain();
    const filt = ac.createBiquadFilter();
    filt.type = "lowpass"; filt.frequency.value = 320; filt.Q.value = 0.8;

    osc.type = "sine"; osc.frequency.value = freq;

    g.gain.setValueAtTime(0, time);
    g.gain.linearRampToValueAtTime(gain, time + 0.02);
    g.gain.exponentialRampToValueAtTime(0.001, time + dur);

    osc.connect(filt); filt.connect(g); g.connect(dest);
    osc.start(time); osc.stop(time + dur + 0.05);
  }

  // Soft hi-hat (filtered white noise)
  private playHat(
    ac: AudioContext, dest: AudioNode,
    time: number, dur: number, gain: number,
  ) {
    const buf  = ac.createBuffer(1, ac.sampleRate * dur, ac.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;

    const src  = ac.createBufferSource();
    const filt = ac.createBiquadFilter();
    const g    = ac.createGain();
    filt.type = "highpass"; filt.frequency.value = 7000;

    src.buffer = buf;
    g.gain.setValueAtTime(gain, time);
    g.gain.exponentialRampToValueAtTime(0.001, time + dur);

    src.connect(filt); filt.connect(g); g.connect(dest);
    src.start(time); src.stop(time + dur + 0.01);
  }

  // Soft kick (sine sweep down)
  private playKick(
    ac: AudioContext, dest: AudioNode,
    time: number, dur: number,
  ) {
    const osc = ac.createOscillator();
    const g   = ac.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(110, time);
    osc.frequency.exponentialRampToValueAtTime(45, time + dur);

    g.gain.setValueAtTime(0.12, time);
    g.gain.exponentialRampToValueAtTime(0.001, time + dur);

    osc.connect(g); g.connect(dest);
    osc.start(time); osc.stop(time + dur + 0.01);
  }
}

function rnd(a: number, b: number) { return a + Math.random() * (b - a); }
