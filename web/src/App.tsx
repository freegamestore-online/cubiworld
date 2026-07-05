import { useRef, useState, useCallback, useEffect } from "react";
import { GameShell, GameTopbar } from "@freegamestore/games";
import { useGameLoop } from "./hooks/useGameLoop";
import { drawCuteBlock } from "./lib/drawBlock";
import { drawText } from "./lib/canvas";
import { LevelMusic, LEVEL_TRACKS } from "./lib/music";
import BlockEditor from "./components/BlockEditor";
import type { BlockSkin, FloorSpike, GameState, Obstacle, PlatformTile, RoundRecord } from "./types";
import { DEFAULT_SKIN, TOTAL_LEVELS, FINISH_LINE_DISTANCE } from "./types";

// ─── Constants ────────────────────────────────────────────────────────────────
const GROUND_Y_RATIO = 0.78;
const BS = 48;
const GRAVITY = 2000;
const JUMP_VEL = -740;
const PLAYER_X = 80;
const PLATFORM_H = 16;

const LEVEL_SPEEDS = [240, 285, 335, 385, 445, 510];
const LEVEL_GAPS: [number, number][] = [
  [1.4, 2.4], [1.2, 2.1], [1.0, 1.85], [0.85, 1.65], [0.7, 1.45], [0.58, 1.25],
];

const CUTE_COLORS  = ["#ffb3d9","#b3d9ff","#b3ffda","#ffe0b3","#e0b3ff","#fffdb3"];
const STEP_COLORS  = ["#b3d9ff","#b3ffda","#ffe0b3","#e0b3ff","#c8f5c8","#ffd6ff"];
const SPIKE_COLORS = ["#ff7eb3","#ff6baa","#ff9ec4","#ff5599","#ffaacc"];
const PLAT_COLORS  = ["#9ec4ff","#a8e6cf","#ffd3e0","#d4a5f5","#ffe066","#b5ead7"];

function rnd(a: number, b: number) { return a + Math.random() * (b - a); }
function pick<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)] as T; }

function lighten(hex: string, amt: number): string {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.min(255, (n >> 16) + Math.round(amt * 255));
  const g = Math.min(255, ((n >> 8) & 0xff) + Math.round(amt * 255));
  const b = Math.min(255, (n & 0xff) + Math.round(amt * 255));
  return `rgb(${r},${g},${b})`;
}

// ─── localStorage helpers ─────────────────────────────────────────────────────
function loadSkin(): BlockSkin {
  try { const r = localStorage.getItem("cubiworld_skin"); if (r) return JSON.parse(r) as BlockSkin; }
  catch { /* ignore */ }
  return { ...DEFAULT_SKIN };
}
function saveSkin(s: BlockSkin) { localStorage.setItem("cubiworld_skin", JSON.stringify(s)); }

function loadUnlocked(): number {
  return parseInt(localStorage.getItem("cubiworld_unlocked") ?? "1", 10) || 1;
}
function saveUnlocked(n: number) { localStorage.setItem("cubiworld_unlocked", String(n)); }

function loadBestScore(level: number): number {
  return parseInt(localStorage.getItem(`cubiworld_best_${level}`) ?? "0", 10) || 0;
}
function saveBestScore(level: number, score: number) {
  const prev = loadBestScore(level);
  if (score > prev) localStorage.setItem(`cubiworld_best_${level}`, String(score));
}

function loadHistory(): RoundRecord[] {
  try { const r = localStorage.getItem("cubiworld_history"); if (r) return JSON.parse(r) as RoundRecord[]; }
  catch { /* ignore */ }
  return [];
}
function saveHistory(rec: RoundRecord) {
  const h = loadHistory();
  h.unshift(rec);
  localStorage.setItem("cubiworld_history", JSON.stringify(h.slice(0, 20)));
}

// ─── Obstacle factories ───────────────────────────────────────────────────────
function makeSpikeGroup(startX: number, groundY: number): Obstacle {
  const count = Math.floor(rnd(1, 4));
  const sw = 36;
  const sh = 44;
  const color = pick(SPIKE_COLORS);
  return {
    x: startX, y: groundY - sh,
    width: sw * count, height: sh,
    type: count === 1 ? "spike" : "spike_group",
    color, spikeCount: count,
  };
}

function makePlatform(startX: number, groundY: number): Obstacle {
  const pw = Math.floor(rnd(100, 170));
  const ph = PLATFORM_H;
  const py = groundY - Math.floor(rnd(90, 160));
  const color = pick(PLAT_COLORS);

  const platforms: PlatformTile[] = [{ x: startX, y: py, width: pw, height: ph }];

  // Floor spikes under the platform gap area
  const floorSpikes: FloorSpike[] = [];
  const sh = 38; const sw = 34;
  const numSpikes = Math.floor(pw / (sw + 6));
  for (let i = 0; i < numSpikes; i++) {
    floorSpikes.push({
      x: startX + i * (sw + 6) + 4,
      y: groundY - sh,
      width: sw, height: sh,
      color: pick(SPIKE_COLORS),
    });
  }

  return {
    x: startX, y: py,
    width: pw, height: groundY - py,
    type: "platform", color,
    platforms, floorSpikes,
  };
}

