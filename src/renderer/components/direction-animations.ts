import type { DirectionAnimation, DirectionAnimationFrame, DirectionResult } from '../types.js';

const directions = ['North', 'East', 'South', 'West'];
const format = (number: number | null): string => (number == null ? '—' : number.toFixed(2));

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function buildFramePath(frames: DirectionAnimationFrame[]) {
  const xs = frames.map((frame) => frame.x);
  const ys = frames.map((frame) => frame.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const width = Math.max(maxX - minX, 1);
  const height = Math.max(maxY - minY, 1);
  const normalized = frames.map((frame) => ({
    ...frame,
    x: ((frame.x - minX) / width) * 100,
    y: ((frame.y - minY) / height) * 100,
  }));
  return normalized;
}

function getLongestRunForDirection(
  results: DirectionResult[],
  animations: DirectionAnimation[],
  direction: string,
): DirectionAnimation | null {
  const matching = animations.filter((item) => item.direction === direction);
  if (!matching.length) return null;
  return matching.reduce((best, current) =>
    current.frameCount > best.frameCount ? current : best,
  );
}

function renderAnimationCard(animation: DirectionAnimation): string {
  const frames = buildFramePath(animation.frames);
  const startFrame = frames[0];
  const lastFrame = frames[frames.length - 1];
  const pathway = frames
    .map((frame, index) => {
      const isFirst = index === 0;
      const x = isFirst ? 50 : clamp(frame.x, 0, 100);
      const y = isFirst ? 50 : clamp(frame.y, 0, 100);
      return `${isFirst ? 'M' : 'L'} ${x} ${y}`;
    })
    .join(' ');

  const startMarkerX = clamp(startFrame.x, 0, 100);
  const startMarkerY = clamp(startFrame.y, 0, 100);
  const endMarkerX = clamp(lastFrame.x, 0, 100);
  const endMarkerY = clamp(lastFrame.y, 0, 100);

  return `
    <section class="rounded-xl border border-sky-200/15 bg-slate-900/80 p-4 shadow-lg shadow-slate-950/20">
      <div class="mb-3 flex items-center justify-between gap-3">
        <div>
          <div class="text-xs font-bold uppercase tracking-[.12em] text-cyan-300">${animation.direction}</div>
          <div class="mt-1 text-lg font-bold text-white">${animation.player}</div>
        </div>
        <div class="text-right text-xs text-slate-300">
          <div>Team: ${animation.team}</div>
          <div>Frames: ${animation.frameCount}</div>
        </div>
      </div>
      <div class="relative overflow-hidden rounded-xl border border-sky-200/10 bg-slate-950/70 p-3">
        <svg viewBox="0 0 100 100" class="h-52 w-full">
          <path data-direction="${animation.direction}" data-role="track" d="${pathway}" fill="none" stroke="rgba(103,232,249,0.7)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />
          <circle data-direction="${animation.direction}" data-role="start-marker" cx="${startMarkerX}" cy="${startMarkerY}" r="2.7" fill="#a78bfa" />
          <circle data-direction="${animation.direction}" data-role="end-marker" cx="${endMarkerX}" cy="${endMarkerY}" r="2.7" fill="#7dd3fc" />
          <circle data-direction="${animation.direction}" data-role="current-marker" cx="${startMarkerX}" cy="${startMarkerY}" r="3.5" fill="#f8fafc" stroke="#22d3ee" stroke-width="0.8" />
          <line data-direction="${animation.direction}" data-role="orientation-line" x1="${startMarkerX}" y1="${startMarkerY}" x2="${startMarkerX}" y2="${startMarkerY}" stroke="rgba(248,250,252,0.9)" stroke-width="1.2" stroke-linecap="round" />
        </svg>
      </div>
      <div class="mt-4 flex items-center gap-3">
        <button type="button" data-direction="${animation.direction}" data-action="toggle" class="rounded-lg bg-cyan-300 px-3 py-2 text-sm font-bold text-slate-950 hover:bg-cyan-200">Pause</button>
        <input type="range" min="0" max="${Math.max(animation.frameCount - 1, 0)}" value="0" data-direction="${animation.direction}" data-role="slider" class="w-full accent-cyan-300" />
        <div class="w-24 text-right text-xs text-slate-300"><span data-direction="${animation.direction}" data-role="frame-label">1 / ${animation.frameCount}</span></div>
      </div>
      <div class="mt-3 flex items-center gap-3 text-xs text-slate-300">
        <button type="button" data-direction="${animation.direction}" data-action="step-back" class="rounded border border-sky-200/20 px-2 py-1 hover:bg-slate-800">-1</button>
        <button type="button" data-direction="${animation.direction}" data-action="step-forward" class="rounded border border-sky-200/20 px-2 py-1 hover:bg-slate-800">+1</button>
        <label class="ml-auto flex items-center gap-2">
          Speed
          <select data-direction="${animation.direction}" data-role="speed" class="rounded border border-sky-200/20 bg-slate-900 px-2 py-1 text-slate-100">
            <option value="0.5">0.5x</option>
            <option value="1" selected>1x</option>
            <option value="1.5">1.5x</option>
            <option value="2">2x</option>
          </select>
        </label>
      </div>
    </section>
  `;
}

export function renderDirectionAnimations(
  container: HTMLElement,
  animations: DirectionAnimation[],
  filters: { team: string; player: string },
): void {
  const activeAnimations = animations.filter((animation) => {
    const teamMatch = !filters.team || animation.team === filters.team;
    const playerMatch = !filters.player || animation.player.toLowerCase().includes(filters.player.toLowerCase());
    return teamMatch && playerMatch;
  });

  const cards = directions
    .map((direction) => getLongestRunForDirection([], activeAnimations, direction))
    .filter((animation): animation is DirectionAnimation => animation != null)
    .map((animation) => renderAnimationCard(animation))
    .join('');

  container.innerHTML = cards || '<div class="col-span-full rounded-xl border border-sky-200/15 bg-slate-900/80 p-6 text-slate-300">No animation data for this filter.</div>';

  directions.forEach((direction) => {
    const animation = activeAnimations.find((item) => item.direction === direction);
    if (!animation) return;

    const slider = container.querySelector<HTMLInputElement>(`[data-direction="${direction}"][data-role="slider"]`);
    const frameLabel = container.querySelector<HTMLElement>(`[data-direction="${direction}"][data-role="frame-label"]`);
    const speedSelect = container.querySelector<HTMLSelectElement>(`[data-direction="${direction}"][data-role="speed"]`);
    const currentMarker = container.querySelector<SVGCircleElement>(`[data-direction="${direction}"][data-role="current-marker"]`);
    const orientationLine = container.querySelector<SVGLineElement>(`[data-direction="${direction}"][data-role="orientation-line"]`);
    const toggleButton = container.querySelector<HTMLButtonElement>(`[data-direction="${direction}"][data-action="toggle"]`);
    const stepBackButton = container.querySelector<HTMLButtonElement>(`[data-direction="${direction}"][data-action="step-back"]`);
    const stepForwardButton = container.querySelector<HTMLButtonElement>(`[data-direction="${direction}"][data-action="step-forward"]`);
    const currentFrames = buildFramePath(animation.frames);

    let paused = false;
    let speed = 1;
    let currentIndex = 0;
    let intervalId: number | undefined;

    const updatePlayerPosition = (): void => {
      const frame = currentFrames[currentIndex];
      if (!frame || !slider || !frameLabel || !currentMarker || !orientationLine) return;

      slider.value = String(currentIndex);
      frameLabel.textContent = `${currentIndex + 1} / ${currentFrames.length}`;
      currentMarker.setAttribute('cx', String(clamp(frame.x, 0, 100)));
      currentMarker.setAttribute('cy', String(clamp(frame.y, 0, 100)));

      const angleRadians = ((frame.o % 360) * Math.PI) / 180;
      const facingX = clamp(frame.x + Math.cos(angleRadians) * 5, 0, 100);
      const facingY = clamp(frame.y + Math.sin(angleRadians) * 5, 0, 100);
      orientationLine.setAttribute('x1', String(clamp(frame.x, 0, 100)));
      orientationLine.setAttribute('y1', String(clamp(frame.y, 0, 100)));
      orientationLine.setAttribute('x2', String(facingX));
      orientationLine.setAttribute('y2', String(facingY));
    };

    const stopAnimation = (): void => {
      if (intervalId) {
        window.clearInterval(intervalId);
        intervalId = undefined;
      }
    };

    const startAnimation = (): void => {
      stopAnimation();
      intervalId = window.setInterval(() => {
        if (paused) return;
        currentIndex = (currentIndex + 1) % currentFrames.length;
        updatePlayerPosition();
      }, 1000 / (Math.max(speed, 0.1) * 8));
    };

    toggleButton?.addEventListener('click', () => {
      paused = !paused;
      toggleButton.textContent = paused ? 'Play' : 'Pause';
      if (!paused) startAnimation();
    });

    speedSelect?.addEventListener('change', () => {
      speed = Number(speedSelect.value);
      if (!paused) startAnimation();
    });

    slider?.addEventListener('input', (event) => {
      const nextValue = Number((event.target as HTMLInputElement).value);
      currentIndex = nextValue;
      paused = true;
      if (toggleButton) toggleButton.textContent = 'Play';
      stopAnimation();
      updatePlayerPosition();
    });

    stepBackButton?.addEventListener('click', () => {
      paused = true;
      if (toggleButton) toggleButton.textContent = 'Play';
      currentIndex = Math.max(0, currentIndex - 1);
      stopAnimation();
      updatePlayerPosition();
    });

    stepForwardButton?.addEventListener('click', () => {
      paused = true;
      if (toggleButton) toggleButton.textContent = 'Play';
      currentIndex = Math.min(currentFrames.length - 1, currentIndex + 1);
      stopAnimation();
      updatePlayerPosition();
    });

    updatePlayerPosition();
    if (!paused) startAnimation();
  });
}
