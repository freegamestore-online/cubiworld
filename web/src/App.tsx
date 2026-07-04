import { useRef, useState, useCallback, useEffect } from "react";
import { GameShell, GameTopbar } from "@freegamestore/games";
import { useGameLoop } from "./hooks/useGameLoop";
import { useHighScore } from "./hooks/useHighScore";
import { drawCuteBlock } from "./lib/drawBlock";
import { drawText } from "./lib/canvas";
import BlockEditor from "./components/BlockEditor";
import type { BlockSkin, GameState, Obstacle, StepTile } from "./types";
import { DEFAULT_SKIN } from "./types";

// ─── Constants ────────────────────────────────────────────────────────────────
const GROUND_Y_RATIO = 0.78;
const BS = 48; // block size
const GRAVITY = 2200;
const JUMP_VEL = -720;
const INITIAL_SPEED = 280;
const PLAYER_X = 80;

const CUTE_COLORS = ["#ffb3d9", "#b3d9ff", "#b3ffda", "#ffe0b3", "#e0b3ff", "#fffdb3"];
const STEP_COLORS = ["#b3d9ff", "#b3ffda", "#ffe0b3", "#e0b3ff", "#c8f5c8"];
const SPIKE_COLORS = ["#ff7eb3", "#ff6baa", "#ff9ec4", "#ff5599", "#ffaacc"];

function rnd(a: number, b: number) {
  return a + Math.random() * (b - a);
}

function loadSkin(): BlockSkin {
  try {
    const raw = localStorage.getItem("cubiworld_skin");
    if (raw) return JSON.parse(raw) as BlockSkin;
  } catch { /* ignore */ }
  return { ...DEFAULT_SKIN };
}
function saveSkin(s: BlockSkin) {
  localStorage.setItem("cubiworld_skin", JSON.stringify(s));
}

// ─── Obstacle factories ───────────────────────────────────────────────────────
function makeSpikeGroup(startX: number, groundY: number): Obstacle {
  const count = Math.random() < 0.4 ? 1 : Math.random() < 0.6 ? 2 : 3;
  const sw = BS * 0.72;
  const sh = BS * 0.92;
  const color = SPIKE_COLORS[Math.floor(Math.random() * SPIKE_COLORS.length)] ?? "#ff7eb3";
  return {
    x: startX,
    y: groundY - sh,
    width: sw * count,
    height: sh,
    type: count === 1 ? "spike" : "spike_group",
    color,
    spikeCount: count,
  };
}

function makeSteps(startX: number, groundY: number): Obstacle {
  const stepCount = Math.random() < 0.5 ? 2 : 3;
  const color = STEP_COLORS[Math.floor(Math.random() * STEP_COLORS.length)] ?? "#b3d9ff";
  const steps: StepTile[] = [];
  for (let i = 0; i < stepCount; i++) {
    steps.push({
      x: startX + i * BS,
      y: groundY - BS * (i + 1),
      width: BS,
      height: BS * (i + 1),
    });
  }
  return {
    x: startX,
    y: groundY - BS * stepCount,
    width: BS * stepCount,
    height: BS * stepCount,
    type: "steps",
    color,
    steps,
  };
}

