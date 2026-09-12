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
