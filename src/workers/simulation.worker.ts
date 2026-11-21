/// <reference lib="webworker" />

import {
  createSolverState,
  resetSolverState,
  setFixedBoundaryCells,
  stepSolver,
  type SolverConfig,
  type SolverState,
} from "../physics/solver";
import { addGaussianSourceTerm, rickerWavelet } from "../physics/sources";
import {
  movingSourceAxisPosition,
  movingSourcePosition,
  movingSourceStrength,
  secondsSinceMovingSourceRestart,
  type MovingSourceConfig,
} from "../physics/movingSource";
import {
  detectWavefrontCrossings,
  pruneWavefrontEvents,
  wavefrontCircles,
  type WavefrontEvent,
} from "../physics/wavefronts";
import { workerProtocolVersion, type WorkerCommand, type WorkerEvent } from "./protocol";
import type { ContinuousSourceConfig } from "../simulation/types";
import { scheduleSimulationSteps } from "./timing";

let config: SolverConfig | undefined;
let state: SolverState | undefined;
let timerId: number | undefined;
let continuousSourceEnabled = false;
let continuousSources: ContinuousSourceConfig[] = [];
let observer: { column: number; row: number } | undefined;
let simulationStepCount = 0;
let playbackSpeed: 0.25 | 0.5 | 1 | 2 = 1;
let lastLoopTickAt = performance.now();
let accumulatedSteps = 0;
let performanceWindowStartedAt = performance.now();
let performanceWindowStepCount = 0;
let sourceTerm: Float32Array | undefined;
let movingSource: MovingSourceConfig | undefined;
// Crest and trough emission records for the theoretical wavefront overlay.
// Recorded continuously so turning the overlay on shows waves already in flight.
let wavefrontEvents: WavefrontEvent[] = [];
let wavefrontsEnabled = false;
let movingSourceStartedAt = 0;
let activePulses: Array<{
  column: number;
  row: number;
  amplitude: number;
  startedAtSeconds: number;
}> = [];

const pulseDurationSeconds = 36;
const pulseCentralFrequencyHz = 1 / 18;

self.onmessage = (message: MessageEvent<WorkerCommand>) => {
  try {
    handleCommand(message.data);
  } catch (error) {
    emit({
      version: workerProtocolVersion,
      type: "ERROR",
      message: error instanceof Error ? error.message : "The simulation worker failed.",
    });
  }
};

function handleCommand(command: WorkerCommand): void {
  if (command.version !== workerProtocolVersion) {
    emit({
      version: workerProtocolVersion,
      type: "ERROR",
      message: "Unsupported simulation worker protocol version.",
    });
    return;
  }

  switch (command.type) {
    case "INIT":
      stopLoop();
      config = command.config;
      state = createSolverState(config);
      sourceTerm = new Float32Array(config.columns * config.rows);
      activePulses = [];
      continuousSourceEnabled = false;
      continuousSources = [];
      observer = undefined;
      movingSource = undefined;
      wavefrontEvents = [];
      simulationStepCount = 0;
      playbackSpeed = 1;
      resetPerformanceWindow();
      emit({ version: workerProtocolVersion, type: "READY" });
      emitFrame();
      return;
    case "START":
      requireState();
      requireConfig();
      startLoop();
      return;
    case "PAUSE":
      stopLoop();
      return;
    case "STEP":
      stepAndEmit();
      return;
    case "RESET":
      stopLoop();
      resetSolverState(requireState());
      setFixedBoundaryCells(requireState(), requireConfig(), []);
      continuousSourceEnabled = false;
      continuousSources = [];
      observer = undefined;
      movingSource = undefined;
      wavefrontEvents = [];
      activePulses = [];
      simulationStepCount = 0;
      resetPerformanceWindow();
      emitFrame();
      return;
    case "SET_CONTINUOUS_SOURCE":
      continuousSourceEnabled = command.enabled;
      return;
    case "SET_CONTINUOUS_SOURCES":
      continuousSources = command.sources.map((source) => ({ ...source }));
      return;
    case "SET_SPEED":
      playbackSpeed = command.multiplier;
      accumulatedSteps = 0;
      lastLoopTickAt = performance.now();
      return;
    case "SET_OBSERVER":
      observer = {
        column: Math.max(1, Math.min(requireConfig().columns - 2, command.column)),
        row: Math.max(1, Math.min(requireConfig().rows - 2, command.row)),
      };
      emitObservationSample();
      return;
    case "SET_MOVING_SOURCE": {
      const now = requireState().simulationTimeSeconds;

      if (command.source !== undefined && command.keepPosition && movingSource !== undefined) {
        movingSource = {
          ...command.source,
          start: movingSourceAxisPosition(
            movingSource,
            requireState().simulationTimeSeconds - movingSourceStartedAt,
            requireConfig().waveSpeedCellsPerSecond,
          ),
        };
      } else {
        movingSource = command.source === undefined ? undefined : { ...command.source };
      }

      movingSourceStartedAt = now;
      emitFrame();
      return;
    }
    case "SET_WAVEFRONTS":
      wavefrontsEnabled = command.enabled;
      emitFrame();
      return;
    case "CLEAR_OBSERVER":
      observer = undefined;
      return;
    case "SET_BOUNDARIES":
      setFixedBoundaryCells(requireState(), requireConfig(), command.cells);
      emitFrame();
      return;
    case "INJECT_PULSE":
      activePulses.push({
        column: command.column,
        row: command.row,
        amplitude: command.amplitude,
        startedAtSeconds: requireState().simulationTimeSeconds,
      });
      return;
    case "DISPOSE":
      stopLoop();
      config = undefined;
      state = undefined;
      return;
  }
}

