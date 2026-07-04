import { useRef, useState, useCallback, useEffect } from "react";
import { GameShell, GameTopbar } from "@freegamestore/games";
import { useGameLoop } from "./hooks/useGameLoop";
import { useHighScore } from "./hooks/useHighScore";
import { drawCuteBlock } from "./lib/drawBlock";
import { drawText } from "./lib/canvas";
import BlockEditor from "./components/BlockEditor";
import type { BlockSkin, GameState, Obstacle, PlatformTile, UnderSpike } from "./types";
import { DEFAULT_SKIN } from "./types";

// ─── Constants ────────────────────────────────────────────────────────────────
const GROUND_Y_RATIO = 0.78;
const BS = 48;
const GRAVITY = 2000;
const JUMP_VEL = -740;
const INITIAL_SPEED = 270;
const PLAYER_X = 80;
const PLATFORM_H = 14; // thickness of platform/step surface

const CUTE_COLORS  = ["#ffb3d9","#b3d9ff","#b3ffda","#ffe0b3","#e0b3ff","#fffdb3"];
const STEP_COLORS  = ["#b3d9ff","#b3ffda","#ffe0b3","#e0b3ff","#c8f5c8","#ffd6ff"];
const SPIKE_COLORS = ["#ff7eb3","#ff6baa","#ff9ec4","#ff5599","#ffaacc"];
const PLAT_COLORS  = ["#9ec4ff","#a8e6cf","#ffd3e0","#d4a5f5","#ffe066","#b5ead7"];

function rnd(a: number, b: number) { return a + Math.random() * (b - a); }
function pick<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)] as T; }

function lighten(hex: string, amt: number): string {
  const c = hex.replace("#", "");
  const r = Math.min(255, parseInt(c.substring(0, 2), 16) + Math.round(amt * 255));
  const g = Math.min(255, parseInt(c.substring(2, 4), 16) + Math.round(amt * 255));
  const b = Math.min(255, parseInt(c.substring(4, 6), 16) + Math.round(amt * 255));
  return `#${r.toString(16).padStart(2,"0")}${g.toString(16).padStart(2,"0")}${b.toString(16).padStart(2,"0")}`;
}

function loadSkin(): BlockSkin {
  try { const r = localStorage.getItem("cubiworld_skin"); if (r) return JSON.parse(r) as BlockSkin; }
  catch { /* ignore */ }
  return { ...DEFAULT_SKIN };
}
function saveSkin(s: BlockSkin) { localStorage.setItem("cubiworld_skin", JSON.stringify(s)); }

// ─── Canvas helpers ───────────────────────────────────────────────────────────
function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const cr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + cr, y); ctx.lineTo(x + w - cr, y);
  ctx.arcTo(x + w, y, x + w, y + cr, cr); ctx.lineTo(x + w, y + h - cr);
  ctx.arcTo(x + w, y + h, x + w - cr, y + h, cr); ctx.lineTo(x + cr, y + h);
  ctx.arcTo(x, y + h, x, y + h - cr, cr); ctx.lineTo(x, y + cr);
  ctx.arcTo(x, y, x + cr, y, cr); ctx.closePath();
}

// ─── Obstacle factories ───────────────────────────────────────────────────────

/** Ground-level spike group (1–3 spikes pointing up) */
function makeSpikeGroup(startX: number, groundY: number): Obstacle {
  const count = Math.random() < 0.4 ? 1 : Math.random() < 0.6 ? 2 : 3;
  const sw = BS * 0.72;
  const sh = BS * 0.88;
  const color = pick(SPIKE_COLORS);
  return {
    x: startX, y: groundY - sh,
    width: sw * count, height: sh,
    type: count === 1 ? "spike" : "spike_group",
    color, spikeCount: count,
  };
}

/**
 * Platform: a wide raised flat surface.
 * Player must jump UP onto it, then jump off the far end.
 * Spikes on the ground below — can't just run under it.
 */
