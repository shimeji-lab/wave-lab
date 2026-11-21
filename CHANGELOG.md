# Changelog

All notable project changes will be documented here.

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
