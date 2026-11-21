// Inline line icons keep the toolbar recognizable without a dependency and
// render identically on Android, iOS and desktop (emoji glyphs do not).
export type IconName =
  | "pulse"
  | "source"
  | "observer"
  | "wall"
  | "slit"
  | "erase"
  | "undo"
  | "play"
  | "pause"
  | "step"
  | "gallery"
  | "more"
  | "reset"
  | "close";

const paths: Record<IconName, string> = {
  pulse: "M12 12m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0 M12 12m-6 0a6 6 0 1 0 12 0a6 6 0 1 0 -12 0 M12 12m-10 0a10 10 0 1 0 20 0a10 10 0 1 0 -20 0",
  source: "M12 12m-3 0a3 3 0 1 0 6 0a3 3 0 1 0 -6 0 M5.6 5.6a9 9 0 0 0 0 12.8 M18.4 5.6a9 9 0 0 1 0 12.8",
  observer: "M12 12m-5 0a5 5 0 1 0 10 0a5 5 0 1 0 -10 0 M12 2v5 M12 17v5 M2 12h5 M17 12h5",
  wall: "M4 20L20 4 M7 20L20 7 M4 17L17 4",
  slit: "M12 3v6 M12 15v6 M6 12h1 M17 12h1",
  erase: "M8 20h12 M5.5 14.5l8-8a2 2 0 0 1 2.8 0l2.2 2.2a2 2 0 0 1 0 2.8L11 19H8z",
  undo: "M9 14L4 9l5-5 M4 9h10a6 6 0 0 1 0 12h-3",
  play: "M7 4.5v15l12-7.5z",
  pause: "M8 5v14 M16 5v14",
  step: "M6 5v14l9-7z M18 5v14",
  gallery: "M4 4h7v7H4z M13 4h7v7h-7z M4 13h7v7H4z M13 13h7v7h-7z",
  more: "M5 12h.01 M12 12h.01 M19 12h.01",
  reset: "M4 12a8 8 0 1 0 2.4-5.7 M4 4v5h5",
  close: "M6 6l12 12 M18 6L6 18",
};

export function Icon({ name }: { name: IconName }) {
  const filled = name === "play" || name === "step";

  return (
    <svg
      className={`icon icon-${name}`}
      viewBox="0 0 24 24"
      aria-hidden="true"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth={name === "more" ? 3.5 : name === "slit" ? 3 : 2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={paths[name]} />
    </svg>
  );
}
