import { useEffect, useRef, type RefObject } from "react";
import type { BoundaryCell } from "../physics/solver";
import type { SimulationFrame } from "../simulation/SimulationController";
import type { ContinuousSourceConfig } from "../simulation/types";
import type { SectionLine } from "../observation/crossSection";
import { writeDisplacementColors } from "./colorScale";
import { cellInVisibleDomain, createVisibleDomain } from "./visibleDomain";

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

// Superposition mode: which field to show (合成 = sum, 0 = 波源1, 1 = 波源2).
export type SuperpositionView = "sum" | 0 | 1;

interface WaveCanvasProps {
  frameReference: RefObject<SimulationFrame | undefined>;
  gridSize: { columns: number; rows: number } | undefined;
  absorptionLayerCells: number;
  displayMode: "color" | "monochrome";
  observer: { column: number; row: number } | undefined;
  continuousSources: ContinuousSourceConfig[];
  selectedSourceId?: string;
  sectionLine?: SectionLine;
  movingSourceActive?: boolean;
  showWavefronts?: boolean;
  superpositionView?: SuperpositionView;
  boundaryCells: BoundaryCell[];
  interactionMode: InteractionMode;
  onFieldTap: (column: number, row: number) => void;
  onBoundaryStroke: (cells: BoundaryCell[], erase: boolean) => void;
  onRenderFramesPerSecond: (framesPerSecond: number) => void;
}

