// A continuous point source that moves along one grid axis at constant speed. The
// source oscillates at its own fixed frequency (f = c / wavelength) while its
// position changes; the Doppler shift is therefore produced by the solver, not
// drawn. Speeds above the wave speed are allowed and produce a Mach cone.
export interface MovingSourceConfig {
  // "horizontal" moves along a row (left to right); "vertical" along a column
  // (top to bottom). Portrait screens use vertical motion for a longer path.
  axis: "horizontal" | "vertical";
  // The fixed coordinate: the row for horizontal motion, the column for vertical.
  lane: number;
  // Position along the axis where the motion starts.
  start: number;
  // The source wraps from max back to min so it keeps moving inside the
  // visible field.
  min: number;
  max: number;
  // Source speed divided by the wave speed (v / c). 1 means "as fast as the wave".
  speedRatio: number;
  wavelengthCells: number;
  amplitude: number;
}

export function movingSourceAxisPosition(
  source: MovingSourceConfig,
  elapsedSeconds: number,
  waveSpeedCellsPerSecond: number,
): number {
  const span = source.max - source.min;

  if (span <= 0) {
    return source.start;
  }

  const travelled = source.speedRatio * waveSpeedCellsPerSecond * Math.max(0, elapsedSeconds);
  const offset = (((source.start - source.min + travelled) % span) + span) % span;
  return source.min + offset;
}

export function movingSourcePosition(
  source: MovingSourceConfig,
  elapsedSeconds: number,
  waveSpeedCellsPerSecond: number,
): { column: number; row: number } {
  const along = movingSourceAxisPosition(source, elapsedSeconds, waveSpeedCellsPerSecond);
  return source.axis === "horizontal"
    ? { column: along, row: source.lane }
    : { column: source.lane, row: along };
}

// Time since the source last restarted its run (start, speed change, or the
// wrap back to min). Only waves emitted after this moment belong to the current
// steady motion, so the Doppler readout measures only the stretch they fill:
// (c - v) * t ahead of the source and (c + v) * t behind it.
export function secondsSinceMovingSourceRestart(
  source: MovingSourceConfig,
  elapsedSeconds: number,
  waveSpeedCellsPerSecond: number,
): number {
  const speed = source.speedRatio * waveSpeedCellsPerSecond;
  const span = source.max - source.min;
  const elapsed = Math.max(0, elapsedSeconds);

  if (speed <= 0 || span <= 0) {
    return elapsed;
  }

  const travelled = speed * elapsed;
  const firstWrapDistance = source.max - source.start;

  if (travelled < firstWrapDistance) {
    return elapsed;
  }

  return ((travelled - firstWrapDistance) % span) / speed;
}

export function movingSourceStrength(
  source: MovingSourceConfig,
  elapsedSeconds: number,
  waveSpeedCellsPerSecond: number,
): number {
  const angularFrequency = (2 * Math.PI * waveSpeedCellsPerSecond) / source.wavelengthCells;
  return Math.sin(angularFrequency * elapsedSeconds) * source.amplitude;
}

// Textbook wavelengths for a source moving slower than the wave.
export function theoreticalDopplerWavelengths(
  wavelengthCells: number,
  speedRatio: number,
): { front: number | undefined; behind: number } {
  return {
    front: speedRatio < 1 ? wavelengthCells * (1 - speedRatio) : undefined,
    behind: wavelengthCells * (1 + speedRatio),
  };
}
