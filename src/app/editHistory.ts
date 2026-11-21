import type { BoundaryCell } from "../physics/solver";
import type { SectionLine } from "../observation/crossSection";
import type { MovingSourceConfig } from "../physics/movingSource";
import type { ContinuousSourceConfig } from "../simulation/types";

// Undo restores what the learner placed in the experiment (walls, sources and
// the observation point). It deliberately does not rewind the wave field: the
// field is the solver's evolving state, and replaying it backwards would need
// stored solver snapshots that the architecture does not keep.
export interface SceneSnapshot {
  boundaryCells: BoundaryCell[];
  continuousSources: ContinuousSourceConfig[];
  continuousSourceEnabled: boolean;
  observer: { column: number; row: number } | undefined;
  sectionLine: SectionLine | undefined;
  movingSource: MovingSourceConfig | undefined;
}

export interface EditHistory {
  entries: SceneSnapshot[];
  // Consecutive edits with the same non-empty key (for example, dragging one
  // source's slider) are merged into a single undo step.
  lastMergeKey: string | undefined;
}

export const maximumHistoryEntries = 40;

export function createEditHistory(): EditHistory {
  return { entries: [], lastMergeKey: undefined };
}

export function recordEdit(
  history: EditHistory,
  before: SceneSnapshot,
  mergeKey?: string,
): EditHistory {
  if (mergeKey !== undefined && mergeKey === history.lastMergeKey) {
    return history;
  }

  return {
    entries: [...history.entries, before].slice(-maximumHistoryEntries),
    lastMergeKey: mergeKey,
  };
}

export function breakEditMerge(history: EditHistory): EditHistory {
  return history.lastMergeKey === undefined ? history : { ...history, lastMergeKey: undefined };
}

export function undoEdit(
  history: EditHistory,
): { history: EditHistory; snapshot: SceneSnapshot } | undefined {
  const snapshot = history.entries.at(-1);

  if (snapshot === undefined) {
    return undefined;
  }

  return {
    history: { entries: history.entries.slice(0, -1), lastMergeKey: undefined },
    snapshot,
  };
}