function makePlatform(startX: number, groundY: number): Obstacle {
  const color = pick(PLAT_COLORS);
  const platW = Math.floor(BS * rnd(2.2, 3.6));
  const platH = PLATFORM_H;
  const riseBlocks = 1.5 + Math.random() * 0.5;
  const platY = groundY - BS * riseBlocks - platH;

  const platforms: PlatformTile[] = [{ x: startX, y: platY, width: platW, height: platH }];

  // Spikes on the ground underneath
  const underSpikes: UnderSpike[] = [];
  const spikeW = BS * 0.7;
  const spikeH = BS * 0.72;
  const spikeCount = Math.ceil(platW / spikeW);
  for (let i = 0; i < spikeCount; i++) {
    underSpikes.push({
      x: startX + i * spikeW,
      y: groundY - spikeH,
      width: spikeW,
      height: spikeH,
      color: pick(SPIKE_COLORS),
      pointDown: false,
    });
  }

  return {
    x: startX, y: platY,
    width: platW, height: groundY - platY,
    type: "platform",
    color, platforms, underSpikes,
  };
}

/**
 * Staircase: 3–4 separated ascending steps.
 * Each step is a narrow platform with a GAP between (must jump each one individually).
 * A spike hangs DOWN from below each step — fall between them = death.
 * Steps get progressively higher left→right.
 */
function makeStaircase(startX: number, groundY: number): Obstacle {
  const stepCount = Math.random() < 0.5 ? 3 : 4;
  const color = pick(STEP_COLORS);

  const stepW = BS * 1.1;       // width of each step surface
  const gap = BS * 0.9;         // gap between steps (must jump across)
  const risePerStep = BS * 0.7; // each step is this much higher than the previous
  const platH = PLATFORM_H;

  const platforms: PlatformTile[] = [];
  const underSpikes: UnderSpike[] = [];

  let totalW = 0;
  let minY = groundY;

  for (let i = 0; i < stepCount; i++) {
    const stepX = startX + i * (stepW + gap);
    const stepY = groundY - BS * 1.15 - risePerStep * i - platH;

    platforms.push({ x: stepX, y: stepY, width: stepW, height: platH });

    // Spike pointing DOWN from the underside of this step
    // (taller on higher steps = more dangerous to fall into)
    const spikeH = BS * 0.65 + risePerStep * i * 0.6;
    const spikeW = stepW * 0.7;
    underSpikes.push({
      x: stepX + (stepW - spikeW) / 2,
      y: stepY + platH,          // hangs from bottom of step surface
      width: spikeW,
      height: spikeH,
      color: pick(SPIKE_COLORS),
      pointDown: true,
    });

    totalW = stepX + stepW - startX;
    if (stepY < minY) minY = stepY;
  }

  return {
    x: startX, y: minY,
    width: totalW, height: groundY - minY,
    type: "staircase",
    color, platforms, underSpikes,
    spikeCount: stepCount,
  };
}

// ─── Drawing helpers ──────────────────────────────────────────────────────────

