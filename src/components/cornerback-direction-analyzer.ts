import fs from 'node:fs';
import path from 'node:path';

type Row = Record<string, string>;
export type CardinalDirection = 'North' | 'East' | 'South' | 'West';

export type CornerbackDirectionAnalysisParams = {
  dataRoot: string;
  playerNames?: string[];
  teams?: string[];
  directions?: CardinalDirection[];
  minimumDistanceYards?: number;
  speedStartDistanceYards?: number;
};

export type CornerbackDirectionResult = {
  player: string;
  team: string;
  direction: CardinalDirection;
  qualifyingRuns: number;
  averageAcceleration: number;
  averageSpeedAfterFive: number | null;
  accelerationSamples: number;
  speedSamples: number;
};

export type CornerbackDirectionAnalysis = {
  results: CornerbackDirectionResult[];
  players: string[];
  teams: string[];
  source: string;
};

const value = (text: string): number => Number.parseFloat(text);

function csv(text: string): Row[] {
  const split = (line: string): string[] => {
    const cells: string[] = [];
    let cell = '';
    let quote = false;
    for (let i = 0; i < line.length; i += 1) {
      const character = line[i];
      if (character === '"') {
        if (quote && line[i + 1] === '"') {
          cell += character;
          i += 1;
        } else quote = !quote;
      } else if (character === ',' && !quote) {
        cells.push(cell);
        cell = '';
      } else cell += character;
    }
    cells.push(cell);
    return cells;
  };
  const lines = text.trim().split(/\r?\n/);
  const headers = split(lines[0]).map((item) => item.replace(/^\uFEFF/, ''));
  return lines.slice(1).map((line) => {
    const cells = split(line);
    return Object.fromEntries(headers.map((header, index) => [header, cells[index] ?? '']));
  });
}

/** Maps an NFL direction angle to the user's exact cardinal ranges. */
export function cardinalDirection(angle: number): CardinalDirection | null {
  const degrees = ((angle % 360) + 360) % 360;
  if (degrees >= 315 || degrees <= 45) return 'North';
  if (degrees >= 46 && degrees <= 134) return 'East';
  if (degrees >= 135 && degrees <= 224) return 'South';
  if (degrees >= 225 && degrees <= 314) return 'West';
  return null;
}

/**
 * Analyses CB movement in the supplied input tracking windows.
 * The source has no ball_snap/pass_forward events; every input window is used as that proxy interval.
 */
export function analyzeCornerbackDirections(
  params: CornerbackDirectionAnalysisParams,
): CornerbackDirectionAnalysis {
  const minimumDistance = params.minimumDistanceYards ?? 5;
  const speedStart = params.speedStartDistanceYards ?? 6;
  const allowedPlayers = params.playerNames ? new Set(params.playerNames) : undefined;
  const allowedTeams = params.teams ? new Set(params.teams) : undefined;
  const allowedDirections = params.directions ? new Set(params.directions) : undefined;
  const plays = new Map(
    csv(fs.readFileSync(path.join(params.dataRoot, 'supplementary_data.csv'), 'utf8')).map((row) => [
      `${row.game_id}:${row.play_id}`,
      row.defensive_team,
    ]),
  );
  const tracks = new Map<string, Row[]>();
  const train = path.join(params.dataRoot, 'train');
  for (const file of fs.readdirSync(train).filter((name) => /^input_.*\.csv$/.test(name))) {
    for (const row of csv(fs.readFileSync(path.join(train, file), 'utf8'))) {
      const team = plays.get(`${row.game_id}:${row.play_id}`) ?? 'Unknown';
      if (
        row.player_side !== 'Defense' ||
        row.player_position !== 'CB' ||
        (allowedPlayers && !allowedPlayers.has(row.player_name)) ||
        (allowedTeams && !allowedTeams.has(team))
      )
        continue;
      const key = `${row.game_id}:${row.play_id}:${row.nfl_id}`;
      tracks.set(key, [...(tracks.get(key) ?? []), row]);
    }
  }
  type Total = CornerbackDirectionResult & { acceleration: number[]; speed: number[] };
  const totals = new Map<string, Total>();
  const store = (
    rows: Row[],
    direction: CardinalDirection,
    acceleration: number[],
    speed: number[],
  ): void => {
    if (!acceleration.length || (allowedDirections && !allowedDirections.has(direction))) return;
    const first = rows[0];
    const team = plays.get(`${first.game_id}:${first.play_id}`) ?? 'Unknown';
    const key = `${first.nfl_id}:${direction}`;
    const total = totals.get(key) ?? {
      player: first.player_name,
      team,
      direction,
      qualifyingRuns: 0,
      averageAcceleration: 0,
      averageSpeedAfterFive: null,
      accelerationSamples: 0,
      speedSamples: 0,
      acceleration: [],
      speed: [],
    };
    total.qualifyingRuns += 1;
    total.acceleration.push(...acceleration);
    total.speed.push(...speed);
    totals.set(key, total);
  };
  for (const rows of tracks.values()) {
    rows.sort((a, b) => value(a.frame_id) - value(b.frame_id));
    let active: CardinalDirection | null = null,
      run: Row[] = [],
      distance = 0,
      acceleration: number[] = [],
      speed: number[] = [];
    const endRun = (): void => {
      if (active && distance >= minimumDistance) store(run, active, acceleration, speed);
      active = null;
      run = [];
      distance = 0;
      acceleration = [];
      speed = [];
    };
    for (const row of rows) {
      const orientation = cardinalDirection(value(row.o));
      const travel = cardinalDirection(value(row.dir));
      const matched = orientation && orientation === travel ? orientation : null;
      if (!matched || (active && active !== matched)) {
        endRun();
        if (!matched) continue;
      }
      if (!active) {
        active = matched;
        run = [row];
        acceleration = [value(row.a)];
        continue;
      }
      const previous = run[run.length - 1];
      distance += Math.hypot(value(row.x) - value(previous.x), value(row.y) - value(previous.y));
      run.push(row);
      if (distance <= minimumDistance) acceleration.push(value(row.a));
      if (distance >= speedStart) speed.push(value(row.s));
    }
    endRun();
  }
  const results = [...totals.values()].map(({ acceleration, speed, ...total }) => ({
    ...total,
    averageAcceleration: acceleration.reduce((sum, item) => sum + item, 0) / acceleration.length,
    averageSpeedAfterFive: speed.length ? speed.reduce((sum, item) => sum + item, 0) / speed.length : null,
    accelerationSamples: acceleration.length,
    speedSamples: speed.length,
  }));
  return {
    results,
    players: [...new Set(results.map((result) => result.player))].sort(),
    teams: [...new Set(results.map((result) => result.team))].sort(),
    source: `${tracks.size.toLocaleString()} CB input windows scanned`,
  };
}
