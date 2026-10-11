/**
 * Transition lengths. Animations stay short (150 ms) and are switched off when Windows asks for
 * less motion ("Animation effects" off), since Svelte transitions don't follow the CSS media query.
 */
const reduced = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** `duration` in milliseconds, or 0 when reduced motion is on. */
export function ms(duration = 150): number {
  return reduced ? 0 : duration;
}
