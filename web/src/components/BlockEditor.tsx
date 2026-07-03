import { useRef, useEffect } from "react";
import type { BlockSkin, FaceExpression } from "../types";
import { drawCuteBlock } from "../lib/drawBlock";

interface Props {
  skin: BlockSkin;
  onChange: (skin: BlockSkin) => void;
  onClose: () => void;
}

const BODY_COLORS = [
  "#ff9ec4", "#ffb347", "#ffe066", "#b5ead7", "#c7f2a4",
  "#9ec4ff", "#d4a5f5", "#ff6b6b", "#a8e6cf", "#ffd3e0",
];

const OUTLINE_COLORS = [
  "#d6006e", "#c05000", "#b8a000", "#007a50", "#3a8a00",
  "#004ab8", "#7a00c0", "#a00000", "#006040", "#b8004a",
];

const PATTERN_COLORS = [
  "#ffe0f0", "#fff0d0", "#fffacc", "#e0fff5", "#f0ffe0",
  "#e0eeff", "#f5e0ff", "#ffe0e0", "#e0f8ef", "#fce4ec",
];

const PATTERNS: BlockSkin["pattern"][] = ["none", "stripes", "dots", "stars", "hearts", "checkers"];
const PATTERN_LABELS: Record<BlockSkin["pattern"], string> = {
  none: "None", stripes: "Stripes", dots: "Dots",
  stars: "Stars", hearts: "Hearts", checkers: "Checks",
};

const FACES: FaceExpression[] = ["happy", "excited", "cool", "sleepy", "wink", "love", "surprised", "nervous"];
const FACE_LABELS: Record<FaceExpression, string> = {
  happy: "😊", excited: "🤩", cool: "😎", sleepy: "😴",
  wink: "😉", love: "😍", surprised: "😮", nervous: "😅",
};

const HATS: BlockSkin["hat"][] = ["none", "bow", "crown", "flower", "star"];
const HAT_LABELS: Record<BlockSkin["hat"], string> = {
  none: "None", bow: "🎀 Bow", crown: "👑 Crown", flower: "🌸 Flower", star: "⭐ Star",
};

