// A cross-section samples the solver's current displacement field along one
// grid row (horizontal) or column (vertical). It is a read-only observation of
// the existing field: no physics is computed here. Only axis-aligned lines are
// supported, so every sample is an exact grid value and no interpolation is
// needed. Diagonal sections are intentionally out of scope.
export type SectionOrientation = "horizontal" | "vertical";

export interface SectionLine {
  orientation: SectionOrientation;
  // The tapped cell. A horizontal line uses its row; a vertical line, its column.
  column: number;
  row: number;
}

export interface SectionDomain {
  left: number;
  top: number;
  columns: number;
  rows: number;
}

export const crossSectionGraphWidth = 320;
export const crossSectionGraphHeight = 96;
// Same fixed vertical scale as the observation graph so heights compare directly.
export const crossSectionAmplitudeScale = 3;

export function extractCrossSection(
  field: Float32Array,
  gridColumns: number,
  line: SectionLine,
  domain: SectionDomain,
): Float32Array {
  // Only the visible domain is sampled; the hidden absorbing layer is not part
  // of the experiment the learner sees.
  if (line.orientation === "horizontal") {
    const start = line.row * gridColumns + domain.left;
    return field.slice(start, start + domain.columns);
  }

  const values = new Float32Array(domain.rows);

  for (let index = 0; index < domain.rows; index += 1) {
    values[index] = field[(domain.top + index) * gridColumns + line.column];
  }

  return values;
}

export function createCrossSectionPoints(
  values: ArrayLike<number>,
  width = crossSectionGraphWidth,
  height = crossSectionGraphHeight,
  amplitudeScale = crossSectionAmplitudeScale,
): string {
  if (values.length === 0) {
    return "";
  }

  const centerY = height / 2;
  const halfHeight = height / 2 - 6;
  const points: string[] = [];

  for (let index = 0; index < values.length; index += 1) {
    const x = values.length === 1 ? 0 : (index / (values.length - 1)) * width;
    const normalized = Math.max(-1, Math.min(1, values[index] / amplitudeScale));
    points.push(`${x.toFixed(1)},${(centerY - normalized * halfHeight).toFixed(1)}`);
  }

  return points.join(" ");
}
