// Measures the dominant wavelength in a stretch of a cross-section from the
// average spacing between zero crossings (both upward and downward, linearly
// interpolated between cells). Two neighbouring crossings are half a
// wavelength apart, so about one wavelength of wave is enough. Returns
// undefined when the stretch has too little wave in it to give
// an honest answer, for example ahead of a source moving faster than the wave.
export function measureWavelength(
  values: ArrayLike<number>,
  startIndex: number,
  endIndex: number,
  minimumAmplitude = 0.03,
): number | undefined {
  const from = Math.max(0, Math.floor(Math.min(startIndex, endIndex)));
  const to = Math.min(values.length - 1, Math.ceil(Math.max(startIndex, endIndex)));

  if (to - from < 4) {
    return undefined;
  }

  let peak = 0;

  for (let index = from; index <= to; index += 1) {
    peak = Math.max(peak, Math.abs(values[index]));
  }

  if (peak < minimumAmplitude) {
    return undefined;
  }

  // Ignore tiny wiggles around zero so numerical noise does not count as a wave.
  const noiseFloor = peak * 0.05;
  const crossings: number[] = [];
  // Hysteresis: a crossing only counts after the wave has clearly been on the
  // other side, so noise near zero cannot create extra crossings.
  let side: -1 | 0 | 1 = 0;

  for (let index = from; index < to; index += 1) {
    const left = values[index];
    const right = values[index + 1];

    if (left < -noiseFloor) {
      side = -1;
    } else if (left > noiseFloor) {
      side = 1;
    }

    const crossesUp = side === -1 && left < 0 && right >= 0;
    const crossesDown = side === 1 && left > 0 && right <= 0;

    if (crossesUp || crossesDown) {
      crossings.push(index + left / (left - right));
      side = 0;
    }
  }

  if (crossings.length < 3) {
    return undefined;
  }

  return (2 * (crossings[crossings.length - 1] - crossings[0])) / (crossings.length - 1);
}
