import { useEffect, useRef, useState } from "react";
import {
  createExperimentPreset,
  dopplerSpeedRatios,
  experimentPresets,
  type ExperimentPresetId,
} from "../experiments/presets";
import { CrossSectionPanel } from "../observation/CrossSectionPanel";
import { DopplerPanel } from "../observation/DopplerPanel";
import { defaultGraphScale, nextGraphScale, type GraphScale } from "../observation/graphScale";
import type { MovingSourceConfig } from "../physics/movingSource";
import type { SectionLine, SectionOrientation } from "../observation/crossSection";
import { ObservationPanel } from "../observation/ObservationPanel";
import { SuperpositionPanel } from "../observation/SuperpositionPanel";
import {
  dampingLevels,
  dampingPerSecondFor,
  defaultDampingLevelId,
  nextDampingLevelId,
  type DampingLevelId,
} from "../physics/damping";
import { createSingleSlitBoundaryCells } from "../physics/boundaries";
import type { BoundaryCell, SolverConfig } from "../physics/solver";
import { WaveCanvas, type SuperpositionView } from "../renderer/WaveCanvas";
import { appVersion } from "../shared/version";
import { DiagnosticsPanel, type ViewportDiagnostic } from "../ui/DiagnosticsPanel";
import { ExperimentGallery } from "../ui/ExperimentGallery";
import { SourceSettingsPanel } from "../ui/SourceSettingsPanel";
import {
  SimulationController,
  type ObservationSample,
  type PerformanceMeasurement,
  type SimulationFrame,
} from "../simulation/SimulationController";
import type { ContinuousSourceConfig } from "../simulation/types";
import { Icon, type IconName } from "../ui/Icon";
import {
  breakEditMerge,
  createEditHistory,
  recordEdit,
  undoEdit,
  type SceneSnapshot,
} from "./editHistory";
import { resolveSourceTap } from "./sourceInteraction";

type SimulationStatus = "loading" | "ready" | "running" | "paused" | "error";
type InteractionMode =
  | "pulse"
  | "observer"
  | "source"
  | "sourceSelect"
  | "wall"
  | "slit"
  | "erase"
  | "section"
  | "placeSource1"
  | "placeSource2";
// "壁を消す" (erase) lives inside the wall tool as a draw/erase switch so the
// tool row keeps six entries on narrow phones.
type Tool =
  | "pulse"
  | "source"
  | "observer"
  | "section"
  | "wall"
  | "slit"
  | "placeSource1"
  | "placeSource2";

const tools: Array<{ tool: Tool; label: string; icon: IconName }> = [
  { tool: "pulse", label: "波を起こす", icon: "pulse" },
  { tool: "source", label: "波源", icon: "source" },
  { tool: "observer", label: "観測点", icon: "observer" },
  { tool: "section", label: "断面", icon: "section" },
  { tool: "wall", label: "壁", icon: "wall" },
  { tool: "slit", label: "スリット", icon: "slit" },
];
// Superposition mode has its own, shorter tool row: walls, slits and pulses
// would break the "合成 = 波源1 + 波源2" picture this mode is about.
const superpositionTools: Array<{ tool: Tool; label: string; icon: IconName }> = [
  { tool: "placeSource1", label: "波源1を動かす", icon: "source" },
  { tool: "placeSource2", label: "波源2を動かす", icon: "source" },
  { tool: "observer", label: "観測点", icon: "observer" },
  { tool: "section", label: "断面", icon: "section" },
];
const superpositionViews: Array<{ view: SuperpositionView; label: string }> = [
  { view: "sum", label: "合成" },
  { view: 0, label: "波源1だけ" },
  { view: 1, label: "波源2だけ" },
];
const slitWidths = [12, 24, 36, 48];

const statusLabels: Record<SimulationStatus, string> = {
  loading: "計算を準備中",
  ready: "準備中",
  running: "再生中",
  paused: "一時停止中",
  error: "計算エラー",
};

