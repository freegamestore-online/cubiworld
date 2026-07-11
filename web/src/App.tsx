import { useRef, useState, useCallback, useEffect } from "react";
import { GameShell, GameTopbar } from "@freegamestore/games";
import { useGameLoop } from "./hooks/useGameLoop";
import { drawCuteBlock } from "./lib/drawBlock";
import { drawText } from "./lib/canvas";
import { LevelMusic, LEVEL_TRACKS } from "./lib/music";
import BlockEditor from "./components/BlockEditor";
import type {
  BlockSkin, FloorSpike, GameState, Obstacle, PlatformTile, RoundRecord,
} from "./types";
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
  const r = Math.min(255, (n >> 16) + amt);
  const g = Math.min(255, ((n >> 8) & 0xff) + amt);
  const b = Math.min(255, (n & 0xff) + amt);
  return `rgb(${r},${g},${b})`;
}

// ─── localStorage helpers ─────────────────────────────────────────────────────
function loadBestScores(): Record<number, number> {
  try {
    const s = localStorage.getItem("cubiworld_best");
    return s ? (JSON.parse(s) as Record<number, number>) : {};
  } catch { return {}; }
}
function saveBestScore(level: number, score: number) {
  const bests = loadBestScores();
  if ((bests[level] ?? 0) < score) {
    bests[level] = score;
    localStorage.setItem("cubiworld_best", JSON.stringify(bests));
  }
}
function loadUnlocked(): number {
  try { return parseInt(localStorage.getItem("cubiworld_unlocked") ?? "1", 10) || 1; }
  catch { return 1; }
}
function saveUnlocked(n: number) {
  localStorage.setItem("cubiworld_unlocked", String(n));
}
function loadHistory(): RoundRecord[] {
  try {
    const r = localStorage.getItem("cubiworld_history");
    return r ? (JSON.parse(r) as RoundRecord[]) : [];
  } catch { return []; }
}
function saveHistory(rec: RoundRecord) {
  const h = loadHistory();
  h.unshift(rec);
  localStorage.setItem("cubiworld_history", JSON.stringify(h.slice(0, 20)));
}

// ─── Canvas draw helpers ──────────────────────────────────────────────────────
function roundRect(
  ctx: CanvasRenderingContext2D, x: number, y: number,
  w: number, h: number, r: number,
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
}

function drawSpike(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, color: string,
) {
  ctx.save();
  ctx.globalAlpha = 0.15; ctx.fillStyle = "#000";
  ctx.beginPath();
  ctx.moveTo(x + w / 2 + 3, y + 3);
  ctx.lineTo(x + w + 3, y + h + 3);
  ctx.lineTo(x + 3, y + h + 3);
  ctx.closePath(); ctx.fill();
  ctx.globalAlpha = 1;
  const grad = ctx.createLinearGradient(x, y, x + w, y + h);
  grad.addColorStop(0, lighten(color, 60));
  grad.addColorStop(1, color);
  ctx.fillStyle = grad;
  ctx.shadowColor = color; ctx.shadowBlur = 8;
  ctx.beginPath();
  ctx.moveTo(x + w / 2, y);
  ctx.lineTo(x + w, y + h);
  ctx.lineTo(x, y + h);
  ctx.closePath(); ctx.fill();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = "rgba(255,255,255,0.4)"; ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(x + w / 2, y + 4);
  ctx.lineTo(x + w * 0.75, y + h - 2);
  ctx.stroke();
  ctx.restore();
}

function drawPlatformTile(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, color: string,
) {
  ctx.save();
  ctx.shadowColor = color; ctx.shadowBlur = 6;
  roundRect(ctx, x, y, w, h, 6);
  const g = ctx.createLinearGradient(x, y, x, y + h);
  g.addColorStop(0, lighten(color, 50));
  g.addColorStop(1, color);
  ctx.fillStyle = g; ctx.fill();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = "rgba(255,255,255,0.5)"; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(x + 8, y + 3); ctx.lineTo(x + w - 8, y + 3); ctx.stroke();
  ctx.restore();
}

