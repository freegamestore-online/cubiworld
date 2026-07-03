export type FaceExpression = "happy" | "excited" | "cool" | "sleepy" | "wink" | "love" | "surprised" | "nervous";

export interface BlockSkin {
  bodyColor: string;
  outlineColor: string;
  patternColor: string;
  pattern: "none" | "stripes" | "dots" | "stars" | "hearts" | "checkers";
  face: FaceExpression;
  cheeks: boolean;
  hat: "none" | "bow" | "crown" | "flower" | "star";
}

export interface Obstacle {
  x: number;
  y: number;
  width: number;
  height: number;
  type: "spike" | "block" | "tall";
  color: string;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
}

export interface GameState {
  phase: "menu" | "playing" | "dead" | "editor";
  playerY: number;
  playerVY: number;
  isGrounded: boolean;
  score: number;
  distance: number;
  speed: number;
  obstacles: Obstacle[];
  particles: Particle[];
  groundTiles: { x: number; color: string }[];
  bgStars: { x: number; y: number; size: number; twinkle: number }[];
  jumpPressed: boolean;
  jumpConsumed: boolean;
  deathAnimTimer: number;
  flashTimer: number;
}

export const DEFAULT_SKIN: BlockSkin = {
  bodyColor: "#ff9ec4",
  outlineColor: "#d6006e",
  patternColor: "#ffcce0",
  pattern: "hearts",
  face: "happy",
  cheeks: true,
  hat: "bow",
};
