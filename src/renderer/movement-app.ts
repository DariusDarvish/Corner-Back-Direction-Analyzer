import { createFilters } from './components/filters.js';
import { renderDirectionAnimations } from './components/direction-animations.js';
import { renderDirectionChart } from './components/direction-chart.js';
import { renderResultsTable } from './components/results-table.js';
import type { Filters, MovementAnalysis } from './types.js';

const output = document.querySelector<HTMLElement>('#analysis-output')!;
const chart = document.querySelector<HTMLElement>('#direction-chart')!;
const table = document.querySelector<HTMLElement>('#results-table')!;
const animations = document.querySelector<HTMLElement>('#direction-animations')!;

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
    renderDirectionAnimations(animations, data.directionAnimations, filters);
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
