/**
 * "Personal Achivements & Desk Diaries" (landscape variant) geometry —
 * Figma node 3:29079.
 *
 * A different composition from `src/scenes/achievements`: a 1920x1080 landscape
 * plate — a painting backdrop with one black-bordered window cut into it. Figma
 * shows that window as a checkerboard, its own convention for "this fill is
 * missing/transparent", and `get_motion_context` reports no animated nodes here.
 * Together that means the window is not Figma content to reproduce; it is where a
 * real-time video feed gets composited in at playback, downstream of this app.
 *
 * So this scene renders the backdrop and the frame exactly as designed, and
 * exposes the window as a data-driven slot — the same role `photoUrl` already
 * plays for every other scene in this codebase — rather than baking in Figma's
 * placeholder swatch as if it were real content.
 *
 * All numbers below are Figma's own values (from `get_design_context`), not
 * measured off a screenshot.
 */

export const CANVAS = { w: 1920, h: 1080 } as const;

/** The cut-out window: a photo or live-video feed shows through here. */
export const WINDOW = { x: 146, y: 126, w: 466.063, h: 828.556 } as const;

/** Border Figma reports on the window frame — solid, square-cornered, black. */
export const WINDOW_BORDER = { width: 15, color: '#000000' } as const;

export const BACKGROUND = '/assets/photo-frame/painting-birmingham.jpg';
