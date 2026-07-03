import type { BlockSkin, FaceExpression } from "../types";

const BLOCK_SIZE = 48;

export function drawCuteBlock(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  skin: BlockSkin,
  size: number = BLOCK_SIZE,
  rotation: number = 0,
): void {
  ctx.save();
  ctx.translate(x + size / 2, y + size / 2);
  if (rotation !== 0) ctx.rotate(rotation);
  ctx.translate(-size / 2, -size / 2);

  const r = size * 0.18;

  // Shadow
  ctx.save();
  ctx.globalAlpha = 0.18;
  ctx.fillStyle = "#000";
  roundRect(ctx, 3, 3, size, size, r);
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.restore();

  // Body
  ctx.fillStyle = skin.bodyColor;
  roundRect(ctx, 0, 0, size, size, r);
  ctx.fill();

  // Pattern
  drawPattern(ctx, skin, size, r);

  // Outline
  ctx.strokeStyle = skin.outlineColor;
  ctx.lineWidth = size * 0.06;
  roundRect(ctx, 0, 0, size, size, r);
  ctx.stroke();

  // Cheeks
  if (skin.cheeks) {
    ctx.globalAlpha = 0.45;
    ctx.fillStyle = "#ff7eb3";
    ctx.beginPath();
    ctx.ellipse(size * 0.2, size * 0.62, size * 0.12, size * 0.08, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(size * 0.8, size * 0.62, size * 0.12, size * 0.08, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  // Face
  drawFace(ctx, skin.face, size);

  // Hat
  drawHat(ctx, skin.hat, size, skin.outlineColor);

  ctx.restore();
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
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

function drawPattern(
  ctx: CanvasRenderingContext2D,
  skin: BlockSkin,
  size: number,
  r: number,
): void {
  if (skin.pattern === "none") return;

  ctx.save();
  roundRect(ctx, 0, 0, size, size, r);
  ctx.clip();
  ctx.fillStyle = skin.patternColor;
  ctx.globalAlpha = 0.55;

  if (skin.pattern === "stripes") {
    for (let i = -size; i < size * 2; i += size * 0.28) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i + size * 0.14, 0);
      ctx.lineTo(i + size * 0.14 + size, size);
      ctx.lineTo(i + size, size);
      ctx.closePath();
      ctx.fill();
    }
  } else if (skin.pattern === "dots") {
    const spacing = size * 0.28;
    for (let row = 0; row < 4; row++) {
      for (let col = 0; col < 4; col++) {
        ctx.beginPath();
        ctx.arc(
          spacing * 0.5 + col * spacing,
          spacing * 0.5 + row * spacing,
          size * 0.055,
          0,
          Math.PI * 2,
        );
        ctx.fill();
      }
    }
  } else if (skin.pattern === "stars") {
    drawMiniStar(ctx, size * 0.25, size * 0.25, size * 0.1);
    drawMiniStar(ctx, size * 0.75, size * 0.25, size * 0.08);
    drawMiniStar(ctx, size * 0.5, size * 0.55, size * 0.1);
    drawMiniStar(ctx, size * 0.2, size * 0.68, size * 0.07);
    drawMiniStar(ctx, size * 0.78, size * 0.7, size * 0.09);
  } else if (skin.pattern === "hearts") {
    drawMiniHeart(ctx, size * 0.25, size * 0.28, size * 0.1);
    drawMiniHeart(ctx, size * 0.75, size * 0.28, size * 0.09);
    drawMiniHeart(ctx, size * 0.5, size * 0.58, size * 0.1);
  } else if (skin.pattern === "checkers") {
    const sq = size / 4;
    for (let row = 0; row < 4; row++) {
      for (let col = 0; col < 4; col++) {
        if ((row + col) % 2 === 0) {
          ctx.fillRect(col * sq, row * sq, sq, sq);
        }
      }
    }
  }

  ctx.globalAlpha = 1;
  ctx.restore();
}

function drawMiniStar(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
): void {
  ctx.beginPath();
  for (let i = 0; i < 5; i++) {
    const angle = (i * 4 * Math.PI) / 5 - Math.PI / 2;
    const innerAngle = ((i * 4 + 2) * Math.PI) / 5 - Math.PI / 2;
    if (i === 0) ctx.moveTo(cx + Math.cos(angle) * r, cy + Math.sin(angle) * r);
    else ctx.lineTo(cx + Math.cos(angle) * r, cy + Math.sin(angle) * r);
    ctx.lineTo(cx + Math.cos(innerAngle) * r * 0.45, cy + Math.sin(innerAngle) * r * 0.45);
  }
  ctx.closePath();
  ctx.fill();
}

function drawMiniHeart(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
): void {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(r, r);
  ctx.beginPath();
  ctx.moveTo(0, 0.3);
  ctx.bezierCurveTo(-1.2, -0.8, -2, 0.3, 0, 1.5);
  ctx.bezierCurveTo(2, 0.3, 1.2, -0.8, 0, 0.3);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawFace(
  ctx: CanvasRenderingContext2D,
  face: FaceExpression,
  size: number,
): void {
  const eyeY = size * 0.42;
  const mouthY = size * 0.65;
  const eyeSpacing = size * 0.22;
  const cx = size / 2;

  ctx.fillStyle = "#2a1a2e";
  ctx.strokeStyle = "#2a1a2e";

  if (face === "happy") {
    // Eyes
    drawEye(ctx, cx - eyeSpacing, eyeY, size * 0.085, "normal");
    drawEye(ctx, cx + eyeSpacing, eyeY, size * 0.085, "normal");
    // Smile
    ctx.beginPath();
    ctx.arc(cx, mouthY - size * 0.04, size * 0.15, 0.15, Math.PI - 0.15);
    ctx.lineWidth = size * 0.055;
    ctx.lineCap = "round";
    ctx.stroke();
  } else if (face === "excited") {
    drawEye(ctx, cx - eyeSpacing, eyeY, size * 0.09, "star");
    drawEye(ctx, cx + eyeSpacing, eyeY, size * 0.09, "star");
    ctx.beginPath();
    ctx.arc(cx, mouthY - size * 0.03, size * 0.16, 0, Math.PI);
    ctx.lineWidth = size * 0.055;
    ctx.lineCap = "round";
    ctx.stroke();
  } else if (face === "cool") {
    // Sunglasses
    ctx.fillStyle = "#2a1a2e";
    roundRect(ctx, cx - eyeSpacing - size * 0.1, eyeY - size * 0.09, size * 0.2, size * 0.16, size * 0.04);
    ctx.fill();
    roundRect(ctx, cx + eyeSpacing - size * 0.1, eyeY - size * 0.09, size * 0.2, size * 0.16, size * 0.04);
    ctx.fill();
    ctx.lineWidth = size * 0.04;
    ctx.strokeStyle = "#2a1a2e";
    ctx.beginPath();
    ctx.moveTo(cx - eyeSpacing + size * 0.1, eyeY - size * 0.01);
    ctx.lineTo(cx + eyeSpacing - size * 0.1, eyeY - size * 0.01);
    ctx.stroke();
    // Smirk
    ctx.beginPath();
    ctx.arc(cx + size * 0.07, mouthY, size * 0.1, Math.PI + 0.3, Math.PI * 2 - 0.3);
    ctx.lineWidth = size * 0.055;
    ctx.lineCap = "round";
    ctx.stroke();
  } else if (face === "sleepy") {
    // Half-closed eyes
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(cx - eyeSpacing, eyeY, size * 0.085, size * 0.085, 0, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillRect(cx - eyeSpacing - size * 0.1, eyeY - size * 0.01, size * 0.2, size * 0.12);
    ctx.restore();
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(cx + eyeSpacing, eyeY, size * 0.085, size * 0.085, 0, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillRect(cx + eyeSpacing - size * 0.1, eyeY - size * 0.01, size * 0.2, size * 0.12);
    ctx.restore();
    // ZZZ
    ctx.fillStyle = "#2a1a2e";
    ctx.font = `bold ${size * 0.18}px Manrope`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("z z", cx, mouthY);
  } else if (face === "wink") {
    drawEye(ctx, cx - eyeSpacing, eyeY, size * 0.085, "normal");
    // Wink
    ctx.lineWidth = size * 0.06;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(cx + eyeSpacing - size * 0.085, eyeY);
    ctx.lineTo(cx + eyeSpacing + size * 0.085, eyeY);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx, mouthY - size * 0.04, size * 0.15, 0.15, Math.PI - 0.15);
    ctx.stroke();
  } else if (face === "love") {
    // Heart eyes
    ctx.fillStyle = "#ff4488";
    drawMiniHeart(ctx, cx - eyeSpacing, eyeY - size * 0.02, size * 0.1);
    drawMiniHeart(ctx, cx + eyeSpacing, eyeY - size * 0.02, size * 0.1);
    ctx.fillStyle = "#2a1a2e";
    ctx.beginPath();
    ctx.arc(cx, mouthY - size * 0.04, size * 0.15, 0.15, Math.PI - 0.15);
    ctx.lineWidth = size * 0.055;
    ctx.lineCap = "round";
    ctx.stroke();
  } else if (face === "surprised") {
    drawEye(ctx, cx - eyeSpacing, eyeY, size * 0.1, "wide");
    drawEye(ctx, cx + eyeSpacing, eyeY, size * 0.1, "wide");
    // O mouth
    ctx.beginPath();
    ctx.ellipse(cx, mouthY, size * 0.09, size * 0.1, 0, 0, Math.PI * 2);
    ctx.lineWidth = size * 0.055;
    ctx.stroke();
  } else if (face === "nervous") {
    drawEye(ctx, cx - eyeSpacing, eyeY, size * 0.085, "normal");
    drawEye(ctx, cx + eyeSpacing, eyeY, size * 0.085, "normal");
    // Sweat drop
    ctx.fillStyle = "#88ddff";
    ctx.beginPath();
    ctx.ellipse(cx + eyeSpacing + size * 0.12, eyeY - size * 0.12, size * 0.04, size * 0.06, 0.3, 0, Math.PI * 2);
    ctx.fill();
    // Wavy mouth
    ctx.fillStyle = "#2a1a2e";
    ctx.strokeStyle = "#2a1a2e";
    ctx.lineWidth = size * 0.055;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(cx - size * 0.14, mouthY);
    ctx.quadraticCurveTo(cx - size * 0.05, mouthY + size * 0.06, cx, mouthY);
    ctx.quadraticCurveTo(cx + size * 0.05, mouthY - size * 0.06, cx + size * 0.14, mouthY);
    ctx.stroke();
  }
}

function drawEye(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  type: "normal" | "wide" | "star",
): void {
  if (type === "normal") {
    ctx.beginPath();
    ctx.ellipse(x, y, r, r * 1.1, 0, 0, Math.PI * 2);
    ctx.fill();
    // Shine
    ctx.fillStyle = "rgba(255,255,255,0.7)";
    ctx.beginPath();
    ctx.ellipse(x - r * 0.3, y - r * 0.3, r * 0.3, r * 0.3, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#2a1a2e";
  } else if (type === "wide") {
    ctx.beginPath();
    ctx.ellipse(x, y, r * 1.1, r * 1.2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.7)";
    ctx.beginPath();
    ctx.ellipse(x - r * 0.3, y - r * 0.35, r * 0.32, r * 0.32, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#2a1a2e";
  } else if (type === "star") {
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = "#ffcc00";
    drawMiniStar(ctx, 0, 0, r * 1.1);
    ctx.restore();
    ctx.fillStyle = "#2a1a2e";
  }
}

function drawHat(
  ctx: CanvasRenderingContext2D,
  hat: BlockSkin["hat"],
  size: number,
  accentColor: string,
): void {
  if (hat === "none") return;

  const cx = size / 2;

  if (hat === "bow") {
    ctx.fillStyle = accentColor;
    // Left bow loop
    ctx.beginPath();
    ctx.ellipse(cx - size * 0.16, -size * 0.05, size * 0.13, size * 0.09, -0.5, 0, Math.PI * 2);
    ctx.fill();
    // Right bow loop
    ctx.beginPath();
    ctx.ellipse(cx + size * 0.16, -size * 0.05, size * 0.13, size * 0.09, 0.5, 0, Math.PI * 2);
    ctx.fill();
    // Center knot
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.ellipse(cx, -size * 0.05, size * 0.06, size * 0.06, 0, 0, Math.PI * 2);
    ctx.fill();
  } else if (hat === "crown") {
    ctx.fillStyle = "#ffd700";
    ctx.strokeStyle = "#e6a800";
    ctx.lineWidth = size * 0.03;
    ctx.beginPath();
    ctx.moveTo(cx - size * 0.28, size * 0.02);
    ctx.lineTo(cx - size * 0.28, -size * 0.16);
    ctx.lineTo(cx - size * 0.12, -size * 0.06);
    ctx.lineTo(cx, -size * 0.2);
    ctx.lineTo(cx + size * 0.12, -size * 0.06);
    ctx.lineTo(cx + size * 0.28, -size * 0.16);
    ctx.lineTo(cx + size * 0.28, size * 0.02);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // Gems
    ctx.fillStyle = "#ff4488";
    ctx.beginPath();
    ctx.arc(cx, -size * 0.14, size * 0.04, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#44aaff";
    ctx.beginPath();
    ctx.arc(cx - size * 0.2, -size * 0.09, size * 0.03, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx + size * 0.2, -size * 0.09, size * 0.03, 0, Math.PI * 2);
    ctx.fill();
  } else if (hat === "flower") {
    const petalColors = ["#ff9ec4", "#ffcc44", "#ff6688", "#ffaa44"];
    for (let i = 0; i < 5; i++) {
      const angle = (i / 5) * Math.PI * 2;
      ctx.fillStyle = petalColors[i % petalColors.length] ?? "#ff9ec4";
      ctx.beginPath();
      ctx.ellipse(
        cx + Math.cos(angle) * size * 0.13,
        -size * 0.08 + Math.sin(angle) * size * 0.13,
        size * 0.09,
        size * 0.07,
        angle,
        0,
        Math.PI * 2,
      );
      ctx.fill();
    }
    ctx.fillStyle = "#ffee44";
    ctx.beginPath();
    ctx.arc(cx, -size * 0.08, size * 0.07, 0, Math.PI * 2);
    ctx.fill();
  } else if (hat === "star") {
    ctx.fillStyle = "#ffd700";
    ctx.save();
    ctx.translate(cx, -size * 0.1);
    drawMiniStar(ctx, 0, 0, size * 0.18);
    ctx.restore();
  }
}
