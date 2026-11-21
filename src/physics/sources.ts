import type { SolverConfig } from "./solver";

export function addGaussianSourceTerm(
  sourceTerm: Float32Array,
  config: SolverConfig,
  column: number,
  row: number,
  strength: number,
): void {
  const radiusCells = 6;
  const varianceCellsSquared = 4;
  // Fractional centres are allowed so a moving source glides smoothly between
  // cells. For integer centres this is identical to the original kernel.
  const centerColumn = Math.round(column);
  const centerRow = Math.round(row);

  for (let rowOffset = -radiusCells; rowOffset <= radiusCells; rowOffset += 1) {
    for (let columnOffset = -radiusCells; columnOffset <= radiusCells; columnOffset += 1) {
      const targetColumn = centerColumn + columnOffset;
      const targetRow = centerRow + rowOffset;

      if (
        targetColumn <= 0 ||
        targetColumn >= config.columns - 1 ||
        targetRow <= 0 ||
        targetRow >= config.rows - 1
      ) {
        continue;
      }

      const distanceSquared = (targetColumn - column) ** 2 + (targetRow - row) ** 2;
      const kernelWeight = Math.exp(-distanceSquared / (2 * varianceCellsSquared));
      sourceTerm[targetRow * config.columns + targetColumn] += strength * kernelWeight;
    }
  }
}

export function rickerWavelet(
  elapsedSeconds: number,
  durationSeconds: number,
  centralFrequencyHz: number,
  amplitude: number,
): number {
  if (elapsedSeconds < 0 || elapsedSeconds > durationSeconds) {
    return 0;
  }

  const centeredTimeSeconds = elapsedSeconds - durationSeconds / 2;
  const squaredPhase = (Math.PI * centralFrequencyHz * centeredTimeSeconds) ** 2;

  return amplitude * (1 - 2 * squaredPhase) * Math.exp(-squaredPhase);
}