/** Draw a spike triangle. pointDown = hangs from a step; !pointDown = sits on ground */
function drawSpikeTriangle(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number,
  color: string,
  pointDown: boolean,
) {
  ctx.save();
  // Shadow
  ctx.globalAlpha = 0.15;
  ctx.fillStyle = "#000";
  ctx.beginPath();
  if (pointDown) {
    ctx.moveTo(x + 3, y + 3); ctx.lineTo(x + w + 3, y + 3); ctx.lineTo(x + w / 2 + 3, y + h + 3);
  } else {
    ctx.moveTo(x + w / 2 + 3, y + 3); ctx.lineTo(x + w + 3, y + h + 3); ctx.lineTo(x + 3, y + h + 3);
  }
  ctx.closePath(); ctx.fill();
  ctx.globalAlpha = 1;

  // Body gradient
  const grad = ctx.createLinearGradient(x, y, x + w, y + h);
  grad.addColorStop(0, lighten(color, 0.3)); grad.addColorStop(1, color);
  ctx.fillStyle = grad;
  ctx.shadowColor = color; ctx.shadowBlur = 10;
  ctx.beginPath();
  if (pointDown) {
    ctx.moveTo(x, y); ctx.lineTo(x + w, y); ctx.lineTo(x + w / 2, y + h);
  } else {
    ctx.moveTo(x + w / 2, y); ctx.lineTo(x + w, y + h); ctx.lineTo(x, y + h);
  }
  ctx.closePath(); ctx.fill();

  // Outline
  ctx.shadowBlur = 0;
  ctx.strokeStyle = "rgba(255,255,255,0.4)"; ctx.lineWidth = 1.5;
  ctx.beginPath();
  if (pointDown) {
    ctx.moveTo(x, y); ctx.lineTo(x + w, y); ctx.lineTo(x + w / 2, y + h);
  } else {
    ctx.moveTo(x + w / 2, y); ctx.lineTo(x + w, y + h); ctx.lineTo(x, y + h);
  }
  ctx.closePath(); ctx.stroke();

  // Highlight streak
  ctx.strokeStyle = "rgba(255,255,255,0.5)"; ctx.lineWidth = 1;
  ctx.beginPath();
  if (pointDown) {
    ctx.moveTo(x + w * 0.35, y + h * 0.08); ctx.lineTo(x + w * 0.48, y + h * 0.72);
  } else {
    ctx.moveTo(x + w / 2, y + h * 0.08); ctx.lineTo(x + w * 0.62, y + h * 0.72);
  }
  ctx.stroke();
  ctx.restore();
}

/** Draw a flat platform/step surface (no face) */
function drawPlatformTile(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number,
  color: string,
) {
  const r = Math.min(6, h / 2);
  ctx.save();
  // Shadow
  ctx.globalAlpha = 0.2; ctx.fillStyle = "#000";
  roundRect(ctx, x + 3, y + 3, w, h, r); ctx.fill();
  ctx.globalAlpha = 1;

  // Body
  const grad = ctx.createLinearGradient(x, y, x, y + h);
  grad.addColorStop(0, lighten(color, 0.28)); grad.addColorStop(1, color);
  ctx.fillStyle = grad;
  ctx.shadowColor = color; ctx.shadowBlur = 10;
  roundRect(ctx, x, y, w, h, r); ctx.fill();
  ctx.shadowBlur = 0;

  // Top shine
  ctx.fillStyle = "rgba(255,255,255,0.22)";
  roundRect(ctx, x + 3, y + 2, w - 6, Math.min(5, h * 0.4), r * 0.5); ctx.fill();

  // Outline
  ctx.strokeStyle = "rgba(255,255,255,0.3)"; ctx.lineWidth = 1.5;
  roundRect(ctx, x, y, w, h, r); ctx.stroke();
  ctx.restore();
}

function drawObstacle(ctx: CanvasRenderingContext2D, obs: Obstacle, groundY: number) {
  ctx.save();

  if (obs.type === "spike" || obs.type === "spike_group") {
    const count = obs.spikeCount ?? 1;
    const sw = obs.width / count;
    for (let i = 0; i < count; i++) {
      drawSpikeTriangle(ctx, obs.x + i * sw, obs.y, sw, obs.height, obs.color, false);
    }
    // Base glow line
    ctx.strokeStyle = obs.color; ctx.lineWidth = 2;
    ctx.shadowColor = obs.color; ctx.shadowBlur = 6;
    ctx.beginPath(); ctx.moveTo(obs.x, groundY); ctx.lineTo(obs.x + obs.width, groundY); ctx.stroke();

  } else if (obs.type === "platform") {
    // Ground spikes below (pointing up)
    if (obs.underSpikes) {
      for (const sp of obs.underSpikes) {
        drawSpikeTriangle(ctx, sp.x, sp.y, sp.width, sp.height, sp.color, false);
      }
    }
    // Platform surface + faint pillars
    if (obs.platforms) {
      for (const p of obs.platforms) {
        // Faint pillar
        const pillarTop = p.y + p.height;
        const pillarH = groundY - pillarTop;
        if (pillarH > 0) {
          ctx.save();
          ctx.globalAlpha = 0.15; ctx.fillStyle = obs.color;
          roundRect(ctx, p.x + p.width * 0.15, pillarTop, p.width * 0.7, pillarH, 4);
          ctx.fill(); ctx.globalAlpha = 1;
          ctx.restore();
        }
        drawPlatformTile(ctx, p.x, p.y, p.width, p.height, obs.color);
      }
    }

  } else if (obs.type === "staircase") {
    // Down-pointing spikes below each step
    if (obs.underSpikes) {
      for (const sp of obs.underSpikes) {
        drawSpikeTriangle(ctx, sp.x, sp.y, sp.width, sp.height, sp.color, true);
      }
    }
    // Each step surface, ascending
    if (obs.platforms) {
      for (let i = 0; i < obs.platforms.length; i++) {
        const p = obs.platforms[i];
        if (!p) continue;
        const c = lighten(obs.color, i * 0.07);
        drawPlatformTile(ctx, p.x, p.y, p.width, p.height, c);
        // Step number
        ctx.save();
        ctx.globalAlpha = 0.6; ctx.fillStyle = "#fff";
        ctx.font = `bold 11px Manrope,sans-serif`;
        ctx.textAlign = "center";
        ctx.fillText(`${i + 1}`, p.x + p.width / 2, p.y + p.height - 2);
        ctx.restore();
      }
    }
  }

  ctx.restore();
}

