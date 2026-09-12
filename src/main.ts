import { app, BrowserWindow, ipcMain } from 'electron';
import fs from 'node:fs';
import path from 'node:path';

type Row = Record<string, string>;
type Summary = {
  player: string;
  team: string;
  direction: string;
  qualifyingRuns: number;
  averageAcceleration: number;
  averageSpeedAfterFive: number | null;
  accelerationSamples: number;
  speedSamples: number;
};
const root = path.join(app.getAppPath(), 'NFL_DATA');
const value = (text: string): number => Number.parseFloat(text);

function csv(text: string): Row[] {
  const split = (line: string): string[] => {
    const cells: string[] = [];
    let cell = '';
    let quote = false;
    for (let i = 0; i < line.length; i += 1) {
      const c = line[i];
      if (c === '"') {
        if (quote && line[i + 1] === '"') {
          cell += c;
          i += 1;
        } else quote = !quote;
      } else if (c === ',' && !quote) {
        cells.push(cell);
        cell = '';
      } else cell += c;
    }
    cells.push(cell);
    return cells;
  };
  const lines = text.trim().split(/\r?\n/);
  const headers = split(lines[0]).map((x) => x.replace(/^\uFEFF/, ''));
  return lines.slice(1).map((line) => {
    const cells = split(line);
    return Object.fromEntries(headers.map((header, i) => [header, cells[i] ?? '']));
  });
}

function direction(angle: number): string | null {
  const degrees = ((angle % 360) + 360) % 360;
  if (degrees >= 315 || degrees <= 45) return 'North';
  if (degrees >= 46 && degrees <= 134) return 'East';
  if (degrees >= 135 && degrees <= 224) return 'South';
  if (degrees >= 225 && degrees <= 314) return 'West';
  return null;
}

function analyseMovement(): { results: Summary[]; players: string[]; teams: string[]; source: string } {
  const plays = new Map(
    csv(fs.readFileSync(path.join(root, 'supplementary_data.csv'), 'utf8')).map((r) => [
      `${r.game_id}:${r.play_id}`,
      r.defensive_team,
    ]),
  );
  const tracks = new Map<string, Row[]>();
  const train = path.join(root, 'train');
  for (const file of fs.readdirSync(train).filter((name) => /^input_.*\.csv$/.test(name))) {
    for (const row of csv(fs.readFileSync(path.join(train, file), 'utf8'))) {
      if (row.player_side !== 'Defense' || row.player_position !== 'CB') continue;
      const key = `${row.game_id}:${row.play_id}:${row.nfl_id}`;
      tracks.set(key, [...(tracks.get(key) ?? []), row]);
    }
  }
  type Total = Summary & { acceleration: number[]; speed: number[] };
  const totals = new Map<string, Total>();
  const store = (rows: Row[], cardinal: string, acceleration: number[], speed: number[]): void => {
    if (!acceleration.length) return;
    const first = rows[0];
    const team = plays.get(`${first.game_id}:${first.play_id}`) ?? 'Unknown';
    const key = `${first.nfl_id}:${cardinal}`;
    const total = totals.get(key) ?? {
      player: first.player_name,
      team,
      direction: cardinal,
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
    let active: string | null = null,
      run: Row[] = [],
      distance = 0,
      acceleration: number[] = [],
      speed: number[] = [];
    const endRun = (): void => {
      if (active && distance >= 5) store(run, active, acceleration, speed);
      active = null;
      run = [];
      distance = 0;
      acceleration = [];
      speed = [];
    };
    for (const row of rows) {
      const orientation = direction(value(row.o));
      const travel = direction(value(row.dir));
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
      if (distance <= 5) acceleration.push(value(row.a));
      if (distance >= 6) speed.push(value(row.s));
    }
    endRun();
  }
  const results = [...totals.values()].map(({ acceleration, speed, ...total }) => ({
    ...total,
    averageAcceleration: acceleration.reduce((a, b) => a + b, 0) / acceleration.length,
    averageSpeedAfterFive: speed.length ? speed.reduce((a, b) => a + b, 0) / speed.length : null,
    accelerationSamples: acceleration.length,
    speedSamples: speed.length,
  }));
  return {
    results,
    players: [...new Set(results.map((r) => r.player))].sort(),
    teams: [...new Set(results.map((r) => r.team))].sort(),
    source: `${tracks.size.toLocaleString()} CB input windows scanned`,
  };
}

function window(): void {
  const browser = new BrowserWindow({
    width: 1280,
    height: 840,
    webPreferences: { contextIsolation: true, preload: path.join(__dirname, 'preload.js') },
  });
  void browser.loadFile(path.join(__dirname, '../movement.html'));
}
app.whenReady().then(() => {
  ipcMain.handle('movement:analyse', analyseMovement);
  window();
});
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
