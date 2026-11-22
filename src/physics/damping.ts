// Learner-selectable damping of the medium (the interior, not the hidden
// absorbing layer). The update u_tt + d u_t = c^2 lap u makes a travelling wave
// lose amplitude as exp(-d t / 2) on top of the 2-D spreading, so with c = 1
// cell/s theory says the amplitude halves after 2 ln 2 / d cells. This solver
// measures a slightly faster decay (exponent x1.2 for 弱/中, x1.06 for 強;
// superposition.test.ts), so in practice the amplitude halves after about:
//   弱 0.005 -> ~230 cells (barely visible; the original default)
//   中 0.02  -> ~58 cells
//   強 0.06  -> ~22 cells
export type DampingLevelId = "none" | "weak" | "medium" | "strong";

export interface DampingLevel {
  id: DampingLevelId;
  label: string;
  dampingPerSecond: number;
}

export const dampingLevels: readonly DampingLevel[] = [
  { id: "none", label: "なし", dampingPerSecond: 0 },
  { id: "weak", label: "弱", dampingPerSecond: 0.005 },
  { id: "medium", label: "中", dampingPerSecond: 0.02 },
  { id: "strong", label: "強", dampingPerSecond: 0.06 },
];

export const defaultDampingLevelId: DampingLevelId = "weak";

export function dampingPerSecondFor(id: DampingLevelId): number {
  return dampingLevels.find((level) => level.id === id)?.dampingPerSecond ?? 0.005;
}

export function nextDampingLevelId(id: DampingLevelId): DampingLevelId {
  const index = dampingLevels.findIndex((level) => level.id === id);
  return dampingLevels[(index + 1) % dampingLevels.length].id;
}

