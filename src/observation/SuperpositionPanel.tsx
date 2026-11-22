import { dampingLevels, type DampingLevelId } from "../physics/damping";

interface SuperpositionPanelProps {
  dampingLevelId: DampingLevelId;
  wavefrontsShown: boolean;
  onDampingChange: (id: DampingLevelId) => void;
  onToggleWavefronts: () => void;
  onExit: () => void;
}

// Controls for superposition mode. The graphs themselves are the ordinary
// cross-section and observation panels, which add the 波源1/波源2 lines here.
export function SuperpositionPanel({
  dampingLevelId,
  wavefrontsShown,
  onDampingChange,
  onToggleWavefronts,
  onExit,
}: SuperpositionPanelProps) {
  return (
    <aside className="superposition-panel" aria-label="重ね合わせモード">
      <header>
        <div>
          <strong>重ね合わせモード</strong>
          <span className="superposition-key">
            <i className="key-swatch tone-0" aria-hidden="true" />波源1
            <i className="key-swatch tone-1" aria-hidden="true" />波源2
            <i className="key-swatch sum" aria-hidden="true" />合成（＝波源1＋波源2）
          </span>
        </div>
        <button type="button" onClick={onExit}>
          終わる
        </button>
      </header>
      <div className="superposition-controls">
        <div className="segmented" role="group" aria-label="減衰（波が進むほど弱まる量）">
          <span>減衰</span>
          {dampingLevels.map((level) => (
            <button
              key={level.id}
              type="button"
              className={level.id === dampingLevelId ? "selected" : ""}
              aria-pressed={level.id === dampingLevelId}
              onClick={() => onDampingChange(level.id)}
            >
              {level.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          className={wavefrontsShown ? "chip-control active" : "chip-control"}
          aria-pressed={wavefrontsShown}
          onClick={onToggleWavefronts}
        >
          山・谷の線 {wavefrontsShown ? "ON" : "OFF"}
        </button>
      </div>
    </aside>
  );
}
