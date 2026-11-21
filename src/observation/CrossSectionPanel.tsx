import { useEffect, useRef, type RefObject } from "react";
import { createVisibleDomain } from "../renderer/visibleDomain";
import type { SimulationFrame } from "../simulation/SimulationController";
import {
  createCrossSectionPoints,
  crossSectionAmplitudeScale,
  crossSectionGraphHeight,
  crossSectionGraphWidth,
  extractCrossSection,
  type SectionLine,
} from "./crossSection";

interface CrossSectionPanelProps {
  frameReference: RefObject<SimulationFrame | undefined>;
  absorptionLayerCells: number;
  line: SectionLine;
  onRemove: () => void;
}

export function CrossSectionPanel({
  frameReference,
  absorptionLayerCells,
  line,
  onRemove,
}: CrossSectionPanelProps) {
  const polylineReference = useRef<SVGPolylineElement>(null);

  useEffect(() => {
    let animationFrameId = 0;
    let lastFrame: SimulationFrame | undefined;

    // The graph follows the renderer's frame cadence. Updating the polyline
    // directly avoids re-rendering React on every simulation frame.
    const drawLatest = () => {
      const frame = frameReference.current;

      if (frame !== undefined && frame !== lastFrame && polylineReference.current !== null) {
        const domain = createVisibleDomain(frame, absorptionLayerCells);
        const values = extractCrossSection(frame.field, frame.columns, line, domain);
        polylineReference.current.setAttribute("points", createCrossSectionPoints(values));
        lastFrame = frame;
      }
    };
    const draw = () => {
      drawLatest();
      animationFrameId = requestAnimationFrame(draw);
    };

    // Draw at once so a new or undone line never shows the previous line's
    // shape, even while the simulation is paused.
    drawLatest();
    animationFrameId = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animationFrameId);
  }, [absorptionLayerCells, frameReference, line]);

  const horizontal = line.orientation === "horizontal";
  const centerY = crossSectionGraphHeight / 2;

  return (
    <aside className="cross-section-panel" aria-label="断面グラフ">
      <header>
        <div>
          <strong>断面グラフ（{horizontal ? "横の線" : "縦の線"}）</strong>
          <span>線にそった波の高さ。横から見た波の形</span>
        </div>
        <button type="button" onClick={onRemove}>線を消す</button>
      </header>
      <svg
        className="cross-section-graph"
        viewBox={`0 0 ${crossSectionGraphWidth} ${crossSectionGraphHeight}`}
        preserveAspectRatio="none"
        role="img"
        aria-label={`${horizontal ? "横" : "縦"}の線にそった波の高さ`}
      >
        <line x1="0" y1={centerY} x2={crossSectionGraphWidth} y2={centerY} className="waveform-zero" />
        <polyline ref={polylineReference} className="cross-section-line" points="" />
      </svg>
      <p className="cross-section-axis">
        <span>{horizontal ? "← 左はし" : "← 上はし"}</span>
        <span>縦軸は固定: -{crossSectionAmplitudeScale.toFixed(1)} ～ +{crossSectionAmplitudeScale.toFixed(1)}</span>
        <span>{horizontal ? "右はし →" : "下はし →"}</span>
      </p>
    </aside>
  );
}
