/**
 * Shared animation timings (ms / px) for the "publish → new post appears"
 * sequence. Imported by BOTH the real flow (/submit + PostList) and the
 * /dev animation playgrounds so they stay perfectly in sync. Tune here.
 */
export const ANIM = {
  // --- Submit page exit ---
  formOut: 250, // heading + form fade out
  previewHold: 220, // beat where only the preview is on screen
  previewOut: 500, // preview flies down and out
  previewFlyY: 320, // px the preview travels downward as it leaves

  // --- New-list entrance ---
  enterBeat: 220, // list shown WITHOUT the new post before it drops in
  enterMs: 480, // new post flies in from the top
  flipMs: 480, // existing posts slide down to make room
  enterFlyY: -36, // px the new post travels (negative = from above)
};