function startLoop(): void {
  if (timerId !== undefined) {
    return;
  }

  accumulatedSteps = 0;
  lastLoopTickAt = performance.now();
  timerId = self.setInterval(runScheduledSteps, 16);
}

function stopLoop(): void {
  if (timerId !== undefined) {
    self.clearInterval(timerId);
    timerId = undefined;
  }

  accumulatedSteps = 0;
}

function stepAndEmit(): void {
  advanceSimulationStep();
  emitFrame();
  emitPerformanceIfReady(requireConfig());
}

function runScheduledSteps(): void {
  const now = performance.now();
  const schedule = scheduleSimulationSteps(
    accumulatedSteps,
    now - lastLoopTickAt,
    playbackSpeed,
  );
  lastLoopTickAt = now;
  accumulatedSteps = schedule.remainingAccumulator;

  if (schedule.steps === 0) {
    return;
  }

  for (let step = 0; step < schedule.steps; step += 1) {
    advanceSimulationStep();
  }

  emitFrame();
  emitPerformanceIfReady(requireConfig());
}

function advanceSimulationStep(): void {
  const currentState = requireState();
  const currentConfig = requireConfig();
  const currentSourceTerm = requireSourceTerm();
  currentSourceTerm.fill(0);

  if (continuousSourceEnabled) {
    for (const source of continuousSources) {
      if (!source.enabled) {
        continue;
      }

      const sourceAngularFrequency =
        (2 * Math.PI * currentConfig.waveSpeedCellsPerSecond) / source.wavelengthCells;
      const sourceAmplitude =
        Math.sin(currentState.simulationTimeSeconds * sourceAngularFrequency + source.phaseRadians) *
        source.amplitude;
      addGaussianSourceTerm(
        currentSourceTerm,
        currentConfig,
        source.column,
        source.row,
        sourceAmplitude,
      );
    }
  }

  recordWavefrontEvents(currentConfig, currentState.simulationTimeSeconds);
  const movingPosition = currentMovingSourcePosition(currentConfig);

  if (movingSource !== undefined && movingPosition !== undefined) {
    // Oscillation uses absolute simulation time so a speed change does not
    // restart the phase; only the position uses the time since the last change.
    addGaussianSourceTerm(
      currentSourceTerm,
      currentConfig,
      movingPosition.column,
      movingPosition.row,
      movingSourceStrength(
        movingSource,
        currentState.simulationTimeSeconds,
        currentConfig.waveSpeedCellsPerSecond,
      ),
    );
  }

  for (const pulse of activePulses) {
    const elapsedSeconds = currentState.simulationTimeSeconds - pulse.startedAtSeconds;
    const pulseStrength = rickerWavelet(
      elapsedSeconds,
      pulseDurationSeconds,
      pulseCentralFrequencyHz,
      pulse.amplitude,
    );
    addGaussianSourceTerm(currentSourceTerm, currentConfig, pulse.column, pulse.row, pulseStrength);
  }

  activePulses = activePulses.filter(
    (pulse) => currentState.simulationTimeSeconds - pulse.startedAtSeconds <= pulseDurationSeconds,
  );

  stepSolver(currentState, currentConfig, currentSourceTerm);
  simulationStepCount += 1;
  performanceWindowStepCount += 1;

  if (simulationStepCount % 3 === 0) {
    emitObservationSample();
  }
}

