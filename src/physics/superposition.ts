import {
  createSolverState,
  setFixedBoundaryCells,
  type BoundaryCell,
  type SolverConfig,
  type SolverState,
} from "./solver";

// Superposition mode keeps one extra solver per source. The wave equation is
// linear (sources, damping, fixed walls and the absorbing edge all enter
// linearly), so the field produced by both sources together is exactly the sum
// of the fields each source produces alone. The combined field is therefore
// built as part1 + part2 instead of being stepped separately, which keeps
// "合成 = 波源1 + 波源2" true to floating-point precision.
export type SuperpositionParts = [SolverState, SolverState];

export function createSuperpositionParts(
  config: SolverConfig,
  simulationTimeSeconds: number,
  boundaryCells: BoundaryCell[],
): SuperpositionParts {
  const parts: SuperpositionParts = [createSolverState(config), createSolverState(config)];

  for (const part of parts) {
    part.simulationTimeSeconds = simulationTimeSeconds;
    setFixedBoundaryCells(part, config, boundaryCells);
  }

  return parts;
}

// Writes part1 + part2 into the combined state after both parts have stepped.
// The previous combined field becomes `previous`, so leaving superposition mode
// continues the ordinary solver from a consistent pair of time levels.
export function combineSuperpositionParts(target: SolverState, parts: SuperpositionParts): void {
  const recycled = target.previous;
  target.previous = target.current;
  target.current = recycled;

  const [first, second] = parts;

  for (let index = 0; index < target.current.length; index += 1) {
    target.current[index] = first.current[index] + second.current[index];
  }

  target.simulationTimeSeconds = first.simulationTimeSeconds;
}
