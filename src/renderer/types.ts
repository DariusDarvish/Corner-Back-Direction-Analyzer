export type DirectionAnimationFrame = {
  frameId: string;
  x: number;
  y: number;
  o: number;
  dir: number;
  speed: number;
  acceleration: number;
};

export type DirectionAnimation = {
  direction: string;
  player: string;
  team: string;
  frameCount: number;
  frames: DirectionAnimationFrame[];
};

export type DirectionResult = {
  player: string;
  team: string;
  direction: string;
  qualifyingRuns: number;
  averageAcceleration: number;
  averageSpeedAfterFive: number | null;
  averageDeceleration: number | null;
  score: number;
  accelerationSamples: number;
  speedSamples: number;
};

export type MovementAnalysis = {
  results: DirectionResult[];
  directionAnimations: DirectionAnimation[];
  players: string[];
  teams: string[];
  source: string;
};
export type Filters = { team: string; player: string };

declare global {
  interface Window {
    movement: { analyse: () => Promise<MovementAnalysis> };
  }
}