function emitPerformanceIfReady(currentConfig: SolverConfig): void {
  const now = performance.now();
  const elapsedMilliseconds = now - performanceWindowStartedAt;

  if (elapsedMilliseconds < 1000) {
    return;
  }

  emit({
    version: workerProtocolVersion,
    type: "PERFORMANCE",
    simulationStepsPerSecond: (performanceWindowStepCount * 1000) / elapsedMilliseconds,
    gridCellCount: currentConfig.columns * currentConfig.rows,
  });
  resetPerformanceWindow();
}

function resetPerformanceWindow(): void {
  performanceWindowStartedAt = performance.now();
  performanceWindowStepCount = 0;
}

function emitObservationSample(): void {
  if (observer === undefined) {
    return;
  }

  const currentState = requireState();
  const currentConfig = requireConfig();
  const index = observer.row * currentConfig.columns + observer.column;

  emit({
    version: workerProtocolVersion,
    type: "OBSERVATION_SAMPLE",
    column: observer.column,
    row: observer.row,
    simulationTimeSeconds: currentState.simulationTimeSeconds,
    displacement: currentState.current[index],
  });
}

function recordWavefrontEvents(currentConfig: SolverConfig, nowSeconds: number): void {
  const nextSeconds = nowSeconds + currentConfig.timeStepSeconds;
  const waveSpeed = currentConfig.waveSpeedCellsPerSecond;

  if (continuousSourceEnabled) {
    for (const source of continuousSources) {
      if (!source.enabled) {
        continue;
      }

      const omega = (2 * Math.PI * waveSpeed) / source.wavelengthCells;

      for (const crossing of detectWavefrontCrossings(omega, source.phaseRadians, nowSeconds, nextSeconds)) {
        wavefrontEvents.push({
          emittedAt: crossing.time,
          column: source.column,
          row: source.row,
          crest: crossing.crest,
        });
      }
    }
  }

  if (movingSource !== undefined) {
    const omega = (2 * Math.PI * waveSpeed) / movingSource.wavelengthCells;

    for (const crossing of detectWavefrontCrossings(omega, 0, nowSeconds, nextSeconds)) {
      const position = movingSourcePosition(
        movingSource,
        crossing.time - movingSourceStartedAt,
        waveSpeed,
      );
      wavefrontEvents.push({ emittedAt: crossing.time, ...position, crest: crossing.crest });
    }
  }

  wavefrontEvents = pruneWavefrontEvents(
    wavefrontEvents,
    nextSeconds,
    waveSpeed,
    Math.hypot(currentConfig.columns, currentConfig.rows),
  );
}

function currentMovingSourcePosition(
  currentConfig: SolverConfig,
): { column: number; row: number } | undefined {
  if (movingSource === undefined) {
    return undefined;
  }

  return movingSourcePosition(
    movingSource,
    requireState().simulationTimeSeconds - movingSourceStartedAt,
    currentConfig.waveSpeedCellsPerSecond,
  );
}

function emitFrame(): void {
  const currentState = requireState();
  const currentConfig = requireConfig();
  const fieldBuffer = currentState.current.slice().buffer;
  const event: WorkerEvent = {
    version: workerProtocolVersion,
    type: "FRAME",
    columns: currentConfig.columns,
    rows: currentConfig.rows,
    simulationTimeSeconds: currentState.simulationTimeSeconds,
    fieldBuffer,
    movingSourcePosition: currentMovingSourcePosition(currentConfig),
    wavefronts: wavefrontsEnabled
      ? wavefrontCircles(
          wavefrontEvents,
          currentState.simulationTimeSeconds,
          currentConfig.waveSpeedCellsPerSecond,
        )
      : undefined,
    movingSourceSecondsSinceRestart:
      movingSource === undefined
        ? undefined
        : secondsSinceMovingSourceRestart(
            movingSource,
            currentState.simulationTimeSeconds - movingSourceStartedAt,
            currentConfig.waveSpeedCellsPerSecond,
          ),
  };

  // The renderer must not receive the Worker-owned solver array. Copying is
  // intentional for this prototype and will be profiled before optimization.
  self.postMessage(event, [fieldBuffer]);
}

function requireState(): SolverState {
  if (state === undefined) {
    throw new Error("Initialize the simulation before sending commands.");
  }

  return state;
}

function requireConfig(): SolverConfig {
  if (config === undefined) {
    throw new Error("Initialize the simulation before sending commands.");
  }

  return config;
}

function requireSourceTerm(): Float32Array {
  if (sourceTerm === undefined) {
    throw new Error("Initialize the simulation before sending source commands.");
  }

  return sourceTerm;
}

function emit(event: WorkerEvent): void {
  self.postMessage(event);
}
