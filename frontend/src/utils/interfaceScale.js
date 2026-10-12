export const INTERFACE_SCALE_VALUES = [
  0.925,
  1,
  1.075,
  1.15,
  1.225,
  1.3,
  1.375,
];


export const INTERFACE_SCALE_LABELS = [
  80,
  87,
  94,
  100,
  107,
  113,
  120,
];


export const DEFAULT_INTERFACE_SCALE_LEVEL =
  3;


export function getInterfaceScale(
  level,
) {
  return (
    INTERFACE_SCALE_VALUES[
      level
    ] ??
    INTERFACE_SCALE_VALUES[
      DEFAULT_INTERFACE_SCALE_LEVEL
    ]
  );
}


export function getInterfaceScaleLabel(
  level,
) {
  return (
    INTERFACE_SCALE_LABELS[
      level
    ] ??
    INTERFACE_SCALE_LABELS[
      DEFAULT_INTERFACE_SCALE_LEVEL
    ]
  );
}


export function applyInterfaceScale(
  level,
) {
  const scale =
    getInterfaceScale(
      level,
    );

  document.documentElement.style.setProperty(
    "--font-scale",
    String(scale),
  );
}