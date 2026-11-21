import { describe, expect, it } from "vitest";
import {
  breakEditMerge,
  createEditHistory,
  maximumHistoryEntries,
  recordEdit,
  undoEdit,
  type SceneSnapshot,
} from "./editHistory";

function scene(sourceCount: number): SceneSnapshot {
  return {
    boundaryCells: [],
    continuousSources: Array.from({ length: sourceCount }, (_, index) => ({
      id: `source-${index}`,
      column: 40,
      row: 40,
      amplitude: 0.8,
      wavelengthCells: 24,
      phaseRadians: 0,
      enabled: true,
    })),
    continuousSourceEnabled: sourceCount > 0,
    observer: undefined,
    sectionLine: undefined,
    movingSource: undefined,
  };
}

describe("edit history", () => {
  it("returns nothing when there is nothing to undo", () => {
    expect(undoEdit(createEditHistory())).toBeUndefined();
  });

  it("undoes edits in reverse order", () => {
    let history = createEditHistory();
    history = recordEdit(history, scene(0));
    history = recordEdit(history, scene(1));

    const first = undoEdit(history);
    expect(first?.snapshot.continuousSources).toHaveLength(1);

    const second = undoEdit(first!.history);
    expect(second?.snapshot.continuousSources).toHaveLength(0);
    expect(undoEdit(second!.history)).toBeUndefined();
  });

  it("merges a continuous slider drag into one undo step", () => {
    let history = createEditHistory();
    history = recordEdit(history, scene(1), "source:source-0");
    history = recordEdit(history, scene(1), "source:source-0");
    history = recordEdit(history, scene(1), "source:source-0");

    expect(history.entries).toHaveLength(1);

    history = breakEditMerge(history);
    history = recordEdit(history, scene(1), "source:source-0");
    expect(history.entries).toHaveLength(2);
  });

  it("keeps only the most recent entries", () => {
    let history = createEditHistory();

    for (let index = 0; index < maximumHistoryEntries + 5; index += 1) {
      history = recordEdit(history, scene(index));
    }

    expect(history.entries).toHaveLength(maximumHistoryEntries);
    expect(history.entries[0].continuousSources).toHaveLength(5);
  });
});
