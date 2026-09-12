# Cornerback Direction Analysis Walkthrough

*2026-09-12T18:42:33Z by Showboat 0.6.1*
<!-- showboat-id: ece32565-7328-472c-966a-0e0fda6d211a -->

This walkthrough traces the app from the raw NFL tracking files to the rendered Electron UI. It is meant to be read linearly: first the analyzer, then the Electron bridge, then the renderer components, and finally how the UI presents the results.

The first thing to understand is that the app does not use a generic data pipeline. It loads the supplied NFL CSV files, filters to defensive cornerbacks, then analyzes each player's movement only when orientation and travel direction line up in the same cardinal direction.

```bash
sed -n '1,120p' src/components/cornerback-direction-analyzer.ts
```

```output
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
  averageDeceleration: number | null;
  score: number;
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
  type Total = CornerbackDirectionResult & {
    acceleration: number[];
    speed: number[];
    deceleration: number[];
  };
  const totals = new Map<string, Total>();
  const store = (
    rows: Row[],
    direction: CardinalDirection,
    acceleration: number[],
    speed: number[],
```

The analyzer defines the exact direction ranges and the output shape first. The cardinalDirection helper is intentionally strict: it maps the raw angle into North, East, South, or West using the same ranges the project has advertised throughout the app.

```bash
sed -n '121,260p' src/components/cornerback-direction-analyzer.ts
```

```output
    deceleration: number[],
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
      averageDeceleration: null,
      score: 0,
      accelerationSamples: 0,
      speedSamples: 0,
      acceleration: [],
      speed: [],
      deceleration: [],
    };
    total.qualifyingRuns += 1;
    total.acceleration.push(...acceleration);
    total.speed.push(...speed);
    total.deceleration.push(...deceleration);
    totals.set(key, total);
  };
  for (const rows of tracks.values()) {
    rows.sort((a, b) => value(a.frame_id) - value(b.frame_id));
    let active: CardinalDirection | null = null,
      run: Row[] = [],
      distance = 0,
      acceleration: number[] = [],
      speed: number[] = [],
      deceleration: number[] = [];
    const endRun = (): void => {
      if (active && distance >= minimumDistance) store(run, active, acceleration, speed, deceleration);
      active = null;
      run = [];
      distance = 0;
      acceleration = [];
      speed = [];
      deceleration = [];
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
      const currentAcceleration = value(row.a);
      distance += Math.hypot(value(row.x) - value(previous.x), value(row.y) - value(previous.y));
      run.push(row);
      if (distance <= minimumDistance) acceleration.push(currentAcceleration);
      if (distance >= speedStart) speed.push(value(row.s));
      if (distance >= 3 && currentAcceleration < 0) deceleration.push(Math.abs(currentAcceleration));
    }
    endRun();
  }
  const results = [...totals.values()].map(({ acceleration, speed, deceleration, ...total }) => ({
    ...total,
    averageAcceleration: acceleration.reduce((sum, item) => sum + item, 0) / acceleration.length,
    averageSpeedAfterFive: speed.length ? speed.reduce((sum, item) => sum + item, 0) / speed.length : null,
    averageDeceleration: deceleration.length
      ? deceleration.reduce((sum, item) => sum + item, 0) / deceleration.length
      : null,
    score: 0,
    accelerationSamples: acceleration.length,
    speedSamples: speed.length,
  }));

  const maxDeceleration = Math.max(0, ...results.map((result) => result.averageDeceleration ?? 0));
  const maxSpeed = Math.max(0, ...results.map((result) => result.averageSpeedAfterFive ?? 0));

  const scoredResults = results.map((result) => {
    const decelerationScore =
      maxDeceleration > 0 && result.averageDeceleration != null
        ? Math.min(100, (result.averageDeceleration / maxDeceleration) * 100)
        : 0;
    const speedScore =
      maxSpeed > 0 && result.averageSpeedAfterFive != null
        ? Math.min(100, (result.averageSpeedAfterFive / maxSpeed) * 100)
        : 0;

    const lowSpeedPenalty = speedScore < 60 ? ((60 - speedScore) / 60) * 35 : 0;

    return {
      ...result,
      score: Math.min(
        100,
        Math.max(0, Math.round(speedScore * 0.75 + decelerationScore * 0.25 - lowSpeedPenalty)),
      ),
    };
  });

  return {
    results: scoredResults,
    players: [...new Set(scoredResults.map((result) => result.player))].sort(),
    teams: [...new Set(scoredResults.map((result) => result.team))].sort(),
    source: `${tracks.size.toLocaleString()} CB input windows scanned`,
  };
}
```

This is the heart of the analysis. The function loads supplementary metadata, scans every training input file, filters to Defense/CB rows, then groups frames by game/play/player. For each group, the loop walks the frames in order and only keeps movement that remains aligned with one matched cardinal direction.

