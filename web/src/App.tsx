import { useRef, useState, useCallback, useEffect } from "react";
import { GameShell, GameTopbar } from "@freegamestore/games";
import { useGameLoop } from "./hooks/useGameLoop";
import { useHighScore } from "./hooks/useHighScore";
import { drawCuteBlock } from "./lib/drawBlock";
import { drawText } from "./lib/canvas";
import BlockEditor from "./components/BlockEditor";
import type { BlockSkin, GameState, Obstacle, Particle } from "./types";
import { DEFAULT_SKIN } from "./types";

// ─── Constants ────────────────────────────────────────────────────────────────
const GROUND_Y_RATIO = 0.78;
const BLOCK_SIZE = 48;
const GRAVITY = 2200;
const JUMP_VEL = -720;
const INITIAL_SPEED = 280;
const SPEED_INCREMENT = 18;
const OBSTACLE_INTERVAL_MIN = 1.1;
const OBSTACLE_INTERVAL_MAX = 2.2;

const CUTE_COLORS = ["#ffb3d9", "#b3d9ff", "#b3ffda", "#ffe0b3", "#e0b3ff", "#fffdb3"];
const OBSTACLE_COLORS = ["#ff7eb3", "#7eb3ff", "#7effd4", "#ffcc7e", "#cc7eff"];

function randomBetween(a: number, b: number) {
  return a + Math.random() * (b - a);
}

function loadSkin(): BlockSkin {
  try {
    const raw = localStorage.getItem("cubiworld_skin");
    if (raw) return JSON.parse(raw) as BlockSkin;
  } catch { /* ignore */ }
  return { ...DEFAULT_SKIN };
}

function saveSkin(skin: BlockSkin) {
  localStorage.setItem("cubiworld_skin", JSON.stringify(skin));
}

