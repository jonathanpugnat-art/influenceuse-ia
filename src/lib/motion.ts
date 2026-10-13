/** Motion tokens — aligned with DESIGN.md / Emil CSS vars in globals.css */

export const easeOut = [0.23, 1, 0.32, 1] as const;
export const easeOutExpo = [0.16, 1, 0.3, 1] as const;
export const easeInOut = [0.77, 0, 0.175, 1] as const;

export const duration = {
  press: 0.15,
  ui: 0.2,
  enter: 0.25,
  panel: 0.28,
} as const;

export const enterTransition = {
  duration: duration.enter,
  ease: easeOut,
} as const;

export const panelTransition = {
  duration: duration.panel,
  ease: easeOut,
} as const;

/** Stagger between sibling entrances (30–80ms band). */
export const stagger = 0.05;

export function fadeUp(reduce: boolean | null) {
  return {
    hidden: {
      opacity: 0,
      transform: reduce ? "none" : "translateY(10px)",
    },
    show: {
      opacity: 1,
      transform: "translateY(0px)",
      transition: enterTransition,
    },
  } as const;
}

export function faceReveal(reduce: boolean | null) {
  return {
    hidden: {
      opacity: 0,
      transform: reduce ? "none" : "scale(0.97)",
    },
    show: {
      opacity: 1,
      transform: "scale(1)",
      transition: panelTransition,
    },
    exit: {
      opacity: 0,
      transform: reduce ? "none" : "scale(0.97)",
      transition: { duration: duration.ui, ease: easeOut },
    },
  } as const;
}

export function fadeOnly() {
  return {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { duration: duration.ui, ease: easeOut },
    },
    exit: {
      opacity: 0,
      transition: { duration: duration.ui, ease: easeOut },
    },
  } as const;
}
