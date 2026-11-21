import { describe, expect, it } from "vitest";
import { createWaveformPoints } from "./waveformPoints";

function sample(simulationTimeSeconds: number, displacement = 0) {
  return { column: 0, row: 0, simulationTimeSeconds, displacement };
}

function xValues(points: string): number[] {
  return points.split(" ").map((point) => Number(point.split(",")[0]));
}

describe("createWaveformPoints", () => {
  it("returns nothing without samples", () => {
    expect(createWaveformPoints([])).toBe("");
  });

  it("keeps the time scale fixed while samples accumulate", () => {
    const early = xValues(createWaveformPoints([sample(0), sample(30)], 300));
    const later = xValues(createWaveformPoints([sample(0), sample(30), sample(60)], 300));

    // 30 s always maps to the same horizontal distance (32 px of 320 px).
    expect(early).toEqual([0, 32]);
    expect(later).toEqual([0, 32, 64]);
  });

  it("scrolls once the window is full, keeping the newest sample at the right edge", () => {
    const points = xValues(createWaveformPoints([sample(0), sample(150), sample(300), sample(450)], 300));

    expect(points).toEqual([0, 160, 320]);
  });
});
