// Theoretical wavefront circles for waves that travel straight from a source
// without hitting anything. They are drawn on top of the solver's field as a
// comparison aid; the coloured field itself remains the numerical result.
//
// A source term sin(omega t + phase) forces the 2-D wave equation. The
// outgoing wave lags the forcing: the 2-D far-field (Hankel) asymptote gives
// pi/4, and the measured lag in this solver is 0.84-0.98 rad for wavelengths
// of 16-36 cells at radii of 30-110 cells (probe recorded in CHANGELOG for
// 0.1.0-prototype.19). The validation test keeps the drawn crests within one
// cell of the solver's crests.
export const wavefrontPhaseLagRadians = 0.9;

export interface WavefrontEvent {
  // Simulation time at which this crest or trough left the source.
  emittedAt: number;
  column: number;
  row: number;
  crest: boolean;
  // Index in the continuous-source list (0 = 波源1); -1 for the moving source.
  sourceIndex: number;
}

export interface WavefrontCircle {
  column: number;
  row: number;
  radius: number;
  crest: boolean;
  sourceIndex: number;
}

// Finds crests (effective phase pi/2) and troughs (3 pi/2) that a source emits
// between two times. effectivePhase(t) = omega t + phase - lag.
export function detectWavefrontCrossings(
  angularFrequency: number,
  phaseRadians: number,
  fromSeconds: number,
  toSeconds: number,
): Array<{ time: number; crest: boolean }> {
  if (angularFrequency <= 0 || toSeconds <= fromSeconds) {
    return [];
  }

  const offset = phaseRadians - wavefrontPhaseLagRadians - Math.PI / 2;
  // Crossing number n happens when omega t + offset = n pi.
  const firstIndex = Math.floor((angularFrequency * fromSeconds + offset) / Math.PI) + 1;
  const lastIndex = Math.floor((angularFrequency * toSeconds + offset) / Math.PI);
  const crossings: Array<{ time: number; crest: boolean }> = [];

  for (let index = firstIndex; index <= lastIndex; index += 1) {
    crossings.push({
      time: (index * Math.PI - offset) / angularFrequency,
      crest: ((index % 2) + 2) % 2 === 0,
    });
  }

  return crossings;
}

export function wavefrontCircles(
  events: readonly WavefrontEvent[],
  nowSeconds: number,
  waveSpeedCellsPerSecond: number,
  minimumRadius = 3,
): WavefrontCircle[] {
  const circles: WavefrontCircle[] = [];

  for (const event of events) {
    const radius = waveSpeedCellsPerSecond * (nowSeconds - event.emittedAt);

    if (radius >= minimumRadius) {
      circles.push({
        column: event.column,
        row: event.row,
        radius,
        crest: event.crest,
        sourceIndex: event.sourceIndex,
      });
    }
  }

  return circles;
}

export function pruneWavefrontEvents(
  events: WavefrontEvent[],
  nowSeconds: number,
  waveSpeedCellsPerSecond: number,
  maximumRadius: number,
): WavefrontEvent[] {
  return events.filter(
    (event) => waveSpeedCellsPerSecond * (nowSeconds - event.emittedAt) <= maximumRadius,
  );
}
