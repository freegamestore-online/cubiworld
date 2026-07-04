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

// A single step tile (part of a staircase obstacle)
export interface StepTile {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Obstacle {
  x: number;        // leftmost x of the whole obstacle group
  y: number;        // top y of the first/tallest part
  width: number;    // bounding width
  height: number;   // bounding height
  type: "spike" | "spike_group" | "steps";
  color: string;
  // For spike_group: how many spikes side-by-side
  spikeCount?: number;
  // For steps: array of individual step tiles
  steps?: StepTile[];
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
  groundedOnStep: boolean;
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
