import { describe, expect, it } from "vitest";
import { measureWavelength } from "./wavelengthMeasurement";

function sine(length: number, wavelength: number, phase = 0.3): number[] {
  return Array.from({ length }, (_, index) => Math.sin((2 * Math.PI * index) / wavelength + phase));
}

describe("measureWavelength", () => {
  it("measures a clean sine wave", () => {
    expect(measureWavelength(sine(200, 24), 0, 199)).toBeCloseTo(24, 1);
    expect(measureWavelength(sine(200, 13.5), 0, 199)).toBeCloseTo(13.5, 1);
  });

  it("measures only the requested stretch", () => {
    const values = [...sine(150, 12), ...sine(150, 36)];
    expect(measureWavelength(values, 0, 149)).toBeCloseTo(12, 0);
    expect(measureWavelength(values, 150, 299)).toBeCloseTo(36, 0);
  });

  it("needs only about one and a half wavelengths of data", () => {
    expect(measureWavelength(sine(60, 38), 0, 59)).toBeCloseTo(38, 0);
  });

  it("gives no answer for a flat or too short stretch", () => {
    expect(measureWavelength(new Array(100).fill(0), 0, 99)).toBeUndefined();
    expect(measureWavelength(sine(100, 60), 0, 40)).toBeUndefined();
  });
});