export function App() {
  const [solverConfig] = useState<SolverConfig>(createPrototypeConfig);
  const controllerReference = useRef<SimulationController | null>(null);
  const boundaryCellsReference = useRef<Map<string, BoundaryCell>>(new Map());
  const sourceIdReference = useRef(1);
  const latestFrameReference = useRef<SimulationFrame | undefined>(undefined);
  const gridSizeReference = useRef<{ columns: number; rows: number } | undefined>(undefined);
  const pendingObservationSamplesReference = useRef<ObservationSample[]>([]);
  const [simulationStatus, setSimulationStatus] = useState<SimulationStatus>("loading");
  const [gridSize, setGridSize] = useState<{ columns: number; rows: number }>();
  const [errorMessage, setErrorMessage] = useState<string>();
  const [continuousSourceEnabled, setContinuousSourceEnabled] = useState(false);
  const [displayMode, setDisplayMode] = useState<"color" | "monochrome">("color");
  const [interactionMode, setInteractionMode] = useState<InteractionMode>("pulse");
  const [observer, setObserver] = useState<{ column: number; row: number }>();
  const [observationSamples, setObservationSamples] = useState<ObservationSample[]>([]);
  const [observationPanelOpen, setObservationPanelOpen] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<0.25 | 0.5 | 1 | 2>(1);
  const [performanceMeasurement, setPerformanceMeasurement] = useState<PerformanceMeasurement>();
  const [boundaryCells, setBoundaryCells] = useState<BoundaryCell[]>([]);
  const [continuousSources, setContinuousSources] = useState<ContinuousSourceConfig[]>([]);
  const [selectedSourceId, setSelectedSourceId] = useState<string>();
  const [slitWidthCells, setSlitWidthCells] = useState(24);
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const [sectionLine, setSectionLine] = useState<SectionLine>();
  const [movingSource, setMovingSource] = useState<MovingSourceConfig>();
  const [graphScale, setGraphScale] = useState<GraphScale>(defaultGraphScale);
  const [wavefrontsRequested, setWavefrontsRequested] = useState(false);
  const [superpositionActive, setSuperpositionActive] = useState(false);
  const [superpositionView, setSuperpositionView] = useState<SuperpositionView>("sum");
  const [dampingLevelId, setDampingLevelId] = useState<DampingLevelId>(defaultDampingLevelId);
  const cycleGraphScale = () => setGraphScale(nextGraphScale);
  const [sectionOrientation, setSectionOrientation] = useState<SectionOrientation>("horizontal");
  const [editHistory, setEditHistory] = useState(createEditHistory);
  const [diagnosticsOpen, setDiagnosticsOpen] = useState(false);
  const [viewportDiagnostic, setViewportDiagnostic] = useState(readViewportDiagnostic);
  const [renderFramesPerSecond, setRenderFramesPerSecond] = useState<number>();
  const [fieldHintRevision, setFieldHintRevision] = useState(0);
  const [experimentGalleryOpen, setExperimentGalleryOpen] = useState(false);

  useEffect(() => {
    const controller = new SimulationController(solverConfig, {
      onReady: () => setSimulationStatus("ready"),
      onFrame: (nextFrame) => {
        latestFrameReference.current = nextFrame;
        const currentGridSize = gridSizeReference.current;

        if (
          currentGridSize === undefined ||
          currentGridSize.columns !== nextFrame.columns ||
          currentGridSize.rows !== nextFrame.rows
        ) {
          const nextGridSize = { columns: nextFrame.columns, rows: nextFrame.rows };
          gridSizeReference.current = nextGridSize;
          setGridSize(nextGridSize);
        }
      },
      onObservationSample: (sample) => {
        pendingObservationSamplesReference.current.push(sample);
      },
      onPerformance: setPerformanceMeasurement,
      onError: (message) => {
        setErrorMessage(message);
        setSimulationStatus("error");
      },
    });
    controllerReference.current = controller;

    return () => {
      controller.dispose();
      controllerReference.current = null;
    };
  }, [solverConfig]);

  useEffect(() => {
    const timerId = window.setInterval(() => {
      if (pendingObservationSamplesReference.current.length === 0) {
        return;
      }

      const pendingSamples = pendingObservationSamplesReference.current;
      pendingObservationSamplesReference.current = [];
      setObservationSamples((samples) => [...samples, ...pendingSamples].slice(-180));
    }, 50);

    return () => window.clearInterval(timerId);
  }, []);


  useEffect(() => {
    const updateViewportDiagnostic = () => setViewportDiagnostic(readViewportDiagnostic());
    window.addEventListener("resize", updateViewportDiagnostic);
    window.addEventListener("orientationchange", updateViewportDiagnostic);

    return () => {
      window.removeEventListener("resize", updateViewportDiagnostic);
      window.removeEventListener("orientationchange", updateViewportDiagnostic);
    };
  }, []);

  const captureScene = (): SceneSnapshot => ({
    boundaryCells,
    continuousSources,
    continuousSourceEnabled,
    observer,
    sectionLine,
    movingSource,
    superposition: superpositionActive,
  });

  // Called immediately before a learner-visible placement change so that
  // "戻す" can restore the previous arrangement.
  const commitEdit = (mergeKey?: string) => {
    setEditHistory((history) => recordEdit(history, captureScene(), mergeKey));
  };

  const applyScene = (scene: SceneSnapshot) => {
    const controller = controllerReference.current;

    boundaryCellsReference.current = new Map(
      scene.boundaryCells.map((cell) => [`${cell.column}:${cell.row}`, cell]),
    );
    setBoundaryCells(scene.boundaryCells);
    controller?.setBoundaries(scene.boundaryCells);

    setContinuousSources(scene.continuousSources);
    controller?.setContinuousSources(scene.continuousSources);
    setContinuousSourceEnabled(scene.continuousSourceEnabled);
    controller?.setContinuousSource(scene.continuousSourceEnabled);

    if (!scene.continuousSources.some((source) => source.id === selectedSourceId)) {
      setSelectedSourceId(undefined);
    }

    if (scene.observer === undefined) {
      controller?.clearObserver();
      setObservationPanelOpen(false);
    } else if (
      observer === undefined ||
      observer.column !== scene.observer.column ||
      observer.row !== scene.observer.row
    ) {
      controller?.setObserver(scene.observer.column, scene.observer.row);
      pendingObservationSamplesReference.current = [];
      setObservationSamples([]);
    }

    setObserver(scene.observer);
    setSectionLine(scene.sectionLine);

    if (scene.movingSource !== movingSource) {
      controller?.setMovingSource(scene.movingSource);
      setMovingSource(scene.movingSource);
    }

    if (scene.sectionLine !== undefined) {
      setSectionOrientation(scene.sectionLine.orientation);
    }

    if (scene.superposition !== superpositionActive) {
      controller?.setSuperposition(scene.superposition);
      setSuperpositionActive(scene.superposition);
      setSuperpositionView("sum");

      if (!scene.superposition && (interactionMode === "placeSource1" || interactionMode === "placeSource2")) {
        setInteractionMode("sourceSelect");
      }
    }
  };

  const handleUndo = () => {
    const result = undoEdit(editHistory);

    if (result === undefined) {
      return;
    }

    setEditHistory(result.history);
    applyScene(result.snapshot);
  };

  const selectTool = (tool: Tool) => {
    setMoreMenuOpen(false);
    setInteractionMode(tool);
  };

  const keyboardHandlers = useRef({ undo: handleUndo, closeAll: () => {} });
  keyboardHandlers.current = {
    undo: handleUndo,
    closeAll: () => {
      setMoreMenuOpen(false);
      setExperimentGalleryOpen(false);
      setDiagnosticsOpen(false);
      setSelectedSourceId(undefined);
    },
  };

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;

      if (target?.tagName === "INPUT" || target?.tagName === "TEXTAREA") {
        return;
      }

      if ((event.ctrlKey || event.metaKey) && !event.shiftKey && event.key.toLowerCase() === "z") {
        event.preventDefault();
        keyboardHandlers.current.undo();
      } else if (event.key === "Escape") {
        keyboardHandlers.current.closeAll();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // The theoretical circles describe waves that travel straight from a source.
  // Walls reflect and block waves, so the overlay pauses while walls exist.
  const wavefrontsVisible = wavefrontsRequested && boundaryCells.length === 0;

  useEffect(() => {
    controllerReference.current?.setWavefronts(wavefrontsVisible);
  }, [wavefrontsVisible]);

  useEffect(() => {
    controllerReference.current?.setDamping(dampingPerSecondFor(dampingLevelId));
  }, [dampingLevelId]);

  const handlePlayPause = () => {
    if (simulationStatus === "running") {
      controllerReference.current?.pause();
      setSimulationStatus("paused");
      return;
    }

    controllerReference.current?.start();
    setSimulationStatus("running");
  };

  const handleReset = () => {
    commitEdit();
    setMoreMenuOpen(false);
    controllerReference.current?.reset();
    boundaryCellsReference.current = new Map();
    setBoundaryCells([]);
    setContinuousSources([]);
    setSelectedSourceId(undefined);
    setContinuousSourceEnabled(false);
    setObserver(undefined);
    setSectionLine(undefined);
    setMovingSource(undefined);
    setSuperpositionActive(false);
    setSuperpositionView("sum");
    pendingObservationSamplesReference.current = [];
    setObservationSamples([]);
    setObservationPanelOpen(false);
    setPerformanceMeasurement(undefined);
    setRenderFramesPerSecond(undefined);
    setExperimentGalleryOpen(false);
    setInteractionMode("pulse");
    setSimulationStatus("ready");
  };

  const handleBoundaryReset = () => {
    commitEdit();
    boundaryCellsReference.current = new Map();
    setBoundaryCells([]);
    controllerReference.current?.setBoundaries([]);
  };

  const handleStep = () => {
    controllerReference.current?.step();
    setSimulationStatus("paused");
  };

  const handleContinuousSource = () => {
    if (continuousSources.length === 0) {
      setInteractionMode("source");
      return;
    }

    commitEdit();
    const nextEnabled = !continuousSourceEnabled;
    controllerReference.current?.setContinuousSource(nextEnabled);
    setContinuousSourceEnabled(nextEnabled);

    if (nextEnabled && simulationStatus !== "running") {
      controllerReference.current?.start();
      setSimulationStatus("running");
    }
  };

  const handleFieldTap = (column: number, row: number) => {
    if (interactionMode === "observer") {
      commitEdit();
      controllerReference.current?.setObserver(column, row);
      setObserver({ column, row });
      setObservationSamples([]);
      setObservationPanelOpen(true);
      return;
    }

    if (interactionMode === "section") {
      commitEdit();
      setSectionLine({ orientation: sectionOrientation, column, row });
      return;
    }

    if (interactionMode === "placeSource1" || interactionMode === "placeSource2") {
      const sourceIndex = interactionMode === "placeSource1" ? 0 : 1;

      if (continuousSources[sourceIndex] === undefined) {
        return;
      }

      commitEdit();
      const nextSources = continuousSources.map((source, index) =>
        index === sourceIndex ? { ...source, column, row } : source,
      );
      setContinuousSources(nextSources);
      controllerReference.current?.setContinuousSources(nextSources);
      return;
    }

    if (interactionMode === "source" || interactionMode === "sourceSelect") {
      selectOrCreateContinuousSource(column, row, interactionMode === "source");
      return;
    }

    if (interactionMode === "slit") {
      if (gridSize === undefined) {
        return;
      }

      commitEdit();
      updateBoundaries(
        createSingleSlitBoundaryCells(gridSize.columns, gridSize.rows, column, row, slitWidthCells),
        false,
        false,
      );
      return;
    }

    controllerReference.current?.injectPulse(column, row, 4);

    if (simulationStatus !== "running") {
      controllerReference.current?.start();
      setSimulationStatus("running");
    }
  };

  const handleBoundaryStroke = (cells: BoundaryCell[], erase: boolean) => {
    commitEdit();
    updateBoundaries(cells, erase);
  };

  const selectOrCreateContinuousSource = (
    column: number,
    row: number,
    allowCreation: boolean,
  ) => {
    const resolution = resolveSourceTap(
      continuousSources,
      column,
      row,
      allowCreation,
    );

    if (resolution.type === "select") {
      setEditHistory(breakEditMerge);
      setSelectedSourceId(resolution.source.id);
      setObservationPanelOpen(false);
      return;
    }

    if (resolution.type === "ignore") {
      setFieldHintRevision((revision) => revision + 1);
      return;
    }

    commitEdit();
    const newSource: ContinuousSourceConfig = {
      id: `source-${sourceIdReference.current++}`,
      column,
      row,
      amplitude: 0.8,
      wavelengthCells: 24,
      phaseRadians: 0,
      enabled: true,
    };
    const nextSources = [...continuousSources, newSource];

    setContinuousSources(nextSources);
    // Creating a source should keep the field visible. Settings remain available
    // when the learner deliberately taps an existing source marker.
    setSelectedSourceId(undefined);
    setObservationPanelOpen(false);
    controllerReference.current?.setContinuousSources(nextSources);

    if (!continuousSourceEnabled) {
      setContinuousSourceEnabled(true);
      controllerReference.current?.setContinuousSource(true);
    }

    if (simulationStatus !== "running") {
      controllerReference.current?.start();
      setSimulationStatus("running");
    }
  };

  const updateContinuousSource = (updatedSource: ContinuousSourceConfig) => {
    // A slider drag sends many updates; merge them into one undo step.
    commitEdit(`source:${updatedSource.id}`);
    const nextSources = continuousSources.map((source) =>
      source.id === updatedSource.id ? updatedSource : source,
    );
    setContinuousSources(nextSources);
    controllerReference.current?.setContinuousSources(nextSources);
  };

  const deleteContinuousSource = (sourceId: string) => {
    commitEdit();
    const nextSources = continuousSources.filter((source) => source.id !== sourceId);
    setContinuousSources(nextSources);
    setSelectedSourceId(undefined);
    controllerReference.current?.setContinuousSources(nextSources);

    if (nextSources.length === 0) {
      setContinuousSourceEnabled(false);
      controllerReference.current?.setContinuousSource(false);
    }
  };

  const openExperimentGallery = () => {
    setMoreMenuOpen(false);
    setSelectedSourceId(undefined);
    setObservationPanelOpen(false);
    setExperimentGalleryOpen(true);
  };

  const applyExperimentPreset = (presetId: ExperimentPresetId) => {
    if (gridSize === undefined) {
      return;
    }

    commitEdit();
    const preset = createExperimentPreset(presetId, {
      columns: gridSize.columns,
      rows: gridSize.rows,
      visibleInsetCells: solverConfig.absorptionLayerCells,
    });

    controllerReference.current?.reset();
    boundaryCellsReference.current = new Map(
      preset.boundaryCells.map((cell) => [`${cell.column}:${cell.row}`, cell]),
    );
    setBoundaryCells(preset.boundaryCells);
    setContinuousSources(preset.sources);
    setSelectedSourceId(undefined);
    setContinuousSourceEnabled(preset.sources.length > 0);
    setObserver(undefined);
    setSectionLine(preset.sectionLine);

    if (preset.sectionLine !== undefined) {
      setSectionOrientation(preset.sectionLine.orientation);
    }

    setSuperpositionActive(preset.superposition === true);
    setSuperpositionView("sum");

    if (preset.superposition === true) {
      // The coloured crest/trough lines are the point of this mode.
      setWavefrontsRequested(true);
    }

    setMovingSource(undefined);
    pendingObservationSamplesReference.current = [];
    setObservationSamples([]);
    setObservationPanelOpen(false);
    setPerformanceMeasurement(undefined);
    setRenderFramesPerSecond(undefined);
    setPlaybackSpeed(1);
    setExperimentGalleryOpen(false);
    setInteractionMode(preset.interactionMode);
    setFieldHintRevision((revision) => revision + 1);

    controllerReference.current?.setBoundaries(preset.boundaryCells);
    controllerReference.current?.setContinuousSources(preset.sources);
    controllerReference.current?.setContinuousSource(preset.sources.length > 0);
    controllerReference.current?.setSpeed(1);

    if (preset.superposition === true) {
      controllerReference.current?.setSuperposition(true);
    }

    setMovingSource(preset.movingSource);
    controllerReference.current?.setMovingSource(preset.movingSource);

    if (preset.pulse !== undefined) {
      controllerReference.current?.injectPulse(
        preset.pulse.column,
        preset.pulse.row,
        preset.pulse.amplitude,
      );
    }

    controllerReference.current?.start();
    setSimulationStatus("running");
  };

  const updateBoundaries = (centers: BoundaryCell[], erase: boolean, expandStroke = true) => {
    const nextBoundaryCells = new Map(boundaryCellsReference.current);
    const offsets = expandStroke ? [-1, 0, 1] : [0];

    for (const center of centers) {
      for (const rowOffset of offsets) {
        for (const columnOffset of offsets) {
          const cell = {
            column: center.column + columnOffset,
            row: center.row + rowOffset,
          };
          const key = `${cell.column}:${cell.row}`;

          if (erase) {
            nextBoundaryCells.delete(key);
          } else {
            nextBoundaryCells.set(key, cell);
          }
        }
      }
    }

    boundaryCellsReference.current = nextBoundaryCells;
    const cells = [...nextBoundaryCells.values()];
    setBoundaryCells(cells);
    controllerReference.current?.setBoundaries(cells);
  };

  const handleSpeed = () => {
    const speeds: Array<0.25 | 0.5 | 1 | 2> = [0.25, 0.5, 1, 2];
    const currentIndex = speeds.indexOf(playbackSpeed);
    const nextSpeed = speeds[(currentIndex + 1) % speeds.length];
    controllerReference.current?.setSpeed(nextSpeed);
    setPlaybackSpeed(nextSpeed);
  };

  const isRunning = simulationStatus === "running";
  const controlsDisabled = simulationStatus === "loading" || simulationStatus === "error";
  const selectedSource = continuousSources.find((source) => source.id === selectedSourceId);

  const activeTool: Tool =
    interactionMode === "sourceSelect"
      ? "source"
      : interactionMode === "erase"
        ? "wall"
        : interactionMode;

  const changeMovingSourceSpeed = (speedRatio: number) => {
    if (movingSource === undefined || movingSource.speedRatio === speedRatio) {
      return;
    }

    commitEdit();
    const nextSource = { ...movingSource, speedRatio };
    setMovingSource(nextSource);
    // Keep the current position so changing speed does not teleport the source.
    controllerReference.current?.setMovingSource(nextSource, true);
  };

  const removeMovingSource = () => {
    commitEdit();
    setMovingSource(undefined);
    controllerReference.current?.setMovingSource(undefined);
  };

  // Leaving superposition mode keeps both sources as ordinary sources.
  const exitSuperposition = () => {
    commitEdit();
    controllerReference.current?.setSuperposition(false);
    setSuperpositionActive(false);
    setSuperpositionView("sum");
    setSelectedSourceId(undefined);
    setInteractionMode("sourceSelect");
  };

  const changeSectionOrientation = (orientation: SectionOrientation) => {
    setSectionOrientation(orientation);

    if (sectionLine !== undefined && sectionLine.orientation !== orientation) {
      commitEdit();
      setSectionLine({ ...sectionLine, orientation });
    }
  };
  const canUndo = editHistory.entries.length > 0;
  const visibleTools = superpositionActive ? superpositionTools : tools;
  const placedSourceIndex =
    interactionMode === "placeSource1" ? 0 : interactionMode === "placeSource2" ? 1 : undefined;
  const dampingLabel = dampingLevels.find((level) => level.id === dampingLevelId)?.label ?? "";
  const selectedSourceNumber =
    selectedSource === undefined ? 0 : continuousSources.indexOf(selectedSource) + 1;

  return (
    <main
      className={[
        "app-shell",
        selectedSource === undefined ? "" : "source-settings-open",
        observer === undefined ? "" : "has-observer",
        superpositionActive ? "superposition" : "",
      ].filter(Boolean).join(" ")}
    >
      <header className="app-header">
        <div className="title-row">
          <h1>Wave Lab</h1>
          <span className="version-label">v{appVersion}</span>
        </div>
        <div className="header-status">
          {performanceMeasurement === undefined ? null : (
            <p className="performance-label">
              {Math.round(performanceMeasurement.simulationStepsPerSecond)} step/s
            </p>
          )}
          <p className={`status status-${simulationStatus}`} aria-live="polite">
            {statusLabels[simulationStatus]}
          </p>
        </div>
      </header>

      <section className="experiment" aria-label="波の実験フィールド">
        <div className="field-container">
          <WaveCanvas
            frameReference={latestFrameReference}
            gridSize={gridSize}
            absorptionLayerCells={solverConfig.absorptionLayerCells}
            displayMode={displayMode}
            observer={observer}
            continuousSources={continuousSources}
            selectedSourceId={selectedSourceId}
            sectionLine={sectionLine}
            movingSourceActive={movingSource !== undefined}
            showWavefronts={wavefrontsVisible}
            superpositionView={superpositionActive ? superpositionView : undefined}
            boundaryCells={boundaryCells}
            interactionMode={interactionMode}
            onFieldTap={handleFieldTap}
            onBoundaryStroke={handleBoundaryStroke}
            onRenderFramesPerSecond={setRenderFramesPerSecond}
          />
          {superpositionActive ? (
            <div className="superposition-view-switch segmented" role="group" aria-label="表示する波">
              {superpositionViews.map(({ view, label }) => (
                <button
                  key={label}
                  type="button"
                  className={[
                    superpositionView === view ? "selected" : "",
                    view === "sum" ? "view-sum" : `view-tone-${view}`,
                  ].filter(Boolean).join(" ")}
                  aria-pressed={superpositionView === view}
                  onClick={() => setSuperpositionView(view)}
                >
                  {label}
                </button>
              ))}
            </div>
          ) : wavefrontsRequested ? (
            <p className="wavefront-legend">
              {wavefrontsVisible ? (
                <>
                  <span className="legend-solid" aria-hidden="true" /> 山
                  <span className="legend-dashed" aria-hidden="true" /> 谷
                  <small>波源からまっすぐ届く波（理論）</small>
                </>
              ) : (
                <small>壁があるので、波面の線はお休み中</small>
              )}
            </p>
          ) : null}
          <div
            className="color-legend"
            aria-label="青は低い変位、緑は基準の0、赤は高い変位"
          >
            <span>低い</span>
            <span className="legend-scale">
              <span className="legend-gradient" aria-hidden="true" />
              <small>基準 0</small>
            </span>
            <span>高い</span>
          </div>
        </div>
      </section>

      <div className="sheet-area">
        {observer === undefined &&
        selectedSource === undefined &&
        sectionLine === undefined &&
        movingSource === undefined &&
        !superpositionActive ? (
          <p className="sheet-placeholder">
            観測点を置くと、ここに波の高さのグラフが出ます。波源をタップすると、ここで設定できます。
          </p>
        ) : null}
        {!superpositionActive || selectedSource !== undefined ? null : (
          <SuperpositionPanel
            dampingLevelId={dampingLevelId}
            wavefrontsShown={wavefrontsRequested}
            onDampingChange={setDampingLevelId}
            onToggleWavefronts={() => setWavefrontsRequested((requested) => !requested)}
            onExit={exitSuperposition}
          />
        )}
        {observer === undefined || selectedSource !== undefined ? null : (
          <ObservationPanel
            open={observationPanelOpen}
            observer={observer}
            samples={observationSamples}
            graphScale={graphScale}
            onCycleGraphScale={cycleGraphScale}
            onToggle={() => setObservationPanelOpen((open) => !open)}
          />
        )}

        {movingSource === undefined || selectedSource !== undefined ? null : (
          <DopplerPanel
            frameReference={latestFrameReference}
            absorptionLayerCells={solverConfig.absorptionLayerCells}
            waveSpeedCellsPerSecond={solverConfig.waveSpeedCellsPerSecond}
            source={movingSource}
            speedRatios={dopplerSpeedRatios}
            graphScale={graphScale}
            onCycleGraphScale={cycleGraphScale}
            onSpeedChange={changeMovingSourceSpeed}
            onRemove={removeMovingSource}
          />
        )}

        {sectionLine === undefined || selectedSource !== undefined ? null : (
          <CrossSectionPanel
            frameReference={latestFrameReference}
            absorptionLayerCells={solverConfig.absorptionLayerCells}
            line={sectionLine}
            graphScale={graphScale}
            showComponents={superpositionActive}
            onCycleGraphScale={cycleGraphScale}
            onRemove={() => {
              commitEdit();
              setSectionLine(undefined);
            }}
          />
        )}

        {selectedSource === undefined || gridSize === undefined ? null : (
          <SourceSettingsPanel
            source={selectedSource}
            label={`波源 ${selectedSourceNumber}`}
            columns={gridSize.columns}
            rows={gridSize.rows}
            visibleInsetCells={solverConfig.absorptionLayerCells}
            waveSpeedCellsPerSecond={solverConfig.waveSpeedCellsPerSecond}
            onChange={updateContinuousSource}
            onDelete={superpositionActive ? undefined : deleteContinuousSource}
            onClose={() => {
              setSelectedSourceId(undefined);
              setEditHistory(breakEditMerge);
            }}
          />
        )}
      </div>

      <section className="tool-dock" aria-label="シミュレーション操作">
        <div className="context-bar">
          <h2 key={fieldHintRevision} className="mode-hint" id="experiment-title">
            {fieldTitleForMode(interactionMode)}
          </h2>
          <div className="context-actions">
            {placedSourceIndex !== undefined && continuousSources[placedSourceIndex] !== undefined ? (
              <button
                type="button"
                className="chip-control"
                onClick={() => setSelectedSourceId(continuousSources[placedSourceIndex].id)}
              >
                波源{placedSourceIndex + 1}の設定（波長・位相）
              </button>
            ) : null}
            {activeTool === "source" && continuousSources.length > 0 ? (
              <button type="button" className="chip-control" onClick={handleContinuousSource} disabled={controlsDisabled}>
                {continuousSourceEnabled ? "連続波を止める" : "連続波を出す"}
              </button>
            ) : null}
            {interactionMode === "sourceSelect" ? (
              <button type="button" className="chip-control" onClick={() => setInteractionMode("source")}>
                ＋ 追加する
              </button>
            ) : null}
            {activeTool === "observer" && observer !== undefined ? (
              <button type="button" className="chip-control" onClick={() => setObservationPanelOpen((open) => !open)}>
                {observationPanelOpen ? "グラフを閉じる" : "グラフを見る"}
              </button>
            ) : null}
            {activeTool === "slit" ? (
              <div className="segmented" role="group" aria-label="スリット幅">
                <span>幅</span>
                {slitWidths.map((width) => (
                  <button
                    key={width}
                    type="button"
                    className={slitWidthCells === width ? "selected" : ""}
                    aria-pressed={slitWidthCells === width}
                    onClick={() => setSlitWidthCells(width)}
                  >
                    {width}
                  </button>
                ))}
              </div>
            ) : null}
            {activeTool === "section" ? (
              <div className="segmented" role="group" aria-label="断面の向き">
                {(["horizontal", "vertical"] as SectionOrientation[]).map((orientation) => (
                  <button
                    key={orientation}
                    type="button"
                    className={sectionOrientation === orientation ? "selected" : ""}
                    aria-pressed={sectionOrientation === orientation}
                    onClick={() => changeSectionOrientation(orientation)}
                  >
                    {orientation === "horizontal" ? "横" : "縦"}
                  </button>
                ))}
              </div>
            ) : null}
            {activeTool === "wall" ? (
              <div className="segmented" role="group" aria-label="壁の描き方">
                <button
                  type="button"
                  className={interactionMode === "wall" ? "selected" : ""}
                  aria-pressed={interactionMode === "wall"}
                  onClick={() => setInteractionMode("wall")}
                >
                  描く
                </button>
                <button
                  type="button"
                  className={interactionMode === "erase" ? "selected" : ""}
                  aria-pressed={interactionMode === "erase"}
                  onClick={() => setInteractionMode("erase")}
                >
                  消す
                </button>
              </div>
            ) : null}
            {activeTool === "wall" && boundaryCells.length > 0 ? (
              <button type="button" className="chip-control danger-chip" onClick={handleBoundaryReset}>
                全部消す
              </button>
            ) : null}
          </div>
        </div>

        <nav className={superpositionActive ? "tool-row four" : "tool-row"} aria-label="道具">
          {visibleTools.map(({ tool, label, icon }) => (
            <button
              key={tool}
              type="button"
              className={[
                "tool-button",
                activeTool === tool ? "active" : "",
                tool === "placeSource1" ? "tone-0" : tool === "placeSource2" ? "tone-1" : "",
              ].filter(Boolean).join(" ")}
              aria-pressed={activeTool === tool}
              onClick={() => selectTool(tool)}
            >
              <Icon name={icon} />
              <span>
                {label}
                {tool === "source" && continuousSources.length > 0 ? ` ${continuousSources.length}` : ""}
              </span>
            </button>
          ))}
        </nav>

        <div className="action-row">
          <button type="button" className="action-button" onClick={openExperimentGallery} disabled={controlsDisabled}>
            <Icon name="gallery" />
            <span>実験</span>
          </button>
          <button
            type="button"
            className="action-button"
            onClick={handleUndo}
            disabled={!canUndo}
            title="置いたものを1つ前に戻す（Ctrl+Z）"
          >
            <Icon name="undo" />
            <span>戻す</span>
          </button>
          <button
            type="button"
            className="action-button play-button"
            onClick={handlePlayPause}
            disabled={controlsDisabled}
          >
            <Icon name={isRunning ? "pause" : "play"} />
            <span>{isRunning ? "一時停止" : "再生"}</span>
          </button>
          <button type="button" className="action-button" onClick={handleSpeed} disabled={controlsDisabled}>
            <strong className="speed-value">{playbackSpeed}×</strong>
            <span>速さ</span>
          </button>
          <button
            type="button"
            className={moreMenuOpen ? "action-button active" : "action-button"}
            aria-expanded={moreMenuOpen}
            onClick={() => setMoreMenuOpen((open) => !open)}
          >
            <Icon name="more" />
            <span>その他</span>
          </button>
        </div>

        {moreMenuOpen ? (
          <div className="more-menu" role="menu" aria-label="その他の操作">
            <button type="button" role="menuitem" onClick={handleStep} disabled={controlsDisabled || isRunning}>
              <Icon name="step" />
              一歩だけ進める
            </button>
            <button
              type="button"
              role="menuitem"
              aria-pressed={wavefrontsRequested}
              onClick={() => setWavefrontsRequested((requested) => !requested)}
            >
              <Icon name="pulse" />
              {wavefrontsRequested ? "波面の線を消す" : "波面の線（山＝実線・谷＝破線）"}
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={() => setDampingLevelId(nextDampingLevelId)}
            >
              <Icon name="pulse" />
              減衰：{dampingLabel}（押すと なし→弱→中→強）
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={() => setDisplayMode((mode) => (mode === "color" ? "monochrome" : "color"))}
            >
              <Icon name="gallery" />
              {displayMode === "color" ? "白黒で表示する" : "色で表示する"}
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setMoreMenuOpen(false);
                setDiagnosticsOpen(true);
              }}
            >
              <Icon name="observer" />
              端末・性能を見る
            </button>
            <button type="button" role="menuitem" className="danger-item" onClick={handleReset} disabled={controlsDisabled}>
              <Icon name="reset" />
              全部リセット（置いた物は「戻す」で戻せる）
            </button>
          </div>
        ) : null}
      </section>

      {diagnosticsOpen ? (
        <div className="modal-backdrop" onClick={() => setDiagnosticsOpen(false)}>
          <div onClick={(event) => event.stopPropagation()}>
            <DiagnosticsPanel
              open
              viewport={viewportDiagnostic}
              gridSize={gridSize}
              performanceMeasurement={performanceMeasurement}
              renderFramesPerSecond={renderFramesPerSecond}
              onClose={() => setDiagnosticsOpen(false)}
            />
          </div>
        </div>
      ) : null}
      {experimentGalleryOpen ? (
        <div className="modal-backdrop" onClick={() => setExperimentGalleryOpen(false)}>
          <div onClick={(event) => event.stopPropagation()}>
            <ExperimentGallery
              open
              presets={experimentPresets}
              onSelect={applyExperimentPreset}
              onClose={() => setExperimentGalleryOpen(false)}
            />
          </div>
        </div>
      ) : null}
      {errorMessage === undefined ? null : <p className="error-message">{errorMessage}</p>}
    </main>
  );
}

