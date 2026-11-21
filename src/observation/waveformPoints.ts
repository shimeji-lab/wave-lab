import type { ObservationSample } from "../simulation/SimulationController";

// The graph's horizontal axis spans a fixed amount of simulation time so that
// the time scale never changes while samples accumulate. The previous version
// stretched however many samples existed across the full width, which made the
// time axis visibly shrink during the first seconds of an experiment.
// 270 normalized seconds = 180 retained samples x one sample per 1.5 s.
export const waveformTimeWindowSeconds = 270;

const graphWidth = 320;
const graphCenterY = 48;
const graphHalfHeight = 42;

export function createWaveformPoints(
  samples: ObservationSample[],
  timeWindowSeconds = waveformTimeWindowSeconds,
  amplitudeScale = 3,
): string {
  const latestSample = samples.at(-1);

  if (latestSample === undefined) {
    return "";
  }

  // Before the window is full, the trace starts at the left edge and grows to
  // the right. Afterwards the newest sample stays at the right edge and older
  // samples scroll off the left edge.
  const windowStartSeconds = Math.max(
    samples[0].simulationTimeSeconds,
    latestSample.simulationTimeSeconds - timeWindowSeconds,
  );

  return samples
    .filter((sample) => sample.simulationTimeSeconds >= windowStartSeconds)
    .map((sample) => {
      const x =
        ((sample.simulationTimeSeconds - windowStartSeconds) / timeWindowSeconds) * graphWidth;
      const normalizedDisplacement = Math.max(
        -1,
        Math.min(1, sample.displacement / amplitudeScale),
      );
      const y = graphCenterY - normalizedDisplacement * graphHalfHeight;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
}