function drawObstacle(ctx: CanvasRenderingContext2D, obs: Obstacle, groundY: number) {
  if (obs.type === "spike" || obs.type === "spike_group") {
    const count = obs.spikeCount ?? 1;
    const sw = obs.width / count;
    for (let i = 0; i < count; i++) {
      drawSpike(ctx, obs.x + i * sw, obs.y, sw - 2, obs.height, obs.color);
    }
  } else if (obs.type === "platform") {
    // floor spikes
    for (const fs of obs.floorSpikes ?? []) {
      drawSpike(ctx, fs.x, fs.y, fs.width, fs.height, fs.color);
    }
    // platform surface
    for (const p of obs.platforms ?? []) {
      drawPlatformTile(ctx, p.x, p.y, p.width, p.height, obs.color);
    }
  } else if (obs.type === "staircase") {
    for (const fs of obs.floorSpikes ?? []) {
      drawSpike(ctx, fs.x, fs.y, fs.width, fs.height, fs.color);
    }
    for (const p of obs.platforms ?? []) {
      drawPlatformTile(ctx, p.x, p.y, p.width, p.height, obs.color);
    }
  }
  // ground shadow
  ctx.save();
  ctx.globalAlpha = 0.08;
  ctx.fillStyle = "#000";
  ctx.fillRect(obs.x, groundY, obs.width, 6);
  ctx.restore();
}

function drawFinishLine(
  ctx: CanvasRenderingContext2D, x: number, groundY: number, h: number,
) {
  ctx.save();
  // pole
  ctx.strokeStyle = "#fff";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(x, groundY);
  ctx.lineTo(x, groundY - h * 0.55);
  ctx.stroke();
  // flag
  ctx.fillStyle = "#ff4444";
  ctx.beginPath();
  ctx.moveTo(x, groundY - h * 0.55);
  ctx.lineTo(x + 38, groundY - h * 0.46);
  ctx.lineTo(x, groundY - h * 0.37);
  ctx.closePath();
  ctx.fill();
  // checkerboard banner on ground
  const bw = 22;
  let toggle = false;
  for (let bx = x - 2; bx < x + 120; bx += bw) {
    ctx.fillStyle = toggle ? "#fff" : "#222";
    ctx.fillRect(bx, groundY - 6, bw, 6);
    toggle = !toggle;
  }
  // glow
  ctx.shadowColor = "#ffff00";
  ctx.shadowBlur = 18;
  ctx.strokeStyle = "#ffff00";
  ctx.lineWidth = 2;
  ctx.setLineDash([8, 6]);
  ctx.beginPath();
  ctx.moveTo(x, 0);
  ctx.lineTo(x, groundY);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.shadowBlur = 0;
  ctx.restore();
}

