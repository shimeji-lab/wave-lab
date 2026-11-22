import { createSingleSlitBoundaryCells } from "../physics/boundaries";
import type { BoundaryCell } from "../physics/solver";
import type { ContinuousSourceConfig } from "../simulation/types";
import type { MovingSourceConfig } from "../physics/movingSource";
import type { SectionLine } from "../observation/crossSection";

export type ExperimentPresetId =
  | "pulse"
  | "interference"
  | "superposition"
  | "reflection"
  | "diffraction"
  | "doppler";

export interface ExperimentPreset {
  id: ExperimentPresetId;
  title: string;
  goal: string;
  prompt: string;
}

export interface ExperimentPresetGrid {
  columns: number;
  rows: number;
  visibleInsetCells: number;
}

export interface ExperimentPresetSetup {
  boundaryCells: BoundaryCell[];
  sources: ContinuousSourceConfig[];
  pulse?: { column: number; row: number; amplitude: number };
  movingSource?: MovingSourceConfig;
  // Superposition mode: show 波源1, 波源2 and their sum separately.
  superposition?: boolean;
  sectionLine?: SectionLine;
  interactionMode: "pulse" | "sourceSelect" | "observer";
}

export const experimentPresets: readonly ExperimentPreset[] = [
  {
    id: "pulse",
    title: "パルスの広がり",
    goal: "波は、起こした場所から外へ広がっていく。",
    prompt: "広がる波と、場所そのものの動きを見比べよう。",
  },
  {
    id: "interference",
    title: "二波源干渉",
    goal: "二つの波が重なると、強まる場所と弱まる場所ができる。",
    prompt: "色が強い場所と、ほとんど動かない場所を探そう。",
  },
  {
    id: "superposition",
    title: "重ね合わせ（波源1＋波源2）",
    goal: "二つの波を足し合わせたものが、実際に見える波になる。",
    prompt: "波源1だけ・波源2だけ・合成を切り替えて、どこで強め合うか見よう。",
  },
  {
    id: "reflection",
    title: "壁での反射",
    goal: "壁に届いた波は、向きを変えて戻る。",
    prompt: "壁に着く前と後で、波の進む向きを見よう。",
  },
  {
    id: "diffraction",
    title: "単スリット回折",
    goal: "せまいすき間を通った波は、その先へ広がる。",
    prompt: "すき間の前と後で、波の広がり方を見比べよう。",
  },
  {
    id: "doppler",
    title: "ドップラー効果",
    goal: "動きながら波を出すと、前では波がつまり、後ろでは広がる。",
    prompt: "速さを変えて、前と後ろの波長を見比べよう。",
  },
];

export const dopplerSpeedRatios = [0.3, 0.6, 0.9, 1.3] as const;

