export type Swipe = "left" | "right" | "down";

/** How far a finger has to travel before a swipe counts, in CSS pixels. */
const SWIPE_PX = 60;

/**
 * A one-finger swipe in zoom at 100 %, from how far it travelled: left or right turns the image,
 * down closes zoom. The longer direction wins, so a slanted swipe still does one thing.
 */
export function swipeOf(dx: number, dy: number): Swipe | null {
  if (Math.abs(dx) >= Math.abs(dy)) {
    if (Math.abs(dx) <= SWIPE_PX) return null;
    return dx < 0 ? "left" : "right";
  }
  return dy > SWIPE_PX ? "down" : null;
}