// ─── App ──────────────────────────────────────────────────────────────────────
export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const stateRef = useRef<GameState | null>(null);
  const skinRef = useRef<BlockSkin>(loadSkin());
  const rotationRef = useRef(0);
  const nextObstacleRef = useRef(randomBetween(OBSTACLE_INTERVAL_MIN, OBSTACLE_INTERVAL_MAX));
  const timeSinceObstacleRef = useRef(0);
  const inputPressedRef = useRef(false);
  const inputWasDownRef = useRef(false);
  const audioCtxRef = useRef<AudioContext | null>(null);

  const [skin, setSkin] = useState<BlockSkin>(loadSkin());
  const [showEditor, setShowEditor] = useState(false);
  const [phase, setPhase] = useState<GameState["phase"]>("menu");
  const [score, setScore] = useState(0);
  const [highScore, updateHighScore] = useHighScore("cubiworld_highscore");

  // ── Canvas sizing ──────────────────────────────────────────────────────────
  const sizeRef = useRef({ w: 600, h: 400 });

  useEffect(() => {
    function resize() {
      const el = containerRef.current;
      if (!el) return;
      const w = el.clientWidth;
      const h = el.clientHeight;
      sizeRef.current = { w, h };
      const canvas = canvasRef.current;
      if (canvas) {
        canvas.width = w;
        canvas.height = h;
      }
    }
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);

  // ── Audio ──────────────────────────────────────────────────────────────────
  function playBeep(freq: number, duration: number, type: OscillatorType = "sine") {
    try {
      if (!audioCtxRef.current) audioCtxRef.current = new AudioContext();
      const ctx = audioCtxRef.current;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = type;
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + duration);
    } catch { /* ignore */ }
  }

  // ── Init game state ────────────────────────────────────────────────────────
  const initGame = useCallback(() => {
    const { w, h } = sizeRef.current;
    const groundY = h * GROUND_Y_RATIO;
    const stars = Array.from({ length: 40 }, () => ({
      x: randomBetween(0, w),
      y: randomBetween(0, groundY * 0.85),
      size: randomBetween(1, 3.5),
      twinkle: randomBetween(0, Math.PI * 2),
    }));
    const groundTiles = Array.from({ length: Math.ceil(w / BLOCK_SIZE) + 4 }, (_, i) => ({
      x: i * BLOCK_SIZE,
      color: CUTE_COLORS[i % CUTE_COLORS.length] ?? "#ffb3d9",
    }));
    stateRef.current = {
      phase: "playing",
      playerY: groundY - BLOCK_SIZE,
      playerVY: 0,
      isGrounded: true,
      score: 0,
      distance: 0,
      speed: INITIAL_SPEED,
      obstacles: [],
      particles: [],
      groundTiles,
      bgStars: stars,
      jumpPressed: false,
      jumpConsumed: false,
      deathAnimTimer: 0,
      flashTimer: 0,
    };
    rotationRef.current = 0;
    nextObstacleRef.current = randomBetween(OBSTACLE_INTERVAL_MIN, OBSTACLE_INTERVAL_MAX);
    timeSinceObstacleRef.current = 0;
    setScore(0);
    setPhase("playing");
  }, []);

  // ── Spawn obstacle ─────────────────────────────────────────────────────────
  function spawnObstacle(state: GameState) {
    const { w, h } = sizeRef.current;
    const groundY = h * GROUND_Y_RATIO;
    const type = Math.random() < 0.5 ? "spike" : Math.random() < 0.5 ? "block" : "tall";
    const color = OBSTACLE_COLORS[Math.floor(Math.random() * OBSTACLE_COLORS.length)] ?? "#ff7eb3";

    let obs: Obstacle;
    if (type === "spike") {
      obs = { x: w + 20, y: groundY - BLOCK_SIZE * 0.9, width: BLOCK_SIZE * 0.7, height: BLOCK_SIZE * 0.9, type, color };
    } else if (type === "block") {
      obs = { x: w + 20, y: groundY - BLOCK_SIZE, width: BLOCK_SIZE, height: BLOCK_SIZE, type, color };
    } else {
      obs = { x: w + 20, y: groundY - BLOCK_SIZE * 1.8, width: BLOCK_SIZE * 0.85, height: BLOCK_SIZE * 1.8, type, color };
    }
    state.obstacles.push(obs);
  }

  // ── Particles ──────────────────────────────────────────────────────────────
  function spawnParticles(state: GameState, x: number, y: number, count: number, colors: string[]) {
    for (let i = 0; i < count; i++) {
      const angle = randomBetween(0, Math.PI * 2);
      const speed = randomBetween(80, 320);
      state.particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 100,
        life: randomBetween(0.4, 0.9),
        maxLife: 0.9,
        color: colors[Math.floor(Math.random() * colors.length)] ?? "#ffb3d9",
        size: randomBetween(4, 10),
      });
    }
  }

  // ── Input handling ─────────────────────────────────────────────────────────
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === " " || e.key === "ArrowUp" || e.key === "w" || e.key === "W") {
        e.preventDefault();
        inputPressedRef.current = true;
      }
    }
    function onKeyUp(e: KeyboardEvent) {
      if (e.key === " " || e.key === "ArrowUp" || e.key === "w" || e.key === "W") {
        inputPressedRef.current = false;
        inputWasDownRef.current = false;
      }
    }
    window.addEventListener("keydown", onKey);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, []);

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
      drawMenu(ctx, w, h, skin, rotationRef);
      rotationRef.current += dt * 1.2;
      return;
    }

    if (!state || state.phase !== "playing") {
      if (state?.phase === "dead") {
        state.deathAnimTimer += dt;
        drawGame(ctx, w, h, groundY, state, skinRef.current, rotationRef.current);
        // Flash overlay
        if (state.flashTimer > 0) {
          ctx.globalAlpha = state.flashTimer * 0.8;
          ctx.fillStyle = "#ff4488";
          ctx.fillRect(0, 0, w, h);
          ctx.globalAlpha = 1;
          state.flashTimer = Math.max(0, state.flashTimer - dt * 4);
        }
      }
      return;
    }

    // ── Input ──
    const jumpTrigger = inputPressedRef.current && !inputWasDownRef.current;
    if (inputPressedRef.current) inputWasDownRef.current = true;

    if (jumpTrigger && state.isGrounded) {
      state.playerVY = JUMP_VEL;
      state.isGrounded = false;
      playBeep(520, 0.12, "square");
      spawnParticles(state, BLOCK_SIZE * 0.5 + 60, state.playerY + BLOCK_SIZE, 6, ["#ffb3d9", "#ffe0b3", "#b3d9ff"]);
    }

    // ── Physics ──
    state.playerVY += GRAVITY * dt;
    state.playerY += state.playerVY * dt;

    if (state.playerY >= groundY - BLOCK_SIZE) {
      state.playerY = groundY - BLOCK_SIZE;
      state.playerVY = 0;
      state.isGrounded = true;
    }

    // ── Rotation ──
    if (!state.isGrounded) {
      rotationRef.current += dt * 5.5;
    } else {
      // Snap to nearest 90deg
      const target = Math.round(rotationRef.current / (Math.PI / 2)) * (Math.PI / 2);
      rotationRef.current += (target - rotationRef.current) * Math.min(1, dt * 15);
    }

    // ── Obstacles ──
    timeSinceObstacleRef.current += dt;
    if (timeSinceObstacleRef.current >= nextObstacleRef.current) {
      spawnObstacle(state);
      timeSinceObstacleRef.current = 0;
      nextObstacleRef.current = randomBetween(OBSTACLE_INTERVAL_MIN, OBSTACLE_INTERVAL_MAX);
    }
    for (const obs of state.obstacles) {
      obs.x -= state.speed * dt;
    }
    state.obstacles = state.obstacles.filter((o) => o.x + o.width > -50);

    // ── Ground tiles ──
    for (const tile of state.groundTiles) {
      tile.x -= state.speed * dt;
    }
    const firstTile = state.groundTiles[0];
    if (firstTile && firstTile.x < -BLOCK_SIZE) {
      state.groundTiles.push({
        x: (state.groundTiles[state.groundTiles.length - 1]?.x ?? 0) + BLOCK_SIZE,
        color: CUTE_COLORS[Math.floor(Math.random() * CUTE_COLORS.length)] ?? "#ffb3d9",
      });
      state.groundTiles.shift();
    }

    // ── Stars ──
    for (const star of state.bgStars) {
      star.twinkle += dt * 2;
      star.x -= state.speed * 0.08 * dt;
      if (star.x < 0) star.x += w;
    }

    // ── Particles ──
    for (const p of state.particles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 400 * dt;
      p.life -= dt;
    }
    state.particles = state.particles.filter((p) => p.life > 0);

    // ── Score ──
    state.distance += state.speed * dt;
    state.score = Math.floor(state.distance / 100);
    state.speed = INITIAL_SPEED + state.score * SPEED_INCREMENT * 0.04;

    // Score milestones
    if (state.score > 0 && state.score % 10 === 0 && state.score !== Math.floor((state.distance - state.speed * dt) / 100)) {
      playBeep(660, 0.08, "sine");
      spawnParticles(state, w / 2, h * 0.3, 12, CUTE_COLORS);
    }

    // ── Collision ──
    const px = 60;
    const py = state.playerY;
    const pad = 6;
    for (const obs of state.obstacles) {
      if (
        px + pad < obs.x + obs.width - pad &&
        px + BLOCK_SIZE - pad > obs.x + pad &&
        py + pad < obs.y + obs.height - pad &&
        py + BLOCK_SIZE - pad > obs.y + pad
      ) {
        // Death
        state.phase = "dead";
        state.flashTimer = 1;
        updateHighScore(state.score);
        setScore(state.score);
        setPhase("dead");
        playBeep(200, 0.3, "sawtooth");
        spawnParticles(state, px + BLOCK_SIZE / 2, py + BLOCK_SIZE / 2, 20, [skinRef.current.bodyColor, skinRef.current.outlineColor, "#fff"]);
        break;
      }
    }

    // ── Draw ──
    drawGame(ctx, w, h, groundY, state, skinRef.current, rotationRef.current);
    setScore(state.score);
  }, phase === "menu");

  // ── Draw game ──────────────────────────────────────────────────────────────
  function drawGame(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    groundY: number,
    state: GameState,
    currentSkin: BlockSkin,
    rotation: number,
  ) {
    // Background gradient
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, "#1a0a2e");
    grad.addColorStop(0.7, "#2d1060");
    grad.addColorStop(1, "#1a0a2e");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // Stars
    for (const star of state.bgStars) {
      const alpha = 0.4 + 0.6 * Math.abs(Math.sin(star.twinkle));
      ctx.globalAlpha = alpha;
      ctx.fillStyle = "#fff";
      ctx.beginPath();
      ctx.arc(star.x, star.y, star.size * 0.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // Ground base
    ctx.fillStyle = "#2a0a4a";
    ctx.fillRect(0, groundY, w, h - groundY);

    // Ground tiles
    const tileH = h - groundY;
    for (const tile of state.groundTiles) {
      ctx.fillStyle = tile.color;
      ctx.globalAlpha = 0.35;
      ctx.fillRect(tile.x, groundY, BLOCK_SIZE - 2, tileH);
    }
    ctx.globalAlpha = 1;

    // Ground line glow
    ctx.save();
    ctx.shadowColor = "#ff9ec4";
    ctx.shadowBlur = 12;
    ctx.strokeStyle = "#ff9ec4";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, groundY);
    ctx.lineTo(w, groundY);
    ctx.stroke();
    ctx.restore();

    // Obstacles
    for (const obs of state.obstacles) {
      drawObstacle(ctx, obs);
    }

    // Particles
    for (const p of state.particles) {
      const alpha = Math.max(0, p.life / p.maxLife);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * alpha, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // Player
    if (state.phase === "playing" || state.deathAnimTimer < 0.5) {
      drawCuteBlock(ctx, 60, state.playerY, currentSkin, BLOCK_SIZE, rotation);
    }

    // Score HUD
    if (state.phase === "playing") {
      drawText(ctx, `✦ ${state.score}`, w / 2, 28, {
        font: "bold 20px Manrope, sans-serif",
        color: "#ffe0f5",
        shadow: "#ff6eb4",
        shadowBlur: 12,
        align: "center",
      });
    }

    // Dead overlay
    if (state.phase === "dead" && state.deathAnimTimer > 0.3) {
      ctx.fillStyle = "rgba(20,5,40,0.72)";
      ctx.fillRect(0, 0, w, h);

      drawText(ctx, "💔 oh no!", w / 2, h * 0.32, {
        font: `bold ${Math.min(w * 0.1, 44)}px Fraunces, serif`,
        color: "#ff9ec4",
        shadow: "#ff6eb4",
        shadowBlur: 20,
        align: "center",
      });
      drawText(ctx, `Score: ${state.score}`, w / 2, h * 0.46, {
        font: `bold ${Math.min(w * 0.065, 28)}px Manrope, sans-serif`,
        color: "#fff",
        align: "center",
      });
      drawText(ctx, `Best: ${Math.max(state.score, highScore)}`, w / 2, h * 0.54, {
        font: `${Math.min(w * 0.05, 20)}px Manrope, sans-serif`,
        color: "#ffb3d9",
        align: "center",
      });
      drawText(ctx, "Tap / Space to try again", w / 2, h * 0.66, {
        font: `${Math.min(w * 0.04, 17)}px Manrope, sans-serif`,
        color: "#cc88bb",
        align: "center",
      });
    }
  }

  function drawObstacle(ctx: CanvasRenderingContext2D, obs: Obstacle) {
    ctx.save();
    if (obs.type === "spike") {
      // Cute spike triangle with face
      ctx.fillStyle = obs.color;
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 2;
      ctx.shadowColor = obs.color;
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.moveTo(obs.x + obs.width / 2, obs.y);
      ctx.lineTo(obs.x + obs.width, obs.y + obs.height);
      ctx.lineTo(obs.x, obs.y + obs.height);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      // Little face on spike
      ctx.shadowBlur = 0;
      ctx.fillStyle = "#2a1a2e";
      ctx.beginPath();
      ctx.arc(obs.x + obs.width * 0.38, obs.y + obs.height * 0.62, obs.width * 0.08, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(obs.x + obs.width * 0.62, obs.y + obs.height * 0.62, obs.width * 0.08, 0, Math.PI * 2);
      ctx.fill();
      // Mean mouth
      ctx.strokeStyle = "#2a1a2e";
      ctx.lineWidth = 1.5;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(obs.x + obs.width * 0.35, obs.y + obs.height * 0.78);
      ctx.quadraticCurveTo(obs.x + obs.width * 0.5, obs.y + obs.height * 0.72, obs.x + obs.width * 0.65, obs.y + obs.height * 0.78);
      ctx.stroke();
    } else {
      // Block obstacle
      ctx.shadowColor = obs.color;
      ctx.shadowBlur = 8;
      ctx.fillStyle = obs.color;
      const r = 6;
      ctx.beginPath();
      ctx.moveTo(obs.x + r, obs.y);
      ctx.lineTo(obs.x + obs.width - r, obs.y);
      ctx.arcTo(obs.x + obs.width, obs.y, obs.x + obs.width, obs.y + r, r);
      ctx.lineTo(obs.x + obs.width, obs.y + obs.height - r);
      ctx.arcTo(obs.x + obs.width, obs.y + obs.height, obs.x + obs.width - r, obs.y + obs.height, r);
      ctx.lineTo(obs.x + r, obs.y + obs.height);
      ctx.arcTo(obs.x, obs.y + obs.height, obs.x, obs.y + obs.height - r, r);
      ctx.lineTo(obs.x, obs.y + r);
      ctx.arcTo(obs.x, obs.y, obs.x + r, obs.y, r);
      ctx.closePath();
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = "#fff3";
      ctx.lineWidth = 2;
      ctx.stroke();
      // Little face
      const fcx = obs.x + obs.width / 2;
      const fcy = obs.y + obs.height * 0.42;
      ctx.fillStyle = "#2a1a2e";
      ctx.beginPath();
      ctx.arc(fcx - obs.width * 0.2, fcy, obs.width * 0.07, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(fcx + obs.width * 0.2, fcy, obs.width * 0.07, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#2a1a2e";
      ctx.lineWidth = 1.5;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.arc(fcx, obs.y + obs.height * 0.68, obs.width * 0.14, 0.2, Math.PI - 0.2);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawMenu(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    currentSkin: BlockSkin,
    rotRef: React.MutableRefObject<number>,
  ) {
    // Background
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, "#1a0a2e");
    grad.addColorStop(1, "#2d1060");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // Floating stars
    const t = performance.now() / 1000;
    for (let i = 0; i < 30; i++) {
      const sx = ((i * 137.5 + t * 10) % w);
      const sy = ((i * 97.3) % (h * 0.75));
      const alpha = 0.3 + 0.4 * Math.abs(Math.sin(t * 1.5 + i));
      ctx.globalAlpha = alpha;
      ctx.fillStyle = "#fff";
      ctx.beginPath();
      ctx.arc(sx, sy, 1 + (i % 3) * 0.7, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // Title
    const titleSize = Math.min(w * 0.12, 52);
    ctx.save();
    ctx.shadowColor = "#ff6eb4";
    ctx.shadowBlur = 24;
    drawText(ctx, "CUBIworld", w / 2, h * 0.22, {
      font: `bold ${titleSize}px Fraunces, serif`,
      color: "#ffe0f5",
      align: "center",
      shadow: "#ff6eb4",
      shadowBlur: 24,
    });
    ctx.restore();

    // Subtitle
    drawText(ctx, "✨ cute geometry dash ✨", w / 2, h * 0.32, {
      font: `${Math.min(w * 0.045, 18)}px Manrope, sans-serif`,
      color: "#cc88bb",
      align: "center",
    });

    // Bouncing cube preview
    const bounce = Math.sin(t * 3) * 8;
    const cubeSize = Math.min(w * 0.14, 64);
    drawCuteBlock(ctx, w / 2 - cubeSize / 2, h * 0.44 + bounce - cubeSize / 2, currentSkin, cubeSize, rotRef.current);

    // High score
    if (highScore > 0) {
      drawText(ctx, `✦ Best: ${highScore}`, w / 2, h * 0.64, {
        font: `${Math.min(w * 0.042, 17)}px Manrope, sans-serif`,
        color: "#ffb3d9",
        align: "center",
      });
    }

    // Tap to play
    const pulse = 0.75 + 0.25 * Math.abs(Math.sin(t * 2));
    ctx.globalAlpha = pulse;
    drawText(ctx, "Tap / Space to play!", w / 2, h * 0.76, {
      font: `bold ${Math.min(w * 0.05, 20)}px Manrope, sans-serif`,
      color: "#ff9ec4",
      align: "center",
    });
    ctx.globalAlpha = 1;

    // Edit button hint
    drawText(ctx, "🎨 tap the pencil to edit your cube", w / 2, h * 0.86, {
      font: `${Math.min(w * 0.038, 15)}px Manrope, sans-serif`,
      color: "#9966aa",
      align: "center",
    });
  }

  // ── Tap / click to jump or start ───────────────────────────────────────────
  function handleTap() {
    if (showEditor) return;
    if (phase === "menu") {
      initGame();
      return;
    }
    if (phase === "playing") {
      inputPressedRef.current = true;
      setTimeout(() => {
        inputPressedRef.current = false;
        inputWasDownRef.current = false;
      }, 80);
      return;
    }
    if (phase === "dead") {
      const state = stateRef.current;
      if (state && state.deathAnimTimer > 0.3) {
        initGame();
      }
    }
  }

  // ── Skin change ────────────────────────────────────────────────────────────
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
          // Don't trigger if touching the edit button
          const target = e.target as HTMLElement;
          if (target.closest("[data-edit-btn]")) return;
          handleTap();
        }}
      >
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full"
          style={{ display: "block" }}
        />

        {/* Edit button */}
        <button
          data-edit-btn="true"
          onClick={(e) => {
            e.stopPropagation();
            setShowEditor(true);
          }}
          className="absolute flex items-center justify-center rounded-2xl font-bold"
          style={{
            bottom: 16,
            right: 16,
            width: 52,
            height: 52,
            background: "linear-gradient(135deg, #ff6eb4cc, #ff9ec4cc)",
            border: "2px solid #ff9ec4",
            backdropFilter: "blur(8px)",
            fontSize: 22,
            cursor: "pointer",
            boxShadow: "0 4px 16px #ff6eb455",
            zIndex: 10,
            color: "#fff",
          }}
          title="Edit your cube"
        >
          🎨
        </button>

        {/* Phase label on menu */}
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
        <BlockEditor
          skin={skin}
          onChange={handleSkinChange}
          onClose={() => setShowEditor(false)}
        />
      )}
    </GameShell>
  );
}
