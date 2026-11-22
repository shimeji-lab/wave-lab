import { describe, expect, it } from "vitest";
import { troughDashCount } from "./WaveCanvas";

describe("troughDashCount", () => {
  it("uses powers of two so each change splits every dash in place", () => {
    for (let radius = 1; radius <= 400; radius += 0.5) {
      const count = troughDashCount(radius);
      expect(Math.log2(count) % 1).toBe(0);
      expect(count).toBeGreaterThanOrEqual(8);
    }
  });

  it("keeps the count fixed over a range of radii, so dashes do not slide", () => {
    expect(troughDashCount(60)).toBe(troughDashCount(70));
    expect(troughDashCount(200)).toBe(2 * troughDashCount(100));
  });
});