function makeStaircase(startX: number, groundY: number): Obstacle {
  const numSteps = Math.floor(rnd(3, 6));
  // Each step is WIDE so the player can easily land — 88px
  const stepW = 88;
  // Gap between steps — enough to require a jump but not impossible
  const stepGap = 52;
  const stepRise = 38;
  const color = pick(STEP_COLORS);

  const platforms: PlatformTile[] = [];
  const floorSpikes: FloorSpike[] = [];

  let cx = startX;
  for (let i = 0; i < numSteps; i++) {
    const stepY = groundY - PLATFORM_H - i * stepRise;
    platforms.push({ x: cx, y: stepY, width: stepW, height: PLATFORM_H });

    // Spikes sitting ON THE FLOOR directly below this step
    const sh = 38; const sw = 30;
    const numSp = Math.floor(stepW / (sw + 4));
    for (let j = 0; j < numSp; j++) {
      floorSpikes.push({
        x: cx + j * (sw + 4) + 2,
        y: groundY - sh,
        width: sw, height: sh,
        color: pick(SPIKE_COLORS),
      });
    }

    cx += stepW + stepGap;
  }

  const totalW = cx - startX;
  return {
    x: startX, y: groundY - PLATFORM_H - (numSteps - 1) * stepRise,
    width: totalW, height: groundY - (groundY - PLATFORM_H - (numSteps - 1) * stepRise),
    type: "staircase", color,
    platforms, floorSpikes,
  };
}

// ─── Draw helpers ─────────────────────────────────────────────────────────────
function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number,
  r: number, fill: string,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
}

function drawSpikeUp(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, color: string,
) {
  ctx.save();
  // Shadow
  ctx.globalAlpha = 0.15; ctx.fillStyle = "#000";
  ctx.beginPath();
  ctx.moveTo(x + w / 2 + 3, y + 3);
  ctx.lineTo(x + w + 3, y + h + 3);
  ctx.lineTo(x + 3, y + h + 3);
  ctx.closePath(); ctx.fill();
  ctx.globalAlpha = 1;

  const grad = ctx.createLinearGradient(x, y, x + w, y + h);
  grad.addColorStop(0, lighten(color, 0.25));
  grad.addColorStop(1, color);
  ctx.fillStyle = grad;
  ctx.shadowColor = color; ctx.shadowBlur = 7;
  ctx.beginPath();
  ctx.moveTo(x + w / 2, y);
  ctx.lineTo(x + w, y + h);
  ctx.lineTo(x, y + h);
  ctx.closePath(); ctx.fill();
  ctx.shadowBlur = 0;

  ctx.strokeStyle = "rgba(255,255,255,0.4)"; ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(x + w / 2, y + 4);
  ctx.lineTo(x + w * 0.72, y + h - 3);
  ctx.stroke();
  ctx.restore();
}

function drawObstacle(ctx: CanvasRenderingContext2D, obs: Obstacle, groundY: number) {
  if (obs.type === "spike" || obs.type === "spike_group") {
    const count = obs.spikeCount ?? 1;
    const sw = obs.width / count;
    for (let i = 0; i < count; i++) {
      drawSpikeUp(ctx, obs.x + i * sw, obs.y, sw, obs.height, obs.color);
    }
    return;
  }

  // Floor spikes (platform & staircase)
  if (obs.floorSpikes) {
    for (const sp of obs.floorSpikes) {
      drawSpikeUp(ctx, sp.x, sp.y, sp.width, sp.height, sp.color);
    }
  }

  if (obs.type === "platform") {
    const p = obs.platforms?.[0];
    if (!p) return;
    // Shadow
    ctx.save();
    ctx.globalAlpha = 0.12; ctx.fillStyle = "#000";
    ctx.fillRect(p.x + 4, p.y + 4, p.width, p.height + 6);
    ctx.globalAlpha = 1;
    // Body
    drawRoundedRect(ctx, p.x, p.y, p.width, p.height + 6, 5, obs.color);
    // Highlight
    ctx.fillStyle = "rgba(255,255,255,0.35)";
    ctx.fillRect(p.x + 6, p.y + 2, p.width - 12, 4);
    // Side post
    ctx.fillStyle = lighten(obs.color, -0.1);
    ctx.fillRect(p.x + p.width / 2 - 5, p.y + p.height + 6, 10, groundY - (p.y + p.height + 6));
    ctx.restore();
    return;
  }

  if (obs.type === "staircase" && obs.platforms) {
    obs.platforms.forEach((p, i) => {
      ctx.save();
      const c = i % 2 === 0 ? obs.color : lighten(obs.color, 0.12);
      // Shadow
      ctx.globalAlpha = 0.12; ctx.fillStyle = "#000";
      ctx.fillRect(p.x + 4, p.y + 4, p.width, p.height + 6);
      ctx.globalAlpha = 1;
      // Step body
      drawRoundedRect(ctx, p.x, p.y, p.width, p.height + 6, 5, c);
      // Highlight
      ctx.fillStyle = "rgba(255,255,255,0.35)";
      ctx.fillRect(p.x + 6, p.y + 2, p.width - 12, 4);
      ctx.restore();
    });
  }
}

