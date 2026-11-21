import type { GraphScale } from "./graphScale";

export function GraphScaleButton({ scale, onCycle }: { scale: GraphScale; onCycle: () => void }) {
  return (
    <button
      type="button"
      className="graph-scale-button"
      onClick={onCycle}
      aria-label={`縦軸の範囲 プラスマイナス${scale}。押すと切り替わる`}
    >
      縦軸 ±{scale}
    </button>
  );
}