Inside the run-building loop, the code keeps cumulative Euclidean distance from x/y values. Once the player has moved at least 5 yards, that run qualifies. Acceleration is averaged across the first 0-5 yards, speed is averaged from 6 yards onward, and de-acceleration is measured after 3 yards using the magnitude of any negative acceleration values.

```bash
sed -n '1,160p' src/electron-main.ts && printf '\n--- preload.ts ---\n' && sed -n '1,120p' src/preload.ts
```

```output
import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'node:path';
import {
  analyzeCornerbackDirections,
  type CornerbackDirectionAnalysisParams,
} from './components/cornerback-direction-analyzer';

const dataRoot = path.join(app.getAppPath(), 'NFL_DATA');

function createWindow(): void {
  const browser = new BrowserWindow({
    width: 1280,
    height: 840,
    webPreferences: { contextIsolation: true, preload: path.join(__dirname, 'preload.js') },
  });
  void browser.loadFile(path.join(__dirname, '../movement.html'));
}

app.whenReady().then(() => {
  ipcMain.handle(
    'movement:analyse',
    (_event, options: Omit<CornerbackDirectionAnalysisParams, 'dataRoot'> = {}) =>
      analyzeCornerbackDirections({ ...options, dataRoot }),
  );
  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

--- preload.ts ---
import { contextBridge, ipcRenderer } from 'electron';
import type { CornerbackDirectionAnalysisParams } from './components/cornerback-direction-analyzer';

contextBridge.exposeInMainWorld('movement', {
  analyse: (options?: Omit<CornerbackDirectionAnalysisParams, 'dataRoot'>) =>
    ipcRenderer.invoke('movement:analyse', options),
});
```

Once the analyzer has built a results set, the Electron main process exposes it over IPC. The preload script makes a safe window.movement.analyse helper available to the renderer, so the browser code never touches Node APIs directly.

```bash
sed -n '1,200p' src/renderer/movement-app.ts && printf '\n--- filters.ts ---\n' && sed -n '1,160p' src/renderer/components/filters.ts
```

```output
import { createFilters } from './components/filters.js';
import { renderDirectionChart } from './components/direction-chart.js';
import { renderResultsTable } from './components/results-table.js';
import type { Filters, MovementAnalysis } from './types.js';

const output = document.querySelector<HTMLElement>('#analysis-output')!;
const chart = document.querySelector<HTMLElement>('#direction-chart')!;
const table = document.querySelector<HTMLElement>('#results-table')!;

function filterResults(data: MovementAnalysis, filters: Filters) {
  const player = filters.player.toLowerCase();
  return data.results.filter(
    (row) => (!filters.team || row.team === filters.team) && row.player.toLowerCase().includes(player),
  );
}

async function start(): Promise<void> {
  const data = await window.movement.analyse();
  const render = (filters: Filters): void => {
    const rows = filterResults(data, filters);
    output.hidden = false;
    renderDirectionChart(chart, rows);
    renderResultsTable(table, rows);
  };
  createFilters(document.querySelector<HTMLElement>('#filters')!, {
    teams: data.teams,
    players: data.players,
    onChange: render,
  });
  render({ team: '', player: '' });
}

void start().catch((error: unknown) => {
  output.hidden = false;
  output.textContent = `Could not analyze NFL_DATA: ${error instanceof Error ? error.message : String(error)}`;
});

--- filters.ts ---
import type { Filters } from '../types.js';

type FilterOptions = { teams: string[]; players: string[]; onChange: (filters: Filters) => void };

export function createFilters(container: HTMLElement, { teams, players, onChange }: FilterOptions): void {
  container.innerHTML = `<select id="team-filter" class="min-w-52 rounded-lg border border-sky-200/20 bg-slate-900 px-4 py-3 text-white"><option value="">All teams</option></select><input id="player-filter" list="player-options" placeholder="Filter cornerback" class="min-w-60 rounded-lg border border-sky-200/20 bg-slate-900 px-4 py-3 text-white placeholder:text-slate-400" /><datalist id="player-options"></datalist><button type="button" id="apply-filter" class="rounded-lg bg-cyan-300 px-5 py-3 font-bold text-slate-950 hover:bg-cyan-200">Apply</button>`;
  const team = container.querySelector<HTMLSelectElement>('#team-filter')!;
  const player = container.querySelector<HTMLInputElement>('#player-filter')!;
  team.insertAdjacentHTML(
    'beforeend',
    teams.map((name) => `<option value="${name}">${name}</option>`).join(''),
  );
  container.querySelector<HTMLDataListElement>('#player-options')!.innerHTML = players
    .map((name) => `<option value="${name}">`)
    .join('');
  const notify = (): void => onChange({ team: team.value, player: player.value.trim() });
  container.querySelector('#apply-filter')!.addEventListener('click', notify);
  team.addEventListener('change', notify);
  player.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') notify();
  });
}
```

