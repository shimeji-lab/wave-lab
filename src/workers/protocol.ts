import type { SolverConfig } from "../physics/solver";
import type { BoundaryCell } from "../physics/solver";
import type { ContinuousSourceConfig } from "../simulation/types";
import type { MovingSourceConfig } from "../physics/movingSource";
import type { WavefrontCircle } from "../physics/wavefronts";

export const workerProtocolVersion = 1 as const;

export type WorkerCommand =
  | { version: typeof workerProtocolVersion; type: "INIT"; config: SolverConfig }
  | { version: typeof workerProtocolVersion; type: "START" }
  | { version: typeof workerProtocolVersion; type: "PAUSE" }
  | { version: typeof workerProtocolVersion; type: "STEP" }
  | { version: typeof workerProtocolVersion; type: "RESET" }
  | { version: typeof workerProtocolVersion; type: "SET_CONTINUOUS_SOURCE"; enabled: boolean }
  | { version: typeof workerProtocolVersion; type: "SET_CONTINUOUS_SOURCES"; sources: ContinuousSourceConfig[] }
  | { version: typeof workerProtocolVersion; type: "SET_SPEED"; multiplier: 0.25 | 0.5 | 1 | 2 }
  | { version: typeof workerProtocolVersion; type: "SET_OBSERVER"; column: number; row: number }
  | { version: typeof workerProtocolVersion; type: "CLEAR_OBSERVER" }
  | { version: typeof workerProtocolVersion; type: "SET_WAVEFRONTS"; enabled: boolean }
  // Superposition mode: also compute 波源1 alone and 波源2 alone.
  | { version: typeof workerProtocolVersion; type: "SET_SUPERPOSITION"; enabled: boolean }
  | { version: typeof workerProtocolVersion; type: "SET_DAMPING"; dampingPerSecond: number }
  | {
      version: typeof workerProtocolVersion;
      type: "SET_MOVING_SOURCE";
      source: MovingSourceConfig | undefined;
      // Keep the current position (for a speed change) instead of restarting.
      keepPosition: boolean;
    }
  | { version: typeof workerProtocolVersion; type: "SET_BOUNDARIES"; cells: BoundaryCell[] }
  | {
      version: typeof workerProtocolVersion;
      type: "INJECT_PULSE";
      column: number;
      row: number;
      amplitude: number;
    }
  | { version: typeof workerProtocolVersion; type: "DISPOSE" };

export type WorkerEvent =
  | { version: typeof workerProtocolVersion; type: "READY" }
  | {
      version: typeof workerProtocolVersion;
      type: "FRAME";
      columns: number;
      rows: number;
      simulationTimeSeconds: number;
      fieldBuffer: ArrayBuffer;
      movingSourcePosition?: { column: number; row: number };
      movingSourceSecondsSinceRestart?: number;
      wavefronts?: WavefrontCircle[];
      // Superposition mode only: the fields of 波源1 alone and 波源2 alone.
      componentBuffers?: [ArrayBuffer, ArrayBuffer];
    }
  | { version: typeof workerProtocolVersion; type: "WARNING"; message: string }
  | {
      version: typeof workerProtocolVersion;
      type: "PERFORMANCE";
      simulationStepsPerSecond: number;
      gridCellCount: number;
    }
  | {
      version: typeof workerProtocolVersion;
      type: "OBSERVATION_SAMPLE";
      column: number;
      row: number;
      simulationTimeSeconds: number;
      displacement: number;
      components?: [number, number];
    }
  | { version: typeof workerProtocolVersion; type: "ERROR"; message: string };