export function createExperimentPreset(
  presetId: ExperimentPresetId,
  grid: ExperimentPresetGrid,
): ExperimentPresetSetup {
  const visibleBounds = createVisibleBounds(grid);
  const centerRow = Math.round((visibleBounds.top + visibleBounds.bottom) / 2);
  const visibleWidth = visibleBounds.right - visibleBounds.left;
  const leftColumn = Math.round(visibleBounds.left + visibleWidth * 0.24);
  const sourceColumn = Math.round(visibleBounds.left + visibleWidth * 0.34);
  const barrierColumn = Math.round(visibleBounds.left + visibleWidth * 0.62);

  switch (presetId) {
    case "pulse":
      return {
        boundaryCells: [],
        sources: [],
        pulse: { column: sourceColumn, row: centerRow, amplitude: 4 },
        interactionMode: "pulse",
      };
    case "interference":
      return {
        boundaryCells: [],
        sources: [
          createSource("interference-a", Math.round(visibleBounds.left + visibleWidth * 0.42), centerRow),
          createSource("interference-b", Math.round(visibleBounds.left + visibleWidth * 0.58), centerRow),
        ],
        interactionMode: "sourceSelect",
      };
    case "superposition": {
      const bandHeight = visibleBounds.bottom - visibleBounds.top;

      return {
        boundaryCells: [],
        sources: [
          createSource("superposition-1", Math.round(visibleBounds.left + visibleWidth * 0.42), centerRow),
          createSource("superposition-2", Math.round(visibleBounds.left + visibleWidth * 0.58), centerRow),
        ],
        superposition: true,
        // A horizontal line below the sources crosses the bright and still
        // stripes, like a screen in front of two slits.
        sectionLine: {
          orientation: "horizontal",
          column: Math.round(visibleBounds.left + visibleWidth / 2),
          row: Math.round(centerRow + bandHeight * 0.3),
        },
        interactionMode: "observer",
      };
    }
    case "reflection":
      return {
        boundaryCells: createVerticalWall(
          barrierColumn,
          visibleBounds.top,
          visibleBounds.bottom,
        ),
        sources: [],
        pulse: { column: leftColumn, row: centerRow, amplitude: 4 },
        interactionMode: "pulse",
      };
    case "diffraction":
      return {
        boundaryCells: createSingleSlitBoundaryCells(
          grid.columns,
          grid.rows,
          barrierColumn,
          centerRow,
          Math.min(24, Math.max(12, Math.round((visibleBounds.bottom - visibleBounds.top) * 0.28))),
        ),
        sources: createLineSources(sourceColumn, centerRow, visibleBounds),
        interactionMode: "sourceSelect",
      };
    case "doppler":
      return {
        boundaryCells: [],
        sources: [],
        movingSource: createDopplerSource(visibleBounds),
        interactionMode: "pulse",
      };
  }
}

// The source travels along the longer side of the field (top to bottom on a
// portrait phone, left to right on a PC) so there is room to see the waves
// bunch up ahead of it.
function createDopplerSource(bounds: ReturnType<typeof createVisibleBounds>): MovingSourceConfig {
  const horizontal = bounds.right - bounds.left >= bounds.bottom - bounds.top;
  const min = horizontal ? bounds.left : bounds.top;
  const max = horizontal ? bounds.right : bounds.bottom;

  return {
    axis: horizontal ? "horizontal" : "vertical",
    lane: Math.round(horizontal ? (bounds.top + bounds.bottom) / 2 : (bounds.left + bounds.right) / 2),
    start: Math.round(min + (max - min) * 0.12),
    min,
    max,
    speedRatio: 0.6,
    wavelengthCells: 24,
    amplitude: 0.8,
  };
}

function createVisibleBounds(grid: ExperimentPresetGrid) {
  const margin = grid.visibleInsetCells + 8;

  return {
    left: Math.min(margin, Math.floor(grid.columns / 3)),
    right: Math.max(margin + 1, grid.columns - margin - 1),
    top: Math.min(margin, Math.floor(grid.rows / 3)),
    bottom: Math.max(margin + 1, grid.rows - margin - 1),
  };
}

function createSource(id: string, column: number, row: number): ContinuousSourceConfig {
  return {
    id,
    column,
    row,
    amplitude: 0.8,
    wavelengthCells: 24,
    phaseRadians: 0,
    enabled: true,
  };
}

function createLineSources(
  column: number,
  centerRow: number,
  bounds: ReturnType<typeof createVisibleBounds>,
): ContinuousSourceConfig[] {
  const spacing = Math.max(6, Math.min(10, Math.round((bounds.bottom - bounds.top) / 10)));
  const sources: ContinuousSourceConfig[] = [];

  for (let offset = -3; offset <= 3; offset += 1) {
    const row = Math.max(bounds.top, Math.min(bounds.bottom, centerRow + offset * spacing));
    sources.push({
      ...createSource(`diffraction-line-${offset + 4}`, column, row),
      amplitude: 0.4,
    });
  }

  return sources;
}

function createVerticalWall(column: number, top: number, bottom: number): BoundaryCell[] {
  const cells: BoundaryCell[] = [];

  for (let row = top; row <= bottom; row += 1) {
    cells.push({ column, row }, { column: column + 1, row });
  }

  return cells;
}