// ─── Scene & Menu draw ────────────────────────────────────────────────────────
function drawScene(
  ctx: CanvasRenderingContext2D,
  w: number, h: number, groundY: number,
  state: GameState, skin: BlockSkin, rotation: number, highScore: number,
) {
  const bg = ctx.createLinearGradient(0, 0, 0, h);
  bg.addColorStop(0, "#1a0a2e"); bg.addColorStop(0.7, "#2d1060"); bg.addColorStop(1, "#1a0a2e");
  ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h);

  for (const s of state.bgStars) {
    ctx.globalAlpha = 0.35 + 0.65 * Math.abs(Math.sin(s.twinkle));
    ctx.fillStyle = "#fff";
    ctx.beginPath(); ctx.arc(s.x, s.y, s.size * 0.5, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;

  ctx.fillStyle = "#2a0a4a"; ctx.fillRect(0, groundY, w, h - groundY);
  for (const t of state.groundTiles) {
    ctx.globalAlpha = 0.28; ctx.fillStyle = t.color;
    ctx.fillRect(t.x, groundY, BS - 2, h - groundY);
  }
  ctx.globalAlpha = 1;

  ctx.save();
  ctx.shadowColor = "#ff9ec4"; ctx.shadowBlur = 12;
  ctx.strokeStyle = "#ff9ec4"; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(0, groundY); ctx.lineTo(w, groundY); ctx.stroke();
  ctx.restore();

  for (const obs of state.obstacles) drawObstacle(ctx, obs, groundY);

  for (const p of state.particles) {
    ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
    ctx.fillStyle = p.color;
    ctx.beginPath(); ctx.arc(p.x, p.y, p.size * (p.life / p.maxLife), 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;

  // Only the player has a face
  if (state.phase === "playing" || state.deathAnimTimer < 0.45) {
    drawCuteBlock(ctx, PLAYER_X, state.playerY, skin, BS, rotation);
  }

  if (state.phase === "playing") {
    drawText(ctx, `✦ ${state.score}`, w / 2, 26, {
      font: "bold 20px Manrope, sans-serif",
      color: "#ffe0f5", shadow: "#ff6eb4", shadowBlur: 12, align: "center",
    });
  }

  if (state.phase === "dead" && state.deathAnimTimer > 0.3) {
    ctx.fillStyle = "rgba(20,5,40,0.74)"; ctx.fillRect(0, 0, w, h);
    drawText(ctx, "💔 oh no!", w / 2, h * 0.32, {
      font: `bold ${Math.min(w * 0.1, 44)}px Fraunces, serif`,
      color: "#ff9ec4", shadow: "#ff6eb4", shadowBlur: 20, align: "center",
    });
    drawText(ctx, `Score: ${state.score}`, w / 2, h * 0.46, {
      font: `bold ${Math.min(w * 0.065, 28)}px Manrope, sans-serif`,
      color: "#fff", align: "center",
    });
    drawText(ctx, `Best: ${Math.max(state.score, highScore)}`, w / 2, h * 0.54, {
      font: `${Math.min(w * 0.05, 20)}px Manrope, sans-serif`,
      color: "#ffb3d9", align: "center",
    });
    drawText(ctx, "Tap / Space to try again", w / 2, h * 0.66, {
      font: `${Math.min(w * 0.04, 17)}px Manrope, sans-serif`,
      color: "#cc88bb", align: "center",
    });
  }
}

function drawMenu(
  ctx: CanvasRenderingContext2D, w: number, h: number,
  skin: BlockSkin, rotRef: { current: number }, highScore: number,
) {
  const bg = ctx.createLinearGradient(0, 0, 0, h);
  bg.addColorStop(0, "#1a0a2e"); bg.addColorStop(1, "#2d1060");
  ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h);

  const t = performance.now() / 1000;
  for (let i = 0; i < 32; i++) {
    ctx.globalAlpha = 0.25 + 0.4 * Math.abs(Math.sin(t * 1.5 + i));
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.arc((i * 137.5 + t * 8) % w, (i * 97.3) % (h * 0.75), 1 + (i % 3) * 0.7, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  drawText(ctx, "CUBIworld", w / 2, h * 0.21, {
    font: `bold ${Math.min(w * 0.12, 52)}px Fraunces, serif`,
    color: "#ffe0f5", shadow: "#ff6eb4", shadowBlur: 24, align: "center",
  });
  drawText(ctx, "✨ jump · platform · survive ✨", w / 2, h * 0.31, {
    font: `${Math.min(w * 0.042, 17)}px Manrope, sans-serif`,
    color: "#cc88bb", align: "center",
  });

  const cs = Math.min(w * 0.14, 64);
  drawCuteBlock(ctx, w / 2 - cs / 2, h * 0.43 + Math.sin(t * 3) * 8 - cs / 2, skin, cs, rotRef.current);

  if (highScore > 0) {
    drawText(ctx, `✦ Best: ${highScore}`, w / 2, h * 0.63, {
      font: `${Math.min(w * 0.042, 17)}px Manrope, sans-serif`,
      color: "#ffb3d9", align: "center",
    });
  }
  ctx.globalAlpha = 0.75 + 0.25 * Math.abs(Math.sin(t * 2));
  drawText(ctx, "Tap / Space to play!", w / 2, h * 0.76, {
    font: `bold ${Math.min(w * 0.05, 20)}px Manrope, sans-serif`,
    color: "#ff9ec4", align: "center",
  });
  ctx.globalAlpha = 1;
  drawText(ctx, "🎨 pencil button to edit your cube", w / 2, h * 0.87, {
    font: `${Math.min(w * 0.038, 15)}px Manrope, sans-serif`,
    color: "#9966aa", align: "center",
  });
}

// ─── App component ────────────────────────────────────────────────────────────
export default function App() {
  const canvasRef    = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const stateRef     = useRef<GameState | null>(null);
  const skinRef      = useRef<BlockSkin>(loadSkin());
  const rotRef       = useRef(0);
  const nextObsTimer = useRef(rnd(1.2, 2.2));
  const timeSinceLast= useRef(0);
  const inputDown    = useRef(false);
  const inputWas     = useRef(false);
  const audioCtx     = useRef<AudioContext | null>(null);
  const sizeRef      = useRef({ w: 600, h: 400 });

  const [skin, setSkin]              = useState<BlockSkin>(loadSkin());
  const [showEditor, setShowEditor]  = useState(false);
  const [phase, setPhase]            = useState<GameState["phase"]>("menu");
  const [score, setScore]            = useState(0);
  const [highScore, updateHighScore] = useHighScore("cubiworld_highscore");

  // ── Resize ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    function resize() {
      const el = containerRef.current; if (!el) return;
      sizeRef.current = { w: el.clientWidth, h: el.clientHeight };
      const c = canvasRef.current;
      if (c) { c.width = el.clientWidth; c.height = el.clientHeight; }
    }
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);

  // ── Keyboard ────────────────────────────────────────────────────────────────
  useEffect(() => {
    const dn = (e: KeyboardEvent) => {
      if ([" ","ArrowUp","w","W"].includes(e.key)) { e.preventDefault(); inputDown.current = true; }
    };
    const up = (e: KeyboardEvent) => {
      if ([" ","ArrowUp","w","W"].includes(e.key)) { inputDown.current = false; inputWas.current = false; }
    };
    window.addEventListener("keydown", dn);
    window.addEventListener("keyup", up);
    return () => { window.removeEventListener("keydown", dn); window.removeEventListener("keyup", up); };
  }, []);

  // ── Audio ───────────────────────────────────────────────────────────────────
  function beep(freq: number, dur: number, type: OscillatorType = "sine") {
    try {
      if (!audioCtx.current) audioCtx.current = new AudioContext();
      const ac = audioCtx.current;
      const osc = ac.createOscillator(); const g = ac.createGain();
      osc.connect(g); g.connect(ac.destination);
      osc.type = type; osc.frequency.value = freq;
      g.gain.setValueAtTime(0.07, ac.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + dur);
      osc.start(); osc.stop(ac.currentTime + dur);
    } catch { /* ignore */ }
  }

  // ── Particles ───────────────────────────────────────────────────────────────
  function burst(state: GameState, x: number, y: number, n: number, colors: string[]) {
    for (let i = 0; i < n; i++) {
      const a = rnd(0, Math.PI * 2); const sp = rnd(80, 300);
      state.particles.push({
        x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 80,
        life: rnd(0.4, 0.9), maxLife: 0.9,
        color: colors[Math.floor(Math.random() * colors.length)] ?? "#ffb3d9",
        size: rnd(4, 9),
      });
    }
  }

  // ── Init ────────────────────────────────────────────────────────────────────
  const initGame = useCallback(() => {
    const { w, h } = sizeRef.current;
    const groundY = h * GROUND_Y_RATIO;
    stateRef.current = {
      phase: "playing",
      playerY: groundY - BS, playerVY: 0, isGrounded: true,
      score: 0, distance: 0, speed: INITIAL_SPEED,
      obstacles: [], particles: [],
      groundTiles: Array.from({ length: Math.ceil(w / BS) + 4 }, (_, i) => ({
        x: i * BS, color: CUTE_COLORS[i % CUTE_COLORS.length] ?? "#ffb3d9",
      })),
      bgStars: Array.from({ length: 40 }, () => ({
        x: rnd(0, w), y: rnd(0, groundY * 0.85),
        size: rnd(1, 3.5), twinkle: rnd(0, Math.PI * 2),
      })),
      jumpConsumed: false,
      deathAnimTimer: 0, flashTimer: 0,
    };
    rotRef.current = 0;
    nextObsTimer.current = rnd(1.2, 2.2);
    timeSinceLast.current = 0;
    inputWas.current = false;
    setScore(0); setPhase("playing");
  }, []);

  // ── Game loop ───────────────────────────────────────────────────────────────
  useGameLoop((dt) => {
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext("2d"); if (!ctx) return;
    const { w, h } = sizeRef.current;
    const groundY = h * GROUND_Y_RATIO;
    const state = stateRef.current;

    if (phase === "menu") {
      drawMenu(ctx, w, h, skinRef.current, rotRef, highScore);
      rotRef.current += dt * 1.4;
      return;
    }
    if (!state) return;

    if (state.phase === "dead") {
      state.deathAnimTimer += dt;
      if (state.flashTimer > 0) state.flashTimer = Math.max(0, state.flashTimer - dt * 4);
      drawScene(ctx, w, h, groundY, state, skinRef.current, rotRef.current, highScore);
      if (state.flashTimer > 0) {
        ctx.globalAlpha = state.flashTimer * 0.75;
        ctx.fillStyle = "#ff2266"; ctx.fillRect(0, 0, w, h);
        ctx.globalAlpha = 1;
      }
      return;
    }
    if (state.phase !== "playing") return;

    // ── Input ──
    const jumpTrigger = inputDown.current && !inputWas.current;
    if (inputDown.current) inputWas.current = true;
    if (jumpTrigger && state.isGrounded) {
      state.playerVY = JUMP_VEL; state.isGrounded = false;
      beep(520, 0.12, "square");
      burst(state, PLAYER_X + BS / 2, state.playerY + BS, 6, ["#ffb3d9","#ffe0b3","#b3d9ff"]);
    }

    // ── Physics ──
    state.playerVY += GRAVITY * dt;
    state.playerY  += state.playerVY * dt;

    // ── Spawn obstacles ──
    timeSinceLast.current += dt;
    if (timeSinceLast.current >= nextObsTimer.current) {
      const roll = Math.random();
      if (state.score > 5 && roll < 0.30) {
        state.obstacles.push(makeStaircase(w + 20, groundY));
      } else if (state.score > 2 && roll < 0.58) {
        state.obstacles.push(makePlatform(w + 20, groundY));
      } else {
        state.obstacles.push(makeSpikeGroup(w + 20, groundY));
      }
      timeSinceLast.current = 0;
      nextObsTimer.current = rnd(1.05, 2.0);
    }

    // ── Scroll ──
    for (const obs of state.obstacles) {
      obs.x -= state.speed * dt;
      if (obs.platforms)   for (const p of obs.platforms)    p.x -= state.speed * dt;
      if (obs.underSpikes) for (const s of obs.underSpikes)  s.x -= state.speed * dt;
    }
    state.obstacles = state.obstacles.filter(o => o.x + o.width > -80);

    // Ground tiles
    for (const t of state.groundTiles) t.x -= state.speed * dt;
    const ft = state.groundTiles[0]; const lt = state.groundTiles[state.groundTiles.length - 1];
    if (ft && ft.x < -BS) {
      state.groundTiles.push({ x: (lt?.x ?? 0) + BS, color: pick(CUTE_COLORS) });
      state.groundTiles.shift();
    }

    // Stars
    for (const s of state.bgStars) {
      s.twinkle += dt * 2; s.x -= state.speed * 0.07 * dt;
      if (s.x < 0) s.x += w;
    }

    // Particles
    for (const p of state.particles) {
      p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 400 * dt; p.life -= dt;
    }
    state.particles = state.particles.filter(p => p.life > 0);

    // Score
    state.distance += state.speed * dt;
    const ns = Math.floor(state.distance / 100);
    if (ns > state.score && ns % 10 === 0) { beep(660, 0.08); burst(state, w / 2, h * 0.3, 10, CUTE_COLORS); }
    state.score = ns;
    state.speed = INITIAL_SPEED + state.score * 0.6;

    // ── Collision ──
    const px = PLAYER_X;
    const py = state.playerY;
    const pad = 5;
    let killed = false;
    let landed = false;
    let landY  = groundY - BS;

    for (const obs of state.obstacles) {
      if (killed) break;

      if (obs.type === "spike" || obs.type === "spike_group") {
        const count = obs.spikeCount ?? 1;
        const sw = obs.width / count;
        for (let i = 0; i < count; i++) {
          const sx = obs.x + i * sw;
          const hit =
            px + pad < sx + sw - pad && px + BS - pad > sx + pad &&
            py + pad < obs.y + obs.height && py + BS - pad > obs.y + pad;
          if (hit) { killed = true; break; }
        }

      } else if (obs.type === "platform" || obs.type === "staircase") {
        // Under-spikes = instant death
        if (obs.underSpikes) {
          for (const sp of obs.underSpikes) {
            const hit =
              px + pad < sp.x + sp.width - pad && px + BS - pad > sp.x + pad &&
              py + pad < sp.y + sp.height       && py + BS - pad > sp.y;
            if (hit) { killed = true; break; }
          }
        }
        if (killed) break;

        // Platform tiles — land on top, die on sides
        if (obs.platforms) {
          for (const p of obs.platforms) {
            const overlapX = px + BS - pad > p.x + pad && px + pad < p.x + p.width - pad;
            if (!overlapX) continue;

            const prevBottom = (state.playerY - state.playerVY * dt) + BS;
            const currBottom = state.playerY + BS;

            if (prevBottom <= p.y + 6 && currBottom >= p.y && state.playerVY >= 0) {
              // Land on top
              if (!landed || p.y - BS < landY) { landed = true; landY = p.y - BS; }
            } else {
              // Side collision
              const inV = py + BS - pad > p.y + pad && py + pad < p.y + p.height - pad;
              if (inV) { killed = true; break; }
            }
          }
        }
      }
      if (killed) break;
    }

    // ── Resolve ──
    if (killed) {
      state.phase = "dead"; state.flashTimer = 1;
      updateHighScore(state.score); setPhase("dead");
      beep(200, 0.35, "sawtooth");
      burst(state, px + BS / 2, py + BS / 2, 22,
        [skinRef.current.bodyColor, skinRef.current.outlineColor, "#fff", "#ffb3d9"]);
    } else if (landed) {
      state.playerY = landY; state.playerVY = 0; state.isGrounded = true;
    } else if (state.playerY >= groundY - BS) {
      state.playerY = groundY - BS; state.playerVY = 0; state.isGrounded = true;
    } else {
      state.isGrounded = false;
    }

    // Rotation
    if (!state.isGrounded) {
      rotRef.current += dt * 5.5;
    } else {
      const target = Math.round(rotRef.current / (Math.PI / 2)) * (Math.PI / 2);
      rotRef.current += (target - rotRef.current) * Math.min(1, dt * 18);
    }

    drawScene(ctx, w, h, groundY, state, skinRef.current, rotRef.current, highScore);
    setScore(state.score);
  }, phase === "menu");

  // ── Tap ─────────────────────────────────────────────────────────────────────
  function handleTap() {
    if (showEditor) return;
    if (phase === "menu") { initGame(); return; }
    if (phase === "playing") {
      inputDown.current = true;
      setTimeout(() => { inputDown.current = false; inputWas.current = false; }, 80);
      return;
    }
    if (phase === "dead") {
      const s = stateRef.current;
      if (s && s.deathAnimTimer > 0.3) initGame();
    }
  }

  function handleSkinChange(ns: BlockSkin) { setSkin(ns); skinRef.current = ns; saveSkin(ns); }

  return (
    <GameShell topbar={<GameTopbar title="CUBIworld" score={score} />}>
      <div
        ref={containerRef}
        className="relative w-full h-full overflow-hidden"
        style={{ cursor: "pointer", userSelect: "none", touchAction: "none" }}
        onClick={handleTap}
        onTouchStart={(e) => {
          e.preventDefault();
          if ((e.target as HTMLElement).closest("[data-edit-btn]")) return;
          handleTap();
        }}
      >
        <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" style={{ display: "block" }} />

        <button
          data-edit-btn="true"
          onClick={(e) => { e.stopPropagation(); setShowEditor(true); }}
          className="absolute flex items-center justify-center rounded-2xl font-bold"
          style={{
            bottom: 16, right: 16, width: 52, height: 52,
            background: "linear-gradient(135deg,#ff6eb4cc,#ff9ec4cc)",
            border: "2px solid #ff9ec4", backdropFilter: "blur(8px)",
            fontSize: 22, cursor: "pointer", boxShadow: "0 4px 16px #ff6eb455",
            zIndex: 10, color: "#fff",
          }}
          title="Edit your cube"
        >🎨</button>

        {phase === "menu" && (
          <div
            className="absolute top-3 left-3 rounded-xl px-3 py-1 text-xs font-bold"
            style={{
              background: "rgba(255,110,180,0.18)", border: "1px solid #ff9ec455",
              color: "#ff9ec4", fontFamily: "Manrope, sans-serif", pointerEvents: "none",
            }}
          >SPACE / TAP to jump</div>
        )}
      </div>

      {showEditor && (
        <BlockEditor skin={skin} onChange={handleSkinChange} onClose={() => setShowEditor(false)} />
      )}
    </GameShell>
  );
}
