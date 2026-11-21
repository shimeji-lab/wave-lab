import { describe, expect, it } from "vitest";
import { measureWavelength } from "../observation/wavelengthMeasurement";
import {
  movingSourceAxisPosition,
  movingSourcePosition,
  movingSourceStrength,
  secondsSinceMovingSourceRestart,
  theoreticalDopplerWavelengths,
  type MovingSourceConfig,
} from "./movingSource";
import { addGaussianSourceTerm } from "./sources";
import { createSolverState, stepSolver, type SolverConfig } from "./solver";

describe("moving source motion", () => {
  const source: MovingSourceConfig = {
    axis: "horizontal",
    lane: 10,
    start: 20,
    min: 10,
    max: 110,
    speedRatio: 0.5,
    wavelengthCells: 24,
    amplitude: 1,
  };

  it("moves at speedRatio times the wave speed", () => {
    expect(movingSourceAxisPosition(source, 0, 1)).toBe(20);
    expect(movingSourceAxisPosition(source, 40, 1)).toBe(40);
  });

  it("wraps back to the left edge after the right edge", () => {
    expect(movingSourceAxisPosition(source, 200, 1)).toBeCloseTo(20);
    expect(movingSourceAxisPosition(source, 190, 1)).toBeCloseTo(115 - 100);
  });

  it("counts time since the start or the last wrap", () => {
    // Start 20, speed 0.5: reaches max 110 after 180 s, then wraps every 200 s.
    expect(secondsSinceMovingSourceRestart(source, 100, 1)).toBe(100);
    expect(secondsSinceMovingSourceRestart(source, 190, 1)).toBeCloseTo(10);
    expect(secondsSinceMovingSourceRestart(source, 390, 1)).toBeCloseTo(10);
  });

  it("maps vertical motion onto rows", () => {
    expect(movingSourcePosition({ ...source, axis: "vertical" }, 40, 1)).toEqual({ column: 10, row: 40 });
  });

  it("gives the textbook Doppler wavelengths", () => {
    expect(theoreticalDopplerWavelengths(24, 0.5)).toEqual({ front: 12, behind: 36 });
    expect(theoreticalDopplerWavelengths(24, 1.3).front).toBeUndefined();
  });
});

describe("moving source physics validation", () => {
  // Measured with the real solver: the wavelength in front of and behind a
  // source moving at half the wave speed must match lambda (1 -/+ v/c).
  it("produces the Doppler wavelengths in front of and behind the source", () => {
    const config: SolverConfig = {
      columns: 420,
      rows: 61,
      waveSpeedCellsPerSecond: 1,
      cellSize: 1,
      timeStepSeconds: 0.5,
      dampingPerSecond: 0,
      absorptionLayerCells: 16,
      absorptionMaxDampingPerSecond: 1.5,
    };
    const source: MovingSourceConfig = {
      axis: "horizontal",
      lane: 30,
      start: 140,
      min: 20,
      max: 400,
      speedRatio: 0.5,
      wavelengthCells: 24,
      amplitude: 1,
    };
    const state = createSolverState(config);
    const sourceTerm = new Float32Array(config.columns * config.rows);
    const durationSeconds = 240;

    while (state.simulationTimeSeconds < durationSeconds) {
      sourceTerm.fill(0);
      addGaussianSourceTerm(
        sourceTerm,
        config,
        movingSourceAxisPosition(source, state.simulationTimeSeconds, 1),
        source.lane,
        movingSourceStrength(source, state.simulationTimeSeconds, 1),
      );
      stepSolver(state, config, sourceTerm);
    }

    const sourceColumn = movingSourceAxisPosition(source, state.simulationTimeSeconds, 1);
    const row = Array.from(
      state.current.subarray(source.lane * config.columns, (source.lane + 1) * config.columns),
    );
    const front = measureWavelength(row, sourceColumn + 15, sourceColumn + 95);
    const behind = measureWavelength(row, sourceColumn - 150, sourceColumn - 30);
    const theory = theoreticalDopplerWavelengths(24, 0.5);

    expect(front).toBeDefined();
    expect(behind).toBeDefined();
    expect(Math.abs(front! - theory.front!) / theory.front!).toBeLessThan(0.1);
    expect(Math.abs(behind! - theory.behind) / theory.behind).toBeLessThan(0.1);
  });
});
