# UI/UX Guidelines

## 1. Primary principle

A new user should produce a visible wave within three seconds.

## 2. Interaction vocabulary

- Tap empty field: create a pulse in basic mode
- Long press: open source creation options
- Drag selected object: move it
- Tap object: select it
- Pinch: zoom where supported
- Two-finger drag or dedicated control: adjust 2.5D camera
- Swipe observation handle upward: open bottom sheet

Gestures must have visible alternatives for discoverability and accessibility.
Range controls inside a scrollable settings sheet must prefer vertical page
scrolling. A vertical touch gesture or cancelled touch restores the value from
the start of that gesture; horizontal drags and deliberate taps still edit it.

### Wave height color scale

- Positive displacement is red.
- Negative displacement is blue.
- Zero displacement is green, negative intermediate values pass through cyan,
  and positive intermediate values pass through yellow. This contour-plot
  vocabulary makes more of the continuous height range visible.
- Colors between the five reference stops are interpolated continuously because wave
  displacement is a continuous quantity. Discrete color bands must not imply
  physical steps that are absent from the model.

Continuous-source and observation markers are vector overlays. They remain
sharp when the low-resolution simulation grid is enlarged on a phone or PC.
Since 0.1.0-prototype.15 a source marker is a navy disc with a white rim and
its number; a white ring expands from enabled sources, and the source whose
settings are open has a yellow outer ring. Presets with more than four sources
(plane-wave rows) use small plain dots instead so the field is not crowded.
The observation point is an orange target that matches the graph line colour.
Markers do not rely on colour alone: numbers, shape and the ring carry meaning.

## 3. Modes

Avoid one overloaded toolbar.

Use explicit modes:

- Interact
- Add source
- Draw wall
- Add slit
- Place observer
- Erase

The active mode must remain clearly visible.

After applying a two-source preset, the field is selection-only: tapping an
existing source opens its settings, while tapping empty space does not create a
third source. Source creation remains available through **＋ 追加する** in the
context bar or by choosing the **波源** tool again.

The tool dock has three rows (since 0.1.0-prototype.14):

1. Context bar: a persistent one-line hint for the active tool plus only the
   controls that tool needs (slit width, continuous-wave toggle, clear walls,
   observation graph toggle). The hint briefly flashes when a tap is ignored.
2. Tool row: six icon + label tools (波を起こす, 波源, 観測点, 断面, 壁,
   スリット). The active tool is highlighted. Since 0.1.0-prototype.16 wall
   erasing is a 描く/消す switch inside the 壁 tool.
3. Action row: 実験 (gallery), 戻す (undo), 再生/一時停止, 速さ, その他
   (single step, monochrome, diagnostics, full reset).

戻す (undo, also Ctrl+Z) restores the previous placement of walls, sources and
the observation point. It does not rewind the wave field itself. Consecutive
slider changes on one source count as one undo step.

断面 (cross-section) draws a horizontal or vertical line through the tapped
cell and graphs the current displacement along it with the same fixed vertical
scale as the observation graph. It reads the solver's latest frame only; it
does not compute physics. Diagonal lines are intentionally not supported.

ドップラー効果 (gallery preset, since 0.1.0-prototype.17) moves one source along
the longer side of the field. Its panel offers four speeds (0.3, 0.6, 0.9 and
1.3 times the wave speed), a cross-section along the path with the source
position marked, and measured versus textbook wavelengths ahead and behind.

Every graph has a "縦軸 ±3" button that cycles the shared vertical range
through ±1, ±3, ±6 and ±12 (since 0.1.0-prototype.18).

その他 → 波面の線 draws theoretical crest (solid) and trough (dashed) circles
for waves that travel straight from continuous sources, with a legend chip at
the top of the field. It pauses, with a note, while walls exist (since
0.1.0-prototype.19).

実験 → 重ね合わせ（波源1＋波源2） opens a separate mode (since
0.1.0-prototype.20). A switch at the top of the field shows 合成 / 波源1だけ /
波源2だけ. Colours are fixed across the mode: 波源1 red, 波源2 blue, 合成
black. Crest/trough lines, source markers and the extra graph lines all use
them. The tool row is replaced by 波源1を動かす, 波源2を動かす, 観測点 and 断面;
walls, slits and pulses are not offered because they would break the
"合成 = 波源1 + 波源2" picture. 終わる keeps both sources as ordinary sources.

Damping (減衰 なし/弱/中/強) is in the superposition panel and in その他.

On stacked (portrait) layouts the sheet area is capped at 42dvh and scrolls,
so several panels never squeeze the wave field away.

Panels (observation results, Doppler, cross-section, source settings) sit between the field and the
tool dock. They never cover the field; the field shrinks to fit instead.
Escape closes open panels and menus.

## 4. Portrait layout

```text
Top bar
Simulation field
Observation / source-settings sheet (optional)
Context bar
Tool row
Action row
```

## 5. Landscape layout

```text
Top/side controls | Large simulation field | Optional observation panel
```

Rotation must not reset the experiment.

## 6. Color and accessibility

- Do not rely on red/blue distinction alone.
- Provide a monochrome or contour cue.
- Display a zero-displacement reference.
- Use sufficient text contrast.
- Respect reduced-motion preferences where practical.
- Avoid flashing patterns.

No final palette is approved at this stage.

## 7. Language

Use concrete terms first:

- “wave height” before “displacement”
- “top of the wave” and “bottom of the wave” before “crest” and “trough”
- “time for one cycle” before “period”

Scientific terms are introduced immediately after the intuitive explanation.

## 8. Parameter controls

Each parameter includes:

- Plain-language label
- Current value
- Safe range
- Reset action
- One-sentence explanation

Sliders must not permit unstable or meaningless solver configurations.

## 9. Observation panel

Three panel heights:

1. Peek: current displacement and mini graph
2. Half: full waveform and core values
3. Full: explanation, measurements, and notes

The panel must not obscure the selected observer without offering a way to pan the field.

## 10. Feedback

Every user action should produce immediate feedback:

- Source placement ripple
- Wall preview
- Invalid placement explanation
- Quality reduction notice
- Save confirmation

Haptic feedback may be optional and must never be required.