export default function BlockEditor({ skin, onChange, onClose }: Props) {
  const previewRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = previewRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, 120, 120);
    // Cute background
    ctx.fillStyle = "#fdf0f8";
    ctx.fillRect(0, 0, 120, 120);
    // Grid
    ctx.strokeStyle = "#f0c8e0";
    ctx.lineWidth = 1;
    for (let i = 0; i < 120; i += 20) {
      ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, 120); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(120, i); ctx.stroke();
    }
    drawCuteBlock(ctx, 12, 12, skin, 96, 0);
  }, [skin]);

  function set<K extends keyof BlockSkin>(key: K, val: BlockSkin[K]) {
    onChange({ ...skin, [key]: val });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(60,20,60,0.55)", backdropFilter: "blur(4px)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="relative rounded-3xl shadow-2xl overflow-y-auto"
        style={{
          background: "var(--paper)",
          border: "3px solid var(--border)",
          maxWidth: 420,
          width: "calc(100vw - 24px)",
          maxHeight: "calc(100vh - 40px)",
          padding: "20px 18px 24px",
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h2 style={{ fontFamily: "Fraunces, serif", fontSize: 22, color: "var(--ink)" }}>
            ✨ Cube Editor
          </h2>
          <button
            onClick={onClose}
            className="rounded-full flex items-center justify-center text-lg font-bold"
            style={{
              width: 36, height: 36,
              background: "var(--surface)",
              border: "2px solid var(--border)",
              color: "var(--ink)",
              cursor: "pointer",
            }}
          >×</button>
        </div>

        {/* Preview */}
        <div className="flex justify-center mb-5">
          <canvas
            ref={previewRef}
            width={120}
            height={120}
            className="rounded-2xl"
            style={{ border: "2px solid var(--border)", imageRendering: "pixelated" }}
          />
        </div>

        {/* Body Color */}
        <Section label="Body Color">
          <div className="flex flex-wrap gap-2">
            {BODY_COLORS.map((c) => (
              <ColorSwatch
                key={c}
                color={c}
                selected={skin.bodyColor === c}
                onClick={() => set("bodyColor", c)}
              />
            ))}
          </div>
        </Section>

        {/* Outline Color */}
        <Section label="Outline Color">
          <div className="flex flex-wrap gap-2">
            {OUTLINE_COLORS.map((c) => (
              <ColorSwatch
                key={c}
                color={c}
                selected={skin.outlineColor === c}
                onClick={() => set("outlineColor", c)}
              />
            ))}
          </div>
        </Section>

        {/* Pattern */}
        <Section label="Pattern">
          <div className="flex flex-wrap gap-2">
            {PATTERNS.map((p) => (
              <Chip
                key={p}
                label={PATTERN_LABELS[p]}
                selected={skin.pattern === p}
                onClick={() => set("pattern", p)}
              />
            ))}
          </div>
        </Section>

        {/* Pattern Color */}
        {skin.pattern !== "none" && (
          <Section label="Pattern Color">
            <div className="flex flex-wrap gap-2">
              {PATTERN_COLORS.map((c) => (
                <ColorSwatch
                  key={c}
                  color={c}
                  selected={skin.patternColor === c}
                  onClick={() => set("patternColor", c)}
                />
              ))}
            </div>
          </Section>
        )}

        {/* Face */}
        <Section label="Face Expression">
          <div className="flex flex-wrap gap-2">
            {FACES.map((f) => (
              <Chip
                key={f}
                label={FACE_LABELS[f]}
                selected={skin.face === f}
                onClick={() => set("face", f)}
                emoji
              />
            ))}
          </div>
        </Section>

        {/* Cheeks */}
        <Section label="Cheeks">
          <div className="flex gap-2">
            <Chip label="🌸 On" selected={skin.cheeks} onClick={() => set("cheeks", true)} />
            <Chip label="Off" selected={!skin.cheeks} onClick={() => set("cheeks", false)} />
          </div>
        </Section>

        {/* Hat */}
        <Section label="Hat">
          <div className="flex flex-wrap gap-2">
            {HATS.map((h) => (
              <Chip
                key={h}
                label={HAT_LABELS[h]}
                selected={skin.hat === h}
                onClick={() => set("hat", h)}
              />
            ))}
          </div>
        </Section>

        {/* Done */}
        <button
          onClick={onClose}
          className="w-full rounded-2xl font-bold text-white mt-4"
          style={{
            background: "linear-gradient(135deg, #ff6eb4, #ff9ec4)",
            border: "none",
            padding: "14px 0",
            fontSize: 16,
            cursor: "pointer",
            fontFamily: "Manrope, sans-serif",
            boxShadow: "0 4px 16px #ff6eb455",
          }}
        >
          💖 Save & Play!
        </button>
      </div>
    </div>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-4">
      <div
        className="mb-2 font-bold text-sm"
        style={{ color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}
      >
        {label}
      </div>
      {children}
    </div>
  );
}

function ColorSwatch({
  color,
  selected,
  onClick,
}: {
  color: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        width: 32,
        height: 32,
        borderRadius: "50%",
        background: color,
        border: selected ? "3px solid var(--ink)" : "2px solid var(--border)",
        cursor: "pointer",
        transform: selected ? "scale(1.2)" : "scale(1)",
        transition: "transform 0.15s, border 0.15s",
        boxShadow: selected ? "0 0 0 2px var(--paper)" : "none",
        outline: "none",
        minWidth: 32,
        minHeight: 32,
      }}
    />
  );
}

function Chip({
  label,
  selected,
  onClick,
  emoji,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
  emoji?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: emoji ? "6px 10px" : "6px 12px",
        borderRadius: 20,
        border: selected ? "2px solid #ff6eb4" : "2px solid var(--border)",
        background: selected ? "#ffe0f0" : "var(--surface)",
        color: selected ? "#c0006a" : "var(--ink)",
        fontWeight: selected ? 700 : 500,
        fontSize: emoji ? 18 : 13,
        cursor: "pointer",
        transition: "all 0.15s",
        fontFamily: "Manrope, sans-serif",
        minHeight: 36,
        outline: "none",
      }}
    >
      {label}
    </button>
  );
}
