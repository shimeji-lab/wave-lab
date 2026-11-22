import { describe, expect, it } from "vitest";
import { movingSourceAxisPosition, type MovingSourceConfig } from "./movingSource";
import { addGaussianSourceTerm } from "./sources";
import { createSolverState, stepSolver, type SolverConfig } from "./solver";
import {
  detectWavefrontCrossings,
  wavefrontCircles,
  wavefrontPhaseLagRadians,
  type WavefrontEvent,
} from "./wavefronts";

describe("detectWavefrontCrossings", () => {
  it("alternates crests and troughs half a period apart", () => {
    const omega = (2 * Math.PI) / 24;
    const crossings = detectWavefrontCrossings(omega, 0, 0, 48);

    expect(crossings).toHaveLength(4);
    expect(crossings.map((crossing) => crossing.crest)).toEqual([true, false, true, false]);
    expect(crossings[1].time - crossings[0].time).toBeCloseTo(12);
    // First crest: omega t - lag = pi / 2.
    expect(crossings[0].time).toBeCloseTo((Math.PI / 2 + wavefrontPhaseLagRadians) / omega);
  });

  it("finds each crossing once across consecutive intervals", () => {
    const omega = (2 * Math.PI) / 24;
    let count = 0;

    for (let time = 0; time < 96; time += 0.5) {
      count += detectWavefrontCrossings(omega, 0, time, time + 0.5).length;
    }

    expect(count).toBe(8);
  });
});

// Measured with the real solver: drawn crest circles must sit on the solver's
// crests for a resting and for a moving source.
describe("wavefront overlay validation", () => {
  const config: SolverConfig = {
    columns: 361,
    rows: 241,
    waveSpeedCellsPerSecond: 1,
    cellSize: 1,
    timeStepSeconds: 0.5,
    dampingPerSecond: 0,
    absorptionLayerCells: 24,
    absorptionMaxDampingPerSecond: 1.5,
  };

  function simulate(speedRatio: number) {
    const source: MovingSourceConfig = {
      axis: "horizontal",
      lane: 120,
      start: 120,
      min: 20,
      max: 340,
      speedRatio,
      wavelengthCells: 24,
      amplitude: 1,
    };
    const omega = (2 * Math.PI) / source.wavelengthCells;
    const state = createSolverState(config);
    const term = new Float32Array(config.columns * config.rows);
    const events: WavefrontEvent[] = [];

    while (state.simulationTimeSeconds < 180) {
      const time = state.simulationTimeSeconds;

      for (const crossing of detectWavefrontCrossings(omega, 0, time, time + config.timeStepSeconds)) {
        events.push({
          emittedAt: crossing.time,
          column: movingSourceAxisPosition(source, crossing.time, 1),
          row: source.lane,
          crest: crossing.crest,
          sourceIndex: -1,
        });
      }

      term.fill(0);
      addGaussianSourceTerm(
        term,
        config,
        movingSourceAxisPosition(source, time, 1),
        source.lane,
        Math.sin(omega * time),
      );
      stepSolver(state, config, term);
    }

    const sourceColumn = movingSourceAxisPosition(source, state.simulationTimeSeconds, 1);
    const row = Array.from(state.current.subarray(source.lane * config.columns, (source.lane + 1) * config.columns));
    // Crest positions along the source's row predicted by the circles.
    const predicted = wavefrontCircles(events, state.simulationTimeSeconds, 1)
      .filter((circle) => circle.crest)
      .flatMap((circle) => [circle.column - circle.radius, circle.column + circle.radius]);

    return { row, sourceColumn, predicted };
  }

  function solverCrests(row: number[], from: number, to: number): number[] {
    const peak = Math.max(...row.slice(from, to).map(Math.abs));
    const crests: number[] = [];

    for (let x = from; x < to; x += 1) {
      const [a, b, c] = [row[x - 1], row[x], row[x + 1]];

      if (b > a && b >= c && b > peak * 0.2) {
        crests.push(x + (0.5 * (a - c)) / (a - 2 * b + c));
      }
    }

    return crests;
  }

  // Resting source: within 1 cell. Moving at 0.5c the shortest wavelength is
  // 12 cells and the measured worst case is about 1.05 cells, so 1.5 cells
  // (one eighth of that wavelength) is the documented tolerance.
  for (const [speedRatio, tolerance] of [
    [0, 1],
    [0.5, 1.5],
  ] as const) {
    it(`matches solver crests within ${tolerance} cell (source speed ${speedRatio} c)`, () => {
      const { row, sourceColumn, predicted } = simulate(speedRatio);
      const crests = [
        ...solverCrests(row, Math.round(sourceColumn + 25), Math.round(sourceColumn + 110)),
        ...solverCrests(row, Math.round(sourceColumn - 110), Math.round(sourceColumn - 25)),
      ].filter((x) => x > 30 && x < config.columns - 30);

      expect(crests.length).toBeGreaterThan(4);

      for (const crest of crests) {
        const nearest = Math.min(...predicted.map((x) => Math.abs(x - crest)));
        expect(nearest).toBeLessThan(tolerance);
      }
    });
  }
});
