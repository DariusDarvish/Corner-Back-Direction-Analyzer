import type { DirectionResult } from '../types.js';

const format = (number: number | null): string => (number == null ? '—' : number.toFixed(2));

export function renderResultsTable(container: HTMLElement, rows: DirectionResult[]): void {
  const body =
    [...rows]
      .sort((a, b) => b.averageAcceleration - a.averageAcceleration)
      .map(
        (row) =>
          `<tr class="border-b border-sky-200/10 last:border-0"><td class="px-4 py-3">${row.player}</td><td class="px-4 py-3">${row.team}</td><td class="px-4 py-3">${row.direction}</td><td class="px-4 py-3">${row.qualifyingRuns}</td><td class="px-4 py-3">${format(row.averageAcceleration)} yd/s²</td><td class="px-4 py-3">${format(row.averageSpeedAfterFive)} yd/s</td></tr>`,
      )
      .join('') ||
    '<tr><td colspan="6" class="px-4 py-8 text-center text-slate-400">No qualifying runs for this filter.</td></tr>';
  container.innerHTML = `<table class="w-full min-w-200 border-collapse text-left text-sm"><thead class="bg-slate-800/80 text-xs uppercase tracking-wider text-sky-200"><tr><th class="px-4 py-3">Player</th><th class="px-4 py-3">Team</th><th class="px-4 py-3">Direction</th><th class="px-4 py-3">Runs ≥5 yd</th><th class="px-4 py-3">Avg acceleration (0–5 yd)</th><th class="px-4 py-3">Avg speed (6+ yd)</th></tr></thead><tbody>${body}</tbody></table>`;
}