function renderFrame(
  ctx: CanvasRenderingContext2D, w: number, h: number,
  state: GameState, skin: BlockSkin, rotation: number, trackIdx: number,
) {
  const track = LEVEL_TRACKS[trackIdx] ?? LEVEL_TRACKS[0]!;
  const groundY = Math.floor(h * GROUND_Y_RATIO);

  // Sky gradient
  const sky = ctx.createLinearGradient(0, 0, 0, groundY);
  sky.addColorStop(0, track.bgTop);
  sky.addColorStop(1, track.bgBottom);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);

  // Stars
  for (const s of state.bgStars) {
    const alpha = 0.4 + 0.6 * Math.abs(Math.sin(s.twinkle));
    ctx.globalAlpha = alpha;
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.arc(s.x, s.y * groundY, s.size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // Ground
  const groundGrad = ctx.createLinearGradient(0, groundY, 0, h);
  groundGrad.addColorStop(0, track.groundColor);
  groundGrad.addColorStop(1, lighten(track.groundColor, -30));
  ctx.fillStyle = groundGrad;
  ctx.fillRect(0, groundY, w, h - groundY);

  // Ground tiles
  for (const t of state.groundTiles) {
    ctx.fillStyle = lighten(track.groundColor, 20);
    ctx.fillRect(t.x, groundY, 60, 6);
  }

  // Ground line
  ctx.strokeStyle = "rgba(255,255,255,0.3)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, groundY);
  ctx.lineTo(w, groundY);
  ctx.stroke();

  // Finish line
  if (state.finishLineX !== null) {
    drawFinishLine(ctx, state.finishLineX, groundY, h);
  }

  // Obstacles
  for (const obs of state.obstacles) {
    drawObstacle(ctx, obs, groundY);
  }

  // Particles
  for (const p of state.particles) {
    const alpha = p.life / p.maxLife;
    ctx.globalAlpha = alpha;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size * alpha, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // Player
  if (state.phase === "playing" || state.deathAnimTimer < 0.45) {
    ctx.save();
    if (state.phase === "dead") {
      ctx.globalAlpha = Math.max(0, 1 - state.deathAnimTimer * 2.2);
    }
    drawCuteBlock(ctx, PLAYER_X, state.playerY, BS, BS, skin, rotation);
    ctx.restore();
  }

  // Flash on death
  if (state.flashTimer > 0) {
    ctx.globalAlpha = state.flashTimer * 0.45;
    ctx.fillStyle = "#ff4466";
    ctx.fillRect(0, 0, w, h);
    ctx.globalAlpha = 1;
  }

  // Level-complete overlay
  if (state.phase === "levelcomplete") {
    ctx.globalAlpha = 0.55;
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, w, h);
    ctx.globalAlpha = 1;
    drawText(ctx, "🏁 FINISH!", w / 2, h * 0.38, {
      font: "bold 52px Fraunces, serif",
      color: "#ffff44",
      align: "center",
    });
    drawText(ctx, `Score: ${state.score}`, w / 2, h * 0.52, {
      font: "bold 28px Manrope, sans-serif",
      color: "#fff",
      align: "center",
    });
    drawText(ctx, "Tap to continue", w / 2, h * 0.64, {
      font: "20px Manrope, sans-serif",
      color: "rgba(255,255,255,0.7)",
      align: "center",
    });
  }

  // Dead overlay
  if (state.phase === "dead" && state.deathAnimTimer > 0.3) {
    ctx.globalAlpha = Math.min(1, (state.deathAnimTimer - 0.3) * 2);
    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.fillRect(0, 0, w, h);
    ctx.globalAlpha = 1;
    drawText(ctx, "💀 Oh no!", w / 2, h * 0.38, {
      font: "bold 44px Fraunces, serif",
      color: "#ff6688",
      align: "center",
    });
    drawText(ctx, `Score: ${state.score}`, w / 2, h * 0.52, {
      font: "bold 26px Manrope, sans-serif",
      color: "#fff",
      align: "center",
    });
    drawText(ctx, "Tap to retry", w / 2, h * 0.64, {
      font: "20px Manrope, sans-serif",
      color: "rgba(255,255,255,0.7)",
      align: "center",
    });
  }
}

// ─── Obstacle generators ──────────────────────────────────────────────────────
function makeSpike(x: number, groundY: number, level: number): Obstacle {
  const w = rnd(28, 44);
  const h = rnd(32 + level * 2, 52 + level * 3);
  return { x, y: groundY - h, width: w, height: h, type: "spike", color: pick(SPIKE_COLORS) };
}

function makeSpikeGroup(x: number, groundY: number, level: number): Obstacle {
  const count = level >= 4 ? 3 : 2;
  const sw = rnd(26, 38);
  const h = rnd(30 + level * 2, 50 + level * 3);
  return {
    x, y: groundY - h, width: sw * count + 4, height: h,
    type: "spike_group", color: pick(SPIKE_COLORS), spikeCount: count,
  };
}

function makePlatform(x: number, groundY: number, level: number): Obstacle {
  const pw = rnd(110, 160);   // wider platforms
  const ph = PLATFORM_H;
  const py = groundY - rnd(90, 130 + level * 8);
  const spikeColor = pick(SPIKE_COLORS);
  const platColor = pick(PLAT_COLORS);
  const floorSpikes: FloorSpike[] = [];
  const sw = 30; const sh = rnd(28, 42);
  // spikes under the platform gap (before and after)
  floorSpikes.push({ x: x - 10, y: groundY - sh, width: sw, height: sh, color: spikeColor });
  floorSpikes.push({ x: x + pw + 4, y: groundY - sh, width: sw, height: sh, color: spikeColor });
  const platforms: PlatformTile[] = [{ x, y: py, width: pw, height: ph }];
  return {
    x: x - 10, y: py, width: pw + 50, height: groundY - py,
    type: "platform", color: platColor, platforms, floorSpikes,
  };
}

function makeStaircase(x: number, groundY: number, level: number): Obstacle {
  const stepCount = level >= 4 ? 4 : 3;
  const stepW = rnd(88, 110);   // wide steps — easy to land on
  const stepH = rnd(38, 52);
  const gap = rnd(52, 72);
  const platforms: PlatformTile[] = [];
  const floorSpikes: FloorSpike[] = [];
  const spikeColor = pick(SPIKE_COLORS);
  const stepColor = pick(STEP_COLORS);
  let totalW = 0;

  for (let i = 0; i < stepCount; i++) {
    const sx = x + i * (stepW + gap);
    const sy = groundY - stepH * (i + 1);
    platforms.push({ x: sx, y: sy, width: stepW, height: PLATFORM_H });
    // spike in each gap
    const gapSw = 28; const gapSh = rnd(26, 40);
    floorSpikes.push({
      x: sx + stepW + 4, y: groundY - gapSh, width: gapSw, height: gapSh, color: spikeColor,
    });
    totalW = sx + stepW - x;
  }

  return {
    x, y: groundY - stepH * stepCount, width: totalW + 20, height: stepH * stepCount,
    type: "staircase", color: stepColor, platforms, floorSpikes,
  };
}

function spawnObstacle(x: number, groundY: number, level: number): Obstacle {
  const roll = Math.random();
  if (level >= 3 && roll < 0.30) return makeStaircase(x, groundY, level);
  if (level >= 2 && roll < 0.62) return makePlatform(x, groundY, level);
  if (roll < 0.80) return makeSpikeGroup(x, groundY, level);
  return makeSpike(x, groundY, level);
}

function burst(state: GameState, x: number, y: number, n: number, colors: string[]) {
  for (let i = 0; i < n; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = rnd(80, 320);
    state.particles.push({
      x, y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 120,
      life: rnd(0.5, 1.1), maxLife: 1.1,
      color: pick(colors), size: rnd(4, 10),
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
  const jumpRef      = useRef(false);
  const levelRef     = useRef(1);   // always in sync with currentLevel

  // ── App-level state ──────────────────────────────────────────────────────
  // screen: "menu" | "levels" | "playing" | "editor"
  const [screen, setScreen]             = useState<"menu" | "levels" | "playing" | "editor">("menu");
  const [currentLevel, setCurrentLevel] = useState(1);
  const [muted, setMuted]               = useState(true);
  const [skin, setSkin]                 = useState<BlockSkin>(DEFAULT_SKIN);
  const [score, setScore]               = useState(0);
  const [bestScores, setBestScores]     = useState<Record<number, number>>(loadBestScores);
  const [unlockedLevels, setUnlockedLevels] = useState(loadUnlocked);
  const [history, setHistory]           = useState<RoundRecord[]>(loadHistory);

  // ── Music ────────────────────────────────────────────────────────────────
  useEffect(() => {
    // Stop old music
    musicRef.current?.stop();
    musicRef.current = null;
    if (screen === "playing") {
      const m = new LevelMusic(levelRef.current - 1);
      musicRef.current = m;
      if (!mutedRef.current) m.start();
    }
    return () => { musicRef.current?.stop(); };
  }, [screen]); // only re-create music when screen changes (i.e. when a round starts)

  // ── Mute toggle ──────────────────────────────────────────────────────────
  function toggleMute() {
    const m = !mutedRef.current;
    mutedRef.current = m;
    setMuted(m);
    if (m) { musicRef.current?.stop(); }
    else { musicRef.current?.start(); }
  }

  // ── Canvas resize ────────────────────────────────────────────────────────
  useEffect(() => {
    function resize() {
      const el = canvasRef.current;
      if (!el) return;
      el.width  = el.clientWidth;
      el.height = el.clientHeight;
    }
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);

  // ── Init game ────────────────────────────────────────────────────────────
  const initGame = useCallback((level: number) => {
    // Keep levelRef in sync so the music effect sees the right level
    levelRef.current = level;
    setCurrentLevel(level);

    const canvas = canvasRef.current;
    const h = canvas ? canvas.clientHeight || 500 : 500;
    const w = canvas ? canvas.clientWidth  || 800 : 800;
    const groundY = Math.floor(h * GROUND_Y_RATIO);

    const speed = LEVEL_SPEEDS[(level - 1) % LEVEL_SPEEDS.length] ?? 240;

    const groundTiles: { x: number; color: string }[] = [];
    for (let gx = 0; gx < w + 120; gx += 62) {
      groundTiles.push({ x: gx, color: pick(CUTE_COLORS) });
    }

    const bgStars: { x: number; y: number; size: number; twinkle: number }[] = [];
    for (let i = 0; i < 28; i++) {
      bgStars.push({
        x: Math.random() * w,
        y: Math.random() * 0.75,
        size: rnd(1, 3),
        twinkle: Math.random() * Math.PI * 2,
      });
    }

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
      groundTiles,
      bgStars,
      nextObstacleIn: 1.2,
      flashTimer: 0,
      deathAnimTimer: 0,
      finishLineX: null,
    };

    rotRef.current = 0;
    jumpRef.current = false;
    setScore(0);
    setScreen("playing");   // ← this triggers the music useEffect
  }, []);

  // ── Keyboard / tap input ─────────────────────────────────────────────────
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.code === "Space" || e.code === "ArrowUp") {
        e.preventDefault();
        jumpRef.current = true;
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // ── Tap handler (canvas area) ─────────────────────────────────────────────
  const handleTap = useCallback(() => {
    const s = stateRef.current;
    if (!s) return;
    if (s.phase === "playing") {
      jumpRef.current = true;
    } else if (s.phase === "levelcomplete") {
      // Go back to level select after completing
      setScreen("levels");
    } else if (s.phase === "dead" && s.deathAnimTimer > 0.3) {
      initGame(levelRef.current);
    }
  }, [initGame]);

  // ── Game loop ─────────────────────────────────────────────────────────────
  useGameLoop((dt) => {
    const canvas = canvasRef.current;
    const state  = stateRef.current;
    if (!canvas || !state) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const w = canvas.width  || canvas.clientWidth;
    const h = canvas.height || canvas.clientHeight;
    const groundY = Math.floor(h * GROUND_Y_RATIO);

    // Animate stars
    for (const s of state.bgStars) s.twinkle += dt * 1.8;

    // Animate ground tiles
    for (const t of state.groundTiles) {
      t.x -= state.speed * dt;
      if (t.x < -62) t.x += w + 180;
    }

    // Animate particles
    for (const p of state.particles) {
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.vy += 400 * dt;
      p.life -= dt;
    }
    state.particles = state.particles.filter(p => p.life > 0);

    // Flash timer
    if (state.flashTimer > 0) state.flashTimer = Math.max(0, state.flashTimer - dt * 3);

    if (state.phase === "dead") {
      state.deathAnimTimer += dt;
      renderFrame(ctx, w, h, state, skin, rotRef.current, levelRef.current - 1);
      return;
    }

    if (state.phase === "levelcomplete") {
      renderFrame(ctx, w, h, state, skin, rotRef.current, levelRef.current - 1);
      return;
    }

    // ── Physics ──────────────────────────────────────────────────────────
    if (jumpRef.current) {
      jumpRef.current = false;
      if (state.isGrounded) {
        state.playerVY = JUMP_VEL;
        state.isGrounded = false;
        burst(state, PLAYER_X + BS / 2, state.playerY + BS, 6, CUTE_COLORS);
      }
    }

    state.playerVY += GRAVITY * dt;
    state.playerY  += state.playerVY * dt;

    // Ground collision
    const floorY = groundY - BS;
    if (state.playerY >= floorY) {
      state.playerY = floorY;
      state.playerVY = 0;
      state.isGrounded = true;
    } else {
      state.isGrounded = false;
    }

    // Rotation
    if (!state.isGrounded) {
      rotRef.current += dt * 4.5;
    } else {
      rotRef.current *= 0.8;
    }

    // Distance / score
    state.distance += state.speed * dt;
    state.score = Math.floor(state.distance / 10);
    setScore(state.score);

    // Spawn finish line
    if (state.finishLineX === null && state.distance >= FINISH_LINE_DISTANCE) {
      state.finishLineX = w + 60;
    }

    // Move finish line
    if (state.finishLineX !== null) {
      state.finishLineX -= state.speed * dt;
      // Player crosses finish line
      if (state.finishLineX < PLAYER_X + BS) {
        state.phase = "levelcomplete";
        burst(state, w / 2, h / 2, 40, ["#ffff44","#ff9900","#ff44aa","#44ffaa","#4488ff"]);
        // Unlock next level
        const nextLvl = levelRef.current + 1;
        const newUnlocked = Math.max(unlockedLevels, Math.min(nextLvl, TOTAL_LEVELS));
        setUnlockedLevels(newUnlocked);
        saveUnlocked(newUnlocked);
        // Save score & history
        saveBestScore(levelRef.current, state.score);
        setBestScores(loadBestScores());
        const rec: RoundRecord = {
          level: levelRef.current, score: state.score,
          completed: true, date: new Date().toLocaleDateString(),
        };
        saveHistory(rec);
        setHistory(loadHistory());
        musicRef.current?.stop();
        return;
      }
    }

    // Spawn obstacles
    state.nextObstacleIn -= dt;
    if (state.nextObstacleIn <= 0) {
      const [gapLo, gapHi] = LEVEL_GAPS[(levelRef.current - 1) % LEVEL_GAPS.length] ?? [1.2, 2.0];
      state.nextObstacleIn = rnd(gapLo, gapHi);
      state.obstacles.push(spawnObstacle(w + 60, groundY, levelRef.current));
    }

    // Move & cull obstacles
    for (const obs of state.obstacles) obs.x -= state.speed * dt;
    state.obstacles = state.obstacles.filter(o => o.x + o.width > -80);

    // ── Collision ─────────────────────────────────────────────────────────
    const px1 = PLAYER_X + 4, px2 = PLAYER_X + BS - 4;
    const py1 = state.playerY + 4, py2 = state.playerY + BS - 4;

    let landed = false;
    for (const obs of state.obstacles) {
      if (obs.type === "spike" || obs.type === "spike_group") {
        if (px2 > obs.x + 4 && px1 < obs.x + obs.width - 4 && py2 > obs.y + 6 && py1 < obs.y + obs.height) {
          die(state);
          renderFrame(ctx, w, h, state, skin, rotRef.current, levelRef.current - 1);
          return;
        }
      } else {
        // Floor spikes
        for (const fs of obs.floorSpikes ?? []) {
          if (px2 > fs.x + 4 && px1 < fs.x + fs.width - 4 && py2 > fs.y + 6 && py1 < fs.y + fs.height) {
            die(state);
            renderFrame(ctx, w, h, state, skin, rotRef.current, levelRef.current - 1);
            return;
          }
        }
        // Platforms — land on top
        for (const p of obs.platforms ?? []) {
          const onTop = px2 > p.x + 4 && px1 < p.x + p.width - 4
            && state.playerVY >= 0
            && py2 >= p.y && py2 <= p.y + p.height + 12
            && py1 < p.y + p.height;
          if (onTop) {
            state.playerY = p.y - BS;
            state.playerVY = 0;
            state.isGrounded = true;
            landed = true;
          }
        }
      }
    }
    if (!landed && state.playerY < floorY) state.isGrounded = false;

    renderFrame(ctx, w, h, state, skin, rotRef.current, levelRef.current - 1);
  }, screen !== "playing");   // ← paused when not playing

  function die(state: GameState) {
    state.phase = "dead";
    state.flashTimer = 1;
    state.deathAnimTimer = 0;
    burst(state, PLAYER_X + BS / 2, state.playerY + BS / 2, 18, CUTE_COLORS);
    saveBestScore(levelRef.current, state.score);
    setBestScores(loadBestScores());
    const rec: RoundRecord = {
      level: levelRef.current, score: state.score,
      completed: false, date: new Date().toLocaleDateString(),
    };
    saveHistory(rec);
    setHistory(loadHistory());
    musicRef.current?.stop();
  }

  // ── Render ────────────────────────────────────────────────────────────────
  const track = LEVEL_TRACKS[(currentLevel - 1) % LEVEL_TRACKS.length]!;

  return (
    <GameShell topbar={
      <GameTopbar
        title="CUBIworld"
        score={screen === "playing" ? score : undefined}
      />
    }>
      {/* ── EDITOR ──────────────────────────────────────────────────────── */}
      {screen === "editor" && (
        <BlockEditor skin={skin} onChange={setSkin} onClose={() => setScreen("menu")} />
      )}

      {/* ── LEVEL SELECT ────────────────────────────────────────────────── */}
      {screen === "levels" && (
        <div className="absolute inset-0 overflow-y-auto" style={{ background: "var(--paper)" }}>
          <div className="max-w-xl mx-auto px-4 py-6">
            {/* Header */}
            <div className="flex items-center gap-3 mb-6">
              <button
                onClick={() => setScreen("menu")}
                className="text-2xl px-3 py-2 rounded-xl"
                style={{ background: "var(--surface)", color: "var(--ink)" }}
              >
                ← Back
              </button>
              <h2 style={{ fontFamily: "Fraunces, serif", color: "var(--ink)", fontSize: 26, fontWeight: 700 }}>
                Choose a Level
              </h2>
            </div>

            {/* Level cards */}
            <div className="flex flex-col gap-4">
              {Array.from({ length: TOTAL_LEVELS }, (_, i) => {
                const lvl = i + 1;
                const t = LEVEL_TRACKS[i]!;
                const unlocked = lvl <= unlockedLevels;
                const best = bestScores[lvl] ?? 0;
                const isSelected = lvl === currentLevel;
                return (
                  <div
                    key={lvl}
                    onClick={() => { if (unlocked) setCurrentLevel(lvl); }}
                    style={{
                      borderRadius: 16,
                      border: isSelected ? "3px solid #ff9ec4" : "2px solid var(--border)",
                      background: isSelected ? "linear-gradient(135deg,#fff0f8,#f0f4ff)" : "var(--surface)",
                      opacity: unlocked ? 1 : 0.45,
                      cursor: unlocked ? "pointer" : "default",
                      padding: "16px 18px",
                      boxShadow: isSelected ? "0 4px 20px #ff9ec455" : "none",
                      transition: "all 0.15s",
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span style={{ fontSize: 32 }}>{unlocked ? t.emoji : "🔒"}</span>
                        <div>
                          <div style={{
                            fontFamily: "Fraunces, serif",
                            fontWeight: 700,
                            fontSize: 18,
                            color: "var(--ink)",
                          }}>
                            Level {lvl} — {t.name}
                          </div>
                          <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 2 }}>
                            {unlocked ? t.description : "Complete previous level to unlock"}
                          </div>
                          {unlocked && best > 0 && (
                            <div style={{ fontSize: 13, color: "#ff9900", marginTop: 2, fontWeight: 600 }}>
                              🏆 Best: {best}
                            </div>
                          )}
                        </div>
                      </div>
                      {unlocked && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            initGame(lvl);
                          }}
                          style={{
                            background: "linear-gradient(135deg,#ff9ec4,#b3d9ff)",
                            color: "#fff",
                            fontWeight: 700,
                            fontSize: 15,
                            border: "none",
                            borderRadius: 12,
                            padding: "10px 18px",
                            cursor: "pointer",
                            minWidth: 80,
                            boxShadow: "0 2px 8px #ff9ec455",
                          }}
                        >
                          ▶ Play
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Recent rounds */}
            {history.length > 0 && (
              <div className="mt-8">
                <h3 style={{
                  fontFamily: "Fraunces, serif", fontSize: 18, fontWeight: 700,
                  color: "var(--ink)", marginBottom: 12,
                }}>
                  Recent Rounds
                </h3>
                <div className="flex flex-col gap-2">
                  {history.slice(0, 8).map((r, idx) => (
                    <div key={idx} style={{
                      display: "flex", alignItems: "center", justifyContent: "space-between",
                      background: "var(--surface)", borderRadius: 10, padding: "10px 14px",
                      border: "1px solid var(--border)",
                    }}>
                      <span style={{ fontSize: 14, color: "var(--ink)", fontWeight: 600 }}>
                        {r.completed ? "🏁" : "💀"} Level {r.level} — {LEVEL_TRACKS[(r.level - 1) % LEVEL_TRACKS.length]?.name}
                      </span>
                      <span style={{ fontSize: 14, color: "var(--muted)" }}>
                        {r.score} pts · {r.date}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── MAIN MENU ───────────────────────────────────────────────────── */}
      {screen === "menu" && (
        <div
          className="absolute inset-0 flex flex-col items-center justify-center gap-5 px-6"
          style={{ background: "linear-gradient(160deg,#ffe0f4 0%,#e0eeff 100%)" }}
        >
          <div style={{
            fontFamily: "Fraunces, serif",
            fontSize: "clamp(38px,8vw,68px)",
            fontWeight: 900,
            color: "#d6006e",
            textShadow: "0 4px 18px #ff9ec455",
            letterSpacing: "-1px",
            lineHeight: 1.1,
            textAlign: "center",
          }}>
            🟦 CUBIworld
          </div>
          <div style={{ fontSize: 16, color: "#7a5c7a", textAlign: "center", maxWidth: 280 }}>
            Jump over spikes, land on platforms, reach the finish line!
          </div>

          {/* Currently selected level preview */}
          <div style={{
            background: "#fff",
            borderRadius: 16,
            padding: "14px 22px",
            border: "2px solid #ffb3d9",
            textAlign: "center",
            minWidth: 220,
          }}>
            <div style={{ fontSize: 28, marginBottom: 4 }}>{track.emoji}</div>
            <div style={{ fontFamily: "Fraunces, serif", fontWeight: 700, fontSize: 16, color: "#333" }}>
              Level {currentLevel} — {track.name}
            </div>
            <div style={{ fontSize: 12, color: "#999", marginTop: 2 }}>{track.description}</div>
            {(bestScores[currentLevel] ?? 0) > 0 && (
              <div style={{ fontSize: 13, color: "#ff9900", marginTop: 6, fontWeight: 600 }}>
                🏆 Best: {bestScores[currentLevel]}
              </div>
            )}
          </div>

          {/* Buttons */}
          <button
            onClick={() => initGame(currentLevel)}
            style={{
              background: "linear-gradient(135deg,#ff9ec4,#b3d9ff)",
              color: "#fff",
              fontWeight: 800,
              fontSize: 20,
              border: "none",
              borderRadius: 16,
              padding: "16px 48px",
              cursor: "pointer",
              boxShadow: "0 4px 20px #ff9ec466",
              letterSpacing: "0.5px",
            }}
          >
            ▶ Play Level {currentLevel}
          </button>

          <div className="flex gap-3 flex-wrap justify-center">
            <button
              onClick={() => setScreen("levels")}
              style={{
                background: "#fff",
                color: "#d6006e",
                fontWeight: 700,
                fontSize: 15,
                border: "2px solid #ffb3d9",
                borderRadius: 12,
                padding: "12px 22px",
                cursor: "pointer",
              }}
            >
              🗺 Level Select
            </button>
            <button
              onClick={() => setScreen("editor")}
              style={{
                background: "#fff",
                color: "#5566cc",
                fontWeight: 700,
                fontSize: 15,
                border: "2px solid #b3d9ff",
                borderRadius: 12,
                padding: "12px 22px",
                cursor: "pointer",
              }}
            >
              🎨 Customize
            </button>
            <button
              onClick={toggleMute}
              style={{
                background: muted ? "#f5f5f5" : "#fff",
                color: muted ? "#999" : "#d6006e",
                fontWeight: 700,
                fontSize: 15,
                border: `2px solid ${muted ? "#ddd" : "#ffb3d9"}`,
                borderRadius: 12,
                padding: "12px 18px",
                cursor: "pointer",
              }}
            >
              {muted ? "🔇 Sound Off" : "🎵 Sound On"}
            </button>
          </div>
        </div>
      )}

      {/* ── GAME CANVAS ─────────────────────────────────────────────────── */}
      {/* visibility (not display): the canvas must keep its layout size while
          hidden — with display:none it measures 0×0, so the mount-time resize
          set a 0×0 bitmap and the game drew onto an empty canvas (white screen
          with only the DOM score ticking). */}
      <div
        className="absolute inset-0"
        style={{ visibility: screen === "playing" ? "visible" : "hidden" }}
        onClick={handleTap}
        onTouchStart={(e) => { e.preventDefault(); handleTap(); }}
      >
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full"
          style={{ display: "block", touchAction: "none" }}
        />
        {/* Mute button overlay */}
        <button
          onClick={(e) => { e.stopPropagation(); toggleMute(); }}
          style={{
            position: "absolute", top: 10, right: 10,
            background: muted ? "rgba(0,0,0,0.35)" : "rgba(255,200,68,0.85)",
            color: "#fff",
            border: "none",
            borderRadius: 10,
            padding: "8px 12px",
            fontSize: 18,
            cursor: "pointer",
            zIndex: 10,
          }}
        >
          {muted ? "🔇" : "🎵"}
        </button>
        {/* Back to menu */}
        <button
          onClick={(e) => { e.stopPropagation(); setScreen("menu"); }}
          style={{
            position: "absolute", top: 10, left: 10,
            background: "rgba(0,0,0,0.35)",
            color: "#fff",
            border: "none",
            borderRadius: 10,
            padding: "8px 14px",
            fontSize: 14,
            fontWeight: 700,
            cursor: "pointer",
            zIndex: 10,
          }}
        >
          ← Menu
        </button>
      </div>
    </GameShell>
  );
}
