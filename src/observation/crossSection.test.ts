import { describe, expect, it } from "vitest";
import { createCrossSectionPoints, extractCrossSection } from "./crossSection";

// 5 x 4 grid where each value encodes its position: value = row * 10 + column.
const gridColumns = 5;
const field = Float32Array.from({ length: 20 }, (_, index) => {
  const row = Math.floor(index / gridColumns);
  const column = index % gridColumns;
  return row * 10 + column;
});
const domain = { left: 1, top: 1, columns: 3, rows: 2 };

describe("extractCrossSection", () => {
  it("samples a grid row inside the visible domain", () => {
    const values = extractCrossSection(field, gridColumns, { orientation: "horizontal", column: 2, row: 2 }, domain);
    expect([...values]).toEqual([21, 22, 23]);
  });

  it("samples a grid column inside the visible domain", () => {
    const values = extractCrossSection(field, gridColumns, { orientation: "vertical", column: 3, row: 1 }, domain);
    expect([...values]).toEqual([13, 23]);
  });
});

describe("createCrossSectionPoints", () => {
  it("spreads samples across the full width with a fixed vertical scale", () => {
    expect(createCrossSectionPoints([0, 3, -3], 100, 40, 3)).toBe("0.0,20.0 50.0,6.0 100.0,34.0");
  });

  it("clamps values outside the fixed scale", () => {
    expect(createCrossSectionPoints([9, -9], 100, 40, 3)).toBe("0.0,6.0 100.0,34.0");
  });
});
