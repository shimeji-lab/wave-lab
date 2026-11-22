import { describe, expect, it } from "vitest";
import { dampingLevels } from "./damping";
import { addGaussianSourceTerm } from "./sources";
import {
  createSolverState,
  setFixedBoundaryCells,
  stepSolver,
  type SolverConfig,
} from "./solver";
import { combineSuperpositionParts, createSuperpositionParts } from "./superposition";

const baseConfig: SolverConfig = {
  columns: 96,
  rows: 80,
  waveSpeedCellsPerSecond: 1,
  cellSize: 1,
  timeStepSeconds: 0.5,
  dampingPerSecond: 0.02,
  absorptionLayerCells: 16,
  absorptionMaxDampingPerSecond: 1.5,
};

const sources = [
  { column: 40, row: 40, wavelength: 16, phase: 0, amplitude: 0.8 },
  { column: 56, row: 40, wavelength: 20, phase: 1.1, amplitude: 0.5 },
];

function sourceStrength(source: (typeof sources)[number], timeSeconds: number): number {
  return Math.sin((2 * Math.PI * timeSeconds) / source.wavelength + source.phase) * source.amplitude;
}

describe("superposition parts", () => {
  it("rebuilds the two-source field exactly as part 1 + part 2, walls included", () => {
    const walls = Array.from({ length: 20 }, (_, index) => ({ column: 70, row: 30 + index }));
    const full = createSolverState(baseConfig);
    const combined = createSolverState(baseConfig);
    setFixedBoundaryCells(full, baseConfig, walls);
    setFixedBoundaryCells(combined, baseConfig, walls);
    const parts = createSuperpositionParts(baseConfig, 0, walls);
    const term = new Float32Array(baseConfig.columns * baseConfig.rows);

    for (let step = 0; step < 240; step += 1) {
      const time = full.simulationTimeSeconds;
      term.fill(0);

      for (const source of sources) {
        addGaussianSourceTerm(term, baseConfig, source.column, source.row, sourceStrength(source, time));
      }

      stepSolver(full, baseConfig, term);

      sources.forEach((source, index) => {
        term.fill(0);
        addGaussianSourceTerm(term, baseConfig, source.column, source.row, sourceStrength(source, time));
        stepSolver(parts[index], baseConfig, term);
      });
      combineSuperpositionParts(combined, parts);
    }

    let largestDifference = 0;
    let largestValue = 0;

    for (let index = 0; index < full.current.length; index += 1) {
      largestDifference = Math.max(largestDifference, Math.abs(full.current[index] - combined.current[index]));
      largestValue = Math.max(largestValue, Math.abs(full.current[index]));
    }

    expect(largestValue).toBeGreaterThan(0.5);
    expect(largestDifference).toBeLessThan(1e-4);
    expect(combined.simulationTimeSeconds).toBeCloseTo(full.simulationTimeSeconds);
  });
});

describe("damping levels", () => {
  // Envelope of a steady wave along a row, far and near, for each level.
  function amplitudeRatio(dampingPerSecond: number): number {
    const config: SolverConfig = {
      ...baseConfig,
      columns: 240,
      rows: 120,
      dampingPerSecond,
      absorptionLayerCells: 24,
    };
    const state = createSolverState(config);
    const term = new Float32Array(config.columns * config.rows);
    const row = 60;
    const sourceColumn = 50;
    let near = 0;
    let far = 0;

    for (let step = 0; step < 640; step += 1) {
      term.fill(0);
      addGaussianSourceTerm(term, config, sourceColumn, row, Math.sin((2 * Math.PI * state.simulationTimeSeconds) / 16));
      stepSolver(state, config, term);

      if (step >= 560) {
        near = Math.max(near, Math.abs(state.current[row * config.columns + sourceColumn + 40]));
        far = Math.max(far, Math.abs(state.current[row * config.columns + sourceColumn + 140]));
      }
    }

    return far / near;
  }

  it("weakens waves more with distance as the level rises, matching exp(-d r / 2)", () => {
    const ratios = dampingLevels.map((level) => amplitudeRatio(level.dampingPerSecond));

    for (let index = 1; index < ratios.length; index += 1) {
      expect(ratios[index]).toBeLessThan(ratios[index - 1]);
    }

    // Damping alone over the extra 100 cells: theory exp(-d * 100 / 2). This
    // solver measures a slightly faster decay (about 1.2x in the exponent),
    // which docs/PHYSICS_ENGINE.md records.
    for (let index = 1; index < ratios.length; index += 1) {
      const exponent =
        -Math.log(ratios[index] / ratios[0]) / (dampingLevels[index].dampingPerSecond * 50);
      expect(exponent).toBeGreaterThan(0.9);
      expect(exponent).toBeLessThan(1.4);
    }
  });
});
