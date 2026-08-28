/**
 * A physical damped-spring ease, as a plain `(progress) => progress` function
 * GSAP can use directly as an `ease`.
 *
 * Figma's named Smart Animate easing presets ("Gentle", "Quick", "Bouncy", …)
 * are real mass-spring-damper physics, not cubic-beziers — the Plugin API and
 * `get_motion_context` only ever expose the preset's *name*, never its
 * mass/stiffness/damping. Those constants can only be read from a raw
 * motion-timeline export (Figma's own JSON for a specific transition), which
 * is where the numbers here came from for "Gentle": `{ mass: 1, stiffness:
 * 100, damping: 15 }`.
 *
 * This solves the same closed-form ODE Figma's own renderer does — the
 * standard damped-harmonic-oscillator solution for a spring released from 0
 * and settling at 1 — so the curve (including the slight underdamped
 * overshoot "Gentle" actually has, at this damping ratio) matches rather than
 * approximates it.
 */
export function springEase(
  mass: number,
  stiffness: number,
  damping: number,
  durationSeconds: number,
): (progress: number) => number {
  const omega0 = Math.sqrt(stiffness / mass);
  const zeta = damping / (2 * Math.sqrt(stiffness * mass));

  const settle = (t: number): number => {
    if (t <= 0) return 0;
    if (zeta < 1) {
      // Underdamped: oscillates around 1 while decaying — the "spring" feel.
      const omegaD = omega0 * Math.sqrt(1 - zeta * zeta);
      const envelope = Math.exp(-zeta * omega0 * t);
      return 1 - envelope * (Math.cos(omegaD * t) + ((zeta * omega0) / omegaD) * Math.sin(omegaD * t));
    }
    if (zeta === 1) {
      // Critically damped: fastest settle with no overshoot.
      const envelope = Math.exp(-omega0 * t);
      return 1 - envelope * (1 + omega0 * t);
    }
    // Overdamped: slower, no overshoot.
    const omegaD = omega0 * Math.sqrt(zeta * zeta - 1);
    const envelope = Math.exp(-zeta * omega0 * t);
    return 1 - envelope * (Math.cosh(omegaD * t) + ((zeta * omega0) / omegaD) * Math.sinh(omegaD * t));
  };

  return (progress: number) => settle(progress * durationSeconds);
}