The renderer starts by loading data through window.movement.analyse. It then applies the current filters, redraws the direction chart, and re-renders the table. The filter helper is simple but important: it builds the team dropdown, populates player suggestions, and triggers rerendering whenever the user changes a filter or presses Apply.

```bash
sed -n '1,180p' src/renderer/components/results-table.ts && printf '\n--- direction-chart.ts ---\n' && sed -n '1,200p' src/renderer/components/direction-chart.ts
```

```output
import type { DirectionResult } from '../types.js';

const format = (number: number | null): string => (number == null ? '—' : number.toFixed(2));

export function renderResultsTable(container: HTMLElement, rows: DirectionResult[]): void {
  const body =
    [...rows]
      .sort((a, b) => b.qualifyingRuns - a.qualifyingRuns || b.score - a.score)
      .map(
        (row) =>
          `<tr class="border-b border-sky-200/10 last:border-0"><td class="px-4 py-3">${row.player}</td><td class="px-4 py-3">${row.team}</td><td class="px-4 py-3">${row.direction}</td><td class="px-4 py-3">${row.qualifyingRuns}</td><td class="px-4 py-3">${format(row.averageAcceleration)} yd/s²</td><td class="px-4 py-3">${format(row.averageSpeedAfterFive)} yd/s</td><td class="px-4 py-3">${row.score}/100</td></tr>`,
      )
      .join('') ||
    '<tr><td colspan="7" class="px-4 py-8 text-center text-slate-400">No qualifying runs for this filter.</td></tr>';
  container.innerHTML = `<table class="w-full min-w-200 border-collapse text-left text-sm"><thead class="bg-slate-800/80 text-xs uppercase tracking-wider text-sky-200"><tr><th class="px-4 py-3">Player</th><th class="px-4 py-3">Team</th><th class="px-4 py-3">Direction</th><th class="px-4 py-3">Runs ≥5 yd</th><th class="px-4 py-3">Avg acceleration (0–5 yd)</th><th class="px-4 py-3">Avg speed (6+ yd)</th><th class="px-4 py-3">Deceleration Score</th></tr></thead><tbody>${body}</tbody></table>`;
}

--- direction-chart.ts ---
import type { DirectionResult } from '../types.js';

const directions = ['North', 'East', 'South', 'West'];
const format = (number: number | null): string => (number == null ? '—' : number.toFixed(2));

function summarize(rows: DirectionResult[], direction: string) {
  const matching = rows.filter((row) => row.direction === direction);
  const accelerationSamples = matching.reduce((sum, row) => sum + row.accelerationSamples, 0);
  const speedRows = matching.filter((row) => row.averageSpeedAfterFive != null);
  const speedSamples = speedRows.reduce((sum, row) => sum + row.speedSamples, 0);
  return {
    direction,
    runs: matching.reduce((sum, row) => sum + row.qualifyingRuns, 0),
    acceleration: accelerationSamples
      ? matching.reduce((sum, row) => sum + row.averageAcceleration * row.accelerationSamples, 0) /
        accelerationSamples
      : null,
    speed: speedSamples
      ? speedRows.reduce((sum, row) => sum + row.averageSpeedAfterFive! * row.speedSamples, 0) / speedSamples
      : null,
  };
}

export function renderDirectionChart(container: HTMLElement, rows: DirectionResult[]): void {
  const summary = directions.map((direction) => summarize(rows, direction));
  const maximum = Math.max(...summary.map((item) => item.acceleration ?? 0), 1);
  container.innerHTML = summary
    .map(
      (item) =>
        `<section class="rounded-xl border border-sky-200/15 bg-slate-900/80 p-5 shadow-lg shadow-slate-950/20"><div class="text-xs font-bold uppercase tracking-widest text-cyan-300">${item.direction}</div><div class="my-2 text-3xl font-extrabold">${format(item.acceleration)} <small class="text-base">yd/s²</small></div><div class="text-sm text-slate-400">Average acceleration · ${item.runs} qualifying runs</div><div class="my-4 h-2 overflow-hidden rounded bg-slate-700"><div class="h-full rounded bg-gradient-to-r from-cyan-300 to-violet-400" style="width:${((item.acceleration ?? 0) / maximum) * 100}%"></div></div><div class="text-sm text-slate-400">Speed after 5 yd: ${format(item.speed)} yd/s</div></section>`,
    )
    .join('');
}
```

The final presentation layer is split into two pieces. The results table is responsible for showing per-player summaries, while the direction chart condenses the filtered rows into a four-card view across North, East, South, and West. Both rely on the same underlying filtered results object, which is why changing filters updates the whole page consistently.

The data flow, end to end, is therefore: CSV files -> analyzer builds tracks and direction-aligned runs -> results are normalized and scored -> Electron IPC hands data to the renderer -> filters update the rendered chart and table. That is the full lifecycle of the cornerback directional analysis app.