export function WaveCanvas({
  frameReference,
  gridSize,
  absorptionLayerCells,
  displayMode,
  observer,
  continuousSources,
  selectedSourceId,
  sectionLine,
  movingSourceActive = false,
  showWavefronts = false,
  superpositionView,
  boundaryCells,
  interactionMode,
  onFieldTap,
  onBoundaryStroke,
  onRenderFramesPerSecond,
}: WaveCanvasProps) {
  const canvasReference = useRef<HTMLCanvasElement>(null);
  const movingMarkerReference = useRef<SVGGElement>(null);
  const wavefrontLayerReference = useRef<SVGGElement>(null);
  const previousPointerCell = useRef<BoundaryCell | null>(null);
  const strokeCells = useRef<BoundaryCell[]>([]);
  // Presets such as the single slit use a row of sources to approximate a
  // plane wave; numbered markers would crowd the field, so many sources are
  // drawn as small plain dots instead.
  const compactSources = continuousSources.length > 4;
  const sourceRadius = compactSources ? 2.6 : 3.6;
  const visibleDomain =
    gridSize === undefined ? undefined : createVisibleDomain(gridSize, absorptionLayerCells);

  useEffect(() => {
    const canvas = canvasReference.current;

    if (canvas === null) {
      return;
    }

    const context = canvas.getContext("2d", { alpha: false });

    if (context === null) {
      return;
    }

    let animationFrameId = 0;
    let lastRenderedFrame: SimulationFrame | undefined;
    let image: ImageData | undefined;
    let measurementStartedAt = performance.now();
    let renderedFrameCount = 0;

    const drawLatestFrame = () => {
      const frame = frameReference.current;

      if (frame !== undefined && frame !== lastRenderedFrame) {
        const domain = createVisibleDomain(frame, absorptionLayerCells);

        if (canvas.width !== domain.columns || canvas.height !== domain.rows) {
          canvas.width = domain.columns;
          canvas.height = domain.rows;
          image = context.createImageData(frame.columns, frame.rows);
        } else if (image === undefined) {
          image = context.createImageData(frame.columns, frame.rows);
        }

        const shownField =
          typeof superpositionView === "number" && frame.components !== undefined
            ? frame.components[superpositionView]
            : frame.field;
        writeDisplacementColors(image.data, shownField, displayMode);
        context.putImageData(image, -domain.left, -domain.top);
        context.fillStyle = "#1e293b";

        for (const cell of boundaryCells) {
          context.fillRect(cell.column - domain.left, cell.row - domain.top, 1, 1);
        }

        // The moving source's position comes with each frame from the Worker,
        // so the marker is moved here rather than through React state.
        if (frame.movingSourcePosition !== undefined && movingMarkerReference.current !== null) {
          movingMarkerReference.current.setAttribute(
            "transform",
            `translate(${frame.movingSourcePosition.column + 0.5} ${frame.movingSourcePosition.row + 0.5})`,
          );
        }

        // Theoretical wavefront circles arrive with each frame. Writing the
        // markup directly keeps dozens of circles cheap at frame rate.
        if (wavefrontLayerReference.current !== null) {
          // The circles are drawn in grid units (no non-scaling-stroke, which
          // would distort pathLength-based dashes), so pass the size of one
          // screen pixel in grid units to keep line widths in pixels.
          const overlayWidth =
            wavefrontLayerReference.current.ownerSVGElement?.getBoundingClientRect().width ?? 0;

          if (overlayWidth > 0) {
            wavefrontLayerReference.current.style.setProperty(
              "--wavefront-pixel",
              (domain.columns / overlayWidth).toFixed(4),
            );
          }

          wavefrontLayerReference.current.innerHTML = (frame.wavefronts ?? [])
            .filter(
              (circle) =>
                typeof superpositionView !== "number" || circle.sourceIndex === superpositionView,
            )
            .map((circle) => {
              const geometry = `cx="${(circle.column + 0.5).toFixed(2)}" cy="${(circle.row + 0.5).toFixed(2)}" r="${circle.radius.toFixed(2)}"${circle.crest ? "" : ` pathLength="${troughPathLength(circle.radius)}"`}`;
              const kind = circle.crest ? "wavefront-crest" : "wavefront-trough";

              if (superpositionView === undefined) {
                return `<circle class="${kind}" ${geometry} />`;
              }

              // Coloured per source; a white halo keeps the line readable on
              // top of the coloured field.
              return `<circle class="${kind} wavefront-halo" ${geometry} /><circle class="${kind} wavefront-tone-${circle.sourceIndex}" ${geometry} />`;
            })
            .join("");
        }

        lastRenderedFrame = frame;
        renderedFrameCount += 1;
        const now = performance.now();

        if (now - measurementStartedAt >= 1000) {
          onRenderFramesPerSecond(
            Math.round((renderedFrameCount * 1000) / (now - measurementStartedAt)),
          );
          measurementStartedAt = now;
          renderedFrameCount = 0;
        }
      }

      animationFrameId = requestAnimationFrame(drawLatestFrame);
    };

    animationFrameId = requestAnimationFrame(drawLatestFrame);

    return () => cancelAnimationFrame(animationFrameId);
  }, [
    absorptionLayerCells,
    boundaryCells,
    displayMode,
    frameReference,
    onRenderFramesPerSecond,
    superpositionView,
  ]);

  const handlePointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const cell = cellFromPointer(event, visibleDomain);

    if (cell === undefined) {
      return;
    }

    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);

    if (interactionMode === "wall" || interactionMode === "erase") {
      previousPointerCell.current = cell;
      strokeCells.current = [cell];
      drawStrokePreview(
        event.currentTarget,
        [cell],
        interactionMode === "erase",
        visibleDomain,
      );
      return;
    }

    onFieldTap(cell.column, cell.row);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (previousPointerCell.current === null) {
      return;
    }

    event.preventDefault();
    const cell = cellFromPointer(event, visibleDomain);

    if (cell === undefined || sameCell(cell, previousPointerCell.current)) {
      return;
    }

    const segment = rasterizeLine(previousPointerCell.current, cell);
    strokeCells.current.push(...segment.slice(1));
    previousPointerCell.current = cell;
    drawStrokePreview(event.currentTarget, segment, interactionMode === "erase", visibleDomain);
  };

  const handlePointerUp = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (previousPointerCell.current !== null) {
      const uniqueCells = new Map(strokeCells.current.map((cell) => [`${cell.column}:${cell.row}`, cell]));
      onBoundaryStroke([...uniqueCells.values()], interactionMode === "erase");
    }

    previousPointerCell.current = null;
    strokeCells.current = [];

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  return (
    <div className="wave-canvas-viewport">
      <div
        className="wave-field-layer"
        style={{
          aspectRatio:
            visibleDomain === undefined ? "4 / 5" : `${visibleDomain.columns} / ${visibleDomain.rows}`,
        }}
      >
        <canvas
          ref={canvasReference}
          className="wave-canvas"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          aria-label={fieldLabel(interactionMode)}
        />
        {visibleDomain === undefined ? null : (
          <svg
            className="field-marker-overlay"
            viewBox={`${visibleDomain.left} ${visibleDomain.top} ${visibleDomain.columns} ${visibleDomain.rows}`}
            aria-hidden="true"
          >
            {showWavefronts ? <g ref={wavefrontLayerReference} className="wavefront-layer" /> : null}
            {sectionLine === undefined ? null : (
              <g className="section-line">
                {sectionLine.orientation === "horizontal" ? (
                  <>
                    <line
                      className="section-line-shadow"
                      x1={visibleDomain.left}
                      x2={visibleDomain.left + visibleDomain.columns}
                      y1={sectionLine.row + 0.5}
                      y2={sectionLine.row + 0.5}
                    />
                    <line
                      className="section-line-main"
                      x1={visibleDomain.left}
                      x2={visibleDomain.left + visibleDomain.columns}
                      y1={sectionLine.row + 0.5}
                      y2={sectionLine.row + 0.5}
                    />
                  </>
                ) : (
                  <>
                    <line
                      className="section-line-shadow"
                      x1={sectionLine.column + 0.5}
                      x2={sectionLine.column + 0.5}
                      y1={visibleDomain.top}
                      y2={visibleDomain.top + visibleDomain.rows}
                    />
                    <line
                      className="section-line-main"
                      x1={sectionLine.column + 0.5}
                      x2={sectionLine.column + 0.5}
                      y1={visibleDomain.top}
                      y2={visibleDomain.top + visibleDomain.rows}
                    />
                  </>
                )}
              </g>
            )}
            {/* Marker sizes are in grid cells so they scale with the field;
                strokes use non-scaling-stroke to stay crisp at any zoom. */}
            {continuousSources.map((source, index) => (
              <g
                key={source.id}
                className={[
                  "source-marker",
                  compactSources ? "compact" : "",
                  source.enabled ? "" : "disabled",
                  source.id === selectedSourceId ? "selected" : "",
                  superpositionView !== undefined && index < 2 ? `source-tone-${index}` : "",
                  typeof superpositionView === "number" && superpositionView !== index ? "dimmed" : "",
                ].filter(Boolean).join(" ")}
                transform={`translate(${source.column + 0.5} ${source.row + 0.5})`}
              >
                {source.enabled && !compactSources ? (
                  <circle className="source-marker-ripple" r={sourceRadius} />
                ) : null}
                {source.id === selectedSourceId ? (
                  <circle className="source-marker-selection" r={sourceRadius + 2.6} />
                ) : null}
                <circle className="source-marker-dot" r={sourceRadius} />
                {compactSources ? null : (
                  <text className="source-marker-label" textAnchor="middle" dominantBaseline="central">
                    {index + 1}
                  </text>
                )}
              </g>
            ))}
            {movingSourceActive ? (
              <g ref={movingMarkerReference} className="source-marker moving" transform="translate(-100 -100)">
                <circle className="source-marker-ripple" r="3.6" />
                <circle className="source-marker-dot" r="3.6" />
              </g>
            ) : null}
            {observer === undefined ? null : (
              <g
                className="observer-marker"
                transform={`translate(${observer.column + 0.5} ${observer.row + 0.5})`}
              >
                <circle className="observer-marker-halo" r="4" />
                <circle className="observer-marker-ring" r="4" />
                <path
                  className="observer-marker-ticks"
                  d="M 0 -7 V -5 M 0 5 V 7 M -7 0 H -5 M 5 0 H 7"
                />
                <circle className="observer-marker-center" r="1"  />
              </g>
            )}
          </svg>
        )}
      </div>
    </div>
  );
}

