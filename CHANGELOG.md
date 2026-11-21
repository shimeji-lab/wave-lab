# Changelog

All notable project changes will be documented here.

## 0.1.0-prototype.14（2026-11-21）

### 追加

- 「戻す」ボタン（PCでは Ctrl+Z）。置いた波源・壁・スリット・観測点を1つ前の状態に戻せる。スライダーを続けて動かした分は1回で戻る。全部リセットも「戻す」で取り消せる。広がっている波そのものは戻らない。
- Esc キーで、開いているパネルやメニューを閉じられるようにした。

### 変更

- 下の操作エリアを3段に整理した。
  - 1段目：いまの道具の説明と、その道具でだけ使うボタン（スリット幅、連続波の出す/止める、壁を全部消す、グラフを見る）
  - 2段目：アイコン付きの6つの道具（波を起こす・波源・観測点・壁・スリット・壁を消す）
  - 3段目：実験・戻す・再生/一時停止・速さ・その他
- 再生と一時停止を、いつでも押せる大きな緑のボタンにした（これまでは「再生」タブの中にあった）。
- 操作エリアや観測結果・波源の設定パネルが、波の画面に重ならないようにした（画面の方が縮んで、全体が見えたままになる）。
- 実験一覧と端末・性能のパネルは、背景を暗くして中央下に出し、外側をタップしても閉じられるようにした。
- 波源の設定パネルの名前を「波源 1 の設定」のように分かりやすくした。
- 色の凡例（低い・高い）に明るい背景をつけて読みやすくした。
- スマホ横向きでは、操作エリアを右側にまとめるようにした。
- 全体の色づかいとボタンの形を見直した。

## 0.1.0-prototype.13（2026-11-21）

### 変更

- 観測グラフの横軸（時間）を一定の幅に固定した。これまではスタート直後に時間軸が縮んでいくように見えていたが、今は線が左から右へ一定の速さで伸び、横幅いっぱいになったら左へ流れていく。
- 観測グラフの下に、横軸が時間であることと横幅が表す時間（270）の説明を加えた。

## Unreleased

### Added

- Interactive React, TypeScript, Vite, and Worker prototype
- Tap pulses and multiple positioned continuous sources
- Observation point with fixed-scale waveform history
- Editable reflecting walls and a single-slit experiment tool
- Playback speed and Worker performance display

### Changed

- Reduced uniform interior damping while retaining the absorbing outer sponge
- Batched wall drawing and erasing into complete pointer strokes
- Reset now clears waves, walls, sources, and the observer

### Foundation

- Initial project charter
- v0.1 product requirements
- Provisional architecture
- Physics-engine design and validation policy
- UI/UX and lesson-design guidance
- Development and AI contribution rules
- GitHub issue and pull-request templates
