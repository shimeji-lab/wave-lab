import { useEffect, useRef, type RefObject } from "react";
import {
  theoreticalDopplerWavelengths,
  type MovingSourceConfig,
} from "../physics/movingSource";
import { createVisibleDomain } from "../renderer/visibleDomain";
import type { SimulationFrame } from "../simulation/SimulationController";
import {
  createCrossSectionPoints,
  crossSectionGraphHeight,
  crossSectionGraphWidth,
  extractCrossSection,
} from "./crossSection";
import { measureWavelength } from "./wavelengthMeasurement";

interface DopplerPanelProps {
  frameReference: RefObject<SimulationFrame | undefined>;
  absorptionLayerCells: number;
  waveSpeedCellsPerSecond: number;
  source: MovingSourceConfig;
  speedRatios: readonly number[];
  onSpeedChange: (speedRatio: number) => void;
  onRemove: () => void;
}

// Cells skipped next to the source: the source kernel itself is not a wave.
const nearSourceGapCells = 12;
const measurementIntervalMilliseconds = 400;

export function DopplerPanel({
  frameReference,
  absorptionLayerCells,
  waveSpeedCellsPerSecond,
  source,
  speedRatios,
  onSpeedChange,
  onRemove,
}: DopplerPanelProps) {
  const lineReference = useRef<SVGPolylineElement>(null);
  const markerReference = useRef<SVGLineElement>(null);
  const frontReference = useRef<HTMLElement>(null);
  const behindReference = useRef<HTMLElement>(null);
  const theory = theoreticalDopplerWavelengths(source.wavelengthCells, source.speedRatio);
  const supersonic = source.speedRatio >= 1;

  useEffect(() => {
    let animationFrameId = 0;
    let lastFrame: SimulationFrame | undefined;
    let lastMeasuredAt = 0;

    // Graph and readouts follow the renderer's frame cadence and are written
    // straight to the DOM so React does not re-render on every frame.
    const draw = (now: number) => {
      const frame = frameReference.current;
      const position = frame?.movingSourcePosition;

      if (frame !== undefined && position !== undefined && frame !== lastFrame) {
        lastFrame = frame;
        const domain = createVisibleDomain(frame, absorptionLayerCells);
        const horizontal = source.axis === "horizontal";
        const values = extractCrossSection(
          frame.field,
          frame.columns,
          horizontal
            ? { orientation: "horizontal", column: 0, row: source.lane }
            : { orientation: "vertical", column: source.lane, row: 0 },
          domain,
        );
        const sourceIndex = horizontal ? position.column - domain.left : position.row - domain.top;
        lineReference.current?.setAttribute("points", createCrossSectionPoints(values));

        const markerX = values.length > 1 ? (sourceIndex / (values.length - 1)) * crossSectionGraphWidth : 0;
        markerReference.current?.setAttribute("x1", markerX.toFixed(1));
        markerReference.current?.setAttribute("x2", markerX.toFixed(1));

        if (now - lastMeasuredAt >= measurementIntervalMilliseconds) {
          lastMeasuredAt = now;
          // Measure only where waves from the current run have arrived; older
          // waves (from before a wrap or speed change) would mix in.
          const since = frame.movingSourceSecondsSinceRestart ?? 0;
          const frontReach = Math.max(0, (1 - source.speedRatio) * waveSpeedCellsPerSecond * since);
          const behindReach = (1 + source.speedRatio) * waveSpeedCellsPerSecond * since;
          const front = measureWavelength(
            values,
            sourceIndex + nearSourceGapCells,
            Math.min(values.length - 4, sourceIndex + frontReach),
          );
          const behind = measureWavelength(
            values,
            Math.max(3, sourceIndex - behindReach),
            sourceIndex - nearSourceGapCells,
          );
          writeMeasurement(
            frontReference.current,
            front,
            source.speedRatio >= 1 ? "波がない" : "いまは測れない",
          );
          writeMeasurement(behindReference.current, behind, "いまは測れない");
        }
      }

      animationFrameId = requestAnimationFrame(draw);
    };

    animationFrameId = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animationFrameId);
  }, [absorptionLayerCells, frameReference, source, waveSpeedCellsPerSecond]);

  const centerY = crossSectionGraphHeight / 2;

  return (
    <aside className="doppler-panel" aria-label="ドップラー効果の観察">
      <header>
        <div>
          <strong>ドップラー効果</strong>
          <span>波源は同じリズムでゆれながら進んでいる（もとの波長 {source.wavelengthCells} セル）</span>
        </div>
        <button type="button" onClick={onRemove}>終わる</button>
      </header>

      <div className="doppler-speed">
        <span>波源の速さ（波の速さの何倍）</span>
        <div className="segmented" role="group" aria-label="波源の速さ">
          {speedRatios.map((ratio) => (
            <button
              key={ratio}
              type="button"
              className={source.speedRatio === ratio ? "selected" : ""}
              aria-pressed={source.speedRatio === ratio}
              onClick={() => onSpeedChange(ratio)}
            >
              {ratio}倍
            </button>
          ))}
        </div>
      </div>

      <svg
        className="cross-section-graph"
        viewBox={`0 0 ${crossSectionGraphWidth} ${crossSectionGraphHeight}`}
        preserveAspectRatio="none"
        role="img"
        aria-label="波源が進む線にそった波の高さ"
      >
        <line x1="0" y1={centerY} x2={crossSectionGraphWidth} y2={centerY} className="waveform-zero" />
        <polyline ref={lineReference} className="cross-section-line" points="" />
        <line ref={markerReference} y1="0" y2={crossSectionGraphHeight} className="doppler-source-marker" />
      </svg>
      <p className="cross-section-axis">
        <span>← 後ろ</span>
        <span>縦の線が波源の位置</span>
        <span>進む向き（前） →</span>
      </p>

      <div className="doppler-readout">
        <p>
          <span>前の波長</span>
          <strong ref={frontReference}>測定中…</strong>
          <small>
            {supersonic
              ? "波より速いので、前には波が届かない（V字の衝撃波）"
              : `理論: ${theory.front?.toFixed(1)} セル（短い → 高い音）`}
          </small>
        </p>
        <p>
          <span>後ろの波長</span>
          <strong ref={behindReference}>測定中…</strong>
          <small>理論: {theory.behind.toFixed(1)} セル（長い → 低い音）</small>
        </p>
      </div>
      <p className="measurement-note">
        測定値は、線にそった波が0を下から上に横切る間隔の平均。理論は「もとの波長 ×（1 ∓ 波源の速さ ÷ 波の速さ）」。
      </p>
    </aside>
  );
}

function writeMeasurement(
  element: HTMLElement | null,
  wavelength: number | undefined,
  missingLabel: string,
): void {
  if (element !== null) {
    element.textContent = wavelength === undefined ? missingLabel : `${wavelength.toFixed(1)} セル`;
  }
}