function drawFinishLine(ctx: CanvasRenderingContext2D, x: number, groundY: number, h: number) {
  const poleH = groundY * 0.55;
  const poleX = x + 4;

  // Pole
  ctx.save();
  ctx.fillStyle = "#888";
  ctx.fillRect(poleX - 4, groundY - poleH, 8, poleH);

  // Checkered flag
  const fw = 64; const fh = 40;
  const cols = 8; const rows = 5;
  const cw = fw / cols; const ch = fh / rows;
  const flagY = groundY - poleH;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      ctx.fillStyle = (r + c) % 2 === 0 ? "#fff" : "#222";
      ctx.fillRect(poleX + c * cw, flagY + r * ch, cw, ch);
    }
  }
  ctx.strokeStyle = "#555"; ctx.lineWidth = 1;
  ctx.strokeRect(poleX, flagY, fw, fh);

  // "FINISH" text
  ctx.font = "bold 13px Manrope, sans-serif";
  ctx.fillStyle = "#fff";
  ctx.textAlign = "center";
  ctx.shadowColor = "#000"; ctx.shadowBlur = 4;
  ctx.fillText("FINISH", poleX + fw / 2, flagY + fh + 16);
  ctx.shadowBlur = 0;

  // Vertical finish line on ground
  ctx.strokeStyle = "rgba(255,255,255,0.5)";
  ctx.lineWidth = 3;
  ctx.setLineDash([8, 6]);
  ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();
}