function lighten(hex: string, amt: number): string {
  const c = hex.replace("#", "");
  const r = Math.min(255, parseInt(c.substring(0, 2), 16) + Math.round(amt * 255));
  const g = Math.min(255, parseInt(c.substring(2, 4), 16) + Math.round(amt * 255));
  const b = Math.min(255, parseInt(c.substring(4, 6), 16) + Math.round(amt * 255));
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, r: number,
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

// ─── Obstacle drawing (NO faces on obstacles) ─────────────────────────────────
function drawObstacle(ctx: CanvasRenderingContext2D, obs: Obstacle, groundY: number) {
  ctx.save();

  if (obs.type === "spike" || obs.type === "spike_group") {
    const count = obs.spikeCount ?? 1;
    const sw = obs.width / count;
    const sh = obs.height;

    for (let i = 0; i < count; i++) {
      const sx = obs.x + i * sw;
      const sy = obs.y;

      // Shadow
      ctx.globalAlpha = 0.18;
      ctx.fillStyle = "#000";
      ctx.beginPath();
      ctx.moveTo(sx + sw / 2 + 3, sy + 3);
      ctx.lineTo(sx + sw + 3, sy + sh + 3);
      ctx.lineTo(sx + 3, sy + sh + 3);
      ctx.closePath();
      ctx.fill();
      ctx.globalAlpha = 1;

      // Gradient body
      const grad = ctx.createLinearGradient(sx, sy, sx + sw, sy + sh);
      grad.addColorStop(0, lighten(obs.color, 0.3));
      grad.addColorStop(1, obs.color);
      ctx.fillStyle = grad;
      ctx.shadowColor = obs.color;
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.moveTo(sx + sw / 2, sy);
      ctx.lineTo(sx + sw, sy + sh);
      ctx.lineTo(sx, sy + sh);
      ctx.closePath();
      ctx.fill();

      // Outline
      ctx.shadowBlur = 0;
      ctx.strokeStyle = "rgba(255,255,255,0.4)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(sx + sw / 2, sy);
      ctx.lineTo(sx + sw, sy + sh);
      ctx.lineTo(sx, sy + sh);
      ctx.closePath();
      ctx.stroke();

      // Highlight
      ctx.strokeStyle = "rgba(255,255,255,0.55)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(sx + sw / 2, sy + sh * 0.08);
      ctx.lineTo(sx + sw * 0.62, sy + sh * 0.72);
      ctx.stroke();
    }

    // Base line
    ctx.strokeStyle = obs.color;
    ctx.lineWidth = 2;
    ctx.shadowColor = obs.color;
    ctx.shadowBlur = 6;
    ctx.beginPath();
    ctx.moveTo(obs.x, groundY);
    ctx.lineTo(obs.x + obs.width, groundY);
    ctx.stroke();

  } else if (obs.type === "steps" && obs.steps) {
    for (let i = 0; i < obs.steps.length; i++) {
      const step = obs.steps[i];
      if (!step) continue;
      drawStepTile(ctx, step.x, step.y, step.width, step.height, obs.color, i);
    }
  }

  ctx.restore();
}

function drawStepTile(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number,
  color: string,
  idx: number,
) {
  const r = 7;
  const lighter = lighten(color, 0.25 + idx * 0.08);

  // Shadow
  ctx.globalAlpha = 0.18;
  ctx.fillStyle = "#000";
  roundRect(ctx, x + 3, y + 3, w, h, r);
  ctx.fill();
  ctx.globalAlpha = 1;

  // Body gradient
  const grad = ctx.createLinearGradient(x, y, x, y + h);
  grad.addColorStop(0, lighter);
  grad.addColorStop(1, color);
  ctx.fillStyle = grad;
  ctx.shadowColor = color;
  ctx.shadowBlur = 8;
  roundRect(ctx, x, y, w, h, r);
  ctx.fill();

  // Outline
  ctx.shadowBlur = 0;
  ctx.strokeStyle = "rgba(255,255,255,0.35)";
  ctx.lineWidth = 2;
  roundRect(ctx, x, y, w, h, r);
  ctx.stroke();

  // Top highlight
  ctx.fillStyle = "rgba(255,255,255,0.18)";
  roundRect(ctx, x + 4, y + 4, w - 8, h * 0.28, r * 0.5);
  ctx.fill();

  // Grid lines on tall steps
  if (h > BS + 4) {
    ctx.strokeStyle = "rgba(255,255,255,0.1)";
    ctx.lineWidth = 1;
    for (let row = 1; row * BS < h; row++) {
      ctx.beginPath();
      ctx.moveTo(x + 4, y + row * BS);
      ctx.lineTo(x + w - 4, y + row * BS);
      ctx.stroke();
    }
  }
}

// ─── Menu draw ────────────────────────────────────────────────────────────────
function drawMenu(
  ctx: CanvasRenderingContext2D,
  w: number, h: number,
  currentSkin: BlockSkin,
  rotRef: { current: number },
  highScore: number,
) {
  const bg = ctx.createLinearGradient(0, 0, 0, h);
  bg.addColorStop(0, "#1a0a2e");
  bg.addColorStop(1, "#2d1060");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);

  const t = performance.now() / 1000;
  for (let i = 0; i < 32; i++) {
    const sx = (i * 137.5 + t * 8) % w;
    const sy = (i * 97.3) % (h * 0.75);
    ctx.globalAlpha = 0.25 + 0.4 * Math.abs(Math.sin(t * 1.5 + i));
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.arc(sx, sy, 1 + (i % 3) * 0.7, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  drawText(ctx, "CUBIworld", w / 2, h * 0.21, {
    font: `bold ${Math.min(w * 0.12, 52)}px Fraunces, serif`,
    color: "#ffe0f5", shadow: "#ff6eb4", shadowBlur: 24, align: "center",
  });
  drawText(ctx, "✨ cute geometry dash ✨", w / 2, h * 0.31, {
    font: `${Math.min(w * 0.045, 18)}px Manrope, sans-serif`,
    color: "#cc88bb", align: "center",
  });

  const cubeSize = Math.min(w * 0.14, 64);
  const bounce = Math.sin(t * 3) * 8;
  drawCuteBlock(ctx, w / 2 - cubeSize / 2, h * 0.43 + bounce - cubeSize / 2, currentSkin, cubeSize, rotRef.current);

  if (highScore > 0) {
    drawText(ctx, `✦ Best: ${highScore}`, w / 2, h * 0.63, {
      font: `${Math.min(w * 0.042, 17)}px Manrope, sans-serif`,
      color: "#ffb3d9", align: "center",
    });
  }

  const pulse = 0.75 + 0.25 * Math.abs(Math.sin(t * 2));
  ctx.globalAlpha = pulse;
  drawText(ctx, "Tap / Space to play!", w / 2, h * 0.76, {
    font: `bold ${Math.min(w * 0.05, 20)}px Manrope, sans-serif`,
    color: "#ff9ec4", align: "center",
  });
  ctx.globalAlpha = 1;

  drawText(ctx, "🎨 tap the pencil to edit your cube", w / 2, h * 0.87, {
    font: `${Math.min(w * 0.038, 15)}px Manrope, sans-serif`,
    color: "#9966aa", align: "center",
  });
}

// ─── Scene draw ───────────────────────────────────────────────────────────────
function drawScene(
  ctx: CanvasRenderingContext2D,
  w: number, h: number, groundY: number,
  state: GameState,
  currentSkin: BlockSkin,
  rotation: number,
  highScore: number,
) {
  // Background
  const bg = ctx.createLinearGradient(0, 0, 0, h);
  bg.addColorStop(0, "#1a0a2e");
  bg.addColorStop(0.7, "#2d1060");
  bg.addColorStop(1, "#1a0a2e");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);

  // Stars
  for (const s of state.bgStars) {
    ctx.globalAlpha = 0.35 + 0.65 * Math.abs(Math.sin(s.twinkle));
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.size * 0.5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // Ground fill
  ctx.fillStyle = "#2a0a4a";
  ctx.fillRect(0, groundY, w, h - groundY);

  // Ground tile strips
  for (const t of state.groundTiles) {
    ctx.globalAlpha = 0.32;
    ctx.fillStyle = t.color;
    ctx.fillRect(t.x, groundY, BS - 2, h - groundY);
  }
  ctx.globalAlpha = 1;

  // Ground glow line
  ctx.save();
  ctx.shadowColor = "#ff9ec4"; ctx.shadowBlur = 12;
  ctx.strokeStyle = "#ff9ec4"; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(0, groundY); ctx.lineTo(w, groundY); ctx.stroke();
  ctx.restore();

  // Obstacles (no faces)
  for (const obs of state.obstacles) {
    drawObstacle(ctx, obs, groundY);
  }

  // Particles
  for (const p of state.particles) {
    ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size * (p.life / p.maxLife), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // Player cube — ONLY the player has a face
  if (state.phase === "playing" || state.deathAnimTimer < 0.45) {
    drawCuteBlock(ctx, PLAYER_X, state.playerY, currentSkin, BS, rotation);
  }

  // Score HUD
  if (state.phase === "playing") {
    drawText(ctx, `✦ ${state.score}`, w / 2, 26, {
      font: "bold 20px Manrope, sans-serif",
      color: "#ffe0f5", shadow: "#ff6eb4", shadowBlur: 12, align: "center",
    });
  }

  // Dead overlay
  if (state.phase === "dead" && state.deathAnimTimer > 0.3) {
    ctx.fillStyle = "rgba(20,5,40,0.74)";
    ctx.fillRect(0, 0, w, h);
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

// ─── App ──────────────────────────────────────────────────────────────────────
export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const stateRef = useRef<GameState | null>(null);
  const skinRef = useRef<BlockSkin>(loadSkin());
  const rotationRef = useRef(0);
  const nextObstacleTimerRef = useRef(rnd(1.2, 2.2));
  const timeSinceLastRef = useRef(0);
  const inputPressedRef = useRef(false);
  const inputWasDownRef = useRef(false);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const sizeRef = useRef({ w: 600, h: 400 });

  const [skin, setSkin] = useState<BlockSkin>(loadSkin());
  const [showEditor, setShowEditor] = useState(false);
  const [phase, setPhase] = useState<GameState["phase"]>("menu");
  const [score, setScore] = useState(0);
  const [highScore, updateHighScore] = useHighScore("cubiworld_highscore");

  // ── Resize ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    function resize() {
      const el = containerRef.current;
      if (!el) return;
      sizeRef.current = { w: el.clientWidth, h: el.clientHeight };
      const c = canvasRef.current;
      if (c) { c.width = el.clientWidth; c.height = el.clientHeight; }
    }
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);

  // ── Audio ──────────────────────────────────────────────────────────────────
  function beep(freq: number, dur: number, type: OscillatorType = "sine") {
    try {
      if (!audioCtxRef.current) audioCtxRef.current = new AudioContext();
      const ac = audioCtxRef.current;
      const osc = ac.createOscillator();
      const g = ac.createGain();
      osc.connect(g); g.connect(ac.destination);
      osc.type = type; osc.frequency.value = freq;
      g.gain.setValueAtTime(0.07, ac.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + dur);
      osc.start(); osc.stop(ac.currentTime + dur);
    } catch { /* ignore */ }
  }

  // ── Init ───────────────────────────────────────────────────────────────────
  const initGame = useCallback(() => {
    const { w, h } = sizeRef.current;
    const groundY = h * GROUND_Y_RATIO;
    stateRef.current = {
      phase: "playing",
      playerY: groundY - BS,
      playerVY: 0,
      isGrounded: true,
      groundedOnStep: false,
      score: 0,
      distance: 0,
      speed: INITIAL_SPEED,
      obstacles: [],
      particles: [],
      groundTiles: Array.from({ length: Math.ceil(w / BS) + 4 }, (_, i) => ({
        x: i * BS,
        color: CUTE_COLORS[i % CUTE_COLORS.length] ?? "#ffb3d9",
      })),
      bgStars: Array.from({ length: 40 }, () => ({
        x: rnd(0, w), y: rnd(0, groundY * 0.85),
        size: rnd(1, 3.5), twinkle: rnd(0, Math.PI * 2),
      })),
      jumpPressed: false,
      jumpConsumed: false,
      deathAnimTimer: 0,
      flashTimer: 0,
    };
    rotationRef.current = 0;
    nextObstacleTimerRef.current = rnd(1.2, 2.2);
    timeSinceLastRef.current = 0;
    inputWasDownRef.current = false;
    setScore(0);
    setPhase("playing");
  }, []);

  // ── Keyboard ───────────────────────────────────────────────────────────────
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if ([" ", "ArrowUp", "w", "W"].includes(e.key)) {
        e.preventDefault();
        inputPressedRef.current = true;
      }
    };
    const up = (e: KeyboardEvent) => {
      if ([" ", "ArrowUp", "w", "W"].includes(e.key)) {
        inputPressedRef.current = false;
        inputWasDownRef.current = false;
      }
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => { window.removeEventListener("keydown", down); window.removeEventListener("keyup", up); };
  }, []);

  // ── Particles ──────────────────────────────────────────────────────────────
  function burst(state: GameState, x: number, y: number, n: number, colors: string[]) {
    for (let i = 0; i < n; i++) {
      const a = rnd(0, Math.PI * 2);
      const sp = rnd(80, 300);
      state.particles.push({
        x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 80,
        life: rnd(0.4, 0.9), maxLife: 0.9,
        color: colors[Math.floor(Math.random() * colors.length)] ?? "#ffb3d9",
        size: rnd(4, 9),
      });
    }
  }

  // ── Game loop ──────────────────────────────────────────────────────────────
  useGameLoop((dt) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const { w, h } = sizeRef.current;
    const groundY = h * GROUND_Y_RATIO;
    const state = stateRef.current;

    if (phase === "menu") {
      drawMenu(ctx, w, h, skinRef.current, rotationRef, highScore);
      rotationRef.current += dt * 1.4;
      return;
    }
    if (!state) return;

    // Dead animation
    if (state.phase === "dead") {
      state.deathAnimTimer += dt;
      if (state.flashTimer > 0) state.flashTimer = Math.max(0, state.flashTimer - dt * 4);
      drawScene(ctx, w, h, groundY, state, skinRef.current, rotationRef.current, highScore);
      if (state.flashTimer > 0) {
        ctx.globalAlpha = state.flashTimer * 0.75;
        ctx.fillStyle = "#ff2266";
        ctx.fillRect(0, 0, w, h);
        ctx.globalAlpha = 1;
      }
      return;
    }

    if (state.phase !== "playing") return;

    // ── Input ──
    const jumpTrigger = inputPressedRef.current && !inputWasDownRef.current;
    if (inputPressedRef.current) inputWasDownRef.current = true;

    if (jumpTrigger && state.isGrounded) {
      state.playerVY = JUMP_VEL;
      state.isGrounded = false;
      state.groundedOnStep = false;
      beep(520, 0.12, "square");
      burst(state, PLAYER_X + BS / 2, state.playerY + BS, 6, ["#ffb3d9", "#ffe0b3", "#b3d9ff"]);
    }

    // ── Physics ──
    state.playerVY += GRAVITY * dt;
    state.playerY += state.playerVY * dt;

    // ── Spawn obstacles ──
    timeSinceLastRef.current += dt;
    if (timeSinceLastRef.current >= nextObstacleTimerRef.current) {
      const useSteps = state.score > 3 && Math.random() < 0.38;
      if (useSteps) {
        state.obstacles.push(makeSteps(w + 20, groundY));
      } else {
        state.obstacles.push(makeSpikeGroup(w + 20, groundY));
      }
      timeSinceLastRef.current = 0;
      nextObstacleTimerRef.current = rnd(1.1, 2.1);
    }

    // ── Move obstacles ──
    for (const obs of state.obstacles) {
      obs.x -= state.speed * dt;
      if (obs.steps) {
        for (const s of obs.steps) s.x -= state.speed * dt;
      }
    }
    state.obstacles = state.obstacles.filter((o) => o.x + o.width > -60);

    // ── Ground tiles ──
    for (const t of state.groundTiles) t.x -= state.speed * dt;
    const firstTile = state.groundTiles[0];
    const lastTile = state.groundTiles[state.groundTiles.length - 1];
    if (firstTile && firstTile.x < -BS) {
      state.groundTiles.push({
        x: (lastTile?.x ?? 0) + BS,
        color: CUTE_COLORS[Math.floor(Math.random() * CUTE_COLORS.length)] ?? "#ffb3d9",
      });
      state.groundTiles.shift();
    }

    // ── Stars ──
    for (const s of state.bgStars) {
      s.twinkle += dt * 2;
      s.x -= state.speed * 0.07 * dt;
      if (s.x < 0) s.x += w;
    }

    // ── Particles ──
    for (const p of state.particles) {
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.vy += 400 * dt; p.life -= dt;
    }
    state.particles = state.particles.filter((p) => p.life > 0);

    // ── Score & speed ──
    state.distance += state.speed * dt;
    const newScore = Math.floor(state.distance / 100);
    if (newScore > state.score && newScore % 10 === 0) {
      beep(660, 0.08);
      burst(state, w / 2, h * 0.3, 10, CUTE_COLORS);
    }
    state.score = newScore;
    state.speed = INITIAL_SPEED + state.score * 0.7;

    // ── Collision detection ──
    const px = PLAYER_X;
    const py = state.playerY;
    const pad = 5;
    let landedOnStep = false;
    let stepLandY = groundY - BS;
    let killed = false;

    for (const obs of state.obstacles) {
      if (killed) break;

      if (obs.type === "steps" && obs.steps) {
        for (const step of obs.steps) {
          const overlapX =
            px + BS - pad > step.x + pad &&
            px + pad < step.x + step.width - pad;

          if (overlapX) {
            // Landing on top of step
            const prevBottom = (py - state.playerVY * dt) + BS;
            const currBottom = py + BS;
            if (prevBottom <= step.y + 4 && currBottom >= step.y && state.playerVY >= 0) {
              landedOnStep = true;
              if (step.y - BS < stepLandY || !landedOnStep) stepLandY = step.y - BS;
            } else {
              // Side collision — kill
              const hitSide =
                py + pad < step.y + step.height - pad &&
                py + BS - pad > step.y + pad;
              if (hitSide) {
                killed = true;
                break;
              }
            }
          }
        }
      } else {
        // Spike — death on any contact
        const hit =
          px + pad < obs.x + obs.width - pad &&
          px + BS - pad > obs.x + pad &&
          py + pad < obs.y + obs.height - pad &&
          py + BS - pad > obs.y + pad;
        if (hit) { killed = true; break; }
      }
    }

    if (killed) {
      state.phase = "dead";
      state.flashTimer = 1;
      updateHighScore(state.score);
      setPhase("dead");
      beep(200, 0.35, "sawtooth");
      burst(state, px + BS / 2, py + BS / 2, 22, [
        skinRef.current.bodyColor, skinRef.current.outlineColor, "#fff", "#ffb3d9",
      ]);
    }

    // ── Ground / step resolution ──
    if (!killed) {
      if (landedOnStep) {
        state.playerY = stepLandY;
        state.playerVY = 0;
        state.isGrounded = true;
        state.groundedOnStep = true;
      } else if (state.playerY >= groundY - BS) {
        state.playerY = groundY - BS;
        state.playerVY = 0;
        state.isGrounded = true;
        state.groundedOnStep = false;
      } else {
        // Check if still standing on a step
        if (state.groundedOnStep) {
          let stillOn = false;
          for (const obs of state.obstacles) {
            if (obs.type === "steps" && obs.steps) {
              for (const step of obs.steps) {
                const overlapX = px + BS - pad > step.x + pad && px + pad < step.x + step.width - pad;
                const atTop = Math.abs((state.playerY + BS) - step.y) < 4;
                if (overlapX && atTop) { stillOn = true; break; }
              }
            }
            if (stillOn) break;
          }
          if (!stillOn) { state.isGrounded = false; state.groundedOnStep = false; }
        } else {
          state.isGrounded = false;
        }
      }
    }

    // ── Rotation ──
    if (!state.isGrounded) {
      rotationRef.current += dt * 5.5;
    } else {
      const target = Math.round(rotationRef.current / (Math.PI / 2)) * (Math.PI / 2);
      rotationRef.current += (target - rotationRef.current) * Math.min(1, dt * 18);
    }

    drawScene(ctx, w, h, groundY, state, skinRef.current, rotationRef.current, highScore);
    setScore(state.score);
  }, phase === "menu");

  // ── Tap handler ────────────────────────────────────────────────────────────
  function handleTap() {
    if (showEditor) return;
    if (phase === "menu") { initGame(); return; }
    if (phase === "playing") {
      inputPressedRef.current = true;
      setTimeout(() => { inputPressedRef.current = false; inputWasDownRef.current = false; }, 80);
      return;
    }
    if (phase === "dead") {
      const s = stateRef.current;
      if (s && s.deathAnimTimer > 0.3) initGame();
    }
  }

  function handleSkinChange(newSkin: BlockSkin) {
    setSkin(newSkin);
    skinRef.current = newSkin;
    saveSkin(newSkin);
  }

  return (
    <GameShell topbar={<GameTopbar title="CUBIworld" score={score} />}>
      <div
        ref={containerRef}
        className="relative w-full h-full overflow-hidden"
        style={{ cursor: "pointer", userSelect: "none", touchAction: "none" }}
        onClick={handleTap}
        onTouchStart={(e) => {
          e.preventDefault();
          const target = e.target as HTMLElement;
          if (target.closest("[data-edit-btn]")) return;
          handleTap();
        }}
      >
        <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" style={{ display: "block" }} />

        {/* Edit button */}
        <button
          data-edit-btn="true"
          onClick={(e) => { e.stopPropagation(); setShowEditor(true); }}
          className="absolute flex items-center justify-center rounded-2xl font-bold"
          style={{
            bottom: 16, right: 16, width: 52, height: 52,
            background: "linear-gradient(135deg, #ff6eb4cc, #ff9ec4cc)",
            border: "2px solid #ff9ec4",
            backdropFilter: "blur(8px)",
            fontSize: 22, cursor: "pointer",
            boxShadow: "0 4px 16px #ff6eb455",
            zIndex: 10, color: "#fff",
          }}
          title="Edit your cube"
        >🎨</button>

        {phase === "menu" && (
          <div
            className="absolute top-3 left-3 rounded-xl px-3 py-1 text-xs font-bold"
            style={{
              background: "rgba(255,110,180,0.18)",
              border: "1px solid #ff9ec455",
              color: "#ff9ec4",
              fontFamily: "Manrope, sans-serif",
              pointerEvents: "none",
            }}
          >
            SPACE / TAP to jump
          </div>
        )}
      </div>

      {showEditor && (
        <BlockEditor skin={skin} onChange={handleSkinChange} onClose={() => setShowEditor(false)} />
      )}
    </GameShell>
  );
}
