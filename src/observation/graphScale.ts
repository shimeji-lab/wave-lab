// Shared vertical range for every wave graph. The range is fixed (not
// automatic) so that heights in different graphs and moments stay comparable;
// the learner chooses a wider range to see tall waves next to a source.
export const graphScales = [1, 3, 6, 12] as const;
export type GraphScale = (typeof graphScales)[number];
export const defaultGraphScale: GraphScale = 3;

export function nextGraphScale(scale: GraphScale): GraphScale {
  const index = graphScales.indexOf(scale);
  return graphScales[(index + 1) % graphScales.length];
}
