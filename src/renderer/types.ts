export type DirectionResult = {
  player: string;
  team: string;
  direction: string;
  qualifyingRuns: number;
  averageAcceleration: number;
  averageSpeedAfterFive: number | null;
  accelerationSamples: number;
  speedSamples: number;
};

export type MovementAnalysis = {
  results: DirectionResult[];
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