// A dashed circle that grows with a fixed dash length makes its dashes slide
// around the circle, which looks like spinning. Instead the dash pattern is
// tied to the circle itself with pathLength: the CSS dash pattern "1 1" then
// means a fixed number of dashes at fixed angles. The count doubles as the
// circle grows (every old dash splits in two), so dashes keep a similar size
// and never rotate.
export function troughDashCount(radiusCells: number): number {
  const targetPeriodCells = 6;
  const ideal = (2 * Math.PI * Math.max(radiusCells, 1)) / targetPeriodCells;
  return Math.max(8, 2 ** Math.round(Math.log2(ideal)));
}

function troughPathLength(radiusCells: number): number {
  return troughDashCount(radiusCells) * 2;
}

function drawStrokePreview(
  canvas: HTMLCanvasElement,
  cells: BoundaryCell[],
  erase: boolean,
  visibleDomain: ReturnType<typeof createVisibleDomain> | undefined,
): void {
  const context = canvas.getContext("2d", { alpha: false });

  if (context === null || visibleDomain === undefined) {
    return;
  }

  context.fillStyle = erase ? "#ef4444" : "#1e293b";

  for (const cell of cells) {
    context.fillRect(
      cell.column - visibleDomain.left - 1,
      cell.row - visibleDomain.top - 1,
      3,
      3,
    );
  }
}