function fieldTitleForMode(mode: InteractionMode): string {
  switch (mode) {
    case "pulse":
      return "タップした所に波が起きる";
    case "observer":
      return "タップした所の波の高さを記録する";
    case "source":
      return "タップで波源を置く・波源をタップで設定";
    case "sourceSelect":
      return "波源をタップすると設定できる";
    case "wall":
      return "なぞって壁を描く";
    case "slit":
      return "タップした高さにすき間のある壁を置く";
    case "erase":
      return "なぞった所の壁を消す";
    case "section":
      return "タップした所を通る線で、波を横から見る";
    case "placeSource1":
      return "タップした所へ波源1を動かす";
    case "placeSource2":
      return "タップした所へ波源2を動かす";
  }
}

function readViewportDiagnostic(): ViewportDiagnostic {
  return {
    width: Math.round(window.innerWidth),
    height: Math.round(window.innerHeight),
    orientation: window.innerWidth >= window.innerHeight ? "landscape" : "portrait",
    androidDetected: /Android/i.test(navigator.userAgent),
  };
}

function createPrototypeConfig(): SolverConfig {
  // Match the grid's aspect ratio to the space the field actually gets, so the
  // field is not letterboxed. Short landscape screens put the controls in a
  // side column; other screens stack header, field and the bottom tool dock.
  // Keep in sync with the side-column media query in App.css.
  const sideLayout =
    window.innerWidth > window.innerHeight &&
    (window.innerHeight <= 560 || window.innerWidth >= 900);
  const availableWidth = sideLayout
    ? window.innerWidth - Math.min(360, window.innerWidth * 0.42)
    : window.innerWidth;
  const availableHeight = sideLayout
    ? window.innerHeight
    : Math.max(320, window.innerHeight - 220);
  const fieldAspectRatio = Math.max(0.55, Math.min(1.8, availableWidth / availableHeight));
  const targetCellCount = 192 * 192;
  const columns = Math.round(Math.sqrt(targetCellCount * fieldAspectRatio));
  const rows = Math.round(targetCellCount / columns);
  const minimumDimension = Math.min(columns, rows);

  return {
    columns,
    rows,
    waveSpeedCellsPerSecond: 1,
    cellSize: 1,
    timeStepSeconds: 0.5,
    dampingPerSecond: 0.005,
    absorptionLayerCells: Math.max(24, Math.round(minimumDimension * 0.18)),
    absorptionMaxDampingPerSecond: 1.5,
  };
}
