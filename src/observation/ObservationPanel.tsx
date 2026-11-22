import type { ObservationSample } from "../simulation/SimulationController";
import { GraphScaleButton } from "./GraphScaleButton";
import type { GraphScale } from "./graphScale";
import { createWaveformPoints, waveformTimeWindowSeconds } from "./waveformPoints";

interface ObservationPanelProps {
  open: boolean;
  observer: { column: number; row: number } | undefined;
  samples: ObservationSample[];
  graphScale: GraphScale;
  onCycleGraphScale: () => void;
  onToggle: () => void;
}

export function ObservationPanel({
  open,
  observer,
  samples,
  graphScale,
  onCycleGraphScale,
  onToggle,
}: ObservationPanelProps) {
  const latestSample = samples.at(-1);
  const waveformPoints = createWaveformPoints(samples, undefined, graphScale);
  // Superposition mode: 波源1 (red) and 波源2 (blue) under the sum (black).
  const hasComponents = latestSample?.components !== undefined;
  const componentPoints = hasComponents
    ? ([0, 1] as const).map((part) =>
        createWaveformPoints(
          samples.filter((sample) => sample.components !== undefined),
          undefined,
          graphScale,
          (sample) => sample.components?.[part] ?? 0,
        ),
      )
    : undefined;

  return (
    <aside className={open ? "observation-panel open" : "observation-panel"} aria-label="観測結果">
      <button type="button" className="observation-handle" onClick={onToggle} disabled={observer === undefined}>
        <span>観測結果</span>
        <span>{open ? "閉じる" : "開く"}</span>
      </button>
      {observer === undefined ? (
        <p className="observation-empty">「観測点」を選び、フィールドをタップしてください</p>
      ) : (
        <div className="observation-content">
          <div className="observation-values">
            <p>
              <span>{hasComponents ? "合成の高さ" : "現在の波の高さ"}</span>
              <strong>{latestSample?.displacement.toFixed(3) ?? "0.000"}</strong>
            </p>
            {latestSample?.components === undefined ? null : (
              <p className="component-values">
                <span>内訳 1＋2</span>
                <strong>
                  <em className="tone-0">{latestSample.components[0].toFixed(2)}</em>
                  {" ＋ "}
                  <em className="tone-1">{latestSample.components[1].toFixed(2)}</em>
                </strong>
              </p>
            )}
            <p>
              <span>シミュレーション時間</span>
              <strong>{latestSample?.simulationTimeSeconds.toFixed(1) ?? "0.0"}</strong>
            </p>
          </div>
          <div className="graph-frame">
            <svg className="waveform-graph" viewBox="0 0 320 96" role="img" aria-label="観測点で測った波の高さの時間変化">
              <line x1="0" y1="48" x2="320" y2="48" className="waveform-zero" />
              {componentPoints?.map((points, part) => (
                <polyline key={part} points={points} className={`component-line tone-${part}`} />
              ))}
              <polyline
                points={waveformPoints}
                className={hasComponents ? "waveform-line sum-line" : "waveform-line"}
              />
            </svg>
            <GraphScaleButton scale={graphScale} onCycle={onCycleGraphScale} />
          </div>
          <p className="measurement-note">
            横軸は時間（左から右へ進む・横幅いっぱいで {waveformTimeWindowSeconds}）。縦軸は -{graphScale} ～ +{graphScale}
          </p>
        </div>
      )}
    </aside>
  );
}