function cellFromPointer(
  event: React.PointerEvent<HTMLCanvasElement>,
  visibleDomain: ReturnType<typeof createVisibleDomain> | undefined,
): BoundaryCell | undefined {
  if (visibleDomain === undefined) {
    return undefined;
  }

  const bounds = event.currentTarget.getBoundingClientRect();

  return cellInVisibleDomain(
    visibleDomain,
    (event.clientX - bounds.left) / bounds.width,
    (event.clientY - bounds.top) / bounds.height,
  );
}

function rasterizeLine(from: BoundaryCell, to: BoundaryCell): BoundaryCell[] {
  const cells: BoundaryCell[] = [];
  const columnDistance = Math.abs(to.column - from.column);
  const rowDistance = Math.abs(to.row - from.row);
  const columnDirection = from.column < to.column ? 1 : -1;
  const rowDirection = from.row < to.row ? 1 : -1;
  let error = columnDistance - rowDistance;
  let column = from.column;
  let row = from.row;

  while (true) {
    cells.push({ column, row });

    if (column === to.column && row === to.row) {
      return cells;
    }

    const doubledError = error * 2;

    if (doubledError > -rowDistance) {
      error -= rowDistance;
      column += columnDirection;
    }

    if (doubledError < columnDistance) {
      error += columnDistance;
      row += rowDirection;
    }
  }
}

function sameCell(left: BoundaryCell, right: BoundaryCell): boolean {
  return left.column === right.column && left.row === right.row;
}

function fieldLabel(mode: InteractionMode): string {
  switch (mode) {
    case "pulse":
      return "波の実験フィールド。タップして波を起こします。";
    case "observer":
      return "波の実験フィールド。タップして観測点を置きます。";
    case "source":
      return "波の実験フィールド。タップして連続波源を追加または選択します。";
    case "sourceSelect":
      return "波の実験フィールド。既存の連続波源をタップすると設定を開きます。";
    case "wall":
      return "波の実験フィールド。ドラッグして壁を描きます。";
    case "slit":
      return "波の実験フィールド。タップして単スリットを置きます。";
    case "erase":
      return "波の実験フィールド。ドラッグして壁を消します。";
    case "section":
      return "波の実験フィールド。タップした所を通る断面の線を引きます。";
    case "placeSource1":
      return "波の実験フィールド。タップした所へ波源1を動かします。";
    case "placeSource2":
      return "波の実験フィールド。タップした所へ波源2を動かします。";
  }
}