function renderFrame(
  ctx: CanvasRenderingContext2D, w: number, h: number,
  state: GameState, skin: BlockSkin, rotation: number,
  levelIdx: number,
) {
  const track = LEVEL_TRACKS[levelIdx] ?? LEVEL_TRACKS[0]!;
  const groundY = Math.floor(h * GROUND_Y_RATIO);

  // Sky gradient
  const sky = ctx.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, track.bgTop);
  sky.addColorStop(1, track.bgBottom);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);

  // Stars / sparkles
  for (const s of state.bgStars) {
    const alpha = 0.3 + 0.7 * Math.abs(Math.sin(s.twinkle));
    ctx.globalAlpha = alpha;
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // Ground
  ctx.fillStyle = track.groundColor;
  ctx.fillRect(0, groundY, w, h - groundY);
  // Ground highlight strip
  ctx.fillStyle = "rgba(255,255,255,0.18)";
  ctx.fillRect(0, groundY, w, 5);
  // Ground tiles
  for (const t of state.groundTiles) {
    ctx.fillStyle = lighten(track.groundColor, 0.08);
    ctx.fillRect(t.x, groundY + 5, 60, 10);
  }

  // Obstacles
  for (const obs of state.obstacles) drawObstacle(ctx, obs, groundY);

  // Finish line
  if (state.finishLineX !== null) {
    drawFinishLine(ctx, state.finishLineX, groundY, h);
  }

  // Player
  const px = PLAYER_X;
  const py = state.playerY;
  if (state.phase === "playing" || state.deathAnimTimer < 0.45) {
    const alpha = state.phase === "dead"
      ? Math.max(0, 1 - state.deathAnimTimer * 2.5)
      : 1;
    ctx.globalAlpha = alpha;
    drawCuteBlock(ctx, px, py, BS, skin, rotation);
    ctx.globalAlpha = 1;
  }

  // Particles
  for (const p of state.particles) {
    const a = p.life / p.maxLife;
    ctx.globalAlpha = a;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size * a, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // Death flash
  if (state.flashTimer > 0) {
    ctx.fillStyle = `rgba(255,80,80,${state.flashTimer * 0.35})`;
    ctx.fillRect(0, 0, w, h);
  }

  // ── HUD — score only, NO level indicator ──────────────────────────────────
  if (state.phase === "playing") {
    // Score pill
    ctx.save();
    ctx.fillStyle = "rgba(0,0,0,0.28)";
    ctx.beginPath(); ctx.roundRect(w - 110, 10, 100, 34, 17); ctx.fill();
    drawText(ctx, `${state.score}`, w - 60, 31, {
      font: "bold 18px Manrope, sans-serif",
      color: "#fff",
      align: "center",
    });
    ctx.restore();

    // Distance progress bar at bottom
    const progress = Math.min(1, state.distance / FINISH_LINE_DISTANCE);
    const barW = w * 0.6;
    const barX = (w - barW) / 2;
    const barY = h - 18;
    ctx.fillStyle = "rgba(0,0,0,0.25)";
    ctx.beginPath(); ctx.roundRect(barX, barY, barW, 8, 4); ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.beginPath(); ctx.roundRect(barX, barY, barW * progress, 8, 4); ctx.fill();
    // Flag icon at end
    ctx.font = "12px sans-serif";
    ctx.fillText("🏁", barX + barW + 4, barY + 9);
  }

  // Level complete overlay
  if (state.phase === "levelcomplete") {
    ctx.fillStyle = "rgba(0,0,0,0.45)";
    ctx.fillRect(0, 0, w, h);
    drawText(ctx, "🏁 LEVEL COMPLETE!", w / 2, h * 0.38, {
      font: "bold 34px Fraunces, serif",
      color: "#ffe066",
      align: "center",
    });
    drawText(ctx, `Score: ${state.score}`, w / 2, h * 0.52, {
      font: "bold 22px Manrope, sans-serif",
      color: "#fff",
      align: "center",
    });
    drawText(ctx, "Tap to continue", w / 2, h * 0.64, {
      font: "16px Manrope, sans-serif",
      color: "rgba(255,255,255,0.7)",
      align: "center",
    });
  }

  // Dead overlay
  if (state.phase === "dead" && state.deathAnimTimer > 0.4) {
    ctx.fillStyle = "rgba(0,0,0,0.42)";
    ctx.fillRect(0, 0, w, h);
    drawText(ctx, "💀 oops!", w / 2, h * 0.38, {
      font: "bold 32px Fraunces, serif",
      color: "#ff6b9d",
      align: "center",
    });
    drawText(ctx, `Score: ${state.score}`, w / 2, h * 0.51, {
      font: "bold 20px Manrope, sans-serif",
      color: "#fff",
      align: "center",
    });
    drawText(ctx, "Tap to retry", w / 2, h * 0.62, {
      font: "15px Manrope, sans-serif",
      color: "rgba(255,255,255,0.65)",
      align: "center",
    });
  }
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function App() {
  const canvasRef    = useRef<HTMLCanvasElement>(null);
  const stateRef     = useRef<GameState | null>(null);
  const musicRef     = useRef<LevelMusic | null>(null);
  const mutedRef     = useRef(true);
  const rotRef       = useRef(0);
  const jumpQueued   = useRef(false);
  const prevSpaceRef = useRef(false);

  // UI state
  const [screen, setScreen]               = useState<"menu" | "levels" | "playing" | "editor">("menu");
  const [muted, setMuted]                 = useState(true);
  const [currentLevel, setCurrentLevel]   = useState(1);
  const [unlockedLevels, setUnlockedLevels] = useState(loadUnlocked);
  const [skin, setSkin]                   = useState<BlockSkin>(loadSkin);
  const [bestScores, setBestScores]       = useState<number[]>(() =>
    Array.from({ length: TOTAL_LEVELS }, (_, i) => loadBestScore(i + 1))
  );
  const [history, setHistory]             = useState<RoundRecord[]>(loadHistory);
  const [displayScore, setDisplayScore]   = useState(0);

  // ── Music toggle ──────────────────────────────────────────────────────────
  const toggleMute = useCallback(() => {
    const nowMuted = !mutedRef.current;
    mutedRef.current = nowMuted;
    setMuted(nowMuted);
    if (nowMuted) {
      musicRef.current?.stop();
      musicRef.current = null;
    } else {
      if (screen === "playing") {
        musicRef.current = new LevelMusic(currentLevel - 1);
        musicRef.current.start();
      }
    }
  }, [screen, currentLevel]);

  // ── Canvas resize ─────────────────────────────────────────────────────────
  useEffect(() => {
    const resize = () => {
      const el = canvasRef.current;
      if (!el) return;
      el.width = el.clientWidth;
      el.height = el.clientHeight;
    };
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);

  // ── Keyboard ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const dn = (e: KeyboardEvent) => {
      if (e.key === " " || e.key === "ArrowUp") { e.preventDefault(); jumpQueued.current = true; }
      if (e.key === "m" || e.key === "M") toggleMute();
    };
    window.addEventListener("keydown", dn);
    return () => window.removeEventListener("keydown", dn);
  }, [toggleMute]);

  // ── Init game ─────────────────────────────────────────────────────────────
  const initGame = useCallback((level: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const h = canvas.clientHeight || 500;
    const groundY = Math.floor(h * GROUND_Y_RATIO);
    const speed = LEVEL_SPEEDS[(level - 1) % LEVEL_SPEEDS.length] ?? LEVEL_SPEEDS[0]!;

    stateRef.current = {
      phase: "playing",
      playerY: groundY - BS,
      playerVY: 0,
      isGrounded: true,
      score: 0,
      distance: 0,
      speed,
      obstacles: [],
      particles: [],
      groundTiles: Array.from({ length: 20 }, (_, i) => ({
        x: i * 70, color: "#aaa",
      })),
      bgStars: Array.from({ length: 28 }, () => ({
        x: Math.random() * (canvas.clientWidth || 800),
        y: Math.random() * (h * 0.7),
        size: rnd(1, 3),
        twinkle: Math.random() * Math.PI * 2,
      })),
      nextObstacleIn: rnd(1.0, 1.8),
      flashTimer: 0,
      deathAnimTimer: 0,
      finishLineX: null,
    };

    setDisplayScore(0);
    setScreen("playing");

    // Start music
    musicRef.current?.stop();
    musicRef.current = null;
    if (!mutedRef.current) {
      musicRef.current = new LevelMusic(level - 1);
      musicRef.current.start();
    }
  }, []);

  // ── Tap / click ───────────────────────────────────────────────────────────
  const handleTap = useCallback(() => {
    const s = stateRef.current;
    if (!s) return;
    if (s.phase === "playing") { jumpQueued.current = true; return; }
    if (s.phase === "dead" && s.deathAnimTimer > 0.4) {
      musicRef.current?.stop(); musicRef.current = null;
      setScreen("menu");
    }
    if (s.phase === "levelcomplete") {
      musicRef.current?.stop(); musicRef.current = null;
      setScreen("menu");
    }
  }, []);

  // ── Burst particles ───────────────────────────────────────────────────────
  function burst(state: GameState, x: number, y: number, n: number, colors: string[]) {
    for (let i = 0; i < n; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = rnd(60, 260);
      state.particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 80,
        life: rnd(0.4, 0.9),
        maxLife: 0.9,
        color: pick(colors),
        size: rnd(3, 7),
      });
    }
  }

  // ── Game loop ─────────────────────────────────────────────────────────────
  useGameLoop((dt) => {
    const canvas = canvasRef.current;
    const state  = stateRef.current;
    if (!canvas || !state) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const w = canvas.width || canvas.clientWidth;
    const h = canvas.height || canvas.clientHeight;
    const groundY = Math.floor(h * GROUND_Y_RATIO);

    // ── Twinkle stars ──
    for (const s of state.bgStars) s.twinkle += dt * 1.5;

    if (state.phase === "playing") {
      // ── Distance & finish line ──────────────────────────────────────────
      state.distance += state.speed * dt;

      // Place finish line marker in world space once close enough
      if (state.finishLineX === null && state.distance > FINISH_LINE_DISTANCE * 0.85) {
        // Put it ahead of the player by the remaining distance
        const remaining = FINISH_LINE_DISTANCE - state.distance;
        state.finishLineX = PLAYER_X + Math.max(remaining, 80);
      }

      // Scroll finish line
      if (state.finishLineX !== null) {
        state.finishLineX -= state.speed * dt;
      }

      // ── Check finish line crossed ───────────────────────────────────────
      if (state.distance >= FINISH_LINE_DISTANCE) {
        state.phase = "levelcomplete";
        burst(state, PLAYER_X + BS / 2, state.playerY, 30, ["#ffe066","#ff9ec4","#b3ffda","#fff"]);
        musicRef.current?.stop(); musicRef.current = null;

        const rec: RoundRecord = {
          level: currentLevel,
          score: state.score,
          completed: true,
          date: new Date().toLocaleTimeString(),
        };
        saveHistory(rec);
        saveBestScore(currentLevel, state.score);

        const newUnlocked = Math.min(TOTAL_LEVELS, currentLevel + 1);
        saveUnlocked(newUnlocked);
        setUnlockedLevels(newUnlocked);
        setBestScores(Array.from({ length: TOTAL_LEVELS }, (_, i) => loadBestScore(i + 1)));
        setHistory(loadHistory());
        return;
      }

      // ── Physics ─────────────────────────────────────────────────────────
      state.playerVY += GRAVITY * dt;
      state.playerY  += state.playerVY * dt;

      // Check if grounded on floor
      const floorY = groundY - BS;
      let onGround = false;
      if (state.playerY >= floorY) {
        state.playerY = floorY;
        state.playerVY = 0;
        onGround = true;
      }

      // Check if standing on a platform/step
      if (!onGround && state.playerVY >= 0) {
        for (const obs of state.obstacles) {
          if (!obs.platforms) continue;
          for (const p of obs.platforms) {
            const playerBottom = state.playerY + BS;
            const prevBottom   = playerBottom - state.playerVY * dt;
            const overlapX     = PLAYER_X + BS > p.x + 4 && PLAYER_X < p.x + p.width - 4;
            if (overlapX && prevBottom <= p.y + 4 && playerBottom >= p.y) {
              state.playerY  = p.y - BS;
              state.playerVY = 0;
              onGround = true;
              break;
            }
          }
          if (onGround) break;
        }
      }

      state.isGrounded = onGround;

      // ── Jump ─────────────────────────────────────────────────────────────
      const spaceNow = jumpQueued.current;
      if (spaceNow && !prevSpaceRef.current && state.isGrounded) {
        state.playerVY = JUMP_VEL;
        state.isGrounded = false;
        burst(state, PLAYER_X + BS / 2, state.playerY + BS, 6, CUTE_COLORS);
      }
      prevSpaceRef.current = spaceNow;
      jumpQueued.current = false;

      // ── Rotation ─────────────────────────────────────────────────────────
      if (!state.isGrounded) rotRef.current += dt * 4.5;
      else rotRef.current *= 0.85;

      // ── Score ─────────────────────────────────────────────────────────────
      state.score = Math.floor(state.distance / 10);
      setDisplayScore(state.score);

      // ── Scroll obstacles & ground ─────────────────────────────────────────
      for (const obs of state.obstacles) {
        obs.x -= state.speed * dt;
        if (obs.platforms) for (const p of obs.platforms) p.x -= state.speed * dt;
        if (obs.floorSpikes) for (const sp of obs.floorSpikes) sp.x -= state.speed * dt;
      }
      state.obstacles = state.obstacles.filter(o => o.x + o.width > -200);

      for (const t of state.groundTiles) t.x -= state.speed * dt;
      state.groundTiles = state.groundTiles.filter(t => t.x > -80);
      while (state.groundTiles.length < 22) {
        const last = state.groundTiles[state.groundTiles.length - 1];
        state.groundTiles.push({ x: (last?.x ?? w) + 70, color: "#aaa" });
      }

      // ── Spawn obstacles ────────────────────────────────────────────────────
      state.nextObstacleIn -= dt;
      if (state.nextObstacleIn <= 0) {
        const spawnX = w + 60;
        const [gapLo, gapHi] = LEVEL_GAPS[(currentLevel - 1) % LEVEL_GAPS.length] ?? [1.2, 2.0];
        const roll = Math.random();
        let obs: Obstacle;
        if (currentLevel >= 3 && roll < 0.32) {
          obs = makeStaircase(spawnX, groundY);
        } else if (currentLevel >= 2 && roll < 0.60) {
          obs = makePlatform(spawnX, groundY);
        } else {
          obs = makeSpikeGroup(spawnX, groundY);
        }
        state.obstacles.push(obs);
        state.nextObstacleIn = rnd(gapLo, gapHi);
      }

      // ── Collision detection ────────────────────────────────────────────────
      const px = PLAYER_X + 6;
      const pw = BS - 12;
      const py = state.playerY + 6;
      const ph = BS - 6;

      let killed = false;

      for (const obs of state.obstacles) {
        if (obs.x + obs.width < PLAYER_X - 10) continue;
        if (obs.x > PLAYER_X + BS + 10) continue;

        // Ground spikes (spike / spike_group)
        if (obs.type === "spike" || obs.type === "spike_group") {
          const count = obs.spikeCount ?? 1;
          const sw = obs.width / count;
          for (let i = 0; i < count; i++) {
            const sx = obs.x + i * sw + 4;
            const sy = obs.y + 6;
            const sw2 = sw - 8; const sh2 = obs.height - 6;
            if (px < sx + sw2 && px + pw > sx && py < sy + sh2 && py + ph > sy) {
              killed = true; break;
            }
          }
        }

        // Floor spikes under platform/staircase
        if (!killed && obs.floorSpikes) {
          for (const sp of obs.floorSpikes) {
            const sx = sp.x + 4; const sy = sp.y + 6;
            const sw2 = sp.width - 8; const sh2 = sp.height - 6;
            if (px < sx + sw2 && px + pw > sx && py < sy + sh2 && py + ph > sy) {
              killed = true; break;
            }
          }
        }

        if (killed) break;
      }

      if (killed) {
        state.phase = "dead";
        state.flashTimer = 1;
        burst(state, PLAYER_X + BS / 2, state.playerY + BS / 2, 18, ["#ff6b9d","#ff9ec4","#fff"]);
        musicRef.current?.stop(); musicRef.current = null;

        const rec: RoundRecord = {
          level: currentLevel,
          score: state.score,
          completed: false,
          date: new Date().toLocaleTimeString(),
        };
        saveHistory(rec);
        saveBestScore(currentLevel, state.score);
        setBestScores(Array.from({ length: TOTAL_LEVELS }, (_, i) => loadBestScore(i + 1)));
        setHistory(loadHistory());
      }
    }

    // ── Timers ──────────────────────────────────────────────────────────────
    if (state.flashTimer > 0) state.flashTimer = Math.max(0, state.flashTimer - dt * 3);
    if (state.phase === "dead") state.deathAnimTimer += dt;

    // ── Particles ──────────────────────────────────────────────────────────
    for (const p of state.particles) {
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.vy += 400 * dt;
      p.life -= dt;
    }
    state.particles = state.particles.filter(p => p.life > 0);

    // ── Render ──────────────────────────────────────────────────────────────
    renderFrame(ctx, w, h, state, skin, rotRef.current, currentLevel - 1);
  }, screen !== "playing");

  // ── Level select screen ───────────────────────────────────────────────────
  if (screen === "levels") {
    const track = LEVEL_TRACKS;
    return (
      <GameShell topbar={<GameTopbar title="CUBIworld" score={displayScore} />}>
        <div className="absolute inset-0 flex flex-col overflow-hidden"
          style={{ background: "linear-gradient(160deg,#ffe4f0 0%,#fff9e6 100%)" }}>

          {/* Header */}
          <div className="flex items-center gap-3 px-5 pt-5 pb-3">
            <button
              onClick={() => setScreen("menu")}
              className="flex items-center gap-1 text-sm font-semibold px-3 py-2 rounded-xl"
              style={{ background: "rgba(0,0,0,0.08)", color: "var(--ink)", fontFamily: "Manrope,sans-serif" }}
            >
              ← Back
            </button>
            <h1 style={{ fontFamily: "Fraunces,serif", fontSize: 22, fontWeight: 700, color: "#d6006e" }}>
              Choose a Level
            </h1>
          </div>

          {/* Level grid */}
          <div className="flex-1 overflow-y-auto px-4 pb-6">
            <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill,minmax(280px,1fr))" }}>
              {Array.from({ length: TOTAL_LEVELS }, (_, i) => {
                const lvl = i + 1;
                const t = track[i]!;
                const unlocked = lvl <= unlockedLevels;
                const best = bestScores[i] ?? 0;
                const isActive = lvl === currentLevel;
                return (
                  <button
                    key={lvl}
                    disabled={!unlocked}
                    onClick={() => {
                      setCurrentLevel(lvl);
                      initGame(lvl);
                    }}
                    className="text-left rounded-2xl p-4 transition-all"
                    style={{
                      background: unlocked
                        ? `linear-gradient(135deg,${t.bgTop},${t.bgBottom})`
                        : "rgba(0,0,0,0.06)",
                      border: isActive ? "3px solid #d6006e" : "3px solid transparent",
                      opacity: unlocked ? 1 : 0.5,
                      cursor: unlocked ? "pointer" : "not-allowed",
                      fontFamily: "Manrope,sans-serif",
                      boxShadow: unlocked ? "0 4px 18px rgba(0,0,0,0.12)" : "none",
                    }}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span style={{ fontSize: 26 }}>{unlocked ? t.emoji : "🔒"}</span>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 15, color: unlocked ? "#222" : "#999" }}>
                          Level {lvl} — {t.name}
                        </div>
                        <div style={{ fontSize: 12, color: unlocked ? "#555" : "#bbb" }}>
                          {t.description}
                        </div>
                      </div>
                    </div>
                    {unlocked && (
                      <div className="flex items-center justify-between mt-2">
                        <span style={{ fontSize: 12, color: "#888" }}>
                          Best: <strong style={{ color: "#d6006e" }}>{best > 0 ? best : "—"}</strong>
                        </span>
                        <span style={{
                          fontSize: 11, fontWeight: 700,
                          background: "#d6006e", color: "#fff",
                          borderRadius: 8, padding: "2px 8px",
                        }}>
                          {isActive ? "✓ Selected" : "Play →"}
                        </span>
                      </div>
                    )}
                    {!unlocked && (
                      <div style={{ fontSize: 11, color: "#bbb", marginTop: 4 }}>
                        Complete level {lvl - 1} to unlock
                      </div>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Recent rounds */}
            {history.length > 0 && (
              <div className="mt-6">
                <h2 style={{ fontFamily: "Fraunces,serif", fontSize: 16, fontWeight: 700, color: "#555", marginBottom: 8 }}>
                  Recent Rounds
                </h2>
                <div className="flex flex-col gap-2">
                  {history.slice(0, 8).map((r, i) => (
                    <div key={i} className="flex items-center justify-between rounded-xl px-4 py-2"
                      style={{ background: "rgba(255,255,255,0.7)", fontFamily: "Manrope,sans-serif" }}>
                      <span style={{ fontSize: 13 }}>
                        {LEVEL_TRACKS[(r.level - 1) % LEVEL_TRACKS.length]?.emoji ?? "🎮"} Level {r.level}
                      </span>
                      <span style={{ fontSize: 13, fontWeight: 700, color: r.completed ? "#22a060" : "#d6006e" }}>
                        {r.completed ? "✓" : "✗"} {r.score} pts
                      </span>
                      <span style={{ fontSize: 11, color: "#aaa" }}>{r.date}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </GameShell>
    );
  }

  // ── Editor screen ─────────────────────────────────────────────────────────
  if (screen === "editor") {
    return (
      <GameShell topbar={<GameTopbar title="CUBIworld" score={displayScore} />}>
        <BlockEditor
          skin={skin}
          onChange={(s) => { setSkin(s); saveSkin(s); }}
          onClose={() => setScreen("menu")}
        />
      </GameShell>
    );
  }

  // ── Main menu ─────────────────────────────────────────────────────────────
  if (screen === "menu") {
    const track = LEVEL_TRACKS[(currentLevel - 1) % LEVEL_TRACKS.length]!;
    return (
      <GameShell topbar={<GameTopbar title="CUBIworld" score={displayScore} />}>
        <div
          className="absolute inset-0 flex flex-col items-center justify-center gap-5 px-6"
          style={{ background: `linear-gradient(160deg,${track.bgTop} 0%,${track.bgBottom} 100%)` }}
          onClick={handleTap}
        >
          {/* Title */}
          <div style={{ textAlign: "center" }}>
            <div style={{ fontFamily: "Fraunces,serif", fontSize: 42, fontWeight: 900,
              color: "#d6006e", textShadow: "0 3px 12px rgba(214,0,110,0.25)", lineHeight: 1.1 }}>
              CUBIworld
            </div>
            <div style={{ fontFamily: "Manrope,sans-serif", fontSize: 14, color: "#888", marginTop: 4 }}>
              Jump the spikes. Reach the finish line.
            </div>
          </div>

          {/* Current level badge */}
          <div style={{
            background: "rgba(255,255,255,0.85)",
            borderRadius: 16, padding: "10px 20px",
            textAlign: "center", fontFamily: "Manrope,sans-serif",
            boxShadow: "0 4px 16px rgba(0,0,0,0.10)",
          }}>
            <div style={{ fontSize: 11, color: "#aaa", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase" }}>
              Playing
            </div>
            <div style={{ fontSize: 18, fontWeight: 800, color: "#222" }}>
              {track.emoji} Level {currentLevel} — {track.name}
            </div>
            <div style={{ fontSize: 12, color: "#888" }}>{track.description}</div>
          </div>

          {/* Buttons */}
          <div className="flex flex-col gap-3 w-full" style={{ maxWidth: 320 }}>
            <button
              onClick={(e) => { e.stopPropagation(); initGame(currentLevel); }}
              className="w-full py-4 rounded-2xl text-white font-bold text-lg transition-all active:scale-95"
              style={{
                background: "linear-gradient(135deg,#ff6b9d,#d6006e)",
                fontFamily: "Manrope,sans-serif",
                boxShadow: "0 6px 20px rgba(214,0,110,0.35)",
                fontSize: 18,
              }}
            >
              ▶ Play Level {currentLevel}
            </button>

            <button
              onClick={(e) => { e.stopPropagation(); setScreen("levels"); }}
              className="w-full py-3 rounded-2xl font-bold transition-all active:scale-95"
              style={{
                background: "rgba(255,255,255,0.85)",
                color: "#d6006e",
                fontFamily: "Manrope,sans-serif",
                border: "2px solid #d6006e",
                fontSize: 15,
              }}
            >
              🗺️ Level Select
            </button>

            <div className="flex gap-3">
              <button
                onClick={(e) => { e.stopPropagation(); setScreen("editor"); }}
                className="flex-1 py-3 rounded-2xl font-bold transition-all active:scale-95"
                style={{
                  background: "rgba(255,255,255,0.85)",
                  color: "#7c3aed",
                  fontFamily: "Manrope,sans-serif",
                  border: "2px solid #c4b5fd",
                  fontSize: 14,
                }}
              >
                🎨 Customize
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); toggleMute(); }}
                className="py-3 px-5 rounded-2xl font-bold transition-all active:scale-95"
                style={{
                  background: muted ? "rgba(255,255,255,0.6)" : "rgba(255,204,68,0.25)",
                  color: muted ? "#aaa" : "#b8860b",
                  fontFamily: "Manrope,sans-serif",
                  border: muted ? "2px solid #ddd" : "2px solid #ffcc44",
                  fontSize: 20,
                }}
                title={muted ? "Unmute music" : "Mute music"}
              >
                {muted ? "🔇" : "🎵"}
              </button>
            </div>
          </div>

          {/* Best scores summary */}
          {bestScores.some(s => s > 0) && (
            <div style={{
              background: "rgba(255,255,255,0.7)",
              borderRadius: 14, padding: "10px 16px",
              fontFamily: "Manrope,sans-serif",
              width: "100%", maxWidth: 320,
            }}>
              <div style={{ fontSize: 11, color: "#aaa", fontWeight: 700, textTransform: "uppercase", marginBottom: 6 }}>
                Best Scores
              </div>
              <div className="flex flex-wrap gap-2">
                {bestScores.map((s, i) => s > 0 && (
                  <span key={i} style={{
                    fontSize: 12, background: "#fff",
                    borderRadius: 8, padding: "2px 8px",
                    color: "#444", border: "1px solid #eee",
                  }}>
                    {LEVEL_TRACKS[i]?.emoji} Lv{i + 1}: <strong style={{ color: "#d6006e" }}>{s}</strong>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </GameShell>
    );
  }

  // ── Playing screen ────────────────────────────────────────────────────────
  return (
    <GameShell topbar={<GameTopbar title="CUBIworld" score={displayScore} />}>
      <div className="relative w-full h-full" onClick={handleTap}>
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full"
          style={{ display: "block" }}
        />
        {/* Mute button — top left, unobtrusive */}
        <button
          onClick={(e) => { e.stopPropagation(); toggleMute(); }}
          className="absolute top-3 left-3 rounded-full w-10 h-10 flex items-center justify-center text-lg transition-all active:scale-90"
          style={{
            background: "rgba(0,0,0,0.22)",
            border: "none",
            color: "#fff",
            zIndex: 10,
          }}
          title={muted ? "Unmute (M)" : "Mute (M)"}
        >
          {muted ? "🔇" : "🎵"}
        </button>
      </div>
    </GameShell>
  );
}
