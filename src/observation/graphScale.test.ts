import { describe, expect, it } from "vitest";
import { nextGraphScale } from "./graphScale";

describe("nextGraphScale", () => {
  it("cycles through the ranges and wraps around", () => {
    expect(nextGraphScale(1)).toBe(3);
    expect(nextGraphScale(3)).toBe(6);
    expect(nextGraphScale(6)).toBe(12);
    expect(nextGraphScale(12)).toBe(1);
  });
});
