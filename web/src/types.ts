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

export interface PlatformTile {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface FloorSpike {
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
}

export interface Obstacle {
  x: number;
  y: number;
  width: number;
  height: number;
  type: "spike" | "spike_group" | "platform" | "staircase";
  color: string;
  spikeCount?: number;
  platforms?: PlatformTile[];
  floorSpikes?: FloorSpike[];
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
  phase: "playing" | "dead" | "levelcomplete";
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
  nextObstacleIn: number;
  flashTimer: number;
  deathAnimTimer: number;
  finishLineX: number | null;
}

export interface RoundRecord {
  level: number;
  score: number;
  completed: boolean;
  date: string;
}

export const TOTAL_LEVELS = 6;
export const FINISH_LINE_DISTANCE = 3000;

export const DEFAULT_SKIN: BlockSkin = {
  bodyColor: "#ff9ec4",
  outlineColor: "#d6006e",
  patternColor: "#ffcce0",
  pattern: "hearts",
  face: "happy",
  cheeks: true,
  hat: "bow",
};
