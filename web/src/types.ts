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

/** A single landable platform tile */
export interface PlatformTile {
  x: number;
  y: number;       // top surface y
  width: number;
  height: number;
}

/** A spike attached under a step or below a platform */
export interface UnderSpike {
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  pointDown: boolean; // true = hangs from step, false = sits on ground under platform
}

export interface Obstacle {
  x: number;
  y: number;
  width: number;
  height: number;
  /**
   * spike       – single triangle spike on the ground
   * spike_group – 2–3 spikes side-by-side on the ground
   * platform    – raised flat platform to jump onto (spikes below)
   * staircase   – separated ascending steps with spikes below each
   */
  type: "spike" | "spike_group" | "platform" | "staircase";
  color: string;
  spikeCount?: number;
  /** landable tiles */
  platforms?: PlatformTile[];
  /** lethal spikes associated with this obstacle */
  underSpikes?: UnderSpike[];
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
  phase: "menu" | "playing" | "dead";
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
