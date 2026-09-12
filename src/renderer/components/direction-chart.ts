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
